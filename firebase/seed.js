/* ==========================================================================
   PÍO VUELO · SEMILLA DE FIREBASE
   --------------------------------------------------------------------------
   Escribe en Firestore el catálogo del juego, la temporada actual, la
   semilla diaria y la configuración. Opcionalmente crea entradas de demo
   en el ranking (Firestore + Realtime Database).

   Uso:
     npm install
     npm run firebase:seed                 # proyecto real (service account)
     npm run firebase:seed:emulator        # emuladores locales
     npm run firebase:seed:demo            # añade 12 récords de ejemplo

   Credenciales (solo en tu máquina, nunca en el navegador):
     FIREBASE_SERVICE_ACCOUNT = ruta al JSON de la cuenta de servicio
     FIREBASE_PROJECT_ID      = id del proyecto (por defecto pio-vuelo)
     FIREBASE_DATABASE_URL    = https://<proyecto>-default-rtdb.firebaseio.com

   El Admin SDK ignora firestore.rules y database.rules.json, por eso este
   script puede escribir catálogo y temporadas que el cliente solo puede leer.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const admin = require('firebase-admin');

const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);
const USE_EMULATOR = ARGS.includes('--emulator') || !!process.env.FIRESTORE_EMULATOR_HOST;
const WITH_DEMO = ARGS.includes('--demo');
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'pio-vuelo';
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL ||
  (USE_EMULATOR ? 'http://127.0.0.1:9000?ns=' + PROJECT_ID : 'https://' + PROJECT_ID + '-default-rtdb.firebaseio.com');

/* ------------------------------------------------------------------ */
/* Catálogo: se lee el MISMO data.js que usa el juego                  */
/* ------------------------------------------------------------------ */

function loadCatalog() {
  const source = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'js/data.js' });
  if (!sandbox.window.DAT) throw new Error('No se pudo cargar window.DAT desde js/data.js');
  return sandbox.window.DAT;
}

/* Convierte a JSON puro: fuera funciones (check/metric) y undefined. */
function plain(value) {
  return JSON.parse(JSON.stringify(value, function (key, val) {
    return typeof val === 'function' ? undefined : val;
  }));
}

function todayStr(d) {
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function dateKey(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return todayStr(d);
}

/* Semilla estable por fecha (misma para todos los jugadores). */
function seedForDate(date) {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 2147483647;
}

/* ------------------------------------------------------------------ */
/* Firebase Admin                                                      */
/* ------------------------------------------------------------------ */

function initAdmin() {
  if (USE_EMULATOR) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
    admin.initializeApp({ projectId: PROJECT_ID, databaseURL: DATABASE_URL });
    return;
  }

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
    (ARGS.find(a => a.startsWith('--service-account=')) || '').split('=')[1];

  if (saPath) {
    const absolute = path.resolve(saPath);
    if (!fs.existsSync(absolute)) throw new Error('No existe la cuenta de servicio: ' + absolute);
    const credentials = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: credentials.project_id || PROJECT_ID,
      databaseURL: DATABASE_URL
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
    databaseURL: DATABASE_URL
  });
}

/* ------------------------------------------------------------------ */
/* Escritura por lotes                                                 */
/* ------------------------------------------------------------------ */

async function commitDocs(db, docs) {
  const CHUNK = 400;
  let written = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    docs.slice(i, i + CHUNK).forEach(function (entry) {
      batch.set(entry.ref, entry.data, { merge: true });
    });
    await batch.commit();
    written += Math.min(CHUNK, docs.length - i);
  }
  return written;
}

function catalogDocs(db, type, list) {
  return list.map(function (item) {
    return {
      ref: db.collection('catalog').doc(type).collection('items').doc(String(item.id)),
      data: Object.assign(plain(item), {
        type: type,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    };
  });
}

/* ------------------------------------------------------------------ */
/* Datos                                                               */
/* ------------------------------------------------------------------ */

function buildCatalog(DAT) {
  const skins = DAT.SKINS.slice();
  /* Variantes doradas: mismo id + '-gold', tal como las genera el juego. */
  DAT.SKINS.forEach(function (skin) {
    if (skin.exclusive) return;
    const gold = DAT.getSkin(skin.id + '-gold');
    if (gold && gold.id === skin.id + '-gold' && !skins.some(s => s.id === gold.id)) skins.push(gold);
  });

  return {
    skins: skins,
    hats: DAT.HATS,
    effects: DAT.EFFECTS,
    maps: DAT.MAPS,
    tools: DAT.TOOLS,
    achievements: DAT.ACH,
    missions: DAT.MISSIONS,
    eggs: DAT.EGGS,
    decor: DAT.DECOR,
    difficulties: DAT.DIFFS
  };
}

function buildSeasons(DAT) {
  const year = new Date().getFullYear();
  const sampleDates = {
    winter: new Date(year, 0, 15),
    spring: new Date(year, 3, 15),
    summer: new Date(year, 6, 15),
    autumn: new Date(year, 9, 15)
  };

  return DAT.SEASONS.map(function (season) {
    const sample = sampleDates[season.id] || new Date();
    const key = year + '-' + season.id;
    return {
      id: season.id,
      key: key,
      name: season.name,
      icon: season.icon,
      accent: season.accent,
      months: season.months,
      year: year,
      passName: season.pass && season.pass.name,
      passIcon: season.pass && season.pass.icon,
      premiumPrice: DAT.PASS_PREMIUM_PRICE,
      tiers: plain(DAT.passTiers(sample)),
      premiumTiers: plain(DAT.passPremiumTiers()),
      seasonTiers: plain(DAT.SEASON_TIERS),
      active: DAT.seasonKey() === key,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  });
}

function demoEntries() {
  return [
    { uid: 'demo-01', name: 'HalconVeloz', best: 184, last: 142, games: 312, level: 47 },
    { uid: 'demo-02', name: 'CometaAzul', best: 171, last: 128, games: 287, level: 44 },
    { uid: 'demo-03', name: 'PioDorado', best: 158, last: 96, games: 241, level: 39 },
    { uid: 'demo-04', name: 'NubeTurbo', best: 149, last: 110, games: 208, level: 36 },
    { uid: 'demo-05', name: 'FenixRojo', best: 137, last: 88, games: 196, level: 33 },
    { uid: 'demo-06', name: 'AuroraLunar', best: 126, last: 74, games: 174, level: 31 },
    { uid: 'demo-07', name: 'RayoVerde', best: 118, last: 91, games: 160, level: 28 },
    { uid: 'demo-08', name: 'TornadoPio', best: 109, last: 63, games: 149, level: 26 },
    { uid: 'demo-09', name: 'EstrellaSol', best: 97, last: 58, games: 133, level: 23 },
    { uid: 'demo-10', name: 'MirloBlanco', best: 86, last: 51, games: 121, level: 21 },
    { uid: 'demo-11', name: 'ZafiroVuelo', best: 74, last: 40, games: 104, level: 18 },
    { uid: 'demo-12', name: 'ColibriRapido', best: 61, last: 35, games: 88, level: 15 }
  ];
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  initAdmin();
  const db = admin.firestore();
  const rtdb = admin.database();
  const DAT = loadCatalog();

  console.log('Proyecto: ' + PROJECT_ID);
  console.log('Modo: ' + (USE_EMULATOR ? 'EMULADOR' : 'PRODUCCIÓN') + (WITH_DEMO ? ' · con demo' : ''));

  /* 1. Configuración de la app */
  await db.collection('config').doc('app').set({
    app: 'pio-vuelo',
    version: '3.1',
    schema: 1,
    minVersion: '2.5.0',
    maintenance: false,
    features: {
      leaderboard: true,
      presence: true,
      duels: true,
      cloudSave: true,
      catalog: true
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  /* 2. Catálogo */
  const catalog = buildCatalog(DAT);
  let totalCatalog = 0;
  for (const type of Object.keys(catalog)) {
    const docs = catalogDocs(db, type, catalog[type]);
    const n = await commitDocs(db, docs);
    totalCatalog += n;
    console.log('  catálogo/' + type + ': ' + n);
  }

  /* 3. Temporadas */
  const seasons = buildSeasons(DAT);
  const seasonDocs = seasons.map(function (season) {
    return {
      ref: db.collection('seasons').doc(season.key),
      data: season
    };
  });
  await commitDocs(db, seasonDocs);
  const active = seasons.find(s => s.active) || seasons[0];
  await db.collection('seasons').doc('current').set({
    key: active.key,
    id: active.id,
    name: active.name,
    icon: active.icon,
    passName: active.passName,
    premiumPrice: active.premiumPrice,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log('  seasons: ' + seasonDocs.length + ' (+ current)');

  /* 4. Semilla diaria para hoy y los próximos 7 días */
  const challengeDocs = [];
  for (let i = 0; i < 8; i++) {
    const date = dateKey(i);
    challengeDocs.push({
      ref: db.collection('dailyChallenges').doc(date),
      data: {
        date: date,
        seed: seedForDate(date),
        mode: 'challenge',
        target: 30,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });
  }
  await commitDocs(db, challengeDocs);
  console.log('  dailyChallenges: ' + challengeDocs.length);

  /* 5. Demo opcional del ranking */
  if (WITH_DEMO) {
    const entries = demoEntries();
    const docs = entries.map(function (entry) {
      return {
        ref: db.collection('leaderboards').doc('global').collection('entries').doc(entry.uid),
        data: {
          uid: entry.uid,
          name: entry.name,
          best: entry.best,
          last: entry.last,
          games: entry.games,
          level: entry.level,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      };
    });
    await commitDocs(db, docs);

    const updates = {};
    entries.forEach(function (entry) {
      updates['leaderboard_live/global/' + entry.uid] = {
        name: entry.name,
        best: entry.best,
        updatedAt: Date.now()
      };
    });
    await rtdb.ref().update(updates);
    console.log('  ranking demo: ' + entries.length + ' (Firestore + RTDB)');
  }

  console.log('');
  console.log('Listo. Catálogo: ' + totalCatalog + ' documentos.');
  console.log('Recuerda desplegar las reglas: firebase deploy --only firestore:rules,firestore:indexes,database');
  /* El Admin SDK mantiene conexiones gRPC abiertas: cerramos explícitamente
     para que `npm run firebase:seed` y `emulators:exec` terminen. */
  process.exit(0);
}

main().catch(function (err) {
  console.error('');
  console.error('ERROR: ' + (err && err.message ? err.message : err));
  if (err && err.code) console.error('Código: ' + err.code);
  process.exit(1);
});
