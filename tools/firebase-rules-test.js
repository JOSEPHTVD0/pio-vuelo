/* ==========================================================================
   PÍO VUELO · PRUEBA DE REGLAS CONTRA LOS EMULADORES
   --------------------------------------------------------------------------
   No toca producción. Se ejecuta con:
     npx firebase-tools emulators:exec --only firestore,database,auth \
       --project demo-pio-vuelo "node tools/firebase-rules-test.js"

   Comprueba con el SDK real del cliente (no Admin) que:
     · El dueño puede crear su perfil, sus vuelos y su entrada de ranking.
     · Nadie puede escribir el perfil de otro ni bajar su récord.
     · El catálogo es de solo lectura.
     · Presencia y ranking en vivo respetan el UID.
     · Un invitado puede unirse a un duelo sin tocar los datos del anfitrión.
   ========================================================================== */
'use strict';

const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = require('firebase/auth');
const {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc,
  collection, addDoc, serverTimestamp
} = require('firebase/firestore');
const {
  getDatabase, connectDatabaseEmulator, ref, set, get, update, remove
} = require('firebase/database');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-pio-vuelo';
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const DATABASE_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';

let passed = 0;
let failed = 0;

function ok(condition, label, detail) {
  if (condition) {
    passed++;
    console.log('  ✓ ' + label);
  } else {
    failed++;
    console.error('  ✗ ' + label + (detail ? ' — ' + detail : ''));
  }
}

function hostPort(value) {
  const parts = value.split(':');
  return { host: parts[0], port: Number(parts[1]) };
}

const fsAddr = hostPort(FIRESTORE_HOST);
const dbAddr = hostPort(DATABASE_HOST);
const authUrl = 'http://' + AUTH_HOST;

function appConfig(name) {
  return {
    apiKey: 'demo-api-key',
    authDomain: PROJECT_ID + '.firebaseapp.com',
    projectId: PROJECT_ID,
    appId: '1:000000000000:web:demo',
    /* El emulador aplica database.rules.json a la instancia por defecto,
       que se llama <proyecto>-default-rtdb. Con ?ns=<proyecto> las reglas
       no se aplican y la prueba daría falsos positivos. */
    databaseURL: 'http://' + DATABASE_HOST + '?ns=' + PROJECT_ID + '-default-rtdb'
  };
}

function makeClient(name) {
  const app = initializeApp(appConfig(name), name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, authUrl, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, fsAddr.host, fsAddr.port);
  const rtdb = getDatabase(app);
  connectDatabaseEmulator(rtdb, dbAddr.host, dbAddr.port);
  return { app, auth, db, rtdb };
}

async function expectOk(label, fn) {
  try {
    await fn();
    ok(true, label);
  } catch (err) {
    ok(false, label, (err && (err.code || err.message)) || String(err));
  }
}

async function expectDenied(label, fn) {
  try {
    await fn();
    ok(false, label, 'la operación NO fue denegada');
  } catch (err) {
    const code = String((err && (err.code || err.message)) || err).toLowerCase();
    if (code.indexOf('permission') !== -1 || code.indexOf('denied') !== -1) {
      ok(true, label);
    } else {
      ok(false, label, 'error inesperado: ' + code);
    }
  }
}

function playerPayload(uid, name) {
  const ts = serverTimestamp();
  return {
    uid: uid,
    name: name,
    createdAt: ts,
    updatedAt: ts,
    level: 1,
    xp: 0,
    coins: 80,
    parts: 0,
    shields: 0,
    best: 0,
    flights: 0,
    pipes: 0,
    distance: 0,
    coinsGot: 0,
    timePlayed: 0,
    equipped: { skin: 'classic', hat: '', fx: 'fx-none', map: 'day' },
    schema: 1,
    app: '3.1'
  };
}

function leaderboardPayload(uid, name, best, games) {
  return {
    uid: uid,
    name: name,
    best: best,
    last: best,
    games: games,
    level: 1,
    updatedAt: serverTimestamp()
  };
}

function presencePayload(name) {
  return {
    name: name,
    level: 1,
    online: true,
    lastSeen: Date.now(),
    board: 'global',
    best: 0
  };
}

function duelPayload(code, uid, name) {
  const now = Date.now();
  return {
    code: code,
    seed: now % 2147483647,
    state: 'waiting',
    createdAt: now,
    updatedAt: now,
    host: { uid: uid, name: name, score: 0 },
    guest: null
  };
}

async function main() {
  console.log('\nPÍO VUELO · reglas de Firebase (emuladores)\n');
  console.log('Proyecto: ' + PROJECT_ID);

  /* Admin solo para preparar datos de lectura pública (ignora las reglas). */
  if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
  const adminDb = admin.firestore();
  await adminDb.collection('catalog').doc('test').collection('items').doc('demo').set({
    id: 'demo', type: 'test', name: 'Demo', price: 0
  });

  /* ---------- Jugador A ---------- */
  const a = makeClient('player-a');
  const credA = await signInAnonymously(a.auth);
  const uidA = credA.user.uid;
  console.log('UID A: ' + uidA);

  console.log('\nFirestore · perfil');
  await expectOk('el dueño crea su perfil', function () {
    return setDoc(doc(a.db, 'players', uidA), playerPayload(uidA, 'TesterA'));
  });
  await expectOk('el dueño lee su perfil', function () {
    return getDoc(doc(a.db, 'players', uidA));
  });
  await expectDenied('nadie puede escribir el perfil de otro UID', function () {
    return setDoc(doc(a.db, 'players', 'otro-uid'), playerPayload('otro-uid', 'Intruso'));
  });
  await expectDenied('el nombre vacío se rechaza', function () {
    return setDoc(doc(a.db, 'players', uidA), Object.assign(playerPayload(uidA, 'X'), { name: 'X' }), { merge: true });
  });

  console.log('\nFirestore · vuelos');
  await expectOk('el dueño registra un vuelo válido', function () {
    return addDoc(collection(a.db, 'players', uidA, 'runs'), {
      score: 12, pipes: 12, coins: 3, dist: 240, mode: 'free',
      seed: 123, createdAt: serverTimestamp(), verified: false
    });
  });
  await expectDenied('un modo de vuelo inventado se rechaza', function () {
    return addDoc(collection(a.db, 'players', uidA, 'runs'), {
      score: 5, pipes: 5, coins: 1, dist: 100, mode: 'hackeado',
      seed: 1, createdAt: serverTimestamp(), verified: false
    });
  });
  await expectDenied('nadie registra vuelos en el perfil de otro', function () {
    return addDoc(collection(a.db, 'players', 'otro-uid', 'runs'), {
      score: 5, pipes: 5, coins: 1, dist: 100, mode: 'free',
      seed: 1, createdAt: serverTimestamp(), verified: false
    });
  });

  console.log('\nFirestore · ranking');
  await expectOk('el dueño crea su entrada de ranking', function () {
    return setDoc(doc(a.db, 'leaderboards', 'global', 'entries', uidA), leaderboardPayload(uidA, 'TesterA', 12, 1));
  });
  await expectDenied('no se puede bajar el récord propio', function () {
    return setDoc(doc(a.db, 'leaderboards', 'global', 'entries', uidA), {
      best: 3, updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await expectDenied('no se puede escribir la entrada de otro', function () {
    return setDoc(doc(a.db, 'leaderboards', 'global', 'entries', 'otro-uid'), leaderboardPayload('otro-uid', 'Intruso', 999, 9));
  });

  console.log('\nFirestore · catálogo y lectura pública');
  await expectDenied('el catálogo no se puede escribir desde el cliente', function () {
    return setDoc(doc(a.db, 'catalog', 'test', 'items', 'demo'), { id: 'demo', name: 'Hackeado' });
  });

  const publicApp = makeClient('public-reader');
  await expectOk('el ranking se lee sin iniciar sesión', function () {
    return getDoc(doc(publicApp.db, 'leaderboards', 'global', 'entries', uidA));
  });
  await expectOk('el catálogo se lee sin iniciar sesión', function () {
    return getDoc(doc(publicApp.db, 'catalog', 'test', 'items', 'demo'));
  });
  await expectDenied('el perfil privado NO se lee sin ser su dueño', function () {
    return getDoc(doc(publicApp.db, 'players', uidA));
  });

  console.log('\nRealtime Database · presencia y ranking en vivo');
  await expectOk('el dueño publica su presencia', function () {
    return set(ref(a.rtdb, 'presence/' + uidA), presencePayload('TesterA'));
  });
  await expectDenied('nadie publica presencia por otro UID', function () {
    return set(ref(a.rtdb, 'presence/otro-uid'), presencePayload('Intruso'));
  });
  await expectOk('el dueño publica su ranking en vivo', function () {
    return set(ref(a.rtdb, 'leaderboard_live/global/' + uidA), { name: 'TesterA', best: 12, updatedAt: Date.now() });
  });
  await expectOk('el ranking en vivo es de lectura pública', function () {
    return get(ref(publicApp.rtdb, 'leaderboard_live/global/' + uidA));
  });
  await expectDenied('presencia NO es de lectura pública', function () {
    return get(ref(publicApp.rtdb, 'presence/' + uidA));
  });

  console.log('\nRealtime Database · duelos');
  const code = 'ABC234';
  await expectOk('el anfitrión crea el duelo', function () {
    return set(ref(a.rtdb, 'duels/' + code), duelPayload(code, uidA, 'TesterA'));
  });

  const b = makeClient('player-b');
  const credB = await signInAnonymously(b.auth);
  const uidB = credB.user.uid;
  console.log('UID B: ' + uidB);

  await expectOk('un invitado se une al duelo', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      guest: { uid: uidB, name: 'TesterB', score: 0 },
      state: 'playing',
      updatedAt: Date.now()
    });
  });
  await expectDenied('el invitado no puede cambiar los datos del anfitrión', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'host/score': 999,
      updatedAt: Date.now()
    });
  });
  await expectOk('el invitado actualiza su propia puntuación', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'guest/score': 7,
      updatedAt: Date.now()
    });
  });
  await expectOk('el duelo es de lectura pública', function () {
    return get(ref(publicApp.rtdb, 'duels/' + code));
  });
  await expectDenied('un tercero no puede escribir el duelo', function () {
    return update(ref(publicApp.rtdb, 'duels/' + code), {
      'guest/score': 999,
      updatedAt: Date.now()
    });
  });
  await expectOk('el anfitrión puede cerrar y borrar el duelo', function () {
    return remove(ref(a.rtdb, 'duels/' + code));
  });

  console.log('\n' + (failed === 0 ? 'OK' : 'FALLOS') + ': ' + passed + ' correctas, ' + failed + ' fallidas\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (err) {
  console.error('\nERROR: ' + ((err && err.message) || err));
  process.exit(1);
});
