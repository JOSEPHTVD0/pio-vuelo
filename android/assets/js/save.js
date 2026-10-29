/* Progreso persistente: monedas, XP, niveles, logros, tienda, ajustes */
window.SAVE = (function () {
  'use strict';

  const KEY = 'piovuelo_v1';
  const DEFAULT_PERKS = { coins: 80 };

  function defaults() {
    return {
      v: 1,
      coins: DEFAULT_PERKS.coins,
      coinsEarned: 0,
      parts: 0,             // 🔩 piezas: material para mejoras de nivel alto
      level: 1,
      xp: 0,
      stats: { best: 0, flights: 0, pipes: 0, timePlayed: 0, coinsGot: 0, dist: 0, powersGot: 0, spent: 0, megaGot: 0, dailyClaimed: 0, enemiesGot: 0, xcGot: 0, toolsUsed: 0, toolsBought: 0, shared: 0, batsGot: 0, chainGot: 0, gemsGot: 0, challengePlayed: 0, manualUses: 0, upgs: 0, missionsDone: 0, toolTypes: [], shieldAbsorbed: 0, ghostPassed: 0, weekendRuns: 0, fenixUsed: 0, maxDistNoHit: 0, zeroCoinRuns: 0, duelWins: 0, windZones: 0, giantPassed: 0, replaysWatched: 0, seedDays: 0, zenBest: 0, bossDefeated: 0, partsEarned: 0, toolsRepaired: 0 },
      best3: [],
      items: { start: 0, magnet: 0, slow: 0, coins: 0, boost: 0, luck: 0, score: 0, sprint: 0, treasure: 0, clock: 0, turbo: 0, combo: 0, shield: 0, ghost: 0, frenzy: 0, eco: 0, hype: 0, bomb: 0, aura: 0, twin: 0, oasis: 0, doble: 0, runa: 0, titan: 0, fenix: 0, bateria: 0, cris: 0, ferro: 0, para: 0, zoom: 0, mirilla: 0, amuleto: 0, rescate: 0, ticket: 0, radar: 0, bala: 0, flot: 0 },
      toolUp: {},           // nivel de mejora por herramienta (0..5)
      toolMode: {},         // 'auto' | 'manual' por herramienta (default auto)
      toolDur: {},          // durabilidad actual por herramienta
      dailyC: { date: '', best: 0, played: false },
      dailyH: {},
      replay: null,
      maxCombo: 0,
      achieved: [],
      skin: 'classic', skinsOwned: [{ id: 'classic' }],
      hat: null, hatsOwned: [],
      fx: 'fx-none', fxOwned: [{ id: 'fx-none' }],
      map: 'day', mapsOwned: [{ id: 'day' }],
      set: { sfx: true, music: true, vib: true, diff: 'normal', gfx: 'high', mode: 'free', hc: false, moon: false, volS: 1, volM: 1, volG: 1, reduced: false, shake: true, lift: false, fps: 0, sens: 1, notif: true, uiAnim: true, confirmBuy: false },
      tutorialDone: false,
      history: [],          // últimas compras/mejoras/reparaciones (máx. 30)
      dailyM: { date: '', claimed: [] },
      dailyBase: {},        // progreso de 0 para las misiones diarias de hoy
      weeklyM: { week: '', claimed: [] },
      weeklyBase: {},       // progreso de 0 para las misiones semanales de esta semana
      passClaimed: [],
      passSeason: '',
      seasonClaimed: [],
      lastDaily: '',
      dailyStreak: 0,
      firstRun: true,
      // Identidad local + ranking de este dispositivo (no hay servidor)
      profile: { id: '', name: '', created: 0 },
      knownNames: [],       // nombres usados en este dispositivo (evita duplicados locales)
      players: [],          // registro agregado para la tabla de récords local
      runs: [],             // historial reciente de vuelos (máx. RUN_HISTORY)
      shields: 0,           // inventario persistente de escudos (no se reinicia por partida)
      nest: {
        decor: { bg: 'bg-cielo', floor: 'fl-pasto', poster: 'po-estrella', rug: 'rug-nada' },
        decorOwned: ['bg-cielo', 'fl-pasto', 'po-estrella', 'rug-nada'],
        eggs: []
      }
    };
  }

  let data = null;
  let saveError = false;   // último guardado falló (cuota/permisos)
  let loadError = false;   // no se pudo leer localStorage

  const RUN_HISTORY = 30;  // vuelos recientes que se conservan para la tabla
  const NAME_MIN = 2;
  const NAME_MAX = 16;
  // Letras (con acentos), números, espacio, punto, guion y guion bajo.
  const NAME_ILLEGAL = /[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÖØ-öø-ÿ _.\-]/g;
  const NAME_A = ['Jugador', 'Pio', 'Fenix', 'Halcon', 'Cometa', 'Tornado', 'Estrella', 'Rayo', 'Cielo', 'Nube', 'Aurora', 'Bravo', 'Veloz', 'Titan', 'Mirlo', 'Colibri', 'Zafiro', 'Rubi', 'Leon', 'Luna'];
  const NAME_B = ['Fenix', 'Veloz', 'Alado', 'Celeste', 'Dorado', 'Fuego', 'Hielo', 'Viento', 'Solar', 'Lunar', 'Turbo', 'Nube', 'Relampago', 'Aventura', 'Campeon', 'Pajaro', 'Pluma', 'Ala', 'Vuelo', 'Cometa'];

  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  function newId() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // Limpia un nombre: quita caracteres no permitidos, colapsa espacios y recorta.
  function cleanName(v) {
    if (typeof v !== 'string') return '';
    let s = v.replace(NAME_ILLEGAL, '').replace(/\s+/g, ' ').trim();
    if (s.length > NAME_MAX) s = s.slice(0, NAME_MAX).trim();
    return s;
  }

  function nameTaken(nm) {
    if (!nm) return false;
    const low = nm.toLowerCase();
    if (data.profile && data.profile.name && data.profile.name.toLowerCase() === low) return false;
    return (data.knownNames || []).some(n => typeof n === 'string' && n.toLowerCase() === low);
  }

  // Nombre aleatorio único del tipo JugadorFenix482 (no reserva el nombre).
  function randomName() {
    for (let i = 0; i < 60; i++) {
      const a = NAME_A[Math.floor(Math.random() * NAME_A.length)];
      const b = NAME_B[Math.floor(Math.random() * NAME_B.length)];
      const n = a + b + (100 + Math.floor(Math.random() * 900));
      if (n.length >= NAME_MIN && n.length <= NAME_MAX && !nameTaken(n)) return n;
    }
    return 'Jugador' + Date.now().toString(36).slice(-5).toUpperCase();
  }

  // Completa/valida identidad, ranking e inventario de escudos (migración incluida).
  function ensureIdentity() {
    if (!data.profile || typeof data.profile !== 'object' || Array.isArray(data.profile)) {
      data.profile = { id: '', name: '', created: 0 };
    }
    if (typeof data.profile.id !== 'string' || !data.profile.id) data.profile.id = newId();
    if (num(data.profile.created) <= 0) data.profile.created = Date.now();
    if (!Array.isArray(data.knownNames)) data.knownNames = [];
    data.knownNames = data.knownNames
      .filter(n => typeof n === 'string' && n.trim().length)
      .map(n => cleanName(n))
      .filter(n => n.length >= NAME_MIN && n.length <= NAME_MAX)
      .slice(-600);
    const nm = cleanName(data.profile.name);
    data.profile.name = nm || randomName();
    if (!data.knownNames.some(n => n.toLowerCase() === data.profile.name.toLowerCase())) {
      data.knownNames.push(data.profile.name);
    }
    if (!Array.isArray(data.players)) data.players = [];
    data.players = data.players.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && p.id);
    data.players.forEach(p => {
      p.name = cleanName(p.name) || 'Jugador';
      p.best = Math.max(0, Math.floor(num(p.best)));
      p.last = Math.max(0, Math.floor(num(p.last)));
      p.games = Math.max(0, Math.floor(num(p.games)));
      p.bestDate = Math.max(0, num(p.bestDate));
      p.lastDate = Math.max(0, num(p.lastDate));
    });
    let me = data.players.find(p => p.id === data.profile.id);
    if (!me) {
      me = { id: data.profile.id, name: data.profile.name, best: 0, last: 0, games: 0, bestDate: 0, lastDate: 0 };
      // conserva el récord histórico de saves antiguos aunque no haya historial
      if (num(data.stats.best) > 0) { me.best = Math.floor(num(data.stats.best)); me.bestDate = 0; }
      data.players.push(me);
    }
    me.name = data.profile.name;
    me.best = Math.max(me.best, Math.max(0, Math.floor(num(data.stats.best))));
    if (!Array.isArray(data.runs)) data.runs = [];
    data.runs = data.runs
      .filter(r => r && typeof r === 'object' && typeof r.score === 'number' && isFinite(r.score))
      .slice(0, RUN_HISTORY);
    data.runs.forEach(r => {
      r.score = Math.max(0, Math.floor(r.score));
      r.pipes = Math.max(0, Math.floor(num(r.pipes)));
      r.coins = Math.max(0, Math.floor(num(r.coins)));
      r.dist = Math.max(0, Math.floor(num(r.dist)));
      r.date = Math.max(0, num(r.date));
      r.mode = typeof r.mode === 'string' ? r.mode : 'free';
    });
    if (typeof data.shields !== 'number' || !isFinite(data.shields)) data.shields = 0;
    data.shields = Math.max(0, Math.floor(data.shields));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          // save corrupto: se respalda y se parte de cero (no se pierde silenciosamente)
          try { localStorage.setItem(KEY + '_bak', raw); } catch (e2) { }
          data = defaults(); ensureIdentity(); ensurePassSeason(); return true;
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          try { localStorage.setItem(KEY + '_bak', raw); } catch (e2) { }
          data = defaults(); ensureIdentity(); ensurePassSeason(); return true;
        }
        data = Object.assign(defaults(), parsed);
        // los stats se fusionan en profundidad: si el save viejo no traía los
        // contadores más antiguos (best/flights/pipes/timePlayed/coinsGot) no se quedan indefinidos
        data.stats = Object.assign({}, defaults().stats, (parsed.stats && typeof parsed.stats === 'object') ? parsed.stats : {});
        // bases de progreso de misiones (migración)
        if (!data.dailyBase || typeof data.dailyBase !== 'object') data.dailyBase = {};
        if (!data.weeklyBase || typeof data.weeklyBase !== 'object') data.weeklyBase = {};
        // asegurar listas mínimas
        if (!data.skinsOwned) data.skinsOwned = [{ id: 'classic' }];
        if (!data.fxOwned) data.fxOwned = [{ id: 'fx-none' }];
        if (!data.mapsOwned) data.mapsOwned = [{ id: 'day' }];
        if (!data.hatsOwned) data.hatsOwned = [];
        if (!data.stats) data.stats = defaults().stats;
        // números globales siempre válidos (nunca NaN/negativos)
        if (typeof data.level !== 'number' || data.level < 1) data.level = 1;
        if (typeof data.xp !== 'number' || data.xp < 0) data.xp = 0;
        if (typeof data.coins !== 'number' || data.coins < 0) data.coins = 0;
        if (typeof data.coinsEarned !== 'number' || data.coinsEarned < 0) data.coinsEarned = 0;
        if (typeof data.maxCombo !== 'number' || data.maxCombo < 0) data.maxCombo = 0;
        if (typeof data.stats.best !== 'number' || data.stats.best < 0) data.stats.best = 0;
        if (typeof data.stats.flights !== 'number' || data.stats.flights < 0) data.stats.flights = 0;
        if (typeof data.stats.pipes !== 'number' || data.stats.pipes < 0) data.stats.pipes = 0;
        if (typeof data.stats.timePlayed !== 'number' || data.stats.timePlayed < 0) data.stats.timePlayed = 0;
        if (typeof data.stats.coinsGot !== 'number' || data.stats.coinsGot < 0) data.stats.coinsGot = 0;
        if (typeof data.stats.dist !== 'number') data.stats.dist = 0;
        if (typeof data.stats.powersGot !== 'number') data.stats.powersGot = 0;
        if (typeof data.stats.spent !== 'number') data.stats.spent = 0;
        if (typeof data.stats.megaGot !== 'number') data.stats.megaGot = 0;
        if (typeof data.stats.dailyClaimed !== 'number') data.stats.dailyClaimed = 0;
        if (typeof data.stats.enemiesGot !== 'number') data.stats.enemiesGot = 0;
        if (typeof data.stats.xcGot !== 'number') data.stats.xcGot = 0;
        if (typeof data.stats.toolsUsed !== 'number') data.stats.toolsUsed = 0;
        if (typeof data.stats.toolsBought !== 'number') data.stats.toolsBought = 0;
        if (typeof data.stats.shared !== 'number') data.stats.shared = 0;
        if (typeof data.stats.batsGot !== 'number') data.stats.batsGot = 0;
        if (typeof data.stats.chainGot !== 'number') data.stats.chainGot = 0;
        if (typeof data.stats.gemsGot !== 'number') data.stats.gemsGot = 0;
        if (typeof data.stats.challengePlayed !== 'number') data.stats.challengePlayed = 0;
        if (typeof data.stats.manualUses !== 'number') data.stats.manualUses = 0;
        if (typeof data.stats.upgs !== 'number') data.stats.upgs = 0;
        if (typeof data.stats.missionsDone !== 'number') data.stats.missionsDone = 0;
        if (typeof data.stats.shieldAbsorbed !== 'number') data.stats.shieldAbsorbed = 0;
        if (typeof data.stats.ghostPassed !== 'number') data.stats.ghostPassed = 0;
        if (typeof data.stats.weekendRuns !== 'number') data.stats.weekendRuns = 0;
        if (typeof data.stats.fenixUsed !== 'number') data.stats.fenixUsed = 0;
        if (typeof data.stats.maxDistNoHit !== 'number') data.stats.maxDistNoHit = 0;
        if (typeof data.stats.zeroCoinRuns !== 'number') data.stats.zeroCoinRuns = 0;
        if (typeof data.stats.duelWins !== 'number') data.stats.duelWins = 0;
        if (typeof data.stats.windZones !== 'number') data.stats.windZones = 0;
        if (typeof data.stats.giantPassed !== 'number') data.stats.giantPassed = 0;
        if (typeof data.stats.replaysWatched !== 'number') data.stats.replaysWatched = 0;
        if (typeof data.stats.seedDays !== 'number') data.stats.seedDays = 0;
        if (!Array.isArray(data.stats.toolTypes)) data.stats.toolTypes = [];
        if (typeof data.parts !== 'number' || !isFinite(data.parts) || data.parts < 0) data.parts = 0;
        data.parts = Math.floor(data.parts);
        if (typeof data.stats.partsEarned !== 'number' || data.stats.partsEarned < 0) data.stats.partsEarned = 0;
        if (typeof data.stats.toolsRepaired !== 'number' || data.stats.toolsRepaired < 0) data.stats.toolsRepaired = 0;
        if (typeof data.toolUp !== 'object' || !data.toolUp) data.toolUp = {};
        if (typeof data.toolMode !== 'object' || !data.toolMode) data.toolMode = {};
        if (typeof data.toolDur !== 'object' || !data.toolDur) data.toolDur = {};
        // valida niveles y durabilidad; las herramientas nuevas arrancan al máximo
        DAT.TOOLS.forEach(t => {
          let lv = data.toolUp[t.key];
          data.toolUp[t.key] = (typeof lv === 'number' && isFinite(lv)) ? Math.max(0, Math.min(5, Math.floor(lv))) : 0;
          const max = DAT.toolMaxDur(t.key, data.toolUp[t.key]);
          let cur = data.toolDur[t.key];
          data.toolDur[t.key] = (typeof cur === 'number' && isFinite(cur)) ? Math.max(0, Math.min(max, cur)) : max;
        });
        // inventario: sin duplicados ni elementos desconocidos
        const dedupe = (list, source, allowGold) => {
          const seen = {};
          return (Array.isArray(list) ? list : []).filter(e => {
            const id = e && e.id;
            if (!id || seen[id]) return false;
            const known = source.some(x => x.id === id) ||
              (allowGold && id.length > 5 && id.slice(-5) === '-gold' && source.some(x => x.id === id.slice(0, -5)));
            if (!known) return false;
            seen[id] = true;
            return true;
          }).map(e => Object.assign({}, e, { id: e.id }));
        };
        data.skinsOwned = dedupe(data.skinsOwned, DAT.SKINS, true);
        data.hatsOwned = dedupe(data.hatsOwned, DAT.HATS);
        data.fxOwned = dedupe(data.fxOwned, DAT.EFFECTS);
        data.mapsOwned = dedupe(data.mapsOwned, DAT.MAPS);
        if (!owns(data.skinsOwned, 'classic')) data.skinsOwned.unshift({ id: 'classic' });
        if (!owns(data.fxOwned, 'fx-none')) data.fxOwned.unshift({ id: 'fx-none' });
        if (!owns(data.mapsOwned, 'day')) data.mapsOwned.unshift({ id: 'day' });
        if (!owns(data.skinsOwned, data.skin)) data.skin = 'classic';
        if (data.hat && !owns(data.hatsOwned, data.hat)) data.hat = null;
        if (!owns(data.fxOwned, data.fx)) data.fx = 'fx-none';
        if (!owns(data.mapsOwned, data.map)) data.map = 'day';
        if (!Array.isArray(data.history)) data.history = [];
        data.history = data.history.filter(h => h && typeof h === 'object' && typeof h.k === 'string').slice(0, 30);
        data.tutorialDone = data.tutorialDone === true;
        if (!Array.isArray(data.history)) data.history = [];
        if (!data.dailyC || typeof data.dailyC !== 'object') data.dailyC = { date: '', best: 0, played: false };
        if (!data.dailyH || typeof data.dailyH !== 'object') data.dailyH = {};
        if (data.replay === undefined) data.replay = null;
        if (typeof data.dailyC.best !== 'number') data.dailyC.best = 0;
        if (typeof data.dailyC.date !== 'string') data.dailyC.date = '';
        if (data.dailyC.played === undefined) data.dailyC.played = false;
        if (!data.items || typeof data.items !== 'object') data.items = {};
        Object.keys(defaults().items).forEach(k => {
          if (typeof data.items[k] !== 'number' || data.items[k] < 0) data.items[k] = 0;
        });
        if (!Array.isArray(data.best3)) data.best3 = [];
        data.best3 = data.best3.filter(e => e && typeof e.s === 'number').slice(0, 3);
        if (typeof data.lastDaily !== 'string') data.lastDaily = '';
        if (typeof data.dailyStreak !== 'number') data.dailyStreak = 0;
        if (!data.set) data.set = defaults().set;
        ['sfx', 'music', 'vib', 'diff', 'gfx', 'mode', 'hc', 'moon', 'volS', 'volM', 'volG', 'reduced', 'shake', 'lift', 'fps', 'sens', 'notif', 'uiAnim', 'confirmBuy'].forEach(k => {
          if (data.set[k] === undefined) data.set[k] = defaults().set[k];
        });
        // sanea ajustes numéricos/booleanos (saves antiguos o manipulados)
        data.set.volS = Math.max(0, Math.min(1, num(data.set.volS) || 0));
        data.set.volM = Math.max(0, Math.min(1, num(data.set.volM) || 0));
        data.set.volG = Math.max(0, Math.min(1, isFinite(num(data.set.volG)) ? num(data.set.volG) : 1));
        data.set.sens = Math.max(0.5, Math.min(1.5, num(data.set.sens) || 1));
        data.set.fps = [0, 30, 60, 120].indexOf(num(data.set.fps)) !== -1 ? num(data.set.fps) : 0;
        ['sfx', 'music', 'vib', 'hc', 'moon', 'reduced', 'shake', 'lift', 'notif', 'uiAnim', 'confirmBuy'].forEach(k => {
          data.set[k] = data.set[k] !== false;
        });
        if (['free', 'zen', 'boss', 'wind'].indexOf(data.set.mode) === -1) data.set.mode = 'free'; // migración: solo modos continuos se guardan
        if (!data.dailyM || typeof data.dailyM !== 'object') data.dailyM = { date: '', claimed: [] };
        if (typeof data.dailyM.date !== 'string') data.dailyM.date = '';
        if (!Array.isArray(data.dailyM.claimed)) data.dailyM.claimed = [];
        if (!data.weeklyM || typeof data.weeklyM !== 'object') data.weeklyM = { week: '', claimed: [] };
        if (typeof data.weeklyM.week !== 'string') data.weeklyM.week = '';
        if (!Array.isArray(data.weeklyM.claimed)) data.weeklyM.claimed = [];
        if (!Array.isArray(data.passClaimed)) data.passClaimed = [];
        if (typeof data.passSeason !== 'string') data.passSeason = '';
        if (!Array.isArray(data.seasonClaimed)) data.seasonClaimed = [];
        if (!data.achieved) data.achieved = [];
        if (!data.nest || typeof data.nest !== 'object') data.nest = defaults().nest;
        else {
          if (!data.nest.decor || typeof data.nest.decor !== 'object') data.nest.decor = defaults().nest.decor;
          else {
            ['bg', 'floor', 'poster', 'rug'].forEach(cat => {
              if (!data.nest.decor[cat] || !DAT.getDecor(data.nest.decor[cat]).cat) data.nest.decor[cat] = defaults().nest.decor[cat];
            });
          }
          if (!Array.isArray(data.nest.decorOwned)) data.nest.decorOwned = [];
          defaults().nest.decorOwned.forEach(id => { if (!owns(data.nest.decorOwned, id)) data.nest.decorOwned.push(id); });
          if (!Array.isArray(data.nest.eggs)) data.nest.eggs = [];
          data.nest.eggs = data.nest.eggs.filter(e => e && typeof e.start === 'number' && e.dur);
        }
        ensureIdentity();   // perfil, ranking local y escudos (migración)
        ensurePassSeason(); // rota el Pase si cambió la temporada real
        return false;
      }
    } catch (e) { loadError = true; }
    data = defaults();
    ensureIdentity();
    ensurePassSeason();
    return true; // primera vez
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      saveError = false;
      return true;
    } catch (e) {
      if (!saveError) {
        // avisa una sola vez por fallo (la UI muestra un toast discreto)
        saveError = true;
        try {
          if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('piovuelo:saveerror'));
          }
        } catch (e2) { }
      }
      return false;
    }
  }
  function lastSaveError() { return saveError; }
  function lastLoadError() { return loadError; }

  function owns(list, id) { return list.some(i => i === id || (i && i.id === id)); }

  /* --- Monedas --- */
  function addCoins(n) {
    n = Math.floor(num(n));
    if (n <= 0) return 0;              // nunca resta ni admite valores inválidos
    data.coins = Math.max(0, data.coins + n);
    data.coinsEarned = Math.max(0, data.coinsEarned + n);
    save();
    return n;
  }
  function spendCoins(n) {
    n = Math.floor(num(n));
    if (!(n > 0)) return false;
    if (data.coins < n) return false;  // nunca deja el saldo negativo
    data.coins -= n; save();
    return true;
  }
  function partsCount() { return Math.max(0, Math.floor(num(data.parts))); }
  function addParts(n) {
    n = Math.floor(num(n));
    if (n <= 0) return partsCount();
    data.parts = partsCount() + n;
    data.stats.partsEarned = Math.max(0, Math.floor(num(data.stats.partsEarned))) + n;
    save();
    return data.parts;
  }
  function spendParts(n) {
    n = Math.floor(num(n));
    if (!(n > 0)) return false;
    if (partsCount() < n) return false;
    data.parts = partsCount() - n;
    save();
    return true;
  }

  /* --- XP / nivel --- */
  function xpFor(level) { return Math.floor(55 * Math.pow(level, 1.35) + 30); }

  function isWeekend() {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  }

  function addXp(n) {
    if (!(n > 0)) return 0; // nunca XP negativa
    if (isWeekend()) {
      n = Math.round(n * 1.5); // XP ×1,5 los fines de semana (Temporada 2026)
    }
    data.xp += n; let ups = 0;
    while (data.xp >= xpFor(data.level)) {
      data.xp -= xpFor(data.level);
      data.level += 1; ups++;
      addCoins(75 + data.level * 10); // recompensa de subir de nivel
    }
    save();
    return ups; // niveles subidos
  }

  /* --- Evolución del ave (XP por volar con esa skin) --- */
  function skinEntry(id) {
    let e = data.skinsOwned.find(i => i.id === id);
    if (!e) { e = { id: id }; data.skinsOwned.push(e); }
    return e;
  }
  function skinXp(id) {
    const e = data.skinsOwned.find(i => i.id === id);
    return e ? (e.xp || 0) : 0;
  }
  function addSkinXp(id, n) {
    if (!(n > 0)) return 0;
    const before = DAT.evolveStage(skinXp(id));
    skinEntry(id).xp = (skinXp(id)) + Math.floor(n);
    save();
    const after = DAT.evolveStage(skinXp(id));
    return after - before; // cuántas etapas subió
  }
  function skinStage(id) { return DAT.evolveStage(skinXp(id)); }

  /* --- Stats --- */
  function endRun(score, pipesPassed, coinsGot, timeSec, distMeters, modeName) {
    data.stats.flights += 1;
    data.stats.pipes += pipesPassed;
    data.stats.timePlayed += Math.floor(timeSec);
    data.stats.coinsGot += coinsGot;
    data.stats.dist += Math.floor(distMeters || 0);
    if (isWeekend()) data.stats.weekendRuns = (data.stats.weekendRuns || 0) + 1; // un vuelo por fin de semana
    addBest(score);
    const isRecord = score > data.stats.best;
    if (isRecord) data.stats.best = score;
    recordRun(score, pipesPassed, coinsGot, distMeters, modeName);
    // 🔩 Piezas: 1 por vuelo + 1 por buena marca + 1 si es récord personal
    const gotParts = 1 + (score >= 20 ? 1 : 0) + (isRecord ? 1 : 0);
    addParts(gotParts);
    return isRecord;
  }

  // Registra un vuelo en el historial y en el ranking local (misma identidad).
  function recordRun(score, pipesPassed, coinsGot, distMeters, modeName) {
    const sc = Math.max(0, Math.floor(num(score)));
    const now = Date.now();
    let p = data.players.find(x => x.id === data.profile.id);
    if (!p) {
      p = { id: data.profile.id, name: data.profile.name, best: 0, last: 0, games: 0, bestDate: 0, lastDate: 0 };
      data.players.push(p);
    }
    p.name = data.profile.name;
    p.games += 1;
    p.last = sc;
    p.lastDate = now;
    if (sc > p.best) { p.best = sc; p.bestDate = now; }
    else if (!p.bestDate && p.best > 0) p.bestDate = now; // récord antiguo sin fecha conocida
    if (sc > data.stats.best) data.stats.best = sc;
    data.runs.unshift({
      score: sc,
      pipes: Math.max(0, Math.floor(num(pipesPassed))),
      coins: Math.max(0, Math.floor(num(coinsGot))),
      dist: Math.max(0, Math.floor(num(distMeters))),
      mode: typeof modeName === 'string' ? modeName : 'free',
      date: now
    });
    if (data.runs.length > RUN_HISTORY) data.runs.length = RUN_HISTORY;
    save();
  }

  // Ranking local (sin servidor): jugadores del dispositivo + mejores vuelos.
  function leaderboard() {
    try {
      const players = (data.players || []).map(p => ({
        id: p.id,
        name: p.name,
        best: p.best,
        last: p.last,
        games: p.games,
        bestDate: p.bestDate || 0,
        lastDate: p.lastDate || 0,
        me: p.id === data.profile.id
      })).sort((a, b) => b.best - a.best || b.last - a.last || a.name.localeCompare(b.name));
      const runs = (data.runs || []).slice()
        .sort((a, b) => b.score - a.score || b.date - a.date)
        .slice(0, 10)
        .map(r => Object.assign({}, r));
      return { players, runs };
    } catch (e) {
      return { players: [], runs: [], error: true };
    }
  }

  function getProfile() {
    return { id: data.profile.id, name: data.profile.name, created: data.profile.created };
  }

  // Cambia el nombre validando vacío, longitud, caracteres y duplicados locales.
  function rename(raw) {
    const original = typeof raw === 'string' ? raw : '';
    const trimmed = original.replace(/\s+/g, ' ').trim();
    if (!trimmed) return { ok: false, msg: 'El nombre no puede estar vacío.' };
    if (trimmed.length < NAME_MIN) return { ok: false, msg: 'Escribe al menos ' + NAME_MIN + ' caracteres.' };
    if (trimmed.length > NAME_MAX) return { ok: false, msg: 'Máximo ' + NAME_MAX + ' caracteres.' };
    const nm = cleanName(original);
    if (!nm || nm !== trimmed) return { ok: false, msg: 'Solo letras, números, espacios, punto, guion y guion bajo.' };
    if (nm.toLowerCase() === data.profile.name.toLowerCase()) return { ok: true, name: nm, unchanged: true };
    if (nameTaken(nm)) return { ok: false, msg: 'Ese nombre ya está en uso en este dispositivo.' };
    data.profile.name = nm;
    if (!data.knownNames.some(n => n.toLowerCase() === nm.toLowerCase())) data.knownNames.push(nm);
    const me = data.players.find(p => p.id === data.profile.id);
    if (me) me.name = nm;
    const ok = save();
    return { ok: true, name: nm, saved: ok };
  }

  /* --- Escudos persistentes (inventario entre partidas) --- */
  function shieldCount() { return Math.max(0, Math.floor(num(data.shields))); }
  function addShield(n) {
    const add = Math.max(0, Math.floor(num(n) || 1));
    if (!add) return shieldCount();
    data.shields = shieldCount() + add;
    save();
    return data.shields;
  }
  function useShield() {
    if (shieldCount() <= 0) return false;
    data.shields = shieldCount() - 1;
    save(); // se guarda al instante: sobrevive a pausa/recarga/cierre
    return true;
  }

  function addBest(score) {
    if (!Array.isArray(data.best3)) data.best3 = [];
    data.best3.push({ s: score, d: Date.now() });
    data.best3.sort((a, b) => b.s - a.s || a.d - b.d);
    if (data.best3.length > 3) data.best3.length = 3;
  }
  function setCombo(maxPipesPassedAgainstDifficulty) {
    if (maxPipesPassedAgainstDifficulty > data.maxCombo) { data.maxCombo = maxPipesPassedAgainstDifficulty; save(); }
  }

  /* --- Tienda --- */
  function buy(type, id) {
    const cat = type === 'skin' ? { list: 'skinsOwned', DAT: DAT.SKINS }
      : type === 'hat' ? { list: 'hatsOwned', DAT: DAT.HATS }
      : type === 'fx' ? { list: 'fxOwned', DAT: DAT.EFFECTS }
      : type === 'map' ? { list: 'mapsOwned', DAT: DAT.MAPS } : null;
    if (!cat) return { ok: false, msg: 'Error' };
    if (owns(data[cat.list], id)) return { ok: false, msg: 'Ya lo tienes' };
    const item = cat.DAT.find(i => i.id === id);
    if (!item) return { ok: false, msg: 'No existe' };
    if (item.week && !DAT.isUnlocked(item)) return { ok: false, msg: 'Se habilitará en la ' + DAT.weekLabel(item) };
    if (data.coins < item.price) return { ok: false, msg: 'no_money' };
    data.coins -= item.price;
    data.stats.spent = (data.stats.spent || 0) + item.price;
    data[cat.list].push({ id });
    pushHistory('compra', item.name, item.price + ' 🪙');
    save();
    return { ok: true, item };
  }

  function equip(type, id) {
    const map = { skin: 'skin', hat: 'hat', fx: 'fx', map: 'map' };
    const key = map[type];
    if (!key) return false;
    const owned = type === 'skin' ? data.skinsOwned : type === 'hat' ? data.hatsOwned : type === 'fx' ? data.fxOwned : data.mapsOwned;
    if (!owned || !owns(owned, id)) return false;
    data[key] = id;
    save();
    return true;
  }

  /* --- Caja Sorpresa 🥚 (huevo): 5% de variante dorada --- */
  function openBox() {
    const def = DAT.boxDef();
    if (data.coins < def.price) return { ok: false, msg: 'no_money' };
    data.coins -= def.price;
    data.stats.spent = (data.stats.spent || 0) + def.price;
    data.stats.boxesBought = (data.stats.boxesBought || 0) + 1;
    // 5% → variante dorada de una skin cualquiera (el patrón rng de spawnMega)
    if (Math.random() < 0.05) {
      const base = DAT.SKINS[Math.floor(Math.random() * DAT.SKINS.length)];
      const gold = DAT.getSkin(base.id + '-gold');
      if (!owns(data.skinsOwned, gold.id)) data.skinsOwned.push({ id: gold.id });
      pushHistory('compra', def.name, 'Variante dorada: ' + gold.name);
      save();
      return { ok: true, kind: 'gold', item: gold };
    }
    const pool = [];
    DAT.SKINS.forEach(s => { if (!owns(data.skinsOwned, s.id)) pool.push({ kind: 'skin', item: s }); });
    DAT.HATS.forEach(h => { if (!owns(data.hatsOwned, h.id)) pool.push({ kind: 'hat', item: h }); });
    DAT.EFFECTS.forEach(f => { if (!owns(data.fxOwned, f.id)) pool.push({ kind: 'fx', item: f }); });
    if (pool.length === 0) {
      data.coins += 100; // consolación: ya lo tienes todo
      pushHistory('compra', def.name, 'Consolación: 100 🪙');
      save();
      return { ok: true, kind: 'coins', amount: 100 };
    }
    const r = pool[Math.floor(Math.random() * pool.length)];
    if (r.kind === 'skin') data.skinsOwned.push({ id: r.item.id });
    else if (r.kind === 'hat') data.hatsOwned.push({ id: r.item.id });
    else data.fxOwned.push({ id: r.item.id });
    pushHistory('compra', def.name, r.item.name);
    save();
    return { ok: true, kind: r.kind, item: r.item };
  }

  /* --- Historial de compras/mejoras (máx. 30) --- */
  function pushHistory(kind, name, detail) {
    if (!Array.isArray(data.history)) data.history = [];
    data.history.unshift({ k: kind, n: name, d: detail || '', t: Date.now() });
    if (data.history.length > 30) data.history.length = 30;
  }
  function getHistory() { return (data.history || []).slice(); }

  /* --- Herramientas de la bolsa (consumibles) --- */
  function buyTool(id) {
    const tool = DAT.getTool(id);
    if (!tool) return { ok: false, msg: 'No existe' };
    if (tool.week && !DAT.isUnlocked(tool)) return { ok: false, msg: 'Se habilitará en la ' + DAT.weekLabel(tool) };
    if (data.coins < tool.price) return { ok: false, msg: 'no_money' };
    if (!spendCoins(tool.price)) return { ok: false, msg: 'no_money' };
    data.stats.spent = (data.stats.spent || 0) + tool.price;
    data.stats.toolsBought = (data.stats.toolsBought || 0) + 1;
    data.items[tool.key] = (data.items[tool.key] || 0) + 1;
    // comprar también deja la herramienta un poco más entera (nunca pasa del máximo)
    const max = DAT.toolMaxDur(tool.key, toolLevel(tool.key));
    data.toolDur[tool.key] = Math.min(max, toolDur(tool.key) + 1);
    pushHistory('compra', tool.name, '+' + 1 + ' uso · ' + tool.price + ' 🪙');
    save();
    return { ok: true, tool: tool, owned: data.items[tool.key] };
  }
  function itemCount(key) { return (data.items && data.items[key]) || 0; }

  /* --- Mejoras, durabilidad y modo de activación --- */
  function toolLevel(key) { return Math.min(5, Math.max(0, Math.floor(num(data.toolUp[key])))); }
  function toolMaxDur(key) { return DAT.toolMaxDur(key, toolLevel(key)); }
  function toolWear(key) { return DAT.toolWear(key, toolLevel(key)); }
  function toolDur(key) {
    const max = toolMaxDur(key);
    const cur = num(data.toolDur[key]);
    if (!(cur > 0) && data.toolDur[key] === undefined) return max;
    return Math.max(0, Math.min(max, cur));
  }
  function toolDurInfo(key) {
    const max = toolMaxDur(key);
    const cur = toolDur(key);
    return {
      cur: cur, max: max, pct: max > 0 ? Math.round(cur / max * 100) : 0,
      broken: cur <= 0.0001, wear: toolWear(key), wearPct: Math.round(toolWear(key) * 100),
      missing: Math.max(0, max - cur)
    };
  }
  function toolUsable(key) { return toolDur(key) > 0.0001; }
  // Consume desgaste de una herramienta usada. Devuelve la durabilidad restante.
  function wearTool(key) {
    if (!toolUsable(key)) return 0;
    const left = Math.max(0, toolDur(key) - toolWear(key));
    data.toolDur[key] = left;
    if (left <= 0.0001) pushHistory('rotura', (DAT.getTool(key) || {}).name || key, 'Necesita reparación');
    save();
    return left;
  }
  function toolUpPrice(key) { return DAT.ECONOMY.toolUpPrice(toolLevel(key)); }
  function toolUpParts(key) { return DAT.ECONOMY.toolUpParts(toolLevel(key)); }
  function toolRepairCost(key) {
    const info = toolDurInfo(key);
    if (info.missing <= 0) return 0;
    return DAT.ECONOMY.repairPrice(DAT.getTool(key), info.missing, info.max);
  }
  function repairTool(key) {
    const info = toolDurInfo(key);
    const tool = DAT.getTool(key);
    if (!tool) return { ok: false, msg: 'No existe' };
    if (info.missing <= 0) return { ok: false, msg: 'full' };
    const price = toolRepairCost(key);
    if (data.coins < price) return { ok: false, msg: 'no_money', price: price };
    if (!spendCoins(price)) return { ok: false, msg: 'no_money', price: price };
    data.coins = Math.max(0, data.coins); // blindaje: saldo nunca negativo
    data.stats.spent = (data.stats.spent || 0) + price;
    data.stats.toolsRepaired = (data.stats.toolsRepaired || 0) + 1;
    data.toolDur[key] = info.max;
    pushHistory('reparacion', tool.name, 'Reparada · ' + price + ' 🪙');
    save();
    return { ok: true, price: price, max: info.max };
  }
  function upToolLevel(key) {
    const tool = DAT.getTool(key);
    if (!tool) return { ok: false, msg: 'No existe' };
    const lv = toolLevel(key);
    if (lv >= 5) return { ok: false, msg: 'max' };
    const price = toolUpPrice(key);
    const parts = toolUpParts(key);
    // Validación completa ANTES de descontar: evita cobros dobles o parciales.
    if (data.coins < price) return { ok: false, msg: 'no_money', price: price, parts: parts };
    if (partsCount() < parts) return { ok: false, msg: 'no_parts', price: price, parts: parts };
    const oldMax = toolMaxDur(key);
    data.coins -= price;
    data.parts = partsCount() - parts;
    data.toolUp[key] = lv + 1;
    const newMax = toolMaxDur(key);
    // la mejora añade la nueva resistencia al estado actual (no repara gratis)
    const cur = toolDur(key);
    data.toolDur[key] = Math.min(newMax, cur + (newMax - oldMax));
    data.stats.spent = (data.stats.spent || 0) + price;
    data.stats.upgs = (data.stats.upgs || 0) + 1;
    pushHistory('mejora', tool.name, 'Nv ' + lv + ' → ' + (lv + 1) + ' · ' + price + ' 🪙' + (parts ? ' + ' + parts + ' 🔩' : ''));
    save();
    return { ok: true, level: lv + 1, price: price, parts: parts, max: newMax, wear: toolWear(key) };
  }
  function toolModeVal(key) { return data.toolMode[key] === 'manual' ? 'manual' : 'auto'; }
  function setToolMode(key, mode) {
    data.toolMode[key] = mode === 'manual' ? 'manual' : 'auto';
    save();
    return data.toolMode[key];
  }
  function noteToolUse(key) {
    data.stats.toolsUsed = (data.stats.toolsUsed || 0) + 1;
    if (data.stats.toolTypes.indexOf(key) === -1) data.stats.toolTypes.push(key);
  }
  // Comparativa antes/después para la interfaz de mejoras.
  function toolStats(key) {
    const lv = toolLevel(key);
    const now = { level: lv, max: DAT.toolMaxDur(key, lv), wear: DAT.toolWear(key, lv) };
    const next = lv < 5 ? { level: lv + 1, max: DAT.toolMaxDur(key, lv + 1), wear: DAT.toolWear(key, lv + 1) } : null;
    return { now: now, next: next, cur: toolDur(key), price: toolUpPrice(key), parts: toolUpParts(key) };
  }

  /* --- Ventajas del panel de administración --- */
  function unlockAll() {
    DAT.SKINS.forEach(sk => { if (!owns(data.skinsOwned, sk.id)) data.skinsOwned.push({ id: sk.id }); });
    DAT.HATS.forEach(h => { if (!owns(data.hatsOwned, h.id)) data.hatsOwned.push({ id: h.id }); });
    DAT.EFFECTS.forEach(f => { if (!owns(data.fxOwned, f.id)) data.fxOwned.push({ id: f.id }); });
    DAT.MAPS.forEach(m => { if (!owns(data.mapsOwned, m.id)) data.mapsOwned.push({ id: m.id }); });
    save();
    return true;
  }
  function giveTools(n) {
    Object.keys(data.items).forEach(k => { data.items[k] += n; });
    save();
    return true;
  }
  function giveAllUpg() {
    DAT.TOOLS.forEach(t => { data.toolUp[t.key] = 5; });
    save();
    return true;
  }
  function achAll() {
    let reward = 0;
    DAT.ACH.forEach(a => {
      if (data.achieved.indexOf(a.id) === -1) {
        data.achieved.push(a.id);
        reward += (a.reward || 0);
      }
    });
    addCoins(reward);
    save();
    return reward;
  }
  function chalReset() {
    const today = todayStr(new Date());
    if (data.dailyC.date === today) {
      data.dailyC.best = 0;
      data.dailyC.played = false;
      save();
    }
    return true;
  }

  /* --- Logros --- */
  function checkAch() {
    const news = [];
    DAT.ACH.forEach(a => {
      if (data.achieved.indexOf(a.id) !== -1) return;
      if (a.check(SAVE)) {
        data.achieved.push(a.id);
        addCoins(a.reward);
        news.push(a);
      }
    });
    save();
    return news;
  }

  /* --- Ajustes --- */
  function setSetting(k, v) { data.set[k] = v; save(); }
  function defaultSettings() { return Object.assign({}, defaults().set); }
  function resetSettings() {
    data.set = defaults().set;
    save();
    return data.set;
  }
  function finishTutorial() { data.tutorialDone = true; save(); return true; }

  /* --- Recompensa diaria + racha --- */
  function padN(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr(d) {
    return d.getFullYear() + '-' + padN(d.getMonth() + 1) + '-' + padN(d.getDate());
  }
  function dailyInfo() {
    const now = new Date();
    const today = todayStr(now);
    if (data.lastDaily === today) return { ready: false, streak: data.dailyStreak || 1 };
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const yesterday = todayStr(y);
    const streak = data.lastDaily === yesterday ? (data.dailyStreak || 0) + 1 : 1;
    return { ready: true, streak: streak };
  }
  function claimDaily() {
    const info = dailyInfo();
    if (!info.ready) return null;
    const bonus = info.streak % 7 === 0 ? 50 : 0;
    const reward = 20 + info.streak * 10 + bonus;
    data.lastDaily = todayStr(new Date());
    data.dailyStreak = info.streak;
    data.stats.dailyClaimed = (data.stats.dailyClaimed || 0) + 1;
    addCoins(reward);
    save();
    return { streak: info.streak, reward: reward, bonus: bonus };
  }
  function adminSetStreak() {
    const now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    data.lastDaily = todayStr(y);
    data.dailyStreak = 6;
    save();
    return true;
  }

  /* --- Desafío diario 🌙 --- */
  function chalToday() {
    const today = todayStr(new Date());
    if (data.dailyC.date !== today) {
      data.dailyC.date = today;
      data.dailyC.best = 0;
      data.dailyC.played = false;
      save();
    }
    return data.dailyC;
  }
  function challengePlayedToday() { return chalToday().played === true; }
  function recordChallenge(score) {
    const dc = chalToday();
    const isBest = score > dc.best;
    const firstRunToday = !dc.played; // solo cuenta 1 semilla por día (logros de constancia)
    if (isBest) dc.best = score;
    dc.played = true;
    if (firstRunToday) {
      data.stats.challengePlayed = (data.stats.challengePlayed || 0) + 1;
      data.stats.seedDays = (data.stats.seedDays || 0) + 1;
    }
    const today = todayStr(new Date());
    if (!data.dailyH[today] || score > data.dailyH[today]) data.dailyH[today] = score;
    const bonus = score >= 35 ? 150 : score >= 15 ? 75 : score >= 5 ? 30 : 5;
    addCoins(bonus);
    save();
    return { bonus: bonus, best: dc.best, isBest: isBest, score: score };
  }
  function dailyHistory() {
    const o = data.dailyH || {};
    return Object.keys(o).sort().slice(-7).map(k => ({ key: k, best: o[k] }));
  }
  function seedToday() {
    const now = new Date();
    const p = n => (n < 10 ? '0' : '') + n;
    return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
  }

  /* --- Replay 🎬 --- */
  function storeReplay(score, seed, taps, mapId) {
    const payload = { score: score, seed: seed, taps: (taps || []).slice(0, 5000), date: Date.now(), map: mapId };
    if (!data.replay) { data.replay = payload; save(); return true; }
    if (score > data.replay.score) { data.replay = payload; save(); return true; }
    // a igual puntuación gana el vuelo más largo (más aleteos grabados), el otro descarta
    if (score === data.replay.score && payload.taps.length > (data.replay.taps || []).length) { data.replay = payload; save(); return true; }
    return false;
  }
  function getReplay() { return data.replay; }
  function markReplayWatched() {
    data.stats.replaysWatched = (data.stats.replaysWatched || 0) + 1;
    save();
  }

  /* --- Misiones diarias/semanales 📋 --- */
  function dzi() {
    const today = todayStr(new Date());
    if (data.dailyM.date !== today) {
      data.dailyM.date = today;
      data.dailyM.claimed = [];
      // base de hoy: las misiones cuentan el progreso DESDE hoy (sin reciclable infinito)
      const nb = {};
      DAT.MISSIONS.forEach(m => { if (!m.weekly) nb[m.id] = m.metric(SAVE) || 0; });
      data.dailyBase = nb;
      save();
    }
    return data.dailyM;
  }
  function weekStr(d) {
    const c = new Date(d);
    const wd = (c.getDay() + 6) % 7; // lunes = 0
    c.setDate(c.getDate() - wd);
    return todayStr(c);
  }
  function wz() {
    const w = weekStr(new Date());
    if (data.weeklyM.week !== w) {
      data.weeklyM.week = w;
      data.weeklyM.claimed = [];
      // base de la semana: el progreso semanal arranca en 0 al rotar
      const nb = {};
      DAT.MISSIONS.forEach(m => { if (m.weekly) nb[m.id] = m.metric(SAVE) || 0; });
      data.weeklyBase = nb;
      save();
    }
    return data.weeklyM;
  }
  function missionProgress(m) { return Math.max(0, (m.metric(SAVE) || 0) - (((m.weekly ? data.weeklyBase : data.dailyBase) || {})[m.id] || 0)); }
  function missionDoneToday(m) {
    const z = m.weekly ? wz() : dzi();
    return z.claimed.indexOf(m.id) !== -1;
  }
  function claimMission(m) {
    if (missionDoneToday(m) || missionProgress(m) < m.target) return null;
    (m.weekly ? wz() : dzi()).claimed.push(m.id);
    grantReward(m.reward);
    data.stats.missionsDone = (data.stats.missionsDone || 0) + 1;
    save();
    return m;
  }
  function grantReward(r) {
    if (typeof r === 'number') { addCoins(r); return; }
    if (r && r.coins) addCoins(r.coins);
    if (r && r.item) data.items[r.item] = (data.items[r.item] || 0) + r.n;
    if (r && r.shields) data.shields = shieldCount() + Math.max(0, Math.floor(num(r.shields)));
    if (r && r.hat && !owns(data.hatsOwned, r.hat)) {
      data.hatsOwned.push({ id: r.hat });
      if (!data.hat) data.hat = r.hat;
    }
    if (r && r.fx && !owns(data.fxOwned, r.fx)) {
      data.fxOwned.push({ id: r.fx });
      if (!data.fx || data.fx === 'fx-none') data.fx = r.fx;
    }
    if (r && r.map && !owns(data.mapsOwned, r.map)) {
      data.mapsOwned.push({ id: r.map });
      if (!data.map || data.map === 'day') data.map = r.map;
    }
    if (r && r.skin && !owns(data.skinsOwned, r.skin)) {
      data.skinsOwned.push({ id: r.skin });
    }
  }

  /* --- Pase de Vuelo 🎫 (rota automáticamente por temporada real) --- */
  function ensurePassSeason() {
    const k = DAT.seasonKey();
    if (data.passSeason !== k) {
      data.passSeason = k;
      data.passClaimed = [];
      save();
    }
  }
  function totalXp() {
    let sum = 0;
    for (let l = 1; l < data.level; l++) sum += xpFor(l);
    return sum + data.xp;
  }
  function passReached() {
    ensurePassSeason();
    const tiers = DAT.passTiers();
    const tx = totalXp();
    let i = -1;
    tiers.forEach((t, idx) => { if (tx >= t.xp) i = idx; });
    return i + 1;
  }
  function passClaimedCount() { return (data.passClaimed || []).length; }
  function claimPassTier(idx) {
    ensurePassSeason();
    const tiers = DAT.passTiers();
    if (idx < 0 || idx >= tiers.length) return null;
    if (data.passClaimed.indexOf(idx) !== -1) return null;
    if (totalXp() < tiers[idx].xp) return null;
    data.passClaimed.push(idx);
    grantReward(tiers[idx].reward);
    save();
    return tiers[idx];
  }
  function passSeasonName() {
    const si = DAT.seasonIndex();
    const s = DAT.SEASONS[si];
    return (s.icon + ' ' + s.pass.name + ' · ' + DAT.seasonKey());
  }

  /* --- Temporada 2026 🗓 (misma XP del jugador) --- */
  function seasonReached() {
    const tx = totalXp();
    let i = -1;
    DAT.SEASON_TIERS.forEach((t, idx) => { if (tx >= t.xp) i = idx; });
    return i + 1;
  }
  function seasonClaimCount() { return (data.seasonClaimed || []).length; }
  function claimSeasonTier(idx) {
    if (idx < 0 || idx >= DAT.SEASON_TIERS.length) return null;
    if (data.seasonClaimed.indexOf(idx) !== -1) return null;
    if (totalXp() < DAT.SEASON_TIERS[idx].xp) return null;
    data.seasonClaimed.push(idx);
    grantReward(DAT.SEASON_TIERS[idx].reward);
    save();
    return DAT.SEASON_TIERS[idx];
  }

  /* --- Helpers admin --- */
  function setLevel(n) {
    const v = Math.floor(Number(n));
    data.level = Math.min(999, Math.max(1, isNaN(v) ? 1 : v));
    data.xp = 0;
    save();
    return data.level;
  }
  function claimPassAll() {
    ensurePassSeason();
    const tiers = DAT.passTiers();
    let n = 0;
    tiers.forEach((t, idx) => {
      if (data.passClaimed.indexOf(idx) === -1 && totalXp() >= t.xp) {
        data.passClaimed.push(idx);
        grantReward(t.reward);
        n++;
      }
    });
    if (n) save();
    return n;
  }
  function claimSeasonAll() {
    let n = 0;
    DAT.SEASON_TIERS.forEach((t, idx) => {
      if (data.seasonClaimed.indexOf(idx) === -1 && totalXp() >= t.xp) {
        data.seasonClaimed.push(idx);
        grantReward(t.reward);
        n++;
      }
    });
    if (n) save();
    return n;
  }

  /* --- Reset --- */
  function reset() {
    const nm = (data && data.profile) ? cleanName(data.profile.name) : '';
    const created = (data && data.profile) ? num(data.profile.created) : 0;
    data = defaults();
    if (nm) data.profile.name = nm;             // el nombre elegido se conserva
    if (created > 0) data.profile.created = created;
    ensureIdentity();
    ensurePassSeason();
    save();
    return data;
  }

  /* --- Nido / huevos / decoración 🪺 --- */
  function nestDecor() { return data.nest.decor || defaults().nest.decor; }
  function isDecorOwned(id) { return owns(data.nest.decorOwned, id); }
  function buyDecor(id) {
    const d = DAT.getDecor(id);
    if (!d) return { ok: false, msg: 'No existe' };
    if (owns(data.nest.decorOwned, id)) return { ok: false, msg: 'Ya lo tienes' };
    if (data.coins < d.price) return { ok: false, msg: 'no_money' };
    data.coins -= d.price;
    data.stats.spent = (data.stats.spent || 0) + d.price;
    data.nest.decorOwned.push(id);
    pushHistory('compra', d.name, d.price + ' 🪙');
    save();
    return { ok: true, item: d };
  }
  function equipDecor(cat, id) {
    const d = DAT.getDecor(id);
    if (!d || d.cat !== cat) return false;
    if (!owns(data.nest.decorOwned, id)) return false;
    data.nest.decor[cat] = id;
    save();
    return true;
  }

  /* Huevos: empiezan a incubar con tiempo real (Date.now) y continúan
     aunque no vuelvas a jugar; eclosionan solos cuando pasa el tiempo. */
  const NEST_MAX_EGGS = 2; // huevos incubando a la vez
  function eggSlotsFree() { return Math.max(0, NEST_MAX_EGGS - (data.nest.eggs || []).length); }
  function eggIncubating() { return (data.nest.eggs || []).map(e => ({
    id: e.id,
    start: e.start,
    dur: e.dur,
    done: (e.start + e.dur - Date.now()) <= 0,
    leftMs: Math.max(0, e.start + e.dur - Date.now()),
    pct: e.dur ? Math.min(100, Math.round(((Date.now() - e.start) / e.dur) * 100)) : 0
  })); }
  function buyEgg(id) {
    const def = DAT.getEgg(id);
    if (!def) return { ok: false, msg: 'No existe' };
    if ((data.nest.eggs || []).length >= NEST_MAX_EGGS) return { ok: false, msg: 'Incubadora llena: 2 huevos como máximo 🥚' };
    if (data.coins < def.price) return { ok: false, msg: 'no_money' };
    const pool = DAT.eggPool(SAVE);
    if (!pool.length) return { ok: false, msg: 'Ya tienes todas las aves y estelas 🎉' };
    // el premio no se decide hasta eclosionar (determinista con el id, pero variado)
    data.coins -= def.price;
    data.stats.spent = (data.stats.spent || 0) + def.price;
    data.nest.eggs.push({ id: def.id, start: Date.now(), dur: def.mins * 60000 });
    pushHistory('compra', def.name, def.price + ' 🪙 · incubando');
    save();
    return { ok: true, item: def };
  }
  function hatchEgg(idx) {
    const eggs = data.nest.eggs || [];
    const e = eggs[idx];
    if (!e) return null;
    if ((e.start + e.dur - Date.now()) > 0) return null; // aún no está listo
    const pool = DAT.eggPool(SAVE);
    eggs.splice(idx, 1);
    if (!pool.length) {
      data.coins += 100; // consolación: ya lo tienes todo
      save();
      return { kind: 'coins', amount: 100 };
    }
    const r = pool[Math.floor(Math.random() * pool.length)];
    const item = r.kind === 'skin' ? DAT.getSkin(r.item.id) : DAT.getFx(r.item.id);
    if (r.kind === 'skin') {
      if (!owns(data.skinsOwned, r.item.id)) data.skinsOwned.push({ id: r.item.id });
      if (!data.skin) data.skin = r.item.id;
    } else {
      if (!owns(data.fxOwned, r.item.id)) data.fxOwned.push({ id: r.item.id });
      if (!data.fx || data.fx === 'fx-none') data.fx = r.item.id;
    }
    save();
    return { kind: r.kind, item: item };
  }

  function get() { return data; }

  const SAVE = {
    load, save, get, defaults,
    addCoins, spendCoins, addXp, xpFor,
    partsCount, addParts, spendParts,
    skinXp, addSkinXp, skinStage, openBox,
    endRun, setCombo, buy, equip, checkAch, setSetting, reset, owns,
    buyTool, itemCount, toolLevel, toolUpPrice, toolUpParts, upToolLevel, toolModeVal, setToolMode, noteToolUse,
    toolMaxDur, toolWear, toolDur, toolDurInfo, toolUsable, wearTool, toolRepairCost, repairTool, toolStats,
    getHistory, resetSettings, defaultSettings, finishTutorial,
    unlockAll, giveTools, giveAllUpg, achAll, chalReset, adminSetStreak,
    dailyInfo, claimDaily, addBest,
    challengePlayedToday, recordChallenge, dailyHistory, seedToday,
    storeReplay, getReplay, markReplayWatched,
    missionProgress, missionDoneToday, claimMission,
    totalXp, passReached, passClaimedCount, claimPassTier, passSeasonName,
    seasonReached, seasonClaimCount, claimSeasonTier,
    setLevel, claimPassAll, claimSeasonAll,
    nestDecor, isDecorOwned, buyDecor, equipDecor,
    eggSlotsFree, eggIncubating, buyEgg, hatchEgg,
    // perfil, ranking local y escudos persistentes
    getProfile, rename, randomName, cleanName, leaderboard,
    shieldCount, addShield, useShield,
    lastSaveError, lastLoadError
  };
  return SAVE;
})();