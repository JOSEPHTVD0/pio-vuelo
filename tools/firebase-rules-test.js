/* ==========================================================================
   PÍO VUELO · PRUEBA DE REGLAS CONTRA LOS EMULADORES
   --------------------------------------------------------------------------
   No toca producción. Se ejecuta con:
     npx firebase-tools emulators:exec --only firestore,database,auth \
       --project demo-pio-vuelo "node tools/firebase-rules-test.js"

   Comprueba con el SDK real del cliente (no Admin) que:
     · El dueño puede crear su perfil, sus vuelos y su entrada de ranking.
     · Solo el dueño puede leer y escribir la copia de progreso de su cuenta.
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
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc,
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

function accountPayload(uid, username, save) {
  return {
    uid: uid,
    username: username,
    nameKey: 'n_' + username.toLowerCase(),
    save: JSON.stringify(save || { level: 4, coins: 320, profile: { name: username } }),
    saveLevel: 4,
    saveBest: 12,
    saveFlights: 3,
    saveAt: Date.now(),
    updatedAt: serverTimestamp(),
    schema: 1
  };
}

function duelConfig(overrides) {
  return Object.assign({
    mode: 'goal',
    pipes: 12,
    time: 0,
    map: 'day',
    diff: 'normal',
    tools: true,
    seedMode: 'daily',
    seed: 20261110
  }, overrides || {});
}

function entitlementsPayload(maps) {
  return { maps: maps, updatedAt: Date.now() };
}

function duelPayload(code, uid, name, config) {
  const now = Date.now();
  return {
    code: code,
    seed: 20261110,
    state: 'waiting',
    startAt: 0,
    winner: '',
    createdAt: now,
    updatedAt: now,
    config: duelConfig(config),
    host: { uid: uid, name: name, score: 0, pipes: 0, alive: true, finished: false, time: 0 },
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

  console.log('\nRealtime Database · mapas desbloqueados');
  await expectOk('el dueño publica sus mapas desbloqueados', function () {
    return set(ref(a.rtdb, 'entitlements/' + uidA), entitlementsPayload({ day: true, sunset: true }));
  });
  await expectDenied('nadie publica mapas por otro UID', function () {
    return set(ref(a.rtdb, 'entitlements/otro-uid'), entitlementsPayload({ day: true }));
  });
  await expectDenied('los mapas deben incluir el mapa gratuito', function () {
    return set(ref(a.rtdb, 'entitlements/' + uidA), entitlementsPayload({ sunset: true }));
  });

  console.log('\nRealtime Database · duelos');
  const code = 'ABC234';
  await expectOk('el anfitrión crea el duelo', function () {
    return set(ref(a.rtdb, 'duels/' + code), duelPayload(code, uidA, 'TesterA'));
  });
  await expectDenied('no se puede crear una sala con un mapa no adquirido', function () {
    return set(ref(a.rtdb, 'duels/ABC235'), duelPayload('ABC235', uidA, 'TesterA', { map: 'night' }));
  });
  await expectOk('se puede crear una sala libre sin meta de tubos', function () {
    return set(ref(a.rtdb, 'duels/ABC236'), duelPayload('ABC236', uidA, 'TesterA', { mode: 'free', pipes: 0 }));
  });
  await expectOk('el anfitrión puede borrar la sala libre de prueba', function () {
    return remove(ref(a.rtdb, 'duels/ABC236'));
  });

  const b = makeClient('player-b');
  const credB = await signInAnonymously(b.auth);
  const uidB = credB.user.uid;
  console.log('UID B: ' + uidB);

  console.log('\nFirestore · nombres únicos');
  function namePayload(uid, name, key, extra) {
    return Object.assign({
      key: key, name: name, uid: uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }, extra || {});
  }
  await expectOk('un jugador reserva un nombre libre', function () {
    return setDoc(doc(a.db, 'names', 'n_testera'), namePayload(uidA, 'TesterA', 'n_testera'));
  });
  await expectOk('el dueño actualiza su propia reserva', function () {
    return setDoc(doc(a.db, 'names', 'n_testera'), {
      name: 'TesterA', updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await expectOk('otro jugador puede consultar si el nombre está ocupado', function () {
    return getDoc(doc(b.db, 'names', 'n_testera'));
  });
  await expectDenied('nadie reserva un nombre a otro UID', function () {
    return setDoc(doc(b.db, 'names', 'n_ajeno'), namePayload(uidA, 'Ajeno', 'n_ajeno'));
  });
  await expectDenied('nadie escribe la reserva de otro jugador', function () {
    return setDoc(doc(b.db, 'names', 'n_testera'), {
      name: 'Robado', updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await expectDenied('nadie borra la reserva de otro jugador', function () {
    return deleteDoc(doc(b.db, 'names', 'n_testera'));
  });
  await expectDenied('la clave del documento debe coincidir', function () {
    return setDoc(doc(a.db, 'names', 'n_otro'), namePayload(uidA, 'Otro', 'n_distinto'));
  });
  await expectDenied('un nombre de 1 carácter no se reserva', function () {
    return setDoc(doc(a.db, 'names', 'n_corto'), namePayload(uidA, 'X', 'n_corto'));
  });
  await expectDenied('una reserva con campos extra se rechaza', function () {
    return setDoc(doc(a.db, 'names', 'n_extra'),
      namePayload(uidA, 'Extra', 'n_extra', { admin: true }));
  });
  await expectOk('el segundo jugador reserva su propio nombre', function () {
    return setDoc(doc(b.db, 'names', 'n_testerb'), namePayload(uidB, 'TesterB', 'n_testerb'));
  });
  await expectDenied('nadie puede apropiarse de una reserva cambiando el uid', function () {
    return setDoc(doc(b.db, 'names', 'n_testerb'), {
      uid: uidA, updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await expectOk('el dueño puede borrar su propia reserva', function () {
    return deleteDoc(doc(b.db, 'names', 'n_testerb'));
  });

  console.log('\nFirestore · copia de progreso de la cuenta');
  await expectOk('la cuenta crea su copia de progreso', function () {
    return setDoc(doc(a.db, 'accounts', uidA), accountPayload(uidA, 'TesterA'));
  });
  await expectOk('la cuenta lee su propia copia', function () {
    return getDoc(doc(a.db, 'accounts', uidA));
  });
  await expectOk('la cuenta actualiza su propia copia', function () {
    return setDoc(doc(a.db, 'accounts', uidA), {
      save: JSON.stringify({ level: 5, coins: 410 }),
      saveLevel: 5,
      saveBest: 20,
      saveFlights: 4,
      saveAt: Date.now(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await expectDenied('otro jugador NO puede leer la copia de una cuenta', function () {
    return getDoc(doc(b.db, 'accounts', uidA));
  });
  await expectDenied('otro jugador NO puede escribir la copia de una cuenta', function () {
    return setDoc(doc(b.db, 'accounts', uidA), accountPayload(uidA, 'TesterA'));
  });
  await expectDenied('nadie puede escribir la copia de otro UID', function () {
    return setDoc(doc(a.db, 'accounts', 'otro-uid'), accountPayload('otro-uid', 'Intruso'));
  });
  await expectDenied('una copia con campos extra se rechaza', function () {
    const p = accountPayload(uidA, 'TesterA');
    p.admin = true;
    return setDoc(doc(a.db, 'accounts', uidA), p);
  });
  await expectDenied('un nivel fuera de rango se rechaza', function () {
    return setDoc(doc(a.db, 'accounts', uidA), Object.assign(accountPayload(uidA, 'TesterA'), { saveLevel: 5000 }), { merge: true });
  });
  await expectDenied('un guardado gigante se rechaza', function () {
    return setDoc(doc(a.db, 'accounts', uidA), Object.assign(accountPayload(uidA, 'TesterA'), {
      save: 'x'.repeat(960000)
    }), { merge: true });
  });
  await expectDenied('nadie puede borrar la copia de la cuenta', function () {
    return deleteDoc(doc(a.db, 'accounts', uidA));
  });

  console.log('\nRealtime Database · duelo 1v1: crear, unirse, empezar y progreso');
  await expectDenied('una meta de tubos fuera de rango se rechaza', function () {
    return set(ref(a.rtdb, 'duels/ZZZ234'), duelPayload('ZZZ234', uidA, 'TesterA', { pipes: -1 }));
  });
  await expectDenied('una dificultad inventada se rechaza', function () {
    return set(ref(a.rtdb, 'duels/ZZZ235'), duelPayload('ZZZ235', uidA, 'TesterA', { diff: 'imposible' }));
  });
  await expectDenied('una semilla inválida se rechaza', function () {
    const p = duelPayload('ZZZ236', uidA, 'TesterA');
    p.seed = 0;
    return set(ref(a.rtdb, 'duels/ZZZ236'), p);
  });
  await expectDenied('un estado de sala inventado se rechaza', function () {
    const p = duelPayload('ZZZ237', uidA, 'TesterA');
    p.state = 'hackeado';
    return set(ref(a.rtdb, 'duels/ZZZ237'), p);
  });

  await expectOk('el invitado publica sus mapas desbloqueados', function () {
    return set(ref(b.rtdb, 'entitlements/' + uidB), entitlementsPayload({ day: true }));
  });
  await expectOk('un invitado se une al duelo con herramientas desactivadas', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      guest: { uid: uidB, name: 'TesterB', score: 0, pipes: 0, alive: true, finished: false, time: 0 },
      updatedAt: Date.now()
    });
  });
  await expectDenied('el invitado no puede cambiar los datos del anfitrión', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'host/score': 999,
      updatedAt: Date.now()
    });
  });
  await expectDenied('el invitado no puede cambiar la configuración', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'config/pipes': 8,
      updatedAt: Date.now()
    });
  });
  await expectDenied('el invitado no puede cambiar la semilla de la sala', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      seed: 12345,
      'config/seed': 12345,
      updatedAt: Date.now()
    });
  });
  await expectDenied('un tercero no puede ocupar la sala llena', function () {
    return update(ref(publicApp.rtdb, 'duels/' + code), {
      guest: { uid: 'intruso', name: 'Intruso', score: 0, pipes: 0, alive: true, finished: false, time: 0 },
      updatedAt: Date.now()
    });
  });
  await expectOk('el anfitrión empieza la partida con un margen de salida', function () {
    return update(ref(a.rtdb, 'duels/' + code), {
      state: 'playing',
      startAt: Date.now() + 3500,
      updatedAt: Date.now()
    });
  });
  await expectDenied('el invitado no puede mover la hora de salida', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      startAt: Date.now() + 900000,
      updatedAt: Date.now()
    });
  });
  await expectDenied('el invitado no puede devolver la sala a la espera', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      state: 'waiting',
      updatedAt: Date.now()
    });
  });
  await expectOk('el invitado publica su progreso', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'guest/pipes': 7,
      'guest/score': 21,
      'guest/dist': 120,
      'guest/alt': 0.42,
      'guest/alive': true,
      'guest/finished': true,
      'guest/time': 24.5,
      updatedAt: Date.now()
    });
  });
  await expectDenied('una altura de radar fuera de rango se rechaza', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'guest/alt': 1.5,
      updatedAt: Date.now()
    });
  });
  await expectDenied('el invitado no puede falsear el progreso del anfitrión', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'host/pipes': 999,
      updatedAt: Date.now()
    });
  });
  await expectDenied('un tiempo negativo se rechaza', function () {
    return update(ref(b.rtdb, 'duels/' + code), {
      'guest/time': -1,
      updatedAt: Date.now()
    });
  });
  await expectOk('el anfitrión publica su progreso y cierra la sala', function () {
    return update(ref(a.rtdb, 'duels/' + code), {
      'host/pipes': 9,
      'host/score': 27,
      'host/dist': 140,
      'host/alt': 0.63,
      'host/alive': true,
      'host/finished': true,
      'host/time': 22.1,
      state: 'finished',
      winner: 'host',
      updatedAt: Date.now()
    });
  });
  await expectDenied('un ganador inventado se rechaza', function () {
    return update(ref(a.rtdb, 'duels/' + code), {
      winner: 'empate-raro',
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
