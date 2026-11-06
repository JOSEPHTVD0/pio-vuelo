/* ==========================================================================
   PÍO VUELO · CAPA DE NUBE (OPCIONAL)
   --------------------------------------------------------------------------
   Firestore  → perfil, historial de vuelos, ranking y catálogo.
   Realtime   → presencia, ranking en vivo y duelos.
   Auth       → sesión anónima (invitado) o cuenta con usuario/contraseña.

   La cuenta guarda una copia completa del progreso en accounts/{uid}. Al
   iniciar sesión en otro dispositivo se puede restaurar ese progreso; si el
   dispositivo ya tenía partidas, la interfaz pregunta cuál conservar.

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
  const SIGNED_OUT_KEY = 'piovuelo_signed_out';
  const ACCOUNT_SCHEMA = 1;
  const ACCOUNT_SAVE_MAX = 900000;   // bytes; el documento de Firestore admite 1 MB
  const VALID_MODES = ['free', 'zen', 'boss', 'wind', 'challenge', 'duel', 'replay'];

  const state = {
    status: 'off',       // off | connecting | online | error
    ready: false,
    uid: null,
    name: '',
    account: false,      // sesión con usuario/contraseña (no anónima)
    username: '',
    hasAccount: false,   // existe accounts/{uid} en Firestore
    pending: false,      // hay que elegir entre progreso local y de la nube
    restoring: false,    // se está importando el progreso de la nube
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
  let saveTimer = null;
  let pendingLogin = null;      // { username, cloudRaw, local, cloud }

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

  /* ------------------------------------------------------------------ */
  /* Utilidades de cuenta (usuario + contraseña, sin correo visible)     */
  /* ------------------------------------------------------------------ */

  function canonicalUser(name) {
    let s = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { }
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Firebase Auth exige un correo. Se deriva del usuario de forma determinista
  // y nunca se muestra ni se usa para enviar mensajes: es solo el identificador
  // interno de la cuenta. La contraseña la guarda Firebase, nunca este código.
  function base64Url(text) {
    let bin = '';
    try { bin = unescape(encodeURIComponent(text)); }
    catch (e) { bin = text; }
    let out = '';
    try { out = btoa(bin); }
    catch (e) {
      out = '';
      for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i));
      out = btoa(out);
    }
    return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function emailFor(name) {
    return 'u_' + base64Url(canonicalUser(name)) + '@piovuelo.local';
  }

  function cleanUser(raw) {
    const original = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!original) return { ok: false, msg: 'Escribe tu usuario.' };
    if (original.length < 2) return { ok: false, msg: 'El usuario debe tener al menos 2 caracteres.' };
    if (original.length > 16) return { ok: false, msg: 'El usuario admite como máximo 16 caracteres.' };
    const nm = (window.SAVE && typeof window.SAVE.cleanName === 'function')
      ? window.SAVE.cleanName(original)
      : original;
    if (!nm || nm !== original) {
      return { ok: false, msg: 'Solo letras, números, espacios, punto, guion y guion bajo.' };
    }
    return { ok: true, name: nm, key: nameKey(nm) };
  }

  function passwordOk(pass) {
    return typeof pass === 'string' && pass.length >= 6 && pass.length <= 128;
  }

  function authMessage(err) {
    const code = String((err && err.code) || '');
    if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential') {
      return 'Ese usuario ya existe. Elige otro nombre o inicia sesión.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials') {
      return 'Usuario o contraseña incorrectos.';
    }
    if (code === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
    if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera un momento y vuelve a probar.';
    if (code === 'auth/network-request-failed') return 'Sin conexión. Revisa tu red e inténtalo de nuevo.';
    if (code === 'auth/operation-not-allowed') return 'El acceso con usuario y contraseña no está activado en el servidor.';
    if (code === 'auth/requires-recent-login') return 'Por seguridad, vuelve a iniciar sesión.';
    if (code === 'auth/user-disabled') return 'Esta cuenta está desactivada.';
    return 'No se pudo completar la operación' + (code ? ' (' + code + ')' : '') + '.';
  }

  function safeParse(raw) {
    try {
      const obj = JSON.parse(String(raw || ''));
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : null;
    } catch (e) { return null; }
  }

  function totalXpOf(save) {
    const s = save || {};
    const level = Math.max(1, Math.floor(Number(s.level) || 1));
    let sum = 0;
    for (let l = 1; l < level; l++) sum += Math.floor(55 * Math.pow(l, 1.35) + 30);
    return sum + Math.max(0, Math.floor(Number(s.xp) || 0));
  }

  function saveStats(save) {
    return (save && save.stats && typeof save.stats === 'object') ? save.stats : {};
  }

  function isFreshSave(save) {
    if (!save) return true;
    const st = saveStats(save);
    return !(Number(st.flights) > 0)
      && !(Number(st.best) > 0)
      && !(Number(save.level) > 1)
      && !(Number(save.xp) > 0)
      && !(Number(save.coinsEarned) > 0)
      && !(Number(save.parts) > 0);
  }

  function summarizeSave(save) {
    const s = save || {};
    const st = saveStats(s);
    return {
      name: String((s.profile && s.profile.name) || 'Jugador'),
      level: Math.max(1, Math.floor(Number(s.level) || 1)),
      xp: totalXpOf(s),
      coins: Math.max(0, Math.floor(Number(s.coins) || 0)),
      best: Math.max(0, Math.floor(Number(st.best) || 0)),
      flights: Math.max(0, Math.floor(Number(st.flights) || 0))
    };
  }

  // Compara dos progresos de la MISMA cuenta/dispositivo. Solo se usan
  // contadores que nunca bajan al jugar (vuelos, XP, récord, monedas ganadas).
  function compareSaves(a, b) {
    const va = progressVector(a);
    const vb = progressVector(b);
    for (let i = 0; i < va.length; i++) {
      if (va[i] !== vb[i]) return va[i] < vb[i] ? -1 : 1;
    }
    return 0;
  }

  function progressVector(save) {
    const s = save || {};
    const st = saveStats(s);
    return [
      Math.max(0, Math.floor(Number(st.flights) || 0)),
      totalXpOf(s),
      Math.max(0, Math.floor(Number(st.best) || 0)),
      Math.max(0, Math.floor(Number(st.coinsGot) || 0)) + Math.max(0, Math.floor(Number(st.spent) || 0)),
      Math.max(0, Math.floor(Number(st.pipes) || 0)),
      Math.max(0, Math.floor(Number(st.dist) || 0))
    ];
  }

  function byteLength(text) {
    const s = String(text || '');
    if (typeof TextEncoder !== 'undefined') {
      try { return new TextEncoder().encode(s).length; } catch (e) { }
    }
    return s.length * 2;
  }

  // La copia de la nube no puede pasar de 1 MB. Si el guardado crece (replay,
  // historial), se recortan primero los datos prescindibles.
  function serializeSave(save) {
    let copy = JSON.parse(JSON.stringify(save));
    let raw = JSON.stringify(copy);
    if (byteLength(raw) <= ACCOUNT_SAVE_MAX) return raw;
    if (copy.replay) {
      copy.replay = { score: copy.replay.score, seed: copy.replay.seed, date: copy.replay.date, map: copy.replay.map, taps: [] };
      raw = JSON.stringify(copy);
      if (byteLength(raw) <= ACCOUNT_SAVE_MAX) return raw;
    }
    copy.replay = null;
    if (Array.isArray(copy.knownNames)) copy.knownNames = copy.knownNames.slice(-100);
    if (Array.isArray(copy.history)) copy.history = copy.history.slice(0, 10);
    if (Array.isArray(copy.runs)) copy.runs = copy.runs.slice(0, 10);
    if (Array.isArray(copy.players)) copy.players = copy.players.slice(0, 5);
    raw = JSON.stringify(copy);
    return byteLength(raw) <= ACCOUNT_SAVE_MAX ? raw : '';
  }

  function restoreCloud(cloudRaw) {
    const local = localSave();
    if (local && JSON.stringify(local) === cloudRaw) return false;
    state.restoring = true;
    try {
      const r = (window.SAVE && typeof window.SAVE.importData === 'function')
        ? window.SAVE.importData(cloudRaw)
        : { ok: false };
      if (!r || !r.ok) { state.restoring = false; return false; }
      if (state.username && window.SAVE && typeof window.SAVE.setProfileName === 'function') {
        window.SAVE.setProfileName(state.username);
      }
      setTimeout(function () {
        try { if (typeof location !== 'undefined' && typeof location.reload === 'function') location.reload(); }
        catch (e) { }
      }, 60);
      return true;
    } catch (err) {
      state.restoring = false;
      warn('restoreCloud:', err);
      return false;
    }
  }

  async function readAccount() {
    if (!db || !state.uid) return null;
    const snap = await M.fsMod.getDoc(M.fsMod.doc(db, 'accounts', state.uid));
    return snap.exists() ? (snap.data() || null) : null;
  }

  async function writeAccount(username) {
    if (!state.account || !db || !state.uid) return false;
    const save = localSave();
    if (!save) return false;
    const raw = serializeSave(save);
    if (!raw) {
      warn('El guardado es demasiado grande para la nube.');
      return false;
    }
    const st = saveStats(save);
    const name = String(username || state.username || (save.profile && save.profile.name) || 'Jugador').slice(0, 16);
    try {
      await M.fsMod.setDoc(M.fsMod.doc(db, 'accounts', state.uid), {
        uid: state.uid,
        username: name,
        nameKey: nameKey(name),
        save: raw,
        saveLevel: Math.max(1, Math.min(999, Math.floor(Number(save.level) || 1))),
        saveBest: Math.max(0, Math.min(10000000, Math.floor(Number(st.best) || 0))),
        saveFlights: Math.max(0, Math.min(100000000, Math.floor(Number(st.flights) || 0))),
        saveAt: Date.now(),
        updatedAt: M.fsMod.serverTimestamp(),
        schema: ACCOUNT_SCHEMA
      }, { merge: true });
      state.hasAccount = true;
      state.lastSync = Date.now();
      return true;
    } catch (err) {
      warn('writeAccount:', err);
      return false;
    }
  }

  async function uploadSave() {
    if (!state.account || state.pending || state.restoring) return false;
    return writeAccount(state.username);
  }

  function scheduleSaveSync() {
    if (!state.account || !state.ready || state.pending || state.restoring) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      uploadSave();
    }, 2500);
  }

  function status() {
    return {
      status: state.status,
      ready: state.ready,
      uid: state.uid,
      name: state.name,
      account: state.account,
      username: state.username,
      hasAccount: state.hasAccount,
      pending: state.pending,
      error: state.error,
      lastSync: state.lastSync,
      configured: configured(),
      online: (typeof navigator === 'undefined' || navigator.onLine !== false),
      board: OPT.board || 'global'
    };
  }

  function signedOutFlag() {
    try { return localStorage.getItem(SIGNED_OUT_KEY) === '1'; } catch (e) { return false; }
  }

  function setSignedOutFlag(on) {
    try {
      if (on) localStorage.setItem(SIGNED_OUT_KEY, '1');
      else localStorage.removeItem(SIGNED_OUT_KEY);
    } catch (e) { }
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
      /* El emulador de Auth se conecta ANTES de tocar la persistencia: al
         recargar con una sesión guardada, Firebase intenta restaurarla y, si
         el emulador aún no está conectado, la petición se iría a producción
         con la apiKey de demo y la sesión se perdería. */
      if (CFG.emulators && CFG.emulators.auth) {
        try { authMod.connectAuthEmulator(auth, CFG.emulators.auth, { disableWarnings: true }); }
        catch (e) { warn('emulador auth:', e); }
      }
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

      /* Solo para pruebas locales: permite apuntar a los emuladores sin
         tocar la configuración de producción. Auth ya se conectó arriba. */
      if (CFG.emulators) {
        try {
          if (CFG.emulators.firestore) {
            const hp = String(CFG.emulators.firestore).split(':');
            fsMod.connectFirestoreEmulator(db, hp[0], Number(hp[1] || 8080));
          }
        } catch (e) { warn('emulador firestore:', e); }
        try {
          if (CFG.emulators.database) {
            const hp = String(CFG.emulators.database).split(':');
            rtdbMod.connectDatabaseEmulator(rtdb, hp[0], Number(hp[1] || 9000));
          }
        } catch (e) { warn('emulador database:', e); }
      }

      /* Con la sesión cerrada a propósito no se crea un invitado anónimo:
         el jugador sigue en modo local hasta que vuelva a iniciar sesión. */
      if (!auth.currentUser && !signedOutFlag()) await authMod.signInAnonymously(auth);

      state.name = localProfile().name || 'Jugador';

      authMod.onAuthStateChanged(auth, function (user) {
        state.uid = user ? user.uid : null;
        state.account = !!(user && !user.isAnonymous);
        if (!user) {
          state.ready = false;
          state.status = 'off';
          state.username = '';
          state.hasAccount = false;
        }
      });

      if (!auth.currentUser) {
        state.uid = null;
        state.account = false;
        state.username = '';
        state.hasAccount = false;
        state.ready = false;
        state.status = 'off';
        state.error = null;
        emit('cloudstatus', status());
        return status();
      }

      state.uid = auth.currentUser.uid;
      state.account = !auth.currentUser.isAnonymous;
      if (state.account) {
        /* El nombre de la cuenta se completa al leer accounts/{uid}. */
        state.username = '';
      }

      await ensurePlayer();
      state.ready = true;
      state.status = 'online';
      state.error = null;
      state.lastSync = Date.now();

      emit('cloudready', status());
      emit('cloudstatus', status());

      if (state.account) {
        const boot = await bootAccount();
        if (boot && boot.stop) return status();
      } else {
        state.username = '';
      }

      await syncProfile();
      await syncLeaderboard();
      await flushQueue();
      // Los invitados ya no reservan nombres: el nombre solo se fija al crear
      // una cuenta, y la sección para cambiarlo se retiró del perfil.
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
  /* Nombres únicos a nivel global                                        */
  /* ------------------------------------------------------------------ */

  function nameKey(name) {
    if (window.SAVE && typeof window.SAVE.nameKey === 'function') return window.SAVE.nameKey(name);
    const nm = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
    if (!nm) return '';
    let key = nm;
    try { key = nm.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { key = nm; }
    key = key.toLowerCase().replace(/\s+/g, ' ').trim();
    try { return 'n_' + encodeURIComponent(key); } catch (e) { return ''; }
  }

  /* Consulta si un nombre está libre. No reserva nada. */
  async function checkName(name) {
    if (!configured()) return { ok: true, available: true, local: true };
    const key = nameKey(name);
    if (!key) return { ok: false, available: false, msg: 'Nombre no válido.' };
    try {
      if (!state.ready) await init();
      if (!state.ready || !db) return { ok: true, available: true, offline: true, key: key };
      const snap = await M.fsMod.getDoc(M.fsMod.doc(db, 'names', key));
      if (!snap.exists()) return { ok: true, available: true, key: key };
      const d = snap.data() || {};
      if (d.uid && d.uid !== state.uid) {
        return { ok: false, available: false, taken: true, owner: String(d.name || ''), key: key };
      }
      return { ok: true, available: true, mine: true, key: key };
    } catch (err) {
      warn('checkName:', err);
      return { ok: true, available: true, offline: true, error: String((err && err.message) || err), key: key };
    }
  }

  /* Reserva el nombre de forma transaccional y libera el anterior del mismo
     uid. Si otro jugador ya lo tiene, devuelve { ok:false, taken:true }. */
  async function claimName(name) {
    if (!configured()) return { ok: true, local: true };
    const key = nameKey(name);
    if (!key) return { ok: false, msg: 'Nombre no válido.' };
    try {
      if (!state.ready) await init();
      if (!state.ready || !db || !state.uid) return { ok: true, offline: true, key: key };

      const prev = localProfile();
      const oldKey = prev && prev.name ? nameKey(prev.name) : '';
      let taken = false;
      let owner = '';

      await M.fsMod.runTransaction(db, async function (tx) {
        const newRef = M.fsMod.doc(db, 'names', key);
        const oldRef = (oldKey && oldKey !== key) ? M.fsMod.doc(db, 'names', oldKey) : null;
        const newSnap = await tx.get(newRef);
        const oldSnap = oldRef ? await tx.get(oldRef) : null;

        if (newSnap.exists()) {
          const d = newSnap.data() || {};
          if (d.uid && d.uid !== state.uid) {
            taken = true;
            owner = String(d.name || '');
            return;
          }
          if (oldSnap && oldSnap.exists() && (oldSnap.data() || {}).uid === state.uid) tx.delete(oldRef);
          tx.set(newRef, {
            key: key, name: name, uid: state.uid,
            createdAt: d.createdAt || M.fsMod.serverTimestamp(),
            updatedAt: M.fsMod.serverTimestamp()
          }, { merge: true });
          return;
        }

        if (oldSnap && oldSnap.exists() && (oldSnap.data() || {}).uid === state.uid) tx.delete(oldRef);
        tx.set(newRef, {
          key: key, name: name, uid: state.uid,
          createdAt: M.fsMod.serverTimestamp(),
          updatedAt: M.fsMod.serverTimestamp()
        });
      });

      if (taken) return { ok: false, taken: true, owner: owner, key: key };
      return { ok: true, key: key };
    } catch (err) {
      // Sin red no se puede verificar: se permite el guardado local y la UI
      // avisa de que la unicidad global se comprobará al reconectar.
      warn('claimName:', err);
      return { ok: true, offline: true, error: String((err && err.message) || err), key: key };
    }
  }

  /* ------------------------------------------------------------------ */
  /* Cuenta: registro, inicio de sesión y progreso completo en la nube   */
  /* ------------------------------------------------------------------ */

  function accountPayloadSummary(save) {
    return summarizeSave(save);
  }

  /* Decide qué hacer al arrancar con una cuenta ya recordada por el SDK. */
  async function bootAccount() {
    let acc = null;
    try { acc = await readAccount(); }
    catch (err) { warn('bootAccount:', err); }

    if (!acc) {
      // Cuenta autenticada sin copia en la nube (por ejemplo, creada antes de
      // esta versión): se sube el progreso actual como primera copia.
      state.username = (localProfile().name || 'Jugador').slice(0, 16);
      await writeAccount(state.username);
      return { stop: false };
    }

    state.hasAccount = true;
    state.username = String(acc.username || (localProfile().name || 'Jugador')).slice(0, 16);
    const cloudRaw = (typeof acc.save === 'string' && acc.save) ? acc.save : '';
    const cloudSave = safeParse(cloudRaw);
    const local = localSave();

    if (!cloudSave) {
      await writeAccount(state.username);
      return { stop: false };
    }
    if (!local) return { stop: false };

    if (JSON.stringify(local) === cloudRaw) return { stop: false };

    // Un dispositivo nuevo (sin partidas) recupera la cuenta sin preguntar.
    if (isFreshSave(local)) {
      if (restoreCloud(cloudRaw)) return { stop: true };
      await writeAccount(state.username);
      return { stop: false };
    }

    const sameDevice = !!(local.profile && cloudSave.profile && local.profile.id && local.profile.id === cloudSave.profile.id);
    if (sameDevice) {
      // Mismo jugador: el progreso más avanzado manda sin molestar.
      if (compareSaves(local, cloudSave) < 0) {
        if (restoreCloud(cloudRaw)) return { stop: true };
      }
      await writeAccount(state.username);
      return { stop: false };
    }

    // Dos progresos distintos: se pregunta antes de descartar ninguno.
    pendingLogin = {
      username: state.username,
      cloudRaw: cloudRaw,
      local: summarizeSave(local),
      cloud: summarizeSave(cloudSave),
      reason: 'boot'
    };
    state.pending = true;
    emit('accountchoice', {
      reason: 'boot',
      username: state.username,
      local: pendingLogin.local,
      cloud: pendingLogin.cloud
    });
    return { stop: true };
  }

  async function finishLogin(username) {
    state.pending = false;
    pendingLogin = null;
    // Reclama el nombre antes de cambiarlo en local, para liberar la reserva
    // anterior del mismo uid (por ejemplo, el nombre aleatorio de invitado).
    const claim = await claimName(username);
    if (window.SAVE && typeof window.SAVE.setProfileName === 'function') {
      window.SAVE.setProfileName(username);
    }
    state.name = username;
    state.username = username;
    await writeAccount(username);
    await syncProfile();
    await syncLeaderboard();
    await flushQueue();
    if (OPT.presence) startPresence();
    if (claim && claim.taken) {
      emit('nameconflict', { name: username, owner: claim.owner });
      return { ok: true, warning: 'name_taken' };
    }
    return { ok: true };
  }

  /* Crea una cuenta nueva vinculando la sesión anónima actual (mismo uid),
     de modo que el nombre y el progreso que ya existen no se pierdan. */
  async function register(rawName, password) {
    if (!configured()) return { ok: false, msg: 'La nube no está configurada.' };
    await init();
    const u = cleanUser(rawName);
    if (!u.ok) return u;
    if (!passwordOk(password)) return { ok: false, msg: 'La contraseña debe tener entre 6 y 128 caracteres.' };
    if (!M || !auth || !db) return { ok: false, msg: 'Sin conexión con la nube. Revisa tu red e inténtalo de nuevo.' };
    if (state.account) return { ok: false, msg: 'Ya hay una sesión iniciada. Cierra sesión para crear otra cuenta.' };

    setSignedOutFlag(false);
    if (!auth.currentUser) {
      try { await M.authMod.signInAnonymously(auth); }
      catch (err) { return { ok: false, msg: authMessage(err) }; }
    }
    state.uid = auth.currentUser.uid;
    state.ready = true;
    state.status = 'online';

    // Comprueba el nombre antes de crear la cuenta: si ya está ocupado no se
    // deja una cuenta huérfana con un correo interno ya gastado.
    const chk = await checkName(u.name);
    if (chk && chk.taken) return { ok: false, msg: 'Ese nombre ya lo usa otro jugador. Elige otro.' };
    if (chk && chk.offline) return { ok: false, msg: 'Sin conexión: no se pudo comprobar si el nombre está libre.' };

    const email = emailFor(u.name);
    const cred = M.authMod.EmailAuthProvider.credential(email, password);
    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        await M.authMod.linkWithCredential(auth.currentUser, cred);
      } else {
        await M.authMod.createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      return { ok: false, msg: authMessage(err), code: String((err && err.code) || '') };
    }

    state.uid = auth.currentUser.uid;
    state.account = true;
    state.ready = true;
    state.status = 'online';
    state.error = null;
    state.username = u.name;

    const claim = await claimName(u.name);
    if (window.SAVE && typeof window.SAVE.setProfileName === 'function') window.SAVE.setProfileName(u.name);
    state.name = u.name;
    await writeAccount(u.name);
    await syncProfile();
    await syncLeaderboard();
    await flushQueue();
    if (OPT.presence) startPresence();
    state.hasAccount = true;
    emit('accountchanged', status());

    if (claim && claim.taken) {
      emit('nameconflict', { name: u.name, owner: claim.owner });
      return { ok: true, username: u.name, warning: 'name_taken' };
    }
    return { ok: true, username: u.name };
  }

  /* Inicia sesión en cualquier dispositivo. Devuelve needsChoice cuando hay
     progreso local y progreso en la nube distintos: la interfaz pregunta. */
  async function login(rawName, password) {
    if (!configured()) return { ok: false, msg: 'La nube no está configurada.' };
    await init();
    const u = cleanUser(rawName);
    if (!u.ok) return u;
    if (!passwordOk(password)) return { ok: false, msg: 'Escribe tu contraseña (mínimo 6 caracteres).' };
    if (!M || !auth || !db) return { ok: false, msg: 'Sin conexión con la nube. Revisa tu red e inténtalo de nuevo.' };

    setSignedOutFlag(false);
    if (auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.email === emailFor(u.name)) {
      return { ok: true, username: state.username || u.name, already: true };
    }

    if (auth.currentUser) {
      try { await M.authMod.signOut(auth); } catch (e) { }
    }
    state.ready = false;
    state.status = 'connecting';
    state.error = null;

    try {
      await M.authMod.signInWithEmailAndPassword(auth, emailFor(u.name), password);
    } catch (err) {
      // Si el intento falla, se recupera una sesión de invitado para que el
      // juego y el ranking sigan funcionando sin obligar a nada.
      try {
        if (!auth.currentUser) await M.authMod.signInAnonymously(auth);
        state.uid = auth.currentUser ? auth.currentUser.uid : null;
        state.account = false;
        state.ready = !!state.uid;
        state.status = state.uid ? 'online' : 'off';
      } catch (e2) { state.ready = false; state.status = 'off'; }
      return { ok: false, msg: authMessage(err), code: String((err && err.code) || '') };
    }

    state.uid = auth.currentUser.uid;
    state.account = true;
    state.ready = true;
    state.status = 'online';
    state.error = null;

    let acc = null;
    try { acc = await readAccount(); } catch (err) { warn('login/readAccount:', err); }
    const username = String((acc && acc.username) || u.name).slice(0, 16);
    state.username = username;
    state.hasAccount = !!acc;

    const cloudRaw = (acc && typeof acc.save === 'string' && acc.save) ? acc.save : '';
    const cloudSave = safeParse(cloudRaw);
    const local = localSave();

    if (!cloudSave) {
      const done = await finishLogin(username);
      return { ok: true, username: username, needsChoice: false, warning: done.warning };
    }

    const localJson = (function () {
      try { return localStorage.getItem('piovuelo_v1') || ''; } catch (e) { return ''; }
    })();

    if (isFreshSave(local) && localJson !== cloudRaw) {
      if (restoreCloud(cloudRaw)) return { ok: true, username: username, restored: true };
    }
    if (localJson === cloudRaw) {
      const done = await finishLogin(username);
      return { ok: true, username: username, needsChoice: false, warning: done.warning };
    }

    pendingLogin = {
      username: username,
      cloudRaw: cloudRaw,
      local: summarizeSave(local),
      cloud: summarizeSave(cloudSave),
      reason: 'login'
    };
    state.pending = true;
    emit('accountchanged', status());
    return {
      ok: true,
      username: username,
      needsChoice: true,
      local: pendingLogin.local,
      cloud: pendingLogin.cloud
    };
  }

  /* Resuelve la elección de progreso: 'cloud' descarga la copia de la cuenta
     y 'local' sube la copia de este dispositivo. */
  async function resolveLogin(mode) {
    if (!pendingLogin) return { ok: false, msg: 'No hay ningún progreso pendiente.' };
    const p = pendingLogin;
    if (mode === 'cloud') {
      if (restoreCloud(p.cloudRaw)) {
        pendingLogin = null;
        state.pending = false;
        return { ok: true, restoring: true };
      }
      pendingLogin = null;
      state.pending = false;
      return { ok: false, msg: 'No se pudo cargar el progreso de la cuenta.' };
    }
    const done = await finishLogin(p.username);
    setTimeout(function () {
      try { if (typeof location !== 'undefined' && typeof location.reload === 'function') location.reload(); }
      catch (e) { }
    }, 80);
    return { ok: true, warning: done.warning };
  }

  async function logout() {
    if (!state.account) return { ok: false, msg: 'No hay ninguna sesión iniciada.' };
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    await writeAccount(state.username);      // última copia antes de salir
    stopPresence();
    try { if (M && auth) await M.authMod.signOut(auth); } catch (e) { }
    setSignedOutFlag(true);
    pendingLogin = null;
    state.pending = false;
    state.account = false;
    state.username = '';
    state.hasAccount = false;
    state.uid = null;
    state.ready = false;
    state.status = 'off';
    state.error = null;
    emit('accountchanged', status());
    emit('cloudstatus', status());
    return { ok: true };
  }

  function session() {
    return {
      signedIn: !!state.uid,
      account: !!state.account,
      anonymous: !!state.uid && !state.account,
      username: state.username || '',
      name: localProfile().name || 'Jugador',
      hasAccount: !!state.hasAccount,
      pending: !!state.pending,
      configured: configured(),
      status: state.status
    };
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
      name: state.username || localProfile().name || 'Jugador',
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

  function stopPresence() {
    if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
    if (presenceRef && M && M.rtdbMod) {
      try {
        const d = presenceData();
        d.online = false;
        M.rtdbMod.set(presenceRef, d);
        M.rtdbMod.onDisconnect(presenceRef).cancel();
      } catch (e) { }
    }
    presenceRef = null;
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
    window.addEventListener('piovuelo:saved', function () { scheduleSaveSync(); });
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && state.account && !state.pending) {
          if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
          uploadSave();
        }
      });
    }
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
    session: session,
    register: register,
    login: login,
    logout: logout,
    resolveLogin: resolveLogin,
    uploadSave: uploadSave,
    syncProfile: syncProfile,
    syncLeaderboard: syncLeaderboard,
    checkName: checkName,
    claimName: claimName,
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
