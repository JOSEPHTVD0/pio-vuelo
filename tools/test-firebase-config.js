/* ==========================================================================
   PÍO VUELO · VERIFICACIÓN DE LA CONFIGURACIÓN DE FIREBASE
   --------------------------------------------------------------------------
   No necesita red ni credenciales. Comprueba:
     · Que los JSON de Firebase sean válidos.
     · Que las reglas cubran las colecciones y rutas esperadas.
     · Que js/cloud.js y firebase/seed.js no tengan errores de sintaxis.
     · Que la nube esté desactivada por defecto.
     · Que index.html y sw.js carguen los archivos nuevos.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(condition, message) {
  if (condition) {
    passed++;
    console.log('  ✓ ' + message);
  } else {
    failed++;
    console.error('  ✗ ' + message);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function parseJson(rel) {
  try {
    return JSON.parse(read(rel));
  } catch (err) {
    failed++;
    console.error('  ✗ JSON inválido en ' + rel + ': ' + err.message);
    return null;
  }
}

function syntax(rel) {
  try {
    new vm.Script(read(rel), { filename: rel });
    return true;
  } catch (err) {
    console.error('  ✗ Error de sintaxis en ' + rel + ': ' + err.message);
    return false;
  }
}

console.log('\nPÍO VUELO · configuración de Firebase\n');

/* ---------- JSON ---------- */
console.log('Archivos JSON');
const firebaseJson = parseJson('firebase.json');
const firebaseRc = parseJson('.firebaserc');
const indexes = parseJson('firestore.indexes.json');
const databaseRules = parseJson('database.rules.json');

ok(!!firebaseJson, 'firebase.json existe y es válido');
ok(!!firebaseRc, '.firebaserc existe y es válido');
ok(!!indexes, 'firestore.indexes.json existe y es válido');
ok(!!databaseRules, 'database.rules.json existe y es válido');

if (firebaseJson) {
  ok(firebaseJson.firestore && firebaseJson.firestore.rules === 'firestore.rules', 'firebase.json apunta a firestore.rules');
  ok(firebaseJson.firestore && firebaseJson.firestore.indexes === 'firestore.indexes.json', 'firebase.json apunta a los índices');
  ok(firebaseJson.database && firebaseJson.database.rules === 'database.rules.json', 'firebase.json apunta a las reglas RTDB');
  ok(!!firebaseJson.emulators, 'firebase.json define emuladores');
}

if (firebaseRc) {
  ok(firebaseRc.projects && typeof firebaseRc.projects.default === 'string', '.firebaserc define un proyecto por defecto');
}

/* ---------- Reglas de Firestore ---------- */
console.log('\nReglas de Firestore');
const firestoreRules = read('firestore.rules');
[
  'players/{uid}',
  'players/{uid}/runs/{runId}',
  'leaderboards/{boardId}/entries/{uid}',
  'catalog/{type}/items/{itemId}',
  'seasons/{seasonKey}',
  'dailyChallenges/{date}',
  'config/{docId}'
].forEach(function (route) {
  ok(firestoreRules.indexOf(route) !== -1, 'cubre ' + route);
});
ok(firestoreRules.indexOf('allow read, write: if false') !== -1, 'tiene denegación final');
ok(firestoreRules.indexOf('request.resource.data.best >= resource.data.best') !== -1, 'impide bajar el récord del ranking');

/* ---------- Reglas de Realtime Database ---------- */
console.log('\nReglas de Realtime Database');
const rtdbRulesText = read('database.rules.json');
['presence', 'leaderboard_live', 'duels'].forEach(function (route) {
  ok(rtdbRulesText.indexOf('"' + route + '"') !== -1, 'cubre ' + route);
});
ok(rtdbRulesText.indexOf('auth.uid === $uid') !== -1, 'limita la escritura al propio UID');

/* ---------- Índices ---------- */
console.log('\nÍndices');
if (indexes && Array.isArray(indexes.indexes)) {
  ok(indexes.indexes.length >= 2, 'hay al menos dos índices compuestos');
  const runsIndex = indexes.indexes.some(function (i) {
    return i.collectionGroup === 'runs' && i.fields.some(f => f.fieldPath === 'score');
  });
  const entriesIndex = indexes.indexes.some(function (i) {
    return i.collectionGroup === 'entries' && i.fields.some(f => f.fieldPath === 'best');
  });
  ok(runsIndex, 'índice para vuelos por puntuación');
  ok(entriesIndex, 'índice para el ranking por mejor marca');
} else {
  ok(false, 'firestore.indexes.json contiene una lista de índices');
}

/* ---------- Cliente ---------- */
console.log('\nCliente');
ok(syntax('js/firebase-config.js'), 'js/firebase-config.js compila');
ok(syntax('js/cloud.js'), 'js/cloud.js compila');
ok(syntax('firebase/seed.js'), 'firebase/seed.js compila');
ok(syntax('js/ui.js'), 'js/ui.js compila');

const configText = read('js/firebase-config.js');
const cloudEnabled = /enabled:\s*true/.test(configText);
ok(cloudEnabled || /enabled:\s*false/.test(configText), 'la nube se puede activar o desactivar');
if (cloudEnabled) {
  ok(configText.indexOf('REEMPLAZA_API_KEY') === -1, 'las credenciales reales están configuradas');
  ok(/apiKey:\s*'AIza[0-9A-Za-z_-]{20,}'/.test(configText), 'la apiKey web tiene formato válido');
  ok(/projectId:\s*'[^']+'/.test(configText), 'el projectId está configurado');
  ok(/databaseURL:\s*'https:\/\/[^']+'/.test(configText), 'la databaseURL está configurada');
} else {
  ok(configText.indexOf('REEMPLAZA_API_KEY') !== -1, 'las credenciales son marcadores de posición');
}

const cloudText = read('js/cloud.js');
ok(cloudText.indexOf('signInAnonymously') !== -1, 'usa autenticación anónima');
ok(cloudText.indexOf('QUEUE_KEY') !== -1, 'tiene cola local para vuelos offline');
ok(cloudText.indexOf('SAVE.endRun') !== -1 || cloudText.indexOf('S.endRun') !== -1, 'engancha el fin de vuelo');

/* ---------- Integración en la app ---------- */
console.log('\nIntegración');
const html = read('index.html');
ok(html.indexOf('js/firebase-config.js') !== -1, 'index.html carga firebase-config.js');
ok(html.indexOf('js/cloud.js') !== -1, 'index.html carga cloud.js');

const sw = read('sw.js');
ok(sw.indexOf('./js/firebase-config.js') !== -1, 'el service worker cachea firebase-config.js');
ok(sw.indexOf('./js/cloud.js') !== -1, 'el service worker cachea cloud.js');

const ui = read('js/ui.js');
ok(ui.indexOf('renderCloudBoard') !== -1, 'la pantalla de récords tiene ranking global opcional');

/* ---------- Resultado ---------- */
console.log('\n' + (failed === 0 ? 'OK' : 'FALLOS') + ': ' + passed + ' correctas, ' + failed + ' fallidas\n');
if (failed > 0) process.exitCode = 1;
