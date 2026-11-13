/* ==========================================================================
   PÍO VUELO · BACKEND DEDICADO · LÓGICA DE NOTIFICACIONES
   --------------------------------------------------------------------------
   Este archivo no depende de firebase-functions ni de firebase-admin: solo
   valida y construye los datos. Así se puede probar con Node sin emuladores
   (tools/test-functions.js) y el código de despliegue queda muy pequeño.

   Reglas que se respetan aquí y en database.rules.json:
     · type: info | record | event | admin
     · title: 1..64 caracteres
     · body: 0..160 caracteres
     · from/fromName: UID y nombre del autor (máx. 16)
     · record: 0..10000
     · read: booleano
   ========================================================================== */
'use strict';

const LIMITS = Object.freeze({
  uid: 128,
  name: 16,
  title: 64,
  body: 160,
  kills: 10000,
  adminPerMinute: 30
});

const ADMIN_TYPES = Object.freeze(['info', 'event', 'admin']);
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/* Quita controles, colapsa espacios y recorta. Evita inyecciones de saltos
   de línea en títulos y cuerpos. */
function cleanText(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function validUid(value) {
  return typeof value === 'string' && UID_RE.test(value);
}

function toKills(value) {
  const n = Math.floor(Number(value));
  if (!isFinite(n) || n < 1 || n > LIMITS.kills) return 0;
  return n;
}

function toMillis(value) {
  const n = Math.floor(Number(value));
  if (!isFinite(n) || n <= 0) return 0;
  return n;
}

/* ID determinista: si Cloud Functions reintenta el evento, escribe el mismo
   nodo y el jugador no recibe el aviso dos veces. */
function recordNotificationId(record) {
  return 'record_' + toMillis(record && record.at) + '_' +
    toKills(record && record.kills) + '_' + String(record && record.uid);
}

/* Aviso al jugador cuyo récord acaba de ser superado.
   before = registro anterior en records/kills
   after  = registro nuevo en records/kills
   Devuelve null cuando no hay nada que avisar. */
function buildRecordNotification(before, after, now) {
  if (!after || typeof after !== 'object') return null;

  const uid = after.uid;
  const kills = toKills(after.kills);
  const at = toMillis(after.at);
  const name = cleanText(after.name, LIMITS.name);
  if (!validUid(uid) || !kills || !at || name.length < 2) return null;
  if (!before || typeof before !== 'object') return null;
  if (!validUid(before.uid) || before.uid === uid) return null;

  const previousKills = toKills(before.kills);
  if (!previousKills || kills <= previousKills) return null;

  const body = (name + ' ha logrado ' + kills + ' eliminaciones (tu récord era ' +
    previousKills + ').').slice(0, LIMITS.body);

  return {
    targetUid: before.uid,
    notificationId: recordNotificationId({ at: at, kills: kills, uid: uid }),
    payload: {
      type: 'record',
      title: '¡Te han superado el récord!',
      body: body,
      from: uid,
      fromName: name,
      record: kills,
      at: toMillis(now) || Date.now(),
      read: false
    }
  };
}

/* Aviso enviado desde el panel de administración a cualquier cuenta. */
function buildAdminNotification(input, actor, now) {
  const data = (input && typeof input === 'object') ? input : {};
  const targetUid = String(data.uid == null ? '' : data.uid).trim();
  if (!validUid(targetUid)) {
    throw new Error('El UID destino no es válido.');
  }

  const title = cleanText(data.title, LIMITS.title);
  if (!title) throw new Error('El título es obligatorio.');

  const body = cleanText(data.body, LIMITS.body) || 'Aviso del equipo';
  const requested = cleanText(data.type, 16).toLowerCase();
  const type = ADMIN_TYPES.indexOf(requested) !== -1 ? requested : 'admin';

  if (!actor || !validUid(actor.uid)) {
    throw new Error('El operador no tiene una sesión válida.');
  }
  const fromName = cleanText(actor.name, LIMITS.name) || 'Equipo';

  return {
    targetUid: targetUid,
    payload: {
      type: type,
      title: title,
      body: body,
      from: actor.uid,
      fromName: fromName,
      record: 0,
      at: toMillis(now) || Date.now(),
      read: false
    }
  };
}

module.exports = {
  LIMITS: LIMITS,
  ADMIN_TYPES: ADMIN_TYPES,
  cleanText: cleanText,
  validUid: validUid,
  toKills: toKills,
  toMillis: toMillis,
  recordNotificationId: recordNotificationId,
  buildRecordNotification: buildRecordNotification,
  buildAdminNotification: buildAdminNotification
};
