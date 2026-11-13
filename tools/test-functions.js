/* Pruebas del backend dedicado (sin dependencias ni emuladores).
 *
 *   node tools/test-functions.js
 *
 * Comprueba la lógica pura que usa functions/index.js: validación del
 * récord, aviso al jugador superado, IDs deterministas y validación de los
 * avisos administrativos. El despliegue real se prueba con los emuladores.
 */
'use strict';

const assert = require('assert');
const fn = require('../functions/notifications');

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

function eq(a, b, name) {
  ok(a === b, name, JSON.stringify(a) + ' !== ' + JSON.stringify(b));
}

console.log('\nBackend · aviso de récord superado');

const before = { uid: 'uidViejo', name: 'Viejo', kills: 12, at: 1000 };
const after = { uid: 'uidNuevo', name: 'Nuevo', kills: 20, at: 2000 };

const rec = fn.buildRecordNotification(before, after, 111);
ok(!!rec, 'un récord superior genera aviso');
eq(rec.targetUid, 'uidViejo', 'el aviso va al jugador anterior');
eq(rec.payload.type, 'record', 'el tipo es record');
eq(rec.payload.from, 'uidNuevo', 'el autor es quien rompió el récord');
eq(rec.payload.fromName, 'Nuevo', 'se guarda el nombre del autor');
eq(rec.payload.record, 20, 'se guarda la nueva puntuación');
ok(rec.payload.body.indexOf('20') !== -1 && rec.payload.body.indexOf('12') !== -1,
  'el cuerpo indica la marca nueva y la anterior');
ok(rec.payload.title.length >= 1 && rec.payload.title.length <= 64, 'el título respeta el límite');
ok(rec.payload.body.length <= 160, 'el cuerpo respeta el límite');
ok(/^[A-Za-z0-9_-]+$/.test(rec.notificationId), 'el ID es válido para RTDB');
eq(fn.buildRecordNotification(before, after, 9999).notificationId, rec.notificationId,
  'el ID es determinista ante reintentos (no duplica)');
eq(fn.buildRecordNotification(before, after, 9999).targetUid, rec.targetUid,
  'el destino no depende del reloj del servidor');

ok(fn.buildRecordNotification(before, { uid: 'uidViejo', name: 'Viejo', kills: 20, at: 2000 }) === null,
  'no se avisa a uno mismo');
ok(fn.buildRecordNotification(before, { uid: 'uidNuevo', name: 'Nuevo', kills: 12, at: 2000 }) === null,
  'una marca igual no genera aviso');
ok(fn.buildRecordNotification(before, { uid: 'uidNuevo', name: 'Nuevo', kills: 11, at: 2000 }) === null,
  'una marca menor no genera aviso');
ok(fn.buildRecordNotification(null, after) === null, 'el primer récord no genera aviso');
ok(fn.buildRecordNotification({ uid: 'x/y', kills: 1 }, after) === null,
  'un UID anterior inválido no genera aviso');
ok(fn.buildRecordNotification(before, { uid: 'uidNuevo', name: 'Nuevo', kills: 20, at: 0 }) === null,
  'un récord sin fecha válida no genera aviso');
ok(fn.buildRecordNotification(before, { uid: 'uidNuevo', name: 'Nuevo', kills: 20000, at: 2000 }) === null,
  'un récord fuera de rango no genera aviso');

const clean = fn.buildRecordNotification(
  { uid: 'uidViejo', kills: 1 },
  { uid: 'uidNuevo', name: '  N\nuevo  ', kills: 2, at: 3000 }
);
eq(clean.payload.fromName, 'N uevo', 'el nombre se limpia y recorta');
ok(clean.payload.body.length <= 160, 'el cuerpo nunca supera 160 caracteres');

console.log('\nBackend · aviso administrativo');

const actor = { uid: 'adminUid', name: 'Operador' };
const admin = fn.buildAdminNotification(
  { uid: 'destinoUid', title: '  Aviso   importante ', body: 'Hola\njugador', type: 'info' },
  actor,
  5000
);
eq(admin.targetUid, 'destinoUid', 'el destino es el UID indicado');
eq(admin.payload.type, 'info', 'se respeta un tipo permitido');
eq(admin.payload.title, 'Aviso importante', 'el título se normaliza');
eq(admin.payload.body, 'Hola jugador', 'el cuerpo se normaliza');
eq(admin.payload.from, 'adminUid', 'el emisor es el operador autenticado');
eq(admin.payload.fromName, 'Operador', 'se usa el nombre del operador');
eq(admin.payload.record, 0, 'un aviso admin no lleva récord');
eq(admin.payload.read, false, 'nace como no leído');
eq(admin.payload.at, 5000, 'se usa la marca del servidor');

const byDefault = fn.buildAdminNotification({ uid: 'destinoUid', title: 'Hola', type: 'record' }, actor, 6000);
eq(byDefault.payload.type, 'admin', 'el tipo record no se puede inyectar desde el panel');
eq(byDefault.payload.body, 'Aviso del equipo', 'el cuerpo vacío usa el texto por defecto');

const longName = fn.buildAdminNotification(
  { uid: 'destinoUid', title: 'Hola' },
  { uid: 'adminUid', name: 'x'.repeat(40) },
  1
);
eq(longName.payload.fromName.length, 16, 'el nombre del operador se recorta a 16');

[['uid con espacios', { uid: 'no valido', title: 'Hola' }, actor],
  ['UID con barra', { uid: 'a/b', title: 'Hola' }, actor],
  ['título vacío', { uid: 'destinoUid', title: '   ' }, actor],
  ['operador sin UID', { uid: 'destinoUid', title: 'Hola' }, { name: 'X' }]
].forEach(function (caseRow) {
  let threw = false;
  try { fn.buildAdminNotification(caseRow[1], caseRow[2], 1); } catch (e) { threw = true; }
  ok(threw, 'se rechaza ' + caseRow[0]);
});

ok(fn.validUid('abcDEF123_-'), 'un UID de Firebase es válido');
ok(!fn.validUid('a.b'), 'un UID con punto no es válido');
ok(!fn.validUid(''), 'un UID vacío no es válido');
ok(!fn.validUid(null), 'un UID nulo no es válido');

console.log('\n' + (failed === 0 ? 'OK' : 'FALLOS') + ': ' + passed + ' correctas, ' + failed + ' fallidas\n');
assert.strictEqual(failed, 0);
process.exit(failed === 0 ? 0 : 1);
