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
  // 'free' = carrera libre (sin meta de tubos) · 'goal' = carrera con meta.
  const MODES = ['free', 'goal'];
  // Cómo se decide el ganador:
  //   survival = aguanta vivo más que el rival (por defecto)
  //   goal     = cruza la meta de tubos antes
  //   score    = al terminar, gana quien tenga mejor marca
  const WIN_BY = ['survival', 'goal', 'score'];

  const DEFAULTS = {
    mode: 'goal',
    pipes: 12,
    time: 0,
    map: 'day',
    diff: 'normal',
    tools: true,
    enemies: true,
    powers: true,
    winBy: 'survival',
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

  function bool(v, fallback) {
    if (v === undefined || v === null) return !!fallback;
    if (typeof v === 'boolean') return v;
    if (v === 0 || v === '0' || v === 'false') return false;
    return !!v;
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

    let mode = oneOf(src.mode, MODES, DEFAULTS.mode);
    let pipes = int(src.pipes, DEFAULTS.pipes, 0, 100);
    const time = (function () {
      let t = int(src.time, DEFAULTS.time, 0, 3600);
      if (times.indexOf(t) === -1) {
        t = times.reduce((best, x) => Math.abs(x - t) < Math.abs(best - t) ? x : best, times[0]);
      }
      return t;
    })();
    // Compatibilidad: las salas antiguas solo tenían mode/pipes. Si piden meta
    // explícita sin winBy, el ganador se decide por meta (comportamiento 3.4.x).
    let winBy = oneOf(src.winBy, WIN_BY, '');
    if (!winBy) winBy = (mode === 'goal' && pipes > 0) ? 'goal' : 'survival';
    if (winBy === 'goal') {
      mode = 'goal';
      if (pipes < 1) pipes = DEFAULTS.pipes;
      if (goals.indexOf(pipes) === -1) {
        pipes = goals.reduce((best, g) => Math.abs(g - pipes) < Math.abs(best - pipes) ? g : best, goals[0]);
      }
    } else if (mode === 'goal' && pipes > 0) {
      // Conserva la meta como referencia visual aunque gane la supervivencia.
      if (goals.indexOf(pipes) === -1) {
        pipes = goals.reduce((best, g) => Math.abs(g - pipes) < Math.abs(best - pipes) ? g : best, goals[0]);
      }
    } else {
      pipes = 0; // la carrera libre nunca exige tubos
    }
    let map = String(src.map == null ? DEFAULTS.map : src.map).slice(0, 32) || DEFAULTS.map;
    if (maps && maps.indexOf(map) === -1) map = maps[0];
    const diff = oneOf(src.diff, diffs, DEFAULTS.diff);
    const seedMode = oneOf(src.seedMode, SEED_MODES, DEFAULTS.seedMode);
    const seed = resolveSeed(seedMode, src.seed, o.now instanceof Date ? o.now : new Date());
    return {
      mode: mode,
      winBy: winBy,
      pipes: pipes,
      time: time,
      map: map,
      diff: diff,
      tools: bool(src.tools, DEFAULTS.tools),
      enemies: bool(src.enemies, DEFAULTS.enemies),
      powers: bool(src.powers, DEFAULTS.powers),
      seedMode: seedMode,
      seed: seed
    };
  }

  function sameConfig(a, b) {
    if (!a || !b) return false;
    return a.mode === b.mode && a.winBy === b.winBy && a.pipes === b.pipes && a.time === b.time &&
      a.map === b.map && a.diff === b.diff && !!a.tools === !!b.tools &&
      !!a.enemies === !!b.enemies && !!a.powers === !!b.powers && a.seed === b.seed;
  }

  // ¿La sala exige una meta de tubos? (mode 'goal')
  function hasGoal(config) {
    return !!config && config.mode === 'goal' && config.pipes > 0;
  }

  function hasSurvival(config) {
    return !config || config.winBy === undefined || config.winBy === 'survival';
  }

  /* Lado de un jugador dentro de la sala. */
  function emptySide(uid, name) {
    return {
      uid: String(uid || ''),
      name: String(name || 'Jugador').slice(0, 16),
      score: 0,
      pipes: 0,
      kills: 0,
      dist: 0,
      alt: 0,
      alive: true,
      finished: false,
      disconnected: false,
      deathAt: 0,
      deathCause: '',
      goalAt: 0,
      finishedBy: '',
      time: 0
    };
  }

  function sideTime(v) {
    return Math.max(0, Math.min(86400, Math.round(num(v, 0) * 100) / 100));
  }

  function sanitizeSide(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    return {
      uid: String(s.uid || ''),
      name: String(s.name || 'Jugador').slice(0, 16),
      score: int(s.score, 0, 0, 10000000),
      pipes: int(s.pipes, 0, 0, 10000),
      kills: int(s.kills, 0, 0, 10000),
      dist: int(s.dist, 0, 0, 10000000),
      alt: Math.max(0, Math.min(1, Math.round(num(s.alt, 0) * 1000) / 1000)),
      alive: s.alive !== false,
      finished: !!s.finished,
      disconnected: !!s.disconnected,
      deathAt: sideTime(s.deathAt),
      deathCause: String(s.deathCause || '').slice(0, 16),
      goalAt: sideTime(s.goalAt),
      finishedBy: (s.finishedBy === 'goal' || s.finishedBy === 'time' || s.finishedBy === 'disconnect') ? s.finishedBy : '',
      time: sideTime(s.time)
    };
  }

  function sanitizeProgress(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    const out = {
      score: int(p.score, 0, 0, 10000000),
      pipes: int(p.pipes, 0, 0, 10000),
      kills: int(p.kills, 0, 0, 10000),
      dist: int(p.dist, 0, 0, 10000000),
      alt: Math.max(0, Math.min(1, Math.round(num(p.alt, 0) * 1000) / 1000)),
      alive: p.alive !== false,
      finished: !!p.finished,
      disconnected: !!p.disconnected,
      time: sideTime(p.time)
    };
    if (p.deathAt !== undefined) out.deathAt = sideTime(p.deathAt);
    if (p.deathCause !== undefined) out.deathCause = String(p.deathCause || '').slice(0, 16);
    if (p.goalAt !== undefined) out.goalAt = sideTime(p.goalAt);
    if (p.finishedBy !== undefined) out.finishedBy = String(p.finishedBy || '').slice(0, 16);
    return out;
  }

  /* Compara dos lados y devuelve 'win' | 'lose' | 'draw' desde a.
   * Se mantiene por compatibilidad con las salas antiguas. */
  function judge(a, b) {
    const x = sanitizeSide(a);
    const y = sanitizeSide(b);
    if (x.finished !== y.finished) return x.finished ? 'win' : 'lose';
    if (x.finished && y.finished && x.time !== y.time) return x.time < y.time ? 'win' : 'lose';
    if (x.pipes !== y.pipes) return x.pipes > y.pipes ? 'win' : 'lose';
    if (x.score !== y.score) return x.score > y.score ? 'win' : 'lose';
    if (x.dist !== y.dist) return x.dist > y.dist ? 'win' : 'lose';
    return 'draw';
  }

  function endInfo(s) {
    const lives = s.alive !== false;
    if (!lives) return { ended: true, alive: false, at: s.deathAt > 0 ? s.deathAt : s.time, by: s.deathCause || 'death' };
    if (s.finished) return { ended: true, alive: true, at: s.time, by: s.finishedBy || 'finish' };
    return { ended: false, alive: true, at: 0, by: '' };
  }

  // Desempate de una carrera puntuada: tubos → puntos → distancia → kills.
  function scoreOrder(x, y) {
    if (x.pipes !== y.pipes) return x.pipes > y.pipes ? 'host' : 'guest';
    if (x.score !== y.score) return x.score > y.score ? 'host' : 'guest';
    if (x.dist !== y.dist) return x.dist > y.dist ? 'host' : 'guest';
    if (x.kills !== y.kills) return x.kills > y.kills ? 'host' : 'guest';
    return 'draw';
  }

  function resultOf(winner, reason, detail) {
    return { winner: winner, reason: reason, detail: detail || '', decided: winner !== '' };
  }

  function resolveSurvival(x, y) {
    const ax = endInfo(x), ay = endInfo(y);
    if (!ax.ended || !ay.ended) {
      return resultOf('', 'pending', 'La carrera sigue: falta que termine un jugador');
    }
    // El último jugador vivo gana. Si ambos siguen vivos al agotarse el
    // tiempo, se decide por la marca (tubos/puntos/distancia).
    if (ax.alive !== ay.alive) {
      return resultOf(ax.alive ? 'host' : 'guest', 'supervivencia',
        ax.alive ? 'El rival cayó antes' : 'Caíste antes que el rival');
    }
    if (!ax.alive && !ay.alive) {
      if (x.deathAt !== y.deathAt && (x.deathAt > 0 || y.deathAt > 0)) {
        return resultOf(x.deathAt > y.deathAt ? 'host' : 'guest', 'supervivencia',
          'Sobrevivió ' + (x.deathAt > y.deathAt ? x.deathAt : y.deathAt) + ' s');
      }
    }
    const w = scoreOrder(x, y);
    return resultOf(w, w === 'draw' ? 'empate' : 'marca', w === 'draw' ? 'Marcas idénticas' : 'Mejor marca al agotarse el tiempo');
  }

  function resolveGoal(x, y) {
    const gx = x.goalAt > 0 ? x.goalAt : (x.finished && x.finishedBy === 'goal' ? x.time : 0);
    const gy = y.goalAt > 0 ? y.goalAt : (y.finished && y.finishedBy === 'goal' ? y.time : 0);
    if (gx > 0 || gy > 0) {
      if (gx > 0 && gy > 0) {
        if (gx !== gy) return resultOf(gx < gy ? 'host' : 'guest', 'meta', 'Cruzó la meta primero');
        return resultOf(scoreOrder(x, y), 'meta', 'Meta empatada');
      }
      return resultOf(gx > 0 ? 'host' : 'guest', 'meta', 'Cruzó la meta');
    }
    // Nadie llegó a la meta: decide la supervivencia y, si ambos cayeron, la marca.
    return resolveSurvival(x, y);
  }

  function resolveScore(x, y) {
    const ax = endInfo(x), ay = endInfo(y);
    if (!ax.ended || !ay.ended) return resultOf('', 'pending', 'La carrera sigue');
    const w = scoreOrder(x, y);
    if (w !== 'draw') return resultOf(w, 'puntuación', 'Mejor marca');
    if (ax.alive !== ay.alive) return resultOf(ax.alive ? 'host' : 'guest', 'supervivencia', 'Último vivo');
    return resultOf('draw', 'empate', 'Marcas idénticas');
  }

  /* Resolución moderna por estado. Devuelve {winner, reason, detail, decided}. */
  function resolve(a, b, config) {
    const x = sanitizeSide(a);
    const y = sanitizeSide(b);
    const cfg = config || {};
    const winBy = oneOf(cfg.winBy, WIN_BY, cfg.mode === 'goal' ? 'goal' : 'survival');
    if (!x.uid && !y.uid) return resultOf('', 'pending', 'Sala sin jugadores');
    if (winBy === 'goal') return resolveGoal(x, y);
    if (winBy === 'score') return resolveScore(x, y);
    return resolveSurvival(x, y);
  }

  function sideName(winner) {
    return winner === 'host' ? 'host' : winner === 'guest' ? 'guest' : 'draw';
  }

  function resolveSides(host, guest, config) {
    // Si la carrera sigue pendiente devolvemos '' (no 'draw') para que quien
    // llama pueda aplicar su propio criterio de desempate o abandono.
    const r = resolve(host, guest, config);
    return r.decided ? r.winner : '';
  }

  function judgeSides(host, guest) {
    const r = judge(host, guest);
    return r === 'win' ? 'host' : r === 'lose' ? 'guest' : 'draw';
  }

  // Texto corto para tarjetas/listas de la interfaz.
  function configLabel(config) {
    const c = config || {};
    const win = c.winBy === 'goal' ? 'Meta ' + (c.pipes || 0)
      : c.winBy === 'score' ? 'Puntuación'
      : 'Supervivencia';
    return win + ' · ' + (c.time > 0 ? c.time + ' s' : 'sin límite');
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
    CODE_LEN, ALPHABET, PIPE_GOALS, TIME_LIMITS, DIFF_IDS, SEED_MODES, MODES, WIN_BY, DEFAULTS,
    cleanCode, isValidCode, randomCode,
    daySeed, hashSeed, resolveSeed,
    normalizeConfig, sameConfig, hasGoal, hasSurvival,
    emptySide, sanitizeSide, sanitizeProgress,
    judge, judgeSides, resolve, resolveSides, configLabel, isReady, roomPhase
  };
})();
