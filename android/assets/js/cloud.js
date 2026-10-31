/* ==========================================================================
   PÍO VUELO · CAPA DE NUBE (OPCIONAL)
   --------------------------------------------------------------------------
   Firestore  → perfil, historial de vuelos, ranking y catálogo.
   Realtime   → presencia, ranking en vivo y duelos.
   Auth       → sesión anónima (sin correo ni contraseña).

   Reglas de oro de este archivo:
     · Si `PIO_FIREBASE.enabled` es false, NO se carga el SDK ni se hace red.
     · Cualquier fallo de red se captura: el juego sigue funcionando offline.
     · El progreso local (localStorage) siempre manda; la nube es un espejo.
     · Los vuelos que no se puedan subir se guardan en una cola local y se
       reintentan al recuperar conexión.

   API pública: window.CLOUD
   ========================================================================== */
window.CLOUD = (function () {
  'use strict';

  const CFG = window.PIO_FIREBASE || {};
  const CONF = CFG.config || {};
  const OPT = Object.assign({
    board: 'global',
    presence: true,
    runs: true,
    heartbeatMs: 60000
  }, CFG.options || {});

  const QUEUE_KEY = 'piovuelo_cloud_queue';
  const QUEUE_MAX = 50;
  const BOARD_CACHE_KEY = 'piovuelo_cloud_board_v1';
  const BOARD_CACHE_MAX = 25;
  const VALID_MODES = ['free', 'zen', 'boss', 'wind', 'challenge', 'duel', 'replay'];

  const state = {
    status: 'off',       // off | connecting | online | error
    ready: false,
    uid: null,
    name: '',
    error: null,
    lastSync: 0
  };

  let app = null;
  let auth = null;
  let db = null;
  let rtdb = null;
  let M = null;                 // módulos del SDK
  let initPromise = null;
  let boardUnsub = null;
  let duelUnsub = null;
  let presenceTimer = null;
  let presenceRef = null;
  let presenceHooked = false;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function configured() {
    return CFG.enabled === true
      && !!CONF.projectId && !!CONF.apiKey && !!CONF.appId
      && !/REEMPLAZA|XXXX|TU_/i.test(CONF.projectId)
      && !/REEMPLAZA|XXXX|TU_/i.test(CONF.apiKey)
      && !/REEMPLAZA|XXXX|TU_/i.test(CONF.appId);
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent('piovuelo:' + name, { detail: detail }));
    } catch (e) { /* entorno sin CustomEvent */ }
  }

  function warn() {
    try { console.warn.apply(console, ['[Pío Vuelo · nube]'].concat([].slice.call(arguments))); } catch (e) { }
  }

  function clampInt(value, min, max) {
    const n = Math.floor(Number(value));
    if (!isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function cleanMode(mode) {
    return VALID_MODES.indexOf(mode) !== -1 ? mode : 'free';
  }

  function localSave() {
    return (window.SAVE && typeof window.SAVE.get === 'function') ? window.SAVE.get() : null;
  }

  function localProfile() {
    return (window.SAVE && typeof window.SAVE.getProfile === 'function')
      ? window.SAVE.getProfile()
      : { id: '', name: 'Jugador', created: 0 };
  }

  function status() {
    return {
      status: state.status,
      ready: state.ready,
      uid: state.uid,
      name: state.name,
      error: state.error,
      lastSync: state.lastSync,
      configured: configured(),
      online: (typeof navigator === 'undefined' || navigator.onLine !== false),
      board: OPT.board || 'global'
    };
  }

  /* Limpia una fila antes de pintarla o guardarla en la caché local. */
  function cleanRow(v, id) {
    if (!v || typeof v !== 'object') return null;
    const best = clampInt(v.best, 0, 10000000);
    if (best <= 0) return null;
    return {
      uid: String((v.uid || id || '')).slice(0, 128),
      name: String(v.name == null ? 'Jugador' : v.name).replace(/[<>]/g, '').trim().slice(0, 16) || 'Jugador',
      best: best,
      last: clampInt(v.last, 0, 10000000),
      games: clampInt(v.games, 0, 100000000),
      level: clampInt(v.level, 1, 999),
      updatedAt: (typeof v.updatedAt === 'number' && isFinite(v.updatedAt)) ? v.updatedAt : 0,
      me: !!v.me
    };
  }

  function cleanRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (r) { return cleanRow(r, r && r.uid); })
      .filter(Boolean)
      .sort(function (a, b) { return b.best - a.best || b.last - a.last || a.name.localeCompare(b.name); })
      .slice(0, BOARD_CACHE_MAX);
  }

  /* ------------------------------------------------------------------ */
  /* Caché local del ranking (solo lectura si falla la red)              */
  /* ------------------------------------------------------------------ */

  function cacheBoard(board, rows) {
    try {
      localStorage.setItem(BOARD_CACHE_KEY, JSON.stringify({
        board: String(board || OPT.board || 'global'),
        at: Date.now(),
        rows: cleanRows(rows)
      }));
    } catch (e) { /* espacio lleno o modo privado */ }
  }

  function cachedLeaderboard(boardId) {
    const board = boardId || OPT.board || 'global';
    try {
      const obj = JSON.parse(localStorage.getItem(BOARD_CACHE_KEY) || 'null');
      if (!obj || obj.board !== board || !Array.isArray(obj.rows)) return [];
      return cleanRows(obj.rows).map(function (r) {
        return Object.assign({}, r, { me: !!(state.uid && r.uid === state.uid) });
      });
    } catch (e) { return []; }
  }

  function cachedLeaderboardAt(boardId) {
    const board = boardId || OPT.board || 'global';
    try {
      const obj = JSON.parse(localStorage.getItem(BOARD_CACHE_KEY) || 'null');
      return (obj && obj.board === board && typeof obj.at === 'number') ? obj.at : 0;
    } catch (e) { return 0; }
  }

  /* ------------------------------------------------------------------ */
  /* Cola local de vuelos pendientes                                     */
  /* ------------------------------------------------------------------ */

  function readQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(r => r && typeof r.score === 'number') : [];
    } catch (e) { return []; }
  }

  function writeQueue(list) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-QUEUE_MAX))); } catch (e) { }
  }

  function enqueue(run) {
    const q = readQueue();
    q.push(run);
    writeQueue(q);
  }

  /* ------------------------------------------------------------------ */
  /* Inicialización perezosa del SDK                                     */
  /* ------------------------------------------------------------------ */

  async function init() {
    if (initPromise) return initPromise;
    if (!configured()) {
      state.status = 'off';
      return status();
    }

    initPromise = (async () => {
      state.status = 'connecting';
      emit('cloudstatus', status());

      const version = CFG.sdkVersion || '11.0.2';
      const base = 'https://www.gstatic.com/firebasejs/' + version + '/';

      const [appMod, authMod, fsMod, rtdbMod] = await Promise.all([
        import(base + 'firebase-app.js'),
        import(base + 'firebase-auth.js'),
        import(base + 'firebase-firestore.js'),
        import(base + 'firebase-database.js')
      ]);

      /* Reutiliza la app si un reintento ocurre tras un fallo parcial. */
      if (!app) {
        let existing = [];
        try { existing = appMod.getApps ? appMod.getApps() : []; } catch (e) { existing = []; }
        app = existing.length ? appMod.getApp() : appMod.initializeApp(CONF);
      }
      auth = authMod.getAuth(app);
      try {
        await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      } catch (e) { /* algunos navegadores privados lo bloquean */ }

      try {
        db = fsMod.initializeFirestore(app, {
          localCache: fsMod.persistentLocalCache({
            tabManager: fsMod.persistentMultipleTabManager()
          })
        });
      } catch (e) {
        db = fsMod.getFirestore(app);
      }

      rtdb = rtdbMod.getDatabase(app);
      M = { appMod: appMod, authMod: authMod, fsMod: fsMod, rtdbMod: rtdbMod };

      if (!auth.currentUser) await authMod.signInAnonymously(auth);
      state.uid = auth.currentUser.uid;
      state.name = localProfile().name || 'Jugador';

      authMod.onAuthStateChanged(auth, function (user) {
        state.uid = user ? user.uid : null;
        if (!user) {
          state.ready = false;
          state.status = 'off';
        }
      });

      await ensurePlayer();
      state.ready = true;
      state.status = 'online';
      state.error = null;
      state.lastSync = Date.now();

      emit('cloudready', status());
      emit('cloudstatus', status());

      await syncProfile();
      await syncLeaderboard();
      await flushQueue();
      if (OPT.presence) startPresence();
      return status();
    })().catch(function (err) {
      state.status = 'error';
      state.ready = false;
      state.error = String((err && err.message) || err);
      initPromise = null;              // permite reintentar cuando vuelva la red
      warn('No se pudo inicializar Firebase:', err);
      emit('clouderror', status());
      return status();
    });

    return initPromise;
  }

  /* Reintento real: vuelve a cargar el SDK y la sesión tras un fallo. */
  function retry() {
    if (!configured()) return Promise.resolve(status());
    if (!state.ready || state.status === 'error') {
      initPromise = null;
      state.status = 'connecting';
      state.error = null;
      emit('cloudstatus', status());
    }
    return init();
  }

  /* ------------------------------------------------------------------ */
  /* Perfil                                                              */
  /* ------------------------------------------------------------------ */

  function profilePayload() {
    const s = localSave();
    if (!s) return null;
    const prof = localProfile();
    const st = s.stats || {};
    return {
      uid: state.uid,
      name: prof.name || 'Jugador',
      updatedAt: M.fsMod.serverTimestamp(),
      level: clampInt(s.level, 1, 999),
      xp: clampInt(s.xp, 0, 1000000000),
      coins: clampInt(s.coins, 0, 1000000000),
      parts: clampInt(s.parts, 0, 1000000000),
      shields: clampInt(s.shields, 0, 1000000000),
      best: clampInt(st.best, 0, 10000000),
      flights: clampInt(st.flights, 0, 1000000000),
      pipes: clampInt(st.pipes, 0, 1000000000),
      distance: clampInt(st.dist, 0, 1000000000000),
      coinsGot: clampInt(st.coinsGot, 0, 1000000000),
      timePlayed: clampInt(st.timePlayed, 0, 1000000000000),
      equipped: {
        skin: String(s.skin || ''),
        hat: String(s.hat || ''),
        fx: String(s.fx || ''),
        map: String(s.map || '')
      },
      schema: 1,
      app: '3.1'
    };
  }

  async function ensurePlayer() {
    const ref = M.fsMod.doc(db, 'players', state.uid);
    const snap = await M.fsMod.getDoc(ref);
    if (snap.exists()) return;
    const payload = profilePayload();
    if (!payload) return;
    payload.createdAt = M.fsMod.serverTimestamp();
    await M.fsMod.setDoc(ref, payload, { merge: true });
  }

  async function syncProfile() {
    if (!state.ready || !db) return false;
    const payload = profilePayload();
    if (!payload) return false;
    try {
      await M.fsMod.setDoc(M.fsMod.doc(db, 'players', state.uid), payload, { merge: true });
      state.lastSync = Date.now();
      return true;
    } catch (err) {
      warn('syncProfile:', err);
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Ranking                                                             */
  /* ------------------------------------------------------------------ */

  function leaderboardPayload(lastScore) {
    const s = localSave() || {};
    const prof = localProfile();
    const st = s.stats || {};
    return {
      uid: state.uid,
      name: prof.name || 'Jugador',
      best: clampInt(st.best, 0, 10000000),
      last: clampInt(lastScore, 0, 10000000),
      games: clampInt(st.flights, 0, 100000000),
      level: clampInt(s.level, 1, 999),
      updatedAt: M.fsMod.serverTimestamp()
    };
  }

  async function syncLeaderboard(lastScore) {
    if (!state.ready || !db || !state.uid) return false;
    const board = OPT.board || 'global';
    const ref = M.fsMod.doc(db, 'leaderboards', board, 'entries', state.uid);
    const payload = leaderboardPayload(lastScore);
    const hasLast = typeof lastScore === 'number' && isFinite(lastScore);

    /* No ensuciar el ranking con entradas de 0 puntos antes de jugar. */
    if (payload.best <= 0 && payload.games <= 0) return false;

    try {
      await M.fsMod.runTransaction(db, async function (tx) {
        const snap = await tx.get(ref);
        const prev = snap.exists() ? snap.data() : {};
        const merged = Object.assign({}, payload, {
          best: Math.max(clampInt(prev.best, 0, 10000000), payload.best),
          last: hasLast ? payload.last : clampInt(prev.last, 0, 10000000),
          games: Math.max(clampInt(prev.games, 0, 100000000), payload.games),
          updatedAt: M.fsMod.serverTimestamp()
        });
        tx.set(ref, merged, { merge: true });
      });
      state.lastSync = Date.now();
      return true;
    } catch (err) {
      warn('syncLeaderboard:', err);
      return false;
    }
  }

  function rowFromDoc(d, source) {
    const v = d.data ? (d.data() || {}) : (d || {});
    const id = (d && d.id) || source || v.uid || '';
    return cleanRow(Object.assign({}, v, {
      uid: v.uid || id,
      me: !!(state.uid && (v.uid === state.uid || id === state.uid))
    }), id);
  }

  function topQuery(board, max) {
    return M.fsMod.query(
      M.fsMod.collection(db, 'leaderboards', board, 'entries'),
      M.fsMod.where('best', '>', 0),
      M.fsMod.orderBy('best', 'desc'),
      M.fsMod.limit(clampInt(max || BOARD_CACHE_MAX, 1, 100))
    );
  }

  async function leaderboard(boardId, max, onError) {
    await init();
    const board = boardId || OPT.board || 'global';
    if (!state.ready) {
      const err = new Error(state.error || ((typeof navigator !== 'undefined' && navigator.onLine === false) ? 'Sin conexión' : 'Firebase no disponible'));
      if (typeof onError === 'function') onError(err);
      return cachedLeaderboard(board);
    }
    try {
      const snap = await M.fsMod.getDocs(topQuery(board, max));
      const rows = snap.docs.map(function (d) { return rowFromDoc(d); }).filter(Boolean);
      cacheBoard(board, rows);
      state.lastSync = Date.now();
      return rows;
    } catch (err) {
      warn('leaderboard:', err);
      if (typeof onError === 'function') onError(err);
      return cachedLeaderboard(board);
    }
  }

  function watchLeaderboard(boardId, cb, max, onError) {
    if (typeof cb !== 'function') return function () { };
    const board = boardId || OPT.board || 'global';
    init().then(function () {
      if (!state.ready) {
        const err = new Error(state.error || ((typeof navigator !== 'undefined' && navigator.onLine === false) ? 'Sin conexión' : 'Firebase no disponible'));
        if (typeof onError === 'function') onError(err, cachedLeaderboard(board));
        else cb(cachedLeaderboard(board));
        return;
      }
      stopWatchLeaderboard();
      boardUnsub = M.fsMod.onSnapshot(topQuery(board, max), function (snap) {
        const rows = snap.docs.map(function (d) { return rowFromDoc(d); }).filter(Boolean);
        cacheBoard(board, rows);
        state.lastSync = Date.now();
        cb(rows);
      }, function (err) {
        warn('watchLeaderboard:', err);
        if (typeof onError === 'function') onError(err, cachedLeaderboard(board));
        else cb(cachedLeaderboard(board));
      });
    }).catch(function (err) {
      warn('watchLeaderboard init:', err);
      if (typeof onError === 'function') onError(err, cachedLeaderboard(board));
      else cb(cachedLeaderboard(board));
    });
    return stopWatchLeaderboard;
  }

  function stopWatchLeaderboard() {
    if (boardUnsub) { try { boardUnsub(); } catch (e) { } boardUnsub = null; }
  }

  /* ------------------------------------------------------------------ */
  /* Historial de vuelos                                                 */
  /* ------------------------------------------------------------------ */

  function runPayload(score, pipes, coins, dist, mode, seed) {
    return {
      score: clampInt(score, 0, 10000000),
      pipes: clampInt(pipes, 0, 10000000),
      coins: clampInt(coins, 0, 10000000),
      dist: clampInt(dist, 0, 100000000),
      mode: cleanMode(mode),
      seed: clampInt(seed, 0, 2147483647),
      createdAt: M.fsMod.serverTimestamp(),
      verified: false
    };
  }

  async function pushRun(run) {
    if (!state.ready || !db || !OPT.runs) return false;
    try {
      const runs = M.fsMod.collection(db, 'players', state.uid, 'runs');
      await M.fsMod.addDoc(runs, run);
      state.lastSync = Date.now();
      return true;
    } catch (err) {
      warn('pushRun:', err);
      return false;
    }
  }

  async function submitRun(score, pipes, coins, dist, mode, seed) {
    const run = {
      score: clampInt(score, 0, 10000000),
      pipes: clampInt(pipes, 0, 10000000),
      coins: clampInt(coins, 0, 10000000),
      dist: clampInt(dist, 0, 100000000),
      mode: cleanMode(mode),
      seed: clampInt(seed, 0, 2147483647),
      date: Date.now()
    };

    if (!state.ready) {
      if (configured() && OPT.runs) enqueue(run);
      return false;
    }

    const payload = runPayload(run.score, run.pipes, run.coins, run.dist, run.mode, run.seed);
    const ok = await pushRun(payload);
    if (!ok && OPT.runs) enqueue(run);
    await syncProfile();
    await syncLeaderboard(run.score);
    updateLiveBoard();
    return ok;
  }

  async function flushQueue() {
    if (!state.ready) return 0;
    const q = readQueue();
    if (!q.length) return 0;
    const pending = [];
    let sent = 0;
    for (let i = 0; i < q.length; i++) {
      const r = q[i];
      const payload = runPayload(r.score, r.pipes, r.coins, r.dist, r.mode, r.seed);
      const ok = await pushRun(payload);
      if (ok) sent++;
      else pending.push(r);
    }
    writeQueue(pending);
    if (sent) {
      await syncProfile();
      await syncLeaderboard();
      updateLiveBoard();
    }
    return sent;
  }

  /* ------------------------------------------------------------------ */
  /* Presencia y ranking en vivo (Realtime Database)                     */
  /* ------------------------------------------------------------------ */

  function presenceData() {
    const s = localSave() || {};
    const st = s.stats || {};
    return {
      name: localProfile().name || 'Jugador',
      level: clampInt(s.level, 1, 999),
      online: true,
      lastSeen: Date.now(),
      board: String(OPT.board || 'global').slice(0, 32),
      best: clampInt(st.best, 0, 10000000)
    };
  }

  function startPresence() {
    if (!state.ready || !rtdb || !M) return;
    if (presenceTimer) clearInterval(presenceTimer);
    presenceRef = M.rtdbMod.ref(rtdb, 'presence/' + state.uid);
    try {
      M.rtdbMod.set(presenceRef, presenceData());
      M.rtdbMod.onDisconnect(presenceRef).set({
        name: presenceData().name,
        level: presenceData().level,
        online: false,
        lastSeen: Date.now(),
        board: presenceData().board,
        best: presenceData().best
      });
    } catch (err) { warn('presence:', err); }

    presenceTimer = setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      try { M.rtdbMod.set(presenceRef, presenceData()); } catch (e) { }
    }, clampInt(OPT.heartbeatMs, 15000, 300000));

    if (!presenceHooked) {
      presenceHooked = true;
      window.addEventListener('beforeunload', function () {
        try {
          const d = presenceData();
          d.online = false;
          M.rtdbMod.set(presenceRef, d);
        } catch (e) { }
      });
    }

    updateLiveBoard();
  }

  function updateLiveBoard() {
    if (!state.ready || !rtdb || !M) return;
    const d = presenceData();
    if (d.best <= 0) return;
    try {
      M.rtdbMod.set(M.rtdbMod.ref(rtdb, 'leaderboard_live/' + (OPT.board || 'global') + '/' + state.uid), {
        name: d.name,
        best: d.best,
        updatedAt: Date.now()
      });
    } catch (e) { }
  }

  async function liveLeaderboard(boardId, max) {
    await init();
    if (!state.ready || !rtdb) return [];
    const board = boardId || OPT.board || 'global';
    try {
      const snap = await M.rtdbMod.get(M.rtdbMod.query(
        M.rtdbMod.ref(rtdb, 'leaderboard_live/' + board),
        M.rtdbMod.orderByChild('best'),
        M.rtdbMod.limitToLast(clampInt(max || 25, 1, 100))
      ));
      const out = [];
      snap.forEach(function (child) {
        const v = child.val() || {};
        out.push({
          uid: child.key,
          name: v.name || 'Jugador',
          best: clampInt(v.best, 0, 10000000),
          updatedAt: v.updatedAt || 0,
          me: child.key === state.uid
        });
      });
      return out.reverse();
    } catch (err) {
      warn('liveLeaderboard:', err);
      return [];
    }
  }

  /* ------------------------------------------------------------------ */
  /* Duelos en tiempo real                                               */
  /* ------------------------------------------------------------------ */

  function randomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return out;
  }

  async function createDuel() {
    await init();
    if (!state.ready || !rtdb) throw new Error('Firebase no está conectado');
    const code = randomCode();
    const now = Date.now();
    const ref = M.rtdbMod.ref(rtdb, 'duels/' + code);
    await M.rtdbMod.set(ref, {
      code: code,
      seed: now % 2147483647,
      state: 'waiting',
      createdAt: now,
      updatedAt: now,
      host: { uid: state.uid, name: localProfile().name || 'Jugador', score: 0 },
      guest: null
    });
    return code;
  }

  async function joinDuel(code) {
    await init();
    if (!state.ready || !rtdb) throw new Error('Firebase no está conectado');
    const key = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (key.length !== 6) throw new Error('Código inválido');
    const ref = M.rtdbMod.ref(rtdb, 'duels/' + key);
    const result = await M.rtdbMod.runTransaction(ref, function (cur) {
      if (!cur) return null;
      if (cur.host && cur.host.uid === state.uid) return cur;
      if (cur.guest && cur.guest.uid !== state.uid) return;
      if (cur.state === 'finished') return;
      cur.guest = { uid: state.uid, name: localProfile().name || 'Jugador', score: 0 };
      cur.state = 'playing';
      cur.updatedAt = Date.now();
      return cur;
    });
    if (!result || !result.snapshot || !result.snapshot.exists()) throw new Error('Sala no encontrada o completa');
    return result.snapshot.val();
  }

  async function updateDuelScore(code, score) {
    if (!state.ready || !rtdb) return false;
    const key = String(code || '').toUpperCase().slice(0, 6);
    const ref = M.rtdbMod.ref(rtdb, 'duels/' + key);
    try {
      const snap = await M.rtdbMod.get(ref);
      const duel = snap.val();
      if (!duel) return false;
      let side = null;
      if (duel.host && duel.host.uid === state.uid) side = 'host';
      else if (duel.guest && duel.guest.uid === state.uid) side = 'guest';
      if (!side) return false;
      const patch = { updatedAt: Date.now() };
      patch[side + '/score'] = clampInt(score, 0, 10000000);
      await M.rtdbMod.update(ref, patch);
      return true;
    } catch (err) {
      warn('updateDuelScore:', err);
      return false;
    }
  }

  function watchDuel(code, cb) {
    if (typeof cb !== 'function') return function () { };
    const key = String(code || '').toUpperCase().slice(0, 6);
    init().then(function () {
      if (!state.ready || !rtdb) { cb(null); return; }
      stopWatchDuel();
      duelUnsub = M.rtdbMod.onValue(M.rtdbMod.ref(rtdb, 'duels/' + key), function (snap) {
        cb(snap.exists() ? snap.val() : null);
      }, function (err) {
        warn('watchDuel:', err);
        cb(null);
      });
    });
    return stopWatchDuel;
  }

  function stopWatchDuel() {
    if (duelUnsub) { try { duelUnsub(); } catch (e) { } duelUnsub = null; }
  }

  async function leaveDuel(code) {
    if (!state.ready || !rtdb) return false;
    const key = String(code || '').toUpperCase().slice(0, 6);
    const ref = M.rtdbMod.ref(rtdb, 'duels/' + key);
    try {
      const snap = await M.rtdbMod.get(ref);
      const duel = snap.val();
      if (!duel) return false;
      if (duel.host && duel.host.uid === state.uid) {
        await M.rtdbMod.remove(ref);
      } else if (duel.guest && duel.guest.uid === state.uid) {
        await M.rtdbMod.update(ref, { guest: null, state: 'waiting', updatedAt: Date.now() });
      }
      return true;
    } catch (err) {
      warn('leaveDuel:', err);
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Enganche con el guardado local                                      */
  /* ------------------------------------------------------------------ */

  function hookSave() {
    const S = window.SAVE;
    if (!S || S.__cloudHooked) return;

    const originalEndRun = S.endRun;
    if (typeof originalEndRun === 'function') {
      S.endRun = function (score, pipes, coins, timeSec, dist, mode) {
        const out = originalEndRun.apply(this, arguments);
        try {
          submitRun(score, pipes, coins, dist, mode, Date.now() % 2147483647);
        } catch (e) { warn('hook endRun:', e); }
        return out;
      };
    }

    const originalRename = S.rename;
    if (typeof originalRename === 'function') {
      S.rename = function (name) {
        const out = originalRename.apply(this, arguments);
        if (out && out.ok) {
          state.name = out.name || state.name;
          try { syncProfile(); syncLeaderboard(); updateLiveBoard(); } catch (e) { }
        }
        return out;
      };
    }

    const originalReset = S.reset;
    if (typeof originalReset === 'function') {
      S.reset = function () {
        const out = originalReset.apply(this, arguments);
        try { syncProfile(); syncLeaderboard(0); updateLiveBoard(); } catch (e) { }
        return out;
      };
    }

    S.__cloudHooked = true;
  }

  /* ------------------------------------------------------------------ */
  /* Arranque automático                                                 */
  /* ------------------------------------------------------------------ */

  hookSave();
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('online', function () {
      emit('cloudstatus', status());
      if (state.ready) flushQueue();
      else retry().then(function () { return flushQueue(); });
    });
    window.addEventListener('offline', function () { emit('cloudstatus', status()); });
    window.addEventListener('piovuelo:saveerror', function () { if (state.ready) syncProfile(); });
  }

  if (configured()) {
    const boot = function () {
      hookSave();
      setTimeout(function () { init(); }, 1200);
    };
    if (document.readyState === 'complete') boot();
    else window.addEventListener('load', boot, { once: true });
  }

  return {
    configured: configured,
    init: init,
    retry: retry,
    status: status,
    syncProfile: syncProfile,
    syncLeaderboard: syncLeaderboard,
    submitRun: submitRun,
    flushQueue: flushQueue,
    leaderboard: leaderboard,
    watchLeaderboard: watchLeaderboard,
    stopWatchLeaderboard: stopWatchLeaderboard,
    cachedLeaderboard: cachedLeaderboard,
    cachedLeaderboardAt: cachedLeaderboardAt,
    liveLeaderboard: liveLeaderboard,
    updateLiveBoard: updateLiveBoard,
    createDuel: createDuel,
    joinDuel: joinDuel,
    updateDuelScore: updateDuelScore,
    watchDuel: watchDuel,
    stopWatchDuel: stopWatchDuel,
    leaveDuel: leaveDuel
  };
})();
