/* Multijugador: lógica pura compartida por la interfaz, la nube y las pruebas.
 * No toca DOM ni red: solo normaliza/valida la partida y decide resultados. */
window.MP = (function () {
  'use strict';

  const CODE_LEN = 6;
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // Metas de tubos y límites de tiempo que ofrece la sala.
  const PIPE_GOALS = [8, 10, 12, 15, 20, 30];
  const TIME_LIMITS = [0, 60, 90, 120, 180, 300];
  const DIFF_IDS = ['easy', 'normal', 'hard', 'insane'];
  const SEED_MODES = ['daily', 'manual'];

  const DEFAULTS = {
    pipes: 12,
    time: 0,
    map: 'day',
    diff: 'normal',
    tools: true,
    seedMode: 'daily',
    seed: 0
  };

  function num(v, fallback) {
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function int(v, fallback, min, max) {
    let n = Math.floor(num(v, fallback));
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    return n;
  }

  function oneOf(v, list, fallback) {
    const s = String(v == null ? '' : v);
    return list.indexOf(s) !== -1 ? s : fallback;
  }

  function clampSeed(v) {
    const n = int(v, 1, 1, 2147483646);
    return n || 1;
  }

  /* Código de sala: 6 caracteres sin letras/números confundibles. */
  function cleanCode(v) {
    return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
  }

  function isValidCode(v) {
    const c = cleanCode(v);
    if (c.length !== CODE_LEN) return false;
    for (let i = 0; i < c.length; i++) {
      if (ALPHABET.indexOf(c.charAt(i)) === -1) return false;
    }
    return true;
  }

  function randomCode(rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    let out = '';
    for (let i = 0; i < CODE_LEN; i++) out += ALPHABET.charAt(Math.floor(r() * ALPHABET.length) % ALPHABET.length);
    return out;
  }

  /* Semilla del día: número YYYYMMDD, fácil de repetir y comparar. */
  function daySeed(date) {
    const d = date instanceof Date ? date : new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  // Texto manual → semilla estable (FNV-1a de 31 bits).
  function hashSeed(text) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return 0;
    if (/^\d{1,10}$/.test(s)) return clampSeed(parseInt(s, 10));
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (h % 2147483646) + 1;
  }

  function resolveSeed(seedMode, seed, date) {
    if (seedMode === 'daily') return daySeed(date);
    return clampSeed(hashSeed(seed) || 1);
  }

  /* Configuración completa y segura de una sala. */
  function normalizeConfig(raw, opts) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const o = opts || {};
    const goals = Array.isArray(o.pipes) && o.pipes.length ? o.pipes : PIPE_GOALS;
    const times = Array.isArray(o.time) && o.time.length ? o.time : TIME_LIMITS;
    const diffs = Array.isArray(o.diffs) && o.diffs.length ? o.diffs : DIFF_IDS;
    const maps = Array.isArray(o.maps) && o.maps.length ? o.maps : null;

    let pipes = int(src.pipes, DEFAULTS.pipes, 1, 100);
    if (goals.indexOf(pipes) === -1) {
      // elige la meta permitida más cercana
      pipes = goals.reduce((best, g) => Math.abs(g - pipes) < Math.abs(best - pipes) ? g : best, goals[0]);
    }
    let time = int(src.time, DEFAULTS.time, 0, 3600);
    if (times.indexOf(time) === -1) {
      time = times.reduce((best, t) => Math.abs(t - time) < Math.abs(best - time) ? t : best, times[0]);
    }
    let map = String(src.map == null ? DEFAULTS.map : src.map).slice(0, 32) || DEFAULTS.map;
    if (maps && maps.indexOf(map) === -1) map = maps[0];
    const diff = oneOf(src.diff, diffs, DEFAULTS.diff);
    const seedMode = oneOf(src.seedMode, SEED_MODES, DEFAULTS.seedMode);
    const seed = resolveSeed(seedMode, src.seed, o.now instanceof Date ? o.now : new Date());
    return {
      pipes: pipes,
      time: time,
      map: map,
      diff: diff,
      tools: src.tools !== false,
      seedMode: seedMode,
      seed: seed
    };
  }

  function sameConfig(a, b) {
    if (!a || !b) return false;
    return a.pipes === b.pipes && a.time === b.time && a.map === b.map && a.diff === b.diff &&
      !!a.tools === !!b.tools && a.seed === b.seed;
  }

  /* Lado de un jugador dentro de la sala. */
  function emptySide(uid, name) {
    return {
      uid: String(uid || ''),
      name: String(name || 'Jugador').slice(0, 16),
      score: 0,
      pipes: 0,
      alive: true,
      finished: false,
      time: 0
    };
  }

  function sanitizeSide(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    return {
      uid: String(s.uid || ''),
      name: String(s.name || 'Jugador').slice(0, 16),
      score: int(s.score, 0, 0, 10000000),
      pipes: int(s.pipes, 0, 0, 10000),
      alive: s.alive !== false,
      finished: !!s.finished,
      time: Math.max(0, Math.min(86400, Math.round(num(s.time, 0) * 100) / 100))
    };
  }

  function sanitizeProgress(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    return {
      score: int(p.score, 0, 0, 10000000),
      pipes: int(p.pipes, 0, 0, 10000),
      alive: p.alive !== false,
      finished: !!p.finished,
      time: Math.max(0, Math.min(86400, Math.round(num(p.time, 0) * 100) / 100))
    };
  }

  /* Compara dos lados y devuelve 'win' | 'lose' | 'draw' desde a. */
  function judge(a, b) {
    const x = sanitizeSide(a);
    const y = sanitizeSide(b);
    if (x.finished !== y.finished) return x.finished ? 'win' : 'lose';
    if (x.finished && y.finished && x.time !== y.time) return x.time < y.time ? 'win' : 'lose';
    if (x.pipes !== y.pipes) return x.pipes > y.pipes ? 'win' : 'lose';
    if (x.score !== y.score) return x.score > y.score ? 'win' : 'lose';
    return 'draw';
  }

  function judgeSides(host, guest) {
    const r = judge(host, guest);
    return r === 'win' ? 'host' : r === 'lose' ? 'guest' : 'draw';
  }

  // ¿La sala ya tiene los dos jugadores?
  function isReady(room) {
    return !!(room && room.host && room.host.uid && room.guest && room.guest.uid);
  }

  // Estado legible de una sala para la interfaz.
  function roomPhase(room, now) {
    if (!room) return 'none';
    if (room.state === 'finished') return 'finished';
    if (room.state === 'playing') {
      const at = num(room.startAt, 0);
      if (at > 0 && (now || Date.now()) < at) return 'countdown';
      return 'playing';
    }
    return isReady(room) ? 'ready' : 'waiting';
  }

  return {
    CODE_LEN, ALPHABET, PIPE_GOALS, TIME_LIMITS, DIFF_IDS, SEED_MODES, DEFAULTS,
    cleanCode, isValidCode, randomCode,
    daySeed, hashSeed, resolveSeed,
    normalizeConfig, sameConfig,
    emptySide, sanitizeSide, sanitizeProgress,
    judge, judgeSides, isReady, roomPhase
  };
})();
