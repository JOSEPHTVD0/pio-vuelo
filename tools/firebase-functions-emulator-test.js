/* Prueba de integración del backend con los emuladores de Firebase.
 *
 *   npm run test:functions:emu
 *
 * Levanta Auth + Realtime Database + Functions y comprueba:
 *   · el trigger onKillRecord entrega el aviso en el buzón del jugador anterior
 *   · no avisa al primer récord ni al propio autor
 *   · el ID determinista evita duplicados
 *   · la callable rechaza llamadas sin sesión
 *   · un operador con claim admin puede enviar a otra cuenta
 *   · la auditoría se guarda en Firestore (si el emulador está activo)
 */
'use strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
process.env.FIREBASE_FIRESTORE_EMULATOR_HOST = process.env.FIREBASE_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');

const PROJECT = 'demo-pio-vuelo';
const DB_URL = process.env.FIREBASE_DATABASE_URL ||
  'http://127.0.0.1:9000?ns=' + PROJECT + '-default-rtdb';
const FUNCTIONS_BASE = 'http://127.0.0.1:5001/' + PROJECT + '/us-central1/';

const app = admin.initializeApp({ projectId: PROJECT, databaseURL: DB_URL }, 'functions-emulator-test');
const db = admin.database(app);
const auth = admin.auth(app);
const fsdb = admin.firestore(app);

let passed = 0;
let failed = 0;

function ok(cond, name, extra) {
  if (cond) {
    passed++;
    console.log('  OK  ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (extra ? ' -> ' + extra : ''));
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitFor(fn, timeoutMs, intervalMs) {
  const until = Date.now() + (timeoutMs || 30000);
  let last = null;
  while (Date.now() < until) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs || 400);
  }
  return last;
}

async function callable(name, data, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(FUNCTIONS_BASE + name, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ data: data || {} })
  });
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { status: res.status, body: body };
}

async function signIn(email, password) {
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
  });
  return res.json();
}

async function main() {
  const stamp = Date.now();
  const userA = 'userA_' + stamp;
  const userB = 'userB_' + stamp;
  const email = 'admin_' + stamp + '@example.com';
  const password = 'PioVuelo1234!';

  console.log('\nBackend · integración con emuladores');

  /* 1. Primer récord: no debe avisar a nadie. */
  await db.ref('records/kills').set({
    kills: 5, uid: userA, name: 'Anterior', at: stamp
  });
  await sleep(1800);
  const firstBox = await db.ref('notifications/' + userA).get();
  ok(!firstBox.exists(), 'el primer récord no genera aviso');

  /* 2. Récord superior de otro jugador: aviso al anterior. */
  await db.ref('records/kills').set({
    kills: 9, uid: userB, name: 'Nuevo', at: stamp + 1
  });
  const box = await waitFor(async function () {
    const snap = await db.ref('notifications/' + userA).get();
    return snap.exists() ? snap.val() : null;
  }, 30000);
  ok(!!box, 'el trigger entrega el aviso al jugador anterior');
  const list = box ? Object.keys(box).map(k => box[k]) : [];
  const record = list.find(n => n && n.type === 'record');
  ok(!!record, 'el aviso llega con tipo record');
  const expectedId = 'record_' + (stamp + 1) + '_9_' + userB;
  ok(!!box && !!box[expectedId], 'el ID del aviso es determinista (evita duplicados)',
    JSON.stringify(box ? Object.keys(box) : null));
  if (record) {
    ok(record.from === userB, 'el aviso indica quién rompió el récord');
    ok(record.fromName === 'Nuevo', 'el aviso incluye el nombre del autor');
    ok(record.record === 9, 'el aviso incluye la nueva puntuación');
    ok(String(record.body).indexOf('9') !== -1 && String(record.body).indexOf('5') !== -1,
      'el aviso menciona la marca nueva y la anterior');
    ok(record.read === false, 'el aviso nace como no leído');
  }
  const ownBox = await db.ref('notifications/' + userB).get();
  ok(!ownBox.exists(), 'el autor del récord no recibe un aviso para sí mismo');

  /* 3. La callable exige sesión. */
  const noAuth = await callable('sendAdminNotification', { uid: userA, title: 'Sin sesión' }, null);
  ok(noAuth.status === 401, 'la callable rechaza llamadas sin sesión', String(noAuth.status));

  /* 4. Operador sin claim admin: permiso denegado. */
  const plain = await auth.createUser({ email: 'plain_' + stamp + '@example.com', password: password });
  const plainLogin = await signIn(plain.email, password);
  const plainCall = await callable('sendAdminNotification',
    { uid: userA, title: 'Sin permisos' }, plainLogin.idToken);
  ok(plainCall.status === 403, 'un jugador sin claim admin no puede enviar avisos', String(plainCall.status));

  /* 5. Operador con claim admin: entrega real en otro buzón. */
  const operator = await auth.createUser({ email: email, password: password });
  await auth.setCustomUserClaims(operator.uid, { admin: true });
  const login = await signIn(email, password);
  ok(!!login.idToken, 'el operador obtiene un ID token real del emulador');

  const sent = await callable('sendAdminNotification', {
    uid: userA,
    title: 'Aviso del backend',
    body: 'Entrega real entre cuentas',
    type: 'admin'
  }, login.idToken);
  ok(sent.status === 200 && sent.body && sent.body.result && sent.body.result.ok === true,
    'el operador admin envía el aviso por la callable', JSON.stringify(sent.body));

  const adminNotice = await waitFor(async function () {
    const snap = await db.ref('notifications/' + userA).get();
    if (!snap.exists()) return null;
    const all = snap.val();
    return Object.keys(all).map(k => all[k]).find(n => n && n.type === 'admin' && n.title === 'Aviso del backend') || null;
  }, 15000);
  ok(!!adminNotice, 'el aviso administrativo llega al buzón destino');
  if (adminNotice) {
    ok(adminNotice.from === operator.uid, 'el aviso guarda el UID del operador');
    ok(adminNotice.body === 'Entrega real entre cuentas', 'el aviso conserva el mensaje');
  }

  /* 5b. Auditoría en Firestore. */
  const audit = await waitFor(async function () {
    const snap = await fsdb.collection('adminAudit')
      .where('adminUid', '==', operator.uid)
      .where('targetUid', '==', userA)
      .limit(1)
      .get();
    return snap.empty ? null : snap.docs[0].data();
  }, 15000);
  ok(!!audit, 'la auditoría del aviso se guarda en Firestore');
  if (audit) {
    ok(audit.action === 'notification' && audit.title === 'Aviso del backend',
      'la auditoría registra la acción y el título');
  }

  /* 6. Estado del operador. */
  const status = await callable('getAdminStatus', {}, login.idToken);
  ok(status.status === 200 && status.body && status.body.result && status.body.result.admin === true,
    'getAdminStatus confirma los permisos reales', JSON.stringify(status.body));

  /* 7. Un UID inválido se rechaza como argumento. */
  const invalid = await callable('sendAdminNotification', {
    uid: 'uid/con/barra', title: 'Inválido'
  }, login.idToken);
  ok(invalid.status === 400, 'un UID con barra se rechaza con invalid-argument', String(invalid.status));

  await auth.deleteUser(operator.uid).catch(function () { });
  await auth.deleteUser(plain.uid).catch(function () { });
  await db.ref('records/kills').remove().catch(function () { });
  await db.ref('notifications/' + userA).remove().catch(function () { });
  await db.ref('adminRate/' + operator.uid).remove().catch(function () { });
  const auditDocs = await fsdb.collection('adminAudit')
    .where('adminUid', '==', operator.uid).get().catch(function () { return null; });
  if (auditDocs && !auditDocs.empty) {
    const batch = fsdb.batch();
    auditDocs.docs.forEach(function (d) { batch.delete(d.ref); });
    await batch.commit().catch(function () { });
  }

  console.log('\n' + (failed === 0 ? 'OK' : 'FALLOS') + ': ' + passed + ' correctas, ' + failed + ' fallidas\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (err) {
  console.error('\nERROR: ' + ((err && err.stack) || err));
  process.exit(1);
});
