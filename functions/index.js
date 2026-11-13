/* ==========================================================================
   PÍO VUELO · BACKEND DEDICADO (FIREBASE CLOUD FUNCTIONS v2)
   --------------------------------------------------------------------------
   Dos piezas, ambas con privilegios de Admin SDK (ignoran las reglas de RTDB):

     1) onKillRecord
        Trigger sobre records/kills. Cuando otro jugador supera el récord
        mundial de eliminaciones, escribe el aviso en el buzón privado del
        jugador anterior. El ID es determinista para que un reintento no
        duplique la notificación.

     2) sendAdminNotification
        Función callable autenticada. Solo un operador con custom claim
        admin === true o documento Firestore admins/{uid} puede enviar un
        aviso a cualquier cuenta. Incluye límite de 30 avisos/minuto y
        auditoría en Firestore (adminAudit).

     3) getAdminStatus
        Consulta de solo lectura para que el panel muestre si el operador
        tiene permisos reales de backend.

   Requiere plan Blaze. El cliente actual sigue funcionando sin esto: la
   nube es opcional y las reglas nunca permiten escrituras cruzadas.
   ========================================================================== */
'use strict';

const { setGlobalOptions } = require('firebase-functions/v2');
const { onValueWritten } = require('firebase-functions/v2/database');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { getDatabaseWithUrl } = require('firebase-admin/database');

const {
  LIMITS,
  cleanText,
  buildRecordNotification,
  buildAdminNotification
} = require('./notifications');

const REGION = 'us-central1';

admin.initializeApp();

setGlobalOptions({
  region: REGION,
  maxInstances: 10,
  timeoutSeconds: 60
});

/* Instancias perezosas: en Cloud Functions la configuración del proyecto la
   inyecta el runtime (FIREBASE_CONFIG). Así el módulo también se puede
   cargar en local para revisar exports sin credenciales. */
let rtdbInstance = null;
let firestoreInstance = null;

/* En producción FIREBASE_CONFIG trae la databaseURL real. En el emulador el
   runtime apunta al espacio de nombres del projectId, pero el cliente local
   usa el sufijo -default-rtdb; usamos siempre ese nombre para que todos los
   procesos del emulador compartan la misma instancia. */
function databaseUrl() {
  const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  if (host) {
    const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-pio-vuelo';
    return 'http://' + host + '?ns=' + project + '-default-rtdb';
  }
  try {
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    if (cfg && cfg.databaseURL) return cfg.databaseURL;
  } catch (err) { /* configuración ausente o inválida */ }
  return undefined;
}

function rtdb() {
  if (!rtdbInstance) {
    const url = databaseUrl();
    rtdbInstance = url ? getDatabaseWithUrl(url) : admin.database();
  }
  return rtdbInstance;
}

function firestore() {
  if (!firestoreInstance) firestoreInstance = admin.firestore();
  return firestoreInstance;
}

/* ------------------------------------------------------------------ */
/* Autorización y límites                                              */
/* ------------------------------------------------------------------ */

async function isAdmin(uid, token) {
  if (!uid) return false;
  if (token && (token.admin === true || token.role === 'admin')) return true;
  try {
    const snap = await firestore().doc('admins/' + uid).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    return data.admin === true || data.role === 'admin';
  } catch (err) {
    logger.warn('No se pudo comprobar admins/' + uid, err);
    return false;
  }
}

async function operatorName(uid, token) {
  try {
    const snap = await firestore().doc('accounts/' + uid).get();
    const name = snap.exists ? cleanText(snap.get('username'), LIMITS.name) : '';
    if (name.length >= 2) return name;
  } catch (err) {
    logger.warn('No se pudo leer accounts/' + uid, err);
  }
  return cleanText((token && (token.name || token.displayName)) || 'Equipo', LIMITS.name) || 'Equipo';
}

/* Ventana deslizante de 60 s guardada en RTDB. El Admin SDK puede escribir
   en adminRate aunque las reglas del cliente lo nieguen. */
async function consumeRate(uid) {
  const now = Date.now();
  const res = await rtdb().ref('adminRate/' + uid).transaction(function (cur) {
    const list = (cur && Array.isArray(cur.at) ? cur.at : [])
      .map(Number)
      .filter(function (t) { return isFinite(t) && now - t < 60000; });
    if (list.length >= LIMITS.adminPerMinute) return; // aborta: límite alcanzado
    list.push(now);
    return { at: list, updatedAt: now };
  });
  return !!(res && res.committed);
}

/* ------------------------------------------------------------------ */
/* 1. Récord mundial superado                                          */
/* ------------------------------------------------------------------ */

exports.onKillRecord = onValueWritten({ ref: '/records/kills' }, async (event) => {
  const before = event.data && event.data.before ? event.data.before.val() : null;
  const after = event.data && event.data.after ? event.data.after.val() : null;
  const notice = buildRecordNotification(before, after);

  if (!notice) return;

  try {
    await rtdb().ref('notifications/' + notice.targetUid + '/' + notice.notificationId)
      .set(notice.payload);
    logger.info('Aviso de récord entregado', {
      targetUid: notice.targetUid,
      recordUid: notice.payload.from,
      kills: notice.payload.record
    });
  } catch (err) {
    logger.error('No se pudo entregar el aviso de récord', err);
    throw err;
  }
});

/* ------------------------------------------------------------------ */
/* 2. Aviso administrativo a cualquier cuenta                          */
/* ------------------------------------------------------------------ */

exports.sendAdminNotification = onCall({ invoker: 'public' }, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Inicia sesión para enviar avisos.');
  }
  if (!(await isAdmin(auth.uid, auth.token))) {
    throw new HttpsError('permission-denied',
      'Tu cuenta no tiene permisos de administrador en el backend.');
  }

  let notice;
  try {
    const name = await operatorName(auth.uid, auth.token);
    notice = buildAdminNotification(request.data, { uid: auth.uid, name: name });
  } catch (err) {
    throw new HttpsError('invalid-argument', (err && err.message) || 'Aviso no válido.');
  }

  if (!(await consumeRate(auth.uid))) {
    throw new HttpsError('resource-exhausted',
      'Has enviado demasiados avisos. Espera un minuto e inténtalo de nuevo.');
  }

  const ref = rtdb().ref('notifications/' + notice.targetUid).push();
  try {
    await ref.set(notice.payload);
  } catch (err) {
    logger.error('No se pudo escribir el aviso administrativo', err);
    throw new HttpsError('internal', 'No se pudo entregar el aviso.');
  }

  try {
    await firestore().collection('adminAudit').add({
      action: 'notification',
      adminUid: auth.uid,
      targetUid: notice.targetUid,
      title: notice.payload.title,
      notificationId: ref.key,
      at: FieldValue.serverTimestamp()
    });
  } catch (err) {
    /* La auditoría no debe impedir la entrega; queda en los logs. */
    logger.warn('No se pudo guardar la auditoría del aviso', err);
  }

  return {
    ok: true,
    backend: true,
    id: ref.key,
    targetUid: notice.targetUid,
    at: notice.payload.at
  };
});

/* ------------------------------------------------------------------ */
/* 3. Estado del operador para el panel                                */
/* ------------------------------------------------------------------ */

exports.getAdminStatus = onCall({ invoker: 'public' }, async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    return { ok: true, backend: true, authenticated: false, admin: false, uid: null };
  }
  return {
    ok: true,
    backend: true,
    authenticated: true,
    admin: await isAdmin(auth.uid, auth.token),
    uid: auth.uid
  };
});
