/* Núcleo del juego: bucle, física, obstáculos, monedas, enemigos y dificultad progresiva */
window.G = (function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let groundH = 0;

  let state = 'load';           // load | menu | play | over
  let paused = false;
  let t = 0;
  let lastTime = 0;
  let rafId = 0;
  let halted = false;       // suspendido (pantalla apagada / app en segundo plano)
  let autoPaused = false;   // el juego se pausó SOLO al apagar la pantalla
  let loopActive = false;

  let bird = null;
  let pipes = [];
  let coins = [];
  let enemies = [];
  let score = 0;
  let pipesDone = 0;
  let coinCount = 0;
  let runSeconds = 0;
  let spawnDist = 0;
  let spawnEDist = 0;
  let spawnPwDist = 0;
  let spawnMegaDist = 0;
  let spawnChDist = 0;
  let nextMile = 1; // próximo hito de distancia (cada 100 m)
  let oasisLast = 0;   // metros contados por la herramienta Oasis (cada 10 m)
  let totalDist = 0;
  let powers = [];
  let eff = { magnet: 0, slow: 0, x2: 0, xc: 0, gem: 0, clock: 0, turbo: 0, combo: 0, shield: 0, ghost: 0, frenzy: 0, bomb: 0, aura: 0, twin: 0, ferro: 0, rescueNext: 0 }; // hasta qué instante (t) dura cada efecto
  let effDur = {};      // duración total de cada efecto (para la barra de tiempo del HUD)
  let invulnT = 0;      // fin de invulnerabilidad breve tras romper el escudo
  let runShields = 0;   // escudos recogidos en ESTA partida (acumulativos, no persisten)
  let usedStockShield = false; // ya se gastó el máximo de 1 escudo guardado en esta partida
  let clockFreeze = -1;    // dificultad congelada por el Reloj Estelar (puntuación congelada)
  let rt = { slow: false, magnet: false, coins: false, boost: false, luck: false, hype: false, oasis: false, doble: false, para: false, zoom: false, mirilla: false, amuleto: false, rescate: false, ticket: false, radar: false, bala: false, flot: false }; // herramientas de la bolsa activas esta partida
  let runSpawnWorth = 0;   // valor ponderado de las monedas que han salido esta partida (ticket)
  let runColWorth = 0;     // valor ponderado de las monedas recogidas esta partida (ticket)
  let worldSpeed = 0;
  let challengeMap = null;   // escenario fijo del desafío diario
  let lastCy = null;         // último hueco generado (para acotar el salto entre tuberías)
  let lastPipeX = -1;        // posición x del último tubo generado
  let combo = 0;
  let readyTap = false;
  let airborne = false;

  let diff = null;
  let lvl = 1;
  let mode = 'free';       // free | challenge | duel | zen | boss | wind | replay
  let clearedFlag = false; // evita disparar la superación de un modo 2 veces

  // RNG determinado por semilla (partida idéntica para todos: Semilla diaria + Replay fiel)
  let rng = Math.random;
  let curSeed = 0;
  let replayTaps = [];       // tiempos (ms) de cada aleteo de la partida actual (modo free)
  let replayMode = false;    // reproduciendo un Replay
  let replayIdx = 0;
  let replayRec = null;      // MediaRecorder del export de video
  let hitHappened = false;   // ¿hubo contacto en esta partida? (logro "sin tocar")
  let rival = null;          // IA del Duelo de Aves
  let wind = { on: false, t0: 0, dur: 0, dir: 0 };
  let windZoneLast = 0;
  let windArrows = false;    // flechas grandes de viento (modo Viento)
  let giantsMade = 0;        // tuberías generadas (cada 6 -> gigante)
  let nextWindPts = 150;
  let birds = [];            // BIRDS: el ave de la partida (siempre una)
  let bossGroup = null;      // jefe activo (tubería gigante con vida)
  let bossNext = false;      // el siguiente tubo a generar es la fase de jefe
  let bossPendAt = 20;       // cada cuántos tubos aparece el jefe (20)
  let zenLast = 0;           // metros ya contados como puntos en Zen

  const PHYS = { gravity: 1500, flapVel: -460, maxFall: 820 };
  const SKIN_DEF_STATS = { spd: 1, flap: 1, grav: 1, gap: 1 };
  let skinStats = SKIN_DEF_STATS; // multiplicadores de vuelo del ave equipada (data.js SKIN_STATS)
  const ip = { width: 78 };
  const MIN_PIPE_PAD = 30;      // separación horizontal mínima entre cuerpos de tubos
  const SPAWN_PAD = 26;         // margen extra para validar posiciones de objetos
  const LEVEL_STEP = 8;
  const DUEL_PIPES = 12;         // Tubos que hay que pasar en el Duelo de Aves
  const TUBO_MAX_LEVEL = 50; // Las tuberías fijan su dificultad al alcanzar el nivel 50

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    let h = 1779033703;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    return h >>> 0;
  }
  function dayKey() {
    const n = new Date();
    const p = v => (v < 10 ? '0' : '') + v;
    return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate());
  }
  function daySeed() { return hashSeed(dayKey()); }
  const POWERS = [
    { type: 'x2',    color: '#ffe066', icon: '✨' },
    { type: 'xc',    color: '#b2ff59', icon: '💰' },
    { type: 'magnet', color: '#ff7043', icon: '🧲' },
    { type: 'slow',   color: '#ffd54f', icon: '⏳' },
    { type: 'gem',    color: '#e1bee7', icon: '💎' },
    { type: 'shield', color: '#29b6f6', icon: '🛡️' },
    { type: 'ghost',  color: '#b388ff', icon: '👻' }
  ];

  // Puntuación "equivalente" que marca la dificultad (congelada por el Reloj Estelar).
  function effScore() {
    if (eff.clock > t && clockFreeze >= 0) return clockFreeze;
    return score;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundH = Math.max(64, H * 0.11);
    ip.width = clamp(Math.round(W * 0.085), 62, 84);
    clampPipesToScreen();   // al girar/redimensionar los huecos existentes siguen siendo válidos
    BG.resize(W, H);
  }

  // Reajusta huecos ya generados al tamaño actual de pantalla (evita tubos
  // atravesando el suelo o el techo tras rotar el móvil o cambiar de ventana).
  function clampPipesToScreen() {
    if (!pipes || !pipes.length) return;
    const playTop = 70;
    const playBot = H - groundH - 8;
    const free = Math.max(90, playBot - playTop);
    pipes.forEach(p => {
      p.w = clamp(p.w, 46, Math.max(46, W * 0.5));
      p.gapHalf = clamp(p.gapHalf, 40, Math.max(40, free / 2 - 30));
      let minCy = playTop + p.gapHalf;
      let maxCy = playBot - p.gapHalf;
      if (maxCy < minCy) {
        // pantalla muy baja: centra el hueco y reduce el alto si hace falta
        p.gapHalf = Math.max(36, (playBot - playTop) / 2 - 20);
        const c = (playTop + playBot) / 2;
        p.gap = c;
      } else {
        p.gap = clamp(p.gap, minCy, maxCy);
      }
      if (p.mv) {
        p.mv.amp = Math.max(0, Math.min(p.mv.amp, Math.min(p.gap - minCy, maxCy - p.gap)));
        p.mv.base = p.gap;
      }
    });
  }

function difficultyFor(sc, diffc) {
    const d = diffc || diff || DAT.getDiff(SAVE.get().set.diff);
    // Suavizado: crece más lento, tope más bajo
    // Las tuberías alcanzan su nivel de dificultad máximo en el nivel 50 y ahí se quedan
    const scTubo = Math.min(sc, (TUBO_MAX_LEVEL - 1) * LEVEL_STEP);
    const speed = (150 + scTubo * 6.2) * d.speedMul;
    const gapMin = Math.max(108 * d.gapMul, 118 - scTubo * 0.75);
    const gapVar = H * 0.45 * d.gapMul - scTubo * 2.2;
    const gap = Math.max(gapMin, gapVar);
    return {
      speed: Math.min(speed, 370 * d.speedMul),
      gap: gap,
      spawnEvery: Math.max(180, ip.width * 4.1) * d.spawnMul - Math.min(scTubo * 1.0, 100),
      enemyEvery: Math.max(1050, 1900 - sc * 32) * d.spawnMul,
      powerEvery: Math.max(1400, 3000 - sc * 15),
      megaEvery: Math.max(300, 430 - sc * 3),
      chainEvery: Math.max(900, 2200 - sc * 9),
      level: Math.min(Math.floor(sc / LEVEL_STEP) + 1, TUBO_MAX_LEVEL)
    };
  }

  // Dificultad vigente
  function curD(sc) {
    return difficultyFor(sc);
  }

  function newRun() {
    if (!SAVE.get()) SAVE.load();
    bird = {
      x: W * 0.28, y: H * 0.42, y0: H * 0.42,
      vy: 0, r: clamp(Math.min(W, H) * 0.05, 18, 25),
      rot: 0, squish: 1, wingPhase: 0, dead: false, pipes: 0
    };
    birds = [bird];
    pipes = []; coins = []; enemies = []; powers = [];
    score = 0; pipesDone = 0; coinCount = 0;
    runSpawnWorth = 0; runColWorth = 0;
    runSeconds = 0; spawnDist = 0; spawnEDist = 0; spawnPwDist = 0;
    spawnMegaDist = 0; spawnChDist = 0; nextMile = 1;
    totalDist = 0; combo = 0; lvl = 1; oasisLast = 0;
    eff.magnet = 0; eff.slow = 0; eff.x2 = 0; eff.xc = 0; eff.gem = 0; eff.clock = 0; eff.turbo = 0; eff.combo = 0;
    eff.shield = 0; eff.ghost = 0; eff.frenzy = 0; eff.bomb = 0; eff.aura = 0; eff.twin = 0; eff.ferro = 0; eff.rescueNext = 0; invulnT = 0;
    effDur = {};   // los cronómetros del HUD arrancan limpios en cada vuelo
    // Los escudos recogidos en vuelo son de esta partida. Los comprados se
    // guardan en SAVE.shields, pero solo se puede gastar uno por partida.
    runShields = 0;
    usedStockShield = false;
    clockFreeze = -1;
    rt.slow = false; rt.magnet = false; rt.coins = false; rt.boost = false; rt.luck = false; rt.score = false; rt.sprint = false; rt.hype = false; rt.oasis = false; rt.doble = false; rt.titan = false; rt.fenix = false; rt.para = false; rt.zoom = false; rt.mirilla = false; rt.amuleto = false; rt.rescate = false; rt.ticket = false; rt.radar = false; rt.bala = false; rt.flot = false;
    oasisLast = 0;
    clearedFlag = false;
    readyTap = true; airborne = false;
    replayTaps = []; replayIdx = 0; hitHappened = false;
    lastCy = null; lastPipeX = -1;
    wind.on = false; windZoneLast = 0; giantsMade = 0; nextWindPts = 150;
    windArrows = mode === 'wind';
    bossGroup = null; bossNext = false; bossPendAt = 20; zenLast = 0;
    if (mode === 'challenge') { curSeed = daySeed(); rng = mulberry32(curSeed); }
    else if (mode === 'replay') {
      const rp = SAVE.getReplay();
      replayMode = !!rp;
      if (rp) { curSeed = rp.seed || 0; rng = mulberry32(curSeed); replayTaps = Array.isArray(rp.taps) ? rp.taps : []; replayIdx = 0; }
      else { curSeed = 0; rng = Math.random; }
    } else {
      curSeed = ((Date.now() ^ SAVE.get().stats.flights) % 0x7fffffff) ^ 0x9e3779b9;
      rng = mulberry32(curSeed);
    }
    const rp = SAVE.getReplay();
    rival = mode === 'duel'
      ? { prog: 0, strength: clamp(0.6 + SAVE.get().level * 0.02, 0.55, 1.3) }
      : null;
    diff = DAT.getDiff(mode === 'challenge' ? 'normal' : SAVE.get().set.diff);
    ENTS.setHC(!!SAVE.get().set.hc);
    skinStats = DAT.skinStats(SAVE.get().skin);
    worldSpeed = 0;
    FX.clear(); FX.shake(0);
    BG.init(mode === 'challenge' ? challengeMap : (mode === 'replay' && replayMode && rp ? rp.map : SAVE.get().map)); BG.reset();
    if (mode !== 'zen') preSpawnPipes(); // Zen: sin tubos, solo vuelo libre
  }

  // Obstáculos ya visibles en pantalla durante la fase "listo"
  function preSpawnPipes() {
    const D = curD(0);
    mkPipe(W * 0.82, D);
    const last = pipes[pipes.length - 1];
    const base = last ? last.x + last.w + Math.max(64, D.spawnEvery) : W * 0.82 + D.spawnEvery;
    mkPipe(Math.max(W * 0.82 + D.spawnEvery + ip.width, base), D);
  }

  // Primer x (a la derecha de x) cuyo cuerpo no se solape con otro tubo.
  function safePipeX(x, w, pad) {
    const gap = Math.max(10, pad || MIN_PIPE_PAD);
    let nx = x;
    for (let guard = 0; guard < 40; guard++) {
      let hit = null;
      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        if (nx < p.x + p.w + gap && nx + w > p.x - gap) { hit = p; break; }
      }
      if (!hit) break;
      nx = hit.x + hit.w + gap;
    }
    return nx;
  }

  function mkPipe(x, D) {
    const margin = 80;
    const big = giantsMade > 0 && giantsMade % 6 === 0; // tubería gigante cada 6
    const w = big ? ip.width * 1.7 : ip.width;
    x = safePipeX(x, w, MIN_PIPE_PAD); // raíz: nunca dos tubos encima
    // Fase de jefe: el siguiente tubo se sustituye por la tubería gigante con vida
    if (mode === 'boss' && bossNext && !bossGroup) { bossNext = false; mkBoss(x, D); return; }
    // El hueco mínimo siempre deja espacio real para el pajarito
    const minGap = bird.r * 2 + 36;
    const gap = Math.max(minGap, D.gap * (big ? 0.8 : 1) * skinStats.gap);
    const gapHalf = gap / 2;
    const minCy = margin + gapHalf;
    const maxCy = H - groundH - gapHalf - margin;
    // Salto vertical acotado por la distancia horizontal real hasta el tubo anterior:
    // nunca más de ~55% de esa distancia para que siempre haya sitio para cruzar
    const dxPrev = (lastPipeX >= 0) ? Math.max(40, x - lastPipeX) : D.spawnEvery;
    const maxStep = clamp(dxPrev * 0.55, 56, H * 0.30);
    const lo = Math.min(minCy, maxCy), hi = Math.max(minCy, maxCy);
    const low = (lastCy === null) ? lo : Math.max(lo, lastCy - maxStep);
    const high = (lastCy === null) ? hi : Math.min(hi, lastCy + maxStep);
    const cy = (low < high) ? low + rng() * (high - low) : clamp((H - groundH) / 2, lo, hi);
    const mv = !big && rng() < 0.2 ? { ph: rng() * Math.PI * 2, amp: Math.min(gap * 0.42, 64), spd: 0.9 + rng() * 1.2, base: cy } : null;
    pipes.push({ x: x, w: w, gap: cy, gapHalf, passed: false, big, mv });
    giantsMade++;
    lastCy = cy;
    lastPipeX = x;
    // Tubería doble: dos huecos APARTE (sin solapar cuerpos) y con hueco amplio
    if (!big && rng() < 0.14 && lo < hi) {
      const sep = Math.max(90, ip.width * 1.05);
      const offMax = clamp(sep * 0.6, 40, 95);
      const off = (rng() < 0.5 ? 1 : -1) * (18 + rng() * (offMax - 18));
      const cy2 = clamp(cy + off, lo, hi);
      const w2 = ip.width;
      const x2 = safePipeX(x + w + sep, w2, MIN_PIPE_PAD);
      pipes.push({ x: x2, w: w2, gap: cy2, gapHalf, passed: false, big: false, mv: null });
      lastCy = cy2; // el siguiente hueco parte del segundo
      lastPipeX = x2;
    }
    // Las monedas son escasas: solo ~1 de cada 3 tubos trae un par.
    // Se validan contra TODOS los tubos y objetos antes de crearse.
    if (rng() < 0.35) {
      const cx = x + w + 40;
      for (let i = 0; i < 2; i++) {
        const cyv = clamp(cy + (i % 2 === 0 ? -18 : 18), 20, H - groundH - 20);
        if (addCoinSafe(cx + i * 26, cyv, 10, { ph: i * 1.7 })) runSpawnWorth++;
      }
    }
  }

  // JEFE 👹: tubería gigante con 3 huecos que se abren y cierran. Cada hueco cruzado
  // le quita 1 de vida; al llegar a 0 el jefe muere con premio. El hueco móvil hace
  // que haya que sincronizar el paso (difficultyFor ya da el nivel, aquí solo se
  // arma la fase en newRun continuando el generador).
  function mkBoss(x, D) {
    const g = { hp: 3, left: x, dead: false };
    bossGroup = g;
    const minGap = bird.r * 2 + 40;
    const gap = Math.max(minGap, D.gap * 0.7 * skinStats.gap);
    const gapHalf = gap / 2;
    const margin = 80;
    const minCy = margin + gapHalf;
    const maxCy = H - groundH - gapHalf - margin;
    const lo = Math.min(minCy, maxCy), hi = Math.max(minCy, maxCy);
    const segW = ip.width * 1.25;
    for (let seg = 0; seg < 3; seg++) {
      const gx = safePipeX(x + seg * (ip.width + 150), segW, MIN_PIPE_PAD);
      const cy = lo + rng() * (hi - lo);
      pipes.push({
        x: gx,
        w: segW,
        gap: cy, gapHalf,
        passed: false,
        big: true,
        boss: true, seg,
        mv: { ph: rng() * Math.PI * 2, amp: Math.min(gap * 0.62, 78), spd: 1.7 + rng() * 0.9, base: cy }
      });
      lastCy = cy;
      lastPipeX = gx;
    }
    giantsMade++;
    FX.text(W * 0.5, H * 0.28, '👹 ¡Boss! Cruza sus 3 huecos', 20, '#ff7043');
    SND.sfx.level();
  }

  function spawnPipe(D) {
    // Garantiza separación horizontal mínima: el siguiente tubo nunca toca al anterior
    const mouth = W + 30;
    const last = pipes[pipes.length - 1];
    const minX = last ? last.x + last.w + 64 : mouth;
    mkPipe(Math.max(mouth, minX), D);
  }

  /* --- Validación de posiciones para objetos que aparecen en el carril ---------- */
  // ¿El círculo (x,y,r) está dentro del cuerpo macizo de algún tubo?
  function pipeBlockedAt(x, y, r) {
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      if (x + r < p.x || x - r > p.x + p.w) continue;
      if (y - r < p.gap - p.gapHalf || y + r > p.gap + p.gapHalf) return true;
    }
    return false;
  }

  function overlapsEntity(x, y, r) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i], dx = x - e.x, dy = y - e.y, rr = e.r + r + 8;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i], dx = x - c.x, dy = y - c.y, rr = c.r + r * 0.9;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    for (let i = 0; i < powers.length; i++) {
      const p = powers[i], dx = x - p.x, dy = y - p.y, rr = p.r + r + 8;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  // Posición válida: en pantalla, fuera de tubos y sin pisar otros objetos.
  function isSpotFree(x, y, r) {
    if (!isFinite(x) || !isFinite(y)) return false;
    if (y - r < 4 || y + r > H - groundH - 4) return false;
    if (x + r < 0 || x - r > W + 360) return false;
    if (pipeBlockedAt(x, y, r + 2)) return false;
    if (overlapsEntity(x, y, r)) return false;
    return true;
  }

  // Banda vertical libre para un objeto que ocupa [x, x+span].
  function freeBand(x, span, r) {
    const top = r + 14;
    const bottom = H - groundH - r - 14;
    if (bottom <= top) return null;
    let a = top, b = bottom, inPipe = false;
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      if (x + span + r < p.x || x - r > p.x + p.w) continue;
      inPipe = true;
      a = Math.max(a, p.gap - p.gapHalf + r + 6);
      b = Math.min(b, p.gap + p.gapHalf - r - 6);
    }
    if (inPipe && b <= a) return null;
    return { a: a, b: b };
  }

  // Elige una Y libre dentro de la banda; null si no hay sitio (mejor no crear).
  function freeY(x, span, r, tries) {
    const n = tries || 16;
    const band = freeBand(x, span, r);
    if (!band) return null;
    for (let i = 0; i < n; i++) {
      const y = band.a + rng() * (band.b - band.a);
      if (isSpotFree(x + span / 2, y, r)) return y;
    }
    return null;
  }

  function addCoinSafe(x, y, r, extra) {
    if (!isSpotFree(x, y, r)) {
      const band = freeBand(x, 0, r);
      if (band) {
        for (let i = 0; i < 10; i++) {
          const yy = band.a + rng() * (band.b - band.a);
          if (isSpotFree(x, yy, r)) { y = yy; break; }
        }
      }
    }
    if (!isSpotFree(x, y, r)) return false;
    coins.push(Object.assign({ x: x, y: y, r: r, ph: rng() * Math.PI * 2 }, extra || {}));
    return true;
  }

  // Compatibilidad: elige una Y válida para x/span (nunca dentro de un tubo).
  function spawnCorridorY(r, x, span) {
    const px = (typeof x === 'number') ? x : W + 50;
    const sp = (typeof span === 'number') ? span : r * 2;
    return freeY(px, sp, r);
  }

  // Enemigos: más fuertes y más frecuentes cuanto más lejos vueles (nivel actual).
  // Son diablillos (imp) o murciélagos 🦇 (más rápidos).
  function spawnEnemy() {
    const lv = lvl;
    const tier = lv <= 4 ? 1 : lv <= 9 ? 2 : 3;
    const roll = rng();
    const type = roll < 0.45 ? 'bat' : 'imp';
    const r = type === 'bat' ? 15 : (tier === 3 ? 18 : tier === 2 ? 16 : 14);
    // Se crea fuera de pantalla: debe caber en el hueco del tubo que esté allí.
    const baseY = spawnCorridorY(r, W + 60, r * 2);
    if (baseY === null) return false;
    const sp = (40 + score * 1.5) * (0.65 + tier * 0.3);
    enemies.push({
      x: W + 60, baseY: baseY, y: baseY, r: r, tier: tier, type: type,
      speed: Math.min(sp * (type === 'bat' ? 1.55 : 1), 115 + tier * 22),
      wf: tier === 3 ? 2.4 : tier === 2 ? 1.9 : 1.5,
      ph: rng() * Math.PI * 2,
      amp: Math.min(42 + lv * 3.5, 120),
      passed: false
    });
    return true;
  }

  // Cadena de monedas 🍒: un arco de 5 monedas. Cada moneda se valida por separado
  // (el arco ocupa ~104 px y puede cruzar el cuerpo de un tubo).
  function spawnChain() {
    const r = 10;
    const span = 104;
    const x0 = W + 40;
    const amp = 34;
    for (let attempt = 0; attempt < 16; attempt++) {
      const mid = spawnCorridorY(r, x0, span);
      if (mid === null) return false;
      const dir = rng() < 0.5 ? 1 : -1;
      const pts = [];
      let ok = true;
      for (let i = 0; i < 5; i++) {
        const y = mid + dir * Math.sin((i / 4) * Math.PI) * amp;
        if (!isSpotFree(x0 + i * 26, y, r)) { ok = false; break; }
        pts.push(y);
      }
      if (!ok) continue;
      for (let i = 0; i < 5; i++) {
        coins.push({ x: x0 + i * 26, y: pts[i], r: r, ph: i * 1.1, chain: true });
      }
      runSpawnWorth += 5;
      return true;
    }
    return false;
  }

  // Power-ups: doble puntos, imán, cámara lenta...
  function spawnPower() {
    const pf = POWERS[Math.floor(rng() * POWERS.length)];
    const r = 16;
    const y = spawnCorridorY(r, W + 40, r * 2);
    if (y === null) return false;
    powers.push({ x: W + 40, y: y, r: r, ph: rng() * Math.PI * 2, type: pf.type, color: pf.color, icon: pf.icon });
    return true;
  }

  // Moneda de oro rara: vale 10
  function spawnMega() {
    const r = 15;
    const y = spawnCorridorY(r, W + 40, r * 2);
    if (y === null) return false;
    coins.push({ x: W + 40, y: y, r: r, ph: rng() * Math.PI * 2, big: true });
    runSpawnWorth += 10;
    return true;
  }

  function activatePower(type) {
    if (eff.frenzy > t || rt.hype) {
      score += eff.frenzy > t ? 1 : 2; // Frenesí 🎇 (+1) o Hype 🔥 (+2) por power-up
      FX.text(bird.x, bird.y - bird.r - 44, eff.frenzy > t ? '🎇 +1' : '🔥 +2', 12, '#ff8a65');
      updateHUD();
    }
    const labels = { x2: '✨ ¡Doble puntos!', xc: '💰 ¡Monedas al doble!', magnet: '🧲 ¡Imán!', slow: '⏳ ¡Cámara lenta!', gem: '💎 +3 🪙 ¡Diamante!', shield: '🛡️ ¡Escudo de partida +1!', ghost: '👻 ¡Modo fantasma!' };
    const colors = { x2: '#ffe066', xc: '#b2ff59', magnet: '#ff7043', slow: '#ffd54f', gem: '#e1bee7', shield: '#29b6f6', ghost: '#b388ff' };
    const dur = type === 'xc' ? 10 : type === 'magnet' ? 7 : type === 'slow' ? 5 : 8;
    if (type === 'shield') {
      // Recogido en pleno vuelo: se acumula solo para esta partida.
      runShields++;
    } else if (type === 'ghost') {
      eff.ghost = t + 3; effDur.ghost = 3;
    } else {
      eff[type] = t + dur; effDur[type] = dur;
    }
    if (SAVE.get().stats) {
      SAVE.get().stats.powersGot = (SAVE.get().stats.powersGot || 0) + 1;
      if (type === 'xc') SAVE.get().stats.xcGot = (SAVE.get().stats.xcGot || 0) + 1;
      if (type === 'gem') {
        SAVE.get().stats.gemsGot = (SAVE.get().stats.gemsGot || 0) + 1;
        SAVE.addCoins(3);
        score += 1;
        updateHUD();
      }
      SAVE.save();
    }
    SND.sfx.power();
    FX.burst(bird.x, bird.y, colors[type], 16, 220);
    FX.text(bird.x, bird.y - bird.r - 24, labels[type], 15, colors[type]);
    if (type === 'shield') updateHUD(); // el contador del HUD refleja el escudo de partida
  }

  function drawAura(ctx, x, y, r, col) {
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 8);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function loop(ms) {
    loopActive = true;
    if (halted || document.hidden) { halted = true; loopActive = false; lastTime = ms; return; } // no sigue tras apagar pantalla
    const dt = Math.max(0, Math.min((ms - lastTime) / 1000, 0.033));
    lastTime = ms;
    if (paused || state === 'load') { rafId = requestAnimationFrame(loop); return; }
    t += dt; // el reloj global no avanza mientras se esté en pausa

    if (state === 'menu' || state === 'cleared' || state === 'over') {
      BG.update(dt, 70);
      if (bird) {
        bird.wingPhase = (bird.wingPhase + dt * 1.4) % 1;
        if (state === 'menu' || state === 'cleared') { bird.y = bird.y0 + Math.sin(t * 2.2) * 9; }
        else { bird.y += bird.vy * dt; bird.vy += PHYS.gravity * dt; bird.rot = Math.min(1.4, bird.rot + dt * 5); }
        if (state !== 'cleared') {
          pipes.forEach(p => { p.x -= 60 * dt; });
          pipes = pipes.filter(p => p.x > -ip.width - 30);
          enemies.forEach(e => e.x -= 60 * dt);
          enemies = enemies.filter(e => e.x > -120);
        }
      }
      FX.update(dt);
      render();
      rafId = requestAnimationFrame(loop);
      return;
    }

    // PLAY
    if (readyTap) {
      if (replayMode) {
        // En el Replay la fase de "listo" se salta: los aleteos grabados (incluido el primero) se reproducen al instante
        readyTap = false; airborne = true;
        UI.showStartHint(false);
      } else {
        // Antes del primer toque el mundo está congelado (solo aleteo + obstáculos visibles parados)
        BG.update(dt, 18);
        bird.wingPhase += dt * 6;
        bird.y = bird.y0 + Math.sin(t * 2.4) * 6;
      }
    } else {
      runSeconds += dt;
      const D = curD(mode === 'zen' ? 0 : effScore()); // Zen: dificultad congelada, sin tubos ni enemigos
      lvl = D.level;
      worldSpeed += (D.speed * skinStats.spd - worldSpeed) * Math.min(1, dt * 1.6);
      const spd = worldSpeed * (eff.slow > t ? 0.5 : 1) * (rt.slow ? 0.75 : 1) * (eff.turbo > t ? 1.85 : 1) * (rt.zoom ? 0.75 : 1);
      totalDist += spd * dt;
      // Replay: los aleteos grabados se reproducen en su momento exacto
      if (replayMode) {
        while (replayIdx < replayTaps.length && runSeconds >= replayTaps[replayIdx] / 1000) {
          replayIdx++;
          flapNow();
        }
      }
      // Tramo de viento lateral (cada 420 m; en modo Viento cada 260 m y más intenso)
      // (totalDist está en píxeles y 30 px = 1 m)
      if (mode !== 'zen') {
        const wz = Math.floor(totalDist / (30 * (mode === 'wind' ? 260 : 420)));
        if (wz > windZoneLast) {
          windZoneLast = wz;
          SAVE.get().stats.windZones = (SAVE.get().stats.windZones || 0) + 1;
          SAVE.save();
          wind.on = true; wind.t0 = t; wind.dur = mode === 'wind' ? 6.5 : 4.5; wind.dir = rng() < 0.5 ? -1 : 1;
          FX.text(bird.x, bird.y - bird.r - 70, '💨 ¡Viento lateral!', 15, '#81d4fa');
          UI.toast('💨 ¡Tramo de viento lateral!', 'warning');
        }
      }
      if (wind.on && t > wind.t0 + wind.dur) wind.on = false;
      if (wind.on) {
        const wstr = mode === 'wind' ? 0.6 : 0.32;
        birds.forEach(b => {
          if (b.dead) return;
          b.x += wind.dir * spd * wstr * dt;
          b.x = clamp(b.x, b.r + 6, W * 0.74);
        });
      }
      const dm = Math.floor(totalDist / 30);
      // Zen: cada metro volado suma 1 punto (no hay tubos ni enemigos)
      if (mode === 'zen' && dm > zenLast) { score += dm - zenLast; zenLast = dm; updateHUD(); }
      if (rt.oasis) {
        const om = Math.floor(dm / 10);
        if (om > oasisLast) { score += om - oasisLast; oasisLast = om; updateHUD(); }
      }
      if (dm >= nextMile * 100) {
        nextMile++;
        SAVE.addCoins(5);
        SND.sfx.level();
        FX.burst(bird.x, bird.y, '#69f0ae', 18, 240);
        FX.text(bird.x, bird.y - bird.r - 30, '+' + (nextMile - 1) * 100 + ' m · +5 🪙', 15, '#69f0ae');
        UI.toast('🎉 ¡' + (nextMile - 1) * 100 + ' m! +5 🪙', 'good');
        updateHUD();
      }
      BG.update(dt, spd);

      // física de cada pajarito
      const gravMul = diff.gravityMul * (SAVE.get().set.moon ? 0.72 : 1) * (rt.sprint ? 0.85 : 1) * (rt.para ? 0.6 : 1);
      birds.forEach(b => {
        b.vy = Math.min(b.vy + PHYS.gravity * skinStats.grav * gravMul * dt, PHYS.maxFall);
        b.y += b.vy * dt;
        b.squish = 1;
        b.rot = Math.max(-0.5, Math.min(1.1, b.vy / 900));
        b.wingPhase = (b.wingPhase + dt * (8 + b.vy / -320)) % 1;
      });

      // generar obstáculos, enemigos y power-ups (Zen no genera nada)
      if (mode !== 'zen') {
      spawnDist += spd * dt;
      if (spawnDist >= D.spawnEvery) { spawnDist = 0; spawnPipe(D); }
      spawnEDist += spd * dt;
      if (spawnEDist >= D.enemyEvery) { spawnEDist = 0; spawnEnemy(); }
      spawnPwDist += spd * dt;
      if (spawnPwDist >= D.powerEvery) { spawnPwDist = 0; spawnPower(); }
      spawnMegaDist += spd * dt;
      if (spawnMegaDist >= (rt.radar ? D.megaEvery / 1.6 : D.megaEvery)) { spawnMegaDist = 0; spawnMega(); }
      spawnChDist += spd * dt;
      if (spawnChDist >= (rt.radar ? D.chainEvery / 1.6 : D.chainEvery)) { spawnChDist = 0; spawnChain(); }
      }

      // mover tubos
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= spd * dt;
        // tubo móvil: el hueco sube y baja
        if (p.mv) {
          p.gap = clamp(p.mv.base + Math.sin(t * p.mv.spd + p.mv.ph) * p.mv.amp, 80 + p.gapHalf, H - groundH - p.gapHalf - 4);
        }
        if (!p.passed && p.x + p.w < bird.x - bird.r) {
          p.passed = true; pipesDone++; score += (eff.x2 > t ? 2 : 1) + (rt.score ? 1 : 0) + (eff.combo > t ? 2 : 0) + (eff.aura > t ? 1 : 0) + (rt.doble ? 1 : 0) + (rt.titan ? 2 : 0); combo++;
          if (rt.bala && pipesDone % 10 === 0) balaShot();
          if (mode === 'duel' && !clearedFlag && !bird.dead && pipesDone >= DUEL_PIPES) {
            clearedFlag = true;
            duelClear(true);
            break; // no cortar el bucle principal: sigue el requestAnimationFrame para la celebración
          }
          if (mode === 'duel' && rival) {
            if (rng() < rival.strength) rival.prog++;
            else if (rng() < 0.35) rival.prog++;
          }
          if (mode === 'boss' && !bossGroup && !bossNext && pipesDone >= bossPendAt) bossNext = true;
          if (p.boss && bossGroup && !bossGroup.dead) {
            bossGroup.hp--;
            SND.sfx.enemy();
            score += 8;
            FX.text(bird.x, bird.y - bird.r - 70, '💥 ¡Boss! -1 vida', 16, '#ff7043');
            FX.burst(bird.x, bird.y, '#ff7043', 16, 260);
            if (bossGroup.hp <= 0) {
              bossGroup.dead = true;
              SAVE.addCoins(20);
              SAVE.get().stats.bossDefeated = (SAVE.get().stats.bossDefeated || 0) + 1;
              SAVE.save();
              SND.sfx.level();
              FX.confetti(bird.x, bird.y - 40);
              FX.text(bird.x, bird.y - bird.r - 120, '👹 ¡BOSS DERROTADO! +20 🪙', 22, '#ffca28');
              UI.toast('👹 ¡Boss derrotado! +20 🪙', 'good');
              bossPendAt += 20;
            }
          }
          if (p.big) {
            SAVE.get().stats.giantPassed = (SAVE.get().stats.giantPassed || 0) + 1;
            SAVE.save();
          }
          if (eff.ghost > t) {
            SAVE.get().stats.ghostPassed = (SAVE.get().stats.ghostPassed || 0) + 1;
            SAVE.save();
          }
          if (combo > 3) SAVE.setCombo(combo);
          SND.sfx.score();
          const lvlAfter = difficultyFor(score).level;
          if (lvlAfter > lvl) onLevelUp(lvlAfter);
          updateHUD();
        }
        if (p.x < -p.w - 40) {
          if (p.boss && p.seg === 2 && bossGroup) bossGroup = null; // el jefe salió de pantalla (solo al irse su último hueco)
          pipes.splice(i, 1);
        }
      }

      // mover monedas
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (eff.magnet > t || rt.magnet) {
          c.x += (bird.x - c.x) * Math.min(1, dt * (7 + toolLv('magnet') * 0.4));
          c.y += (bird.y - c.y) * Math.min(1, dt * (5 + toolLv('magnet') * 0.3));
        }
        c.x -= spd * dt;
        if (c.x < -30) { coins.splice(i, 1); continue; }
        let pick = null;
        for (const b of birds) {
          if (b.dead) continue;
          const dx = c.x - b.x, dy = c.y - b.y;
          const rr = c.r + b.r * 0.8;
          if (dx * dx + dy * dy < rr * rr) { pick = b; break; }
        }
        if (pick) {
          coins.splice(i, 1);
          coinCount++;
          runColWorth += c.big ? 10 : 1;
          if (c.big) {
            SAVE.get().stats.megaGot = (SAVE.get().stats.megaGot || 0) + 1;
            SAVE.save();
          } else if (c.chain) {
            SAVE.get().stats.chainGot = (SAVE.get().stats.chainGot || 0) + 1;
            SAVE.save();
          }
          let val = c.big ? 10 : Math.max(1, Math.round((1 + Math.floor(lvl / 5)) * (diff && diff.coinMul ? diff.coinMul : 1))) + (rt.luck ? (1 + toolLv('luck')) : 0);
          if (!c.big && (eff.xc > t || rt.coins)) val = val * 2 + toolLv('coins');
          if (eff.ferro > t) val += 2;
          SAVE.addCoins(val);
          if (eff.bomb > t) { score += 1; FX.text(c.x, c.y - 34, '🧨 +1', 11, '#ffab91'); }
          if (c.big) {
            SND.sfx.power();
            FX.burst(c.x, c.y, '#ffca28', 18, 260);
            FX.text(c.x, c.y - 18, '+10 🪙', 18, '#ffca28');
          } else {
            SND.sfx.coin();
            FX.burst(c.x, c.y, '#ffd54f', 12, 170);
            FX.text(c.x, c.y - 16, '+' + val, 16, '#ffe066');
          }
          updateHUD();
        }
      }

      // mover enemigos
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x -= (spd + e.speed) * dt;
        e.y = e.baseY + Math.sin(t * e.wf + e.ph) * (e.type === 'bat' ? e.amp * 1.25 : e.amp);
        if (!e.passed && e.x + e.r < bird.x - bird.r) {
          e.passed = true;
          score += eff.x2 > t ? 4 : 2; combo++;
          SAVE.get().stats.enemiesGot = (SAVE.get().stats.enemiesGot || 0) + 1;
          if (e.type === 'bat') SAVE.get().stats.batsGot = (SAVE.get().stats.batsGot || 0) + 1;
          SAVE.save();
          const lvlAfter = difficultyFor(score).level;
          if (lvlAfter > lvl) onLevelUp(lvlAfter);
          SND.sfx.enemy();
          FX.text(e.x, e.y - 18, '+2', 15, '#ff9ce6');
          FX.burst(e.x, e.y, '#b39ddb', 8, 140);
          updateHUD();
        }
        if (e.x < -120) enemies.splice(i, 1);
      }

      // mover y recoger power-ups
      for (let i = powers.length - 1; i >= 0; i--) {
        const pw = powers[i];
        pw.x -= spd * dt;
        if (pw.x < -40) { powers.splice(i, 1); continue; }
        let pwPick = null;
        for (const b of birds) {
          if (b.dead) continue;
          const dx = pw.x - b.x, dy = pw.y - b.y;
          const rr = pw.r + b.r * 0.9;
          if (dx * dx + dy * dy < rr * rr) { pwPick = b; break; }
        }
        if (pwPick) {
          const prev = bird;
          bird = pwPick; // los FX/efectos se anclan al ave que lo capturó
          powers.splice(i, 1);
          activatePower(pw.type);
          bird = prev;
          updateHUD();
        }
      }

      // colisiones: CUALQUIER choque con tubo, enemigo o suelo acaba la partida (por ave)
      if (state === 'play') {
        const ghostOn = eff.ghost > t;
        birds.forEach((b, bi) => {
          if (b.dead) return;
          if (b.y + b.r >= H - groundH) {
            if (invulnT > t) { b.y = H - groundH - b.r - 1; b.vy = Math.max(b.vy, -1); }
            else { b.y = H - groundH - b.r; hitObstacleBird(b, bi); } // el escudo también protege del suelo
          }
          if (b.y - b.r < 2) { b.y = 2 + b.r; b.vy = Math.max(b.vy, 0); }
          if (!ghostOn && !b.dead) { // el fantasma atraviesa tubos y enemigos sin morir
            for (let i = 0; i < pipes.length && !b.dead; i++) {
              const p = pipes[i];
              if (circleRect(b.x, b.y, b.r * 0.85, p.x, 0, p.w, p.gap - p.gapHalf)) {
                hitObstacleBird(b, bi); break;
              } else if (circleRect(b.x, b.y, b.r * 0.85, p.x, p.gap + p.gapHalf, p.w, H - groundH - p.gap - p.gapHalf)) {
                hitObstacleBird(b, bi); break;
              }
            }
            for (let i = 0; i < enemies.length && !b.dead; i++) {
              const e = enemies[i];
              const dx = e.x - b.x, dy = e.y - b.y;
              const rr = e.r + b.r * 0.76;
              if (dx * dx + dy * dy < rr * rr) { hitObstacleBird(b, bi); break; }
            }
          }
        });
      }

    }

    // estela (cantidad segun los efectos visuales)
    const fx = DAT.getFx(SAVE.get().fx);
    const gq = SAVE.get().set.gfx;
    const trailChance = gq === 'high' ? 0.5 : gq === 'medium' ? 0.3 : 0.12;
    if (airborne) {
      birds.forEach(b => {
        if (b.dead || !fx.color || Math.random() >= trailChance) return;
        const col = fx.rainbow ? 'hsl(' + ((t * 260) % 360) + ',95%,62%)' : fx.color;
        const tn = gq === 'high' ? 3 : gq === 'medium' ? 2 : 1;
        FX.trail(b.x - b.r * 0.7, b.y + b.r * 0.2, col, tn, fx.stars);
      });
    }

    FX.update(dt);
    updateHUD();
    render();
    rafId = requestAnimationFrame(loop);
  }

  /* --- Suspensión: pantalla apagada o app en segundo plano --- */
  function suspend() {
    if (halted && !loopActive) return;
    halted = true;
    loopActive = false;
    if (cancelAnimationFrame) cancelAnimationFrame(rafId);
    if (state === 'play' && !paused) {
      paused = true;
      autoPaused = true;
      UI.setPaused(true);
      UI.setHudVisible(false);
    }
    SND.stopMusic();
  }

  function resumeLoop() {
    if (loopActive) return;
    halted = false;
    loopActive = true;
    lastTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    if (state === 'menu') SND.startMusic();
    requestAnimationFrame(loop);
  }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  function onLevelUp(newLevel) {
    lvl = newLevel;
    SND.sfx.level();
    FX.confetti(bird.x, bird.y - 20);
    FX.text(bird.x, bird.y - 46, '¡NIVEL ' + lvl + '!', 22, '#ffe066');
    UI.toast('⚡ ¡Nivel ' + lvl + '! El vuelo se pone intenso', 'info');
    updateHUD();
  }

  function flap() {
    if (paused || state !== 'play' || replayMode) return; // en el Replay los aleteos los pone la grabación
    SND.unlock();
    SND.sfx.flap();
    if (readyTap) { readyTap = false; airborne = true; UI.showStartHint(false); }
    flapPhys(bird);
    if (!replayMode && replayTaps.length < 5000) replayTaps.push(Math.round(runSeconds * 1000));
    if (SAVE.get().set.vib && navigator.vibrate) { try { navigator.vibrate(16); } catch (e) { } }
  }

  // Aleteo de física (sin sonido): compartido por los jugadores y el Replay
  function flapPhys(b) {
    b.vy = PHYS.flapVel * skinStats.flap * 0.98;
    b.squish = 1.18;
    b.wingPhase = 0;
  }
  function flapNow() { flapPhys(bird); }

  function collide() { killBird(bird, 0); }

  // Choque con un obstáculo: si hay escudo lo consume (sin morir); con i-frames breves
  function hitObstacle() { hitObstacleBird(bird, 0); }

  function hitObstacleBird(b, bi) {
    if (b.dead) return;
    // Los i-frames mandan: un solo choque consume como máximo un recurso.
    if (invulnT > t) return;
    // Prioridad: escudos recogidos en esta partida → 1 escudo guardado → rescate → muerte.
    if (runShields > 0) {
      runShields--;
      invulnT = t + 1.0;
      SAVE.get().stats.shieldAbsorbed = (SAVE.get().stats.shieldAbsorbed || 0) + 1;
      SAVE.save();
      SND.sfx.block();
      FX.burst(b.x, b.y, '#29b6f6', 26, 300, { big: true, grav: 300 });
      FX.text(b.x, b.y - b.r - 26, '🛡️ ¡Escudo de partida! (' + runShields + ' restantes)', 16, '#29b6f6');
      if (SAVE.get().set.shake !== false) FX.shake(8);
      if (SAVE.get().set.vib && navigator.vibrate) { try { navigator.vibrate(50); } catch (e) { } }
      updateHUD();
    } else if (!usedStockShield && SAVE.shieldCount() > 0) {
      usedStockShield = true;
      SAVE.useShield(); // descuenta y guarda el stock al instante
      invulnT = t + 1.0;
      SAVE.get().stats.shieldAbsorbed = (SAVE.get().stats.shieldAbsorbed || 0) + 1;
      SAVE.save();
      SND.sfx.block();
      FX.burst(b.x, b.y, '#29b6f6', 26, 300, { big: true, grav: 300 });
      FX.text(b.x, b.y - b.r - 26, '🛡️ ¡Escudo guardado! (' + SAVE.shieldCount() + ' en stock)', 16, '#29b6f6');
      if (SAVE.get().set.shake !== false) FX.shake(8);
      if (SAVE.get().set.vib && navigator.vibrate) { try { navigator.vibrate(50); } catch (e) { } }
      updateHUD();
    } else if (rt.rescate && eff.rescueNext <= t) {
      eff.rescueNext = t + 20;
      invulnT = t + 1.0;
      b.vy = Math.max(b.vy, -120);
      SAVE.get().stats.rescueUsed = (SAVE.get().stats.rescueUsed || 0) + 1;
      SAVE.save();
      SND.sfx.block();
      FX.burst(b.x, b.y, '#4dd0e1', 24, 280, { big: true, grav: 300 });
      FX.text(b.x, b.y - b.r - 26, '🚨 ¡Rescate! +20 s', 16, '#4dd0e1');
      if (SAVE.get().set.shake !== false) FX.shake(8);
      if (SAVE.get().set.vib && navigator.vibrate) { try { navigator.vibrate(50); } catch (e) { } }
      updateHUD();
    } else {
      killBird(b, bi);
    }
  }

  // Muerte del ave (con la resurrección del Fénix).
  function killBird(b, bi) {
    if (b.dead) return;
    hitHappened = true;
    if (rt.flot) {
      rt.flot = false;
      b.dead = false;
      b.vy = -300;
      invulnT = t + 1.6;
      SAVE.save();
      SND.sfx.block();
      FX.burst(b.x, b.y, '#4dd0e1', 30, 360, { big: true, grav: 300 });
      FX.text(b.x, b.y - b.r - 40, '🎈 ¡Flotador! +1 choque', 18, '#4dd0e1');
      UI.toast('🎈 ¡El Flotador aguantó el choque!', 'good');
      updateHUD();
      return;
    }
    if (rt.fenix) {
      rt.fenix = false;
      b.dead = false;
      b.y = Math.max(H * 0.42, H - groundH - b.r - 60);
      b.vy = -260;
      invulnT = t + 2.5;
      SAVE.get().stats.fenixUsed = (SAVE.get().stats.fenixUsed || 0) + 1;
      SAVE.save();
      SND.sfx.power();
      FX.burst(b.x, b.y, '#ff8a65', 30, 380, { big: true, grav: 300 });
      FX.text(b.x, b.y - b.r - 40, '🦅 ¡FÉNIX! +1 vida', 18, '#ff8a65');
      UI.toast('🦅 ¡El Fénix volvió a la vida!', 'good');
      updateHUD();
      return;
    }
    bird = b;
    bird.dead = true;
    bird.vy = -300;
    readyTap = false; airborne = false;
    SND.sfx.hit();
    SND.stopMusic();
    if (SAVE.get().set.shake !== false) FX.shake(18);
    FX.burst(bird.x, bird.y, '#ffd54f', 26, 320, { big: true, grav: 700 });
    FX.burst(bird.x, bird.y, '#fff', 14, 200);
    FX.puff(bird.x, bird.y, '#fff', 10);
    if (SAVE.get().set.vib && navigator.vibrate) { try { navigator.vibrate([60, 40, 80]); } catch (e) { } }
    UI.setHudVisible(false);
    endRun(); // muerte instantánea: muestra la pantalla de reintentar al momento
  }

// XP de evolución para el ave equipada (etapas 1 → 2 → 3)
  function awardSkinXp(xpGain) {
    const skid = SAVE.get().skin;
    const ups = SAVE.addSkinXp(skid, Math.max(1, Math.round(xpGain * 0.35) + 2));
    if (ups > 0) {
      const st = SAVE.skinStage(skid);
      SND.sfx.level();
      if (state === 'play') FX.text(bird.x, bird.y - bird.r - 78, '⭐ ¡Etapa ' + st + '!', 15, '#ffe066');
      UI.toast('⭐ ¡' + DAT.getSkin(skid).name + ' evolucionó a la Etapa ' + st + '!', 'good');
    }
  }

  function endRun() {
    // Replay terminado: se sale sin alterar las estadísticas reales
    if (replayMode) {
      replayMode = false;
      SAVE.markReplayWatched();
      const ach = SAVE.checkAch();
      state = 'over';
      UI.toast('🎬 Fin del Replay', 'info');
      goMenu(); // detiene y exporta el video grabado
      ach.forEach(a => UI.popAch(a));
      return;
    }
    state = 'over';
    const xp = Math.floor(score * 3 + pipesDone * 2 + coinCount * 3);
    const xpTotal = rt.amuleto ? Math.floor(xp * 1.05) : xp;
    const levelUps = SAVE.addXp(xpTotal);
    awardSkinXp(xp);
    const dist = Math.floor(totalDist / 30);
    const isRecord = SAVE.endRun(score, pipesDone, coinCount, runSeconds, dist, mode);
    const s = SAVE.get();
    if (mode === 'zen') s.stats.zenBest = Math.max(s.stats.zenBest || 0, score);
    // medallas ocultas (condiciones raras)
    if (!hitHappened && dist > 0) s.stats.maxDistNoHit = Math.max(s.stats.maxDistNoHit || 0, dist);
    if (coinCount === 0 && score > 0) s.stats.zeroCoinRuns = (s.stats.zeroCoinRuns || 0) + 1;
    // Ticket Dorado 🎫: las monedas no recogidas valen x2 al acabar
    if (rt.ticket) {
      const missed = Math.max(0, runSpawnWorth - runColWorth);
      if (missed > 0) {
        const tBonus = missed * 2;
        SAVE.addCoins(tBonus);
        UI.toast('🎫 Ticket Dorado: +' + tBonus + ' 🪙 por monedas no recogidas', 'good');
      }
    }
    if (mode === 'free') SAVE.storeReplay(score, curSeed, replayTaps, s.map);
    SAVE.save();
    const ach = SAVE.checkAch();
    const wasChallenge = mode === 'challenge';
    if (wasChallenge) {
      const cr = SAVE.recordChallenge(score);
      UI.toast('🌱 Semilla diaria: +' + cr.bonus + ' 🪙 · Mejor: ' + cr.best + ' pts', 'good');
    }
    if (mode === 'duel' && !clearedFlag) {
      const rivP = rival ? rival.prog : 0;
      clearedFlag = true;
      if (pipesDone > rivP) { duelClear(false); return; }
      UI.toast('🆚 Perdiste el duelo (IA: ' + rivP + ' · tú: ' + pipesDone + ')', '');
    }
    mode = SAVE.get().set.mode;
    challengeMap = null;
    SND.sfx.over();
    UI.showGameOver(score, s.stats.best, coinCount, pipesDone, dist, isRecord, ach, levelUps);
    if (window.ADS) ADS.onRunEnd('gameover');
  }

  // Se ganó el duelo (por llegar a la meta o por ventaja al morir): premio y pantalla
  function duelClear(finished) {
    const rivP = rival ? rival.prog : 0;
    const won = finished ? pipesDone >= rivP : pipesDone > rivP;
    const reward = won ? (60 + Math.max(0, pipesDone - rivP) * 10 + 40) : 0; // al perder no hay premio
    const xpGain = won ? 45 : 0;
    const lvUps = SAVE.addXp(xpGain);
    awardSkinXp(xpGain);
    SAVE.addCoins(reward);
    if (won) {
      SAVE.get().stats.duelWins = (SAVE.get().stats.duelWins || 0) + 1;
      SAVE.save();
    }
    const ach = SAVE.checkAch();
    SND.stopMusic();
    SND.sfx.medal();
    if (won) SND.sfx.achieve();
    FX.confetti(bird.x, bird.y - 30);
    state = 'cleared';
    UI.setHudVisible(false);
    UI.showModeClear({
      title: won ? '¡GANASTE EL DUELO!' : 'DUELO TERMINADO',
      lvLbl: 'Tus tubos', lv: '' + pipesDone,
      tgtLbl: 'Tubos de la IA', tgt: '' + rivP,
      reward: reward, xp: xpGain, lvUps: lvUps, ach: ach,
      stars: (pipesDone >= rivP ? '🆚 Victoria' : '🆚 Derrota'),
      btn: '🆚 OTRO DUELO'
    });
    if (window.ADS) ADS.onRunEnd('duel');
  }

  function startPlay(m) {
    const valid = m === undefined || m === 'free' || m === 'challenge' || m === 'duel' || m === 'replay' || m === 'zen' || m === 'boss' || m === 'wind';
    if (m !== undefined && !valid) return; // modos removidos (time/levels/pvp) no inician vuelo
    if (valid && m !== undefined) mode = m;
    SND.unlock();
    challengeMap = null;
    if (mode === 'challenge') challengeMap = dailyChallengeMap();
    newRun();
    state = 'play';
    if (mode !== 'replay') consumeTools();
    if (state !== 'play') { SND.startMusic(); return; }
    if (replayMode) startReplayExport();
    paused = false;
    autoPaused = false;
    UI.setPaused(false);
    UI.setHudVisible(true);
    UI.showStartHint(true);
    UI.hideAllScreens();
    updateHUD();
    SND.startMusic();
  }

  // Graba en video el Replay en reproducción (WebM si el navegador lo permite)
  function startReplayExport() {
    if (!replayMode) return;
    try {
      if (canvas.captureStream && typeof MediaRecorder !== 'undefined') {
        const stream = canvas.captureStream(30);
        const chunks = [];
        replayRec = new MediaRecorder(stream, { mimeType: 'video/webm' });
        replayRec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        replayRec.onstop = () => { exportReplayBlob(new Blob(chunks, { type: 'video/webm' })); };
        replayRec.start(250);
      }
    } catch (e) { }
  }
  function exportReplayBlob(blob) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'piovuelo-replay.webm';
      document.body.appendChild(a); a.click(); a.remove();
      UI.toast('🎬 Video del replay guardado (WebM)', 'good');
    } catch (e) {
      UI.toast('🎬 Replay grabado (compártelo desde Descargas)', 'info');
    }
  }

  // Escenario rotativo del desafío diario (cambia cada día)
  function dailyChallengeMap() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const day = Math.floor((now - start) / 86400000);
    return DAT.MAPS[(day * 7 + now.getMonth() + 3) % DAT.MAPS.length].id;
  }

  // Nivel de mejora de una herramienta (0..5)
  function toolLv(k) { return SAVE && SAVE.toolLevel ? SAVE.toolLevel(k) : 0; }

  // Herramientas en modo 'auto' se consumen al empezar la partida
  function consumeTools() {
    rt.slow = false; rt.magnet = false; rt.coins = false; rt.boost = false; rt.luck = false; rt.score = false; rt.sprint = false; rt.hype = false; rt.oasis = false; rt.doble = false; rt.titan = false; rt.fenix = false; rt.para = false; rt.zoom = false; rt.mirilla = false; rt.amuleto = false; rt.rescate = false; rt.ticket = false; rt.radar = false; rt.bala = false; rt.flot = false;
    oasisLast = 0;
    const s = SAVE.get();
    const used = [];
    DAT.TOOLS.forEach(tool => {
      if (SAVE.toolModeVal(tool.key) !== 'auto') return;
      if ((s.items[tool.key] || 0) <= 0) return;
      s.items[tool.key]--;
      applyToolEffect(tool.key, mode);
      SAVE.noteToolUse(tool.key);
      used.push(tool.icon);
    });
    SAVE.save();
    if (used.length) {
      UI.toast('🛠 Herramientas activas: ' + used.join(' '), 'info');
      FX.burst(bird.x, bird.y, '#cdefff', 14, 200);
    }
  }

  // La Bala de Jade 🎯: cada 10 tubos, el ave lanza un proyectil a la moneda más cercana
  function balaShot() {
    const ahead = coins.filter(c => c.x > bird.x);
    if (!ahead.length) return;
    const c = ahead.reduce((a, b) => (a.x < b.x ? a : b));
    coins.splice(coins.indexOf(c), 1);
    coinCount++;
    runColWorth += c.big ? 10 : 1;
    let val = c.big ? 10 : Math.max(1, Math.round((1 + Math.floor(lvl / 5)) * (diff && diff.coinMul ? diff.coinMul : 1))) + (rt.luck ? (1 + toolLv('luck')) : 0);
    if (!c.big && (eff.xc > t || rt.coins)) val = val * 2 + toolLv('coins');
    if (eff.ferro > t) val += 2;
    SAVE.addCoins(val);
    if (c.big) SND.sfx.power(); else SND.sfx.coin();
    if (mode === 'zen') {
      // sin monedas en modo Zen, pero la bala recompensa el reflejo
      score += 1;
    } else {
      score += c.big ? 2 : 1;
    }
    if (c.big) SAVE.get().stats.megaGot = (SAVE.get().stats.megaGot || 0) + 1;
    else SAVE.get().stats.chainGot = (SAVE.get().stats.chainGot || 0) + 1;
    FX.burst(c.x, c.y, '#ffd54f', 18, 260, { big: true, grav: 120 });
    FX.text(c.x, c.y - 26, '🎯 +' + val + ' 🪙', 15, '#ffe082');
    updateHUD();
  }

  // Dibuja la vista del Telescopio 🔭: silueta de los 2 próximos obstáculos
  function drawMirilla(ctx) {
    const next = pipes.filter(p => !p.passed && (p.x + p.w > bird.x || (bird.x - bird.r < p.x + p.w))).slice(0, 2);
    if (!next.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(80, 232, 200, 0.75)';
    ctx.fillStyle = 'rgba(80, 232, 200, 0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    for (const p of next) {
      const px = Math.min(p.x, W - 6);
      const top = Math.max(0, p.gap - p.gapHalf);
      const bot = Math.min(H - groundH, p.gap + p.gapHalf);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, top);
      ctx.moveTo(px, bot);
      ctx.lineTo(px, H - groundH);
      ctx.stroke();
      ctx.fillRect(px + 4, top - 8 > 0 ? top - 56 : top, 3, Math.min(56, Math.max(0, bot - top - 16)));
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function applyToolEffect(key, curMode) {
    const lv = toolLv(key);
    if (key === 'slow') { eff.slow = t + 5 + lv * 1.2; effDur.slow = 5 + lv * 1.2; }
    else if (key === 'magnet') { eff.magnet = t + 7 + lv * 1.5; effDur.magnet = 7 + lv * 1.5; }
    else if (key === 'coins') { eff.xc = t + 8 + lv * 1.5; effDur.xc = 8 + lv * 1.5; }
    else if (key === 'luck') rt.luck = true;
    else if (key === 'score') rt.score = true;
    else if (key === 'sprint') rt.sprint = true;
    else if (key === 'boost') { score += 3 + toolLv('boost') * 2; FX.text(bird.x, bird.y - bird.r - 60, '🚀 ¡Empuje Turbo! +' + (3 + toolLv('boost') * 2), 14, '#a5d6ff'); }
    else if (key === 'start' && curMode === 'free') { score += 5 + toolLv('start') * 3; FX.text(bird.x, bird.y - bird.r - 44, '✨ ¡Arranque Estelar! +' + (5 + toolLv('start') * 3), 14, '#ffe066'); }
    else if (key === 'treasure') {
      const mv = 6 + toolLv('treasure');
      SAVE.addCoins(mv);
      score += 1;
      FX.text(bird.x, bird.y - bird.r - 52, '💎 ¡Tesoro! +' + mv + ' 🪙', 15, '#ce93d8');
    } else if (key === 'clock') {
      eff.clock = t + 5 + toolLv('clock');
      effDur.clock = 5 + toolLv('clock');
      clockFreeze = score;
      FX.text(bird.x, bird.y - bird.r - 60, '⏱ ¡Reloj Estelar!', 14, '#4dd0e1');
    } else if (key === 'turbo') {
      eff.turbo = t + 4 + toolLv('turbo') * 0.8;
      effDur.turbo = 4 + toolLv('turbo') * 0.8;
      FX.text(bird.x, bird.y - bird.r - 60, '⚡ ¡Aliento de Cohete!', 14, '#ff5252');
    } else if (key === 'combo') {
      eff.combo = t + 10 + toolLv('combo') * 1.5;
      effDur.combo = 10 + toolLv('combo') * 1.5;
      FX.text(bird.x, bird.y - bird.r - 60, '🔥 ¡Racha Extra! +2/tubo', 14, '#ff9100');
    } else if (key === 'shield') {
      SAVE.addShield(1); // herramienta de la bolsa: suma al stock guardado
      FX.text(bird.x, bird.y - bird.r - 60, '🛡️ ¡Escudo guardado +1! (' + SAVE.shieldCount() + ')', 14, '#29b6f6');
    } else if (key === 'ghost') {
      eff.ghost = t + 4 + toolLv('ghost');
      effDur.ghost = 4 + toolLv('ghost');
      FX.text(bird.x, bird.y - bird.r - 60, '👻 ¡Pase Fantasma!', 14, '#b388ff');
    } else if (key === 'frenzy') {
      eff.frenzy = t + 12 + toolLv('frenzy') * 1.5;
      effDur.frenzy = 12 + toolLv('frenzy') * 1.5;
      FX.text(bird.x, bird.y - bird.r - 60, '🎇 ¡Frenesí! +1 por power-up', 14, '#ff8a65');
    } else if (key === 'eco') {
      const mv = 10 + toolLv('eco') * 3;
      SAVE.addCoins(mv);
      FX.text(bird.x, bird.y - bird.r - 60, '🛍️ ¡Eco Bolsa! +' + mv + ' 🪙', 14, '#aed581');
    } else if (key === 'hype') {
      rt.hype = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🔥 ¡Hype! +2 por power-up', 14, '#ff8a65');
    } else if (key === 'bomb') {
      eff.bomb = t + 10 + toolLv('bomb') * 1;
      effDur.bomb = 10 + toolLv('bomb') * 1;
      FX.text(bird.x, bird.y - bird.r - 60, '🧨 ¡Cosecha! +1 por moneda', 14, '#ffab91');
    } else if (key === 'aura') {
      eff.aura = t + 20 + toolLv('aura') * 2;
      effDur.aura = 20 + toolLv('aura') * 2;
      FX.text(bird.x, bird.y - bird.r - 60, '🕉️ ¡Aura! +1 por tubo', 14, '#b388ff');
    } else if (key === 'twin') {
      const mv = 8 + toolLv('twin') * 2;
      score += mv;
      FX.text(bird.x, bird.y - bird.r - 60, '🧿 ¡Géminis! +' + mv + ' pts', 14, '#4dd0e1');
      updateHUD();
    } else if (key === 'oasis') {
      rt.oasis = true;
      FX.text(bird.x, bird.y - bird.r - 60, '💧 ¡Oasis! +1 por 10 m', 14, '#69f0ae');
    } else if (key === 'doble') {
      rt.doble = true;
      FX.text(bird.x, bird.y - bird.r - 60, '♦️ ¡Doble Punto! +1 por tubo', 14, '#ffe066');
    } else if (key === 'runa') {
      const xp = 15 + toolLv('runa') * 5;
      SAVE.addXp(xp);
      FX.text(bird.x, bird.y - bird.r - 60, '🗿 ¡Runa Ancestral! +' + xp + ' XP', 14, '#ce93d8');
      updateHUD();
    } else if (key === 'titan') {
      rt.titan = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🥊 ¡Modo Titán! +2/tubo', 14, '#ff8a65');
    } else if (key === 'fenix') {
      rt.fenix = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🦅 ¡Fénix! Revive una vez', 14, '#ff8a65');
    } else if (key === 'bateria') {
      score += 5 + Math.floor(toolLv('bateria') / 2);
      FX.text(bird.x, bird.y - bird.r - 60, '🔋 ¡Batería! +5 pts', 14, '#7ee0ff');
      updateHUD();
    } else if (key === 'cris') {
      const mv = 20 + toolLv('cris') * 3;
      SAVE.addCoins(mv);
      FX.text(bird.x, bird.y - bird.r - 60, '🪄 ¡Cristal Mágico! +' + mv + ' 🪙', 14, '#e1bee7');
      updateHUD();
    } else if (key === 'ferro') {
      eff.ferro = t + 8 + lv * 1.5;
      effDur.ferro = 8 + lv * 1.5;
      FX.text(bird.x, bird.y - bird.r - 60, '🧲 ¡Ferromagnético! +2 por moneda', 14, '#ffb74d');
      updateHUD();
    } else if (key === 'para') {
      rt.para = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🪂 ¡Paracaídas! Caída lenta', 14, '#b2ebf2');
    } else if (key === 'zoom') {
      rt.zoom = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🎥 ¡Cámara Lenta!', 14, '#90caf9');
    } else if (key === 'mirilla') {
      rt.mirilla = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🔭 ¡Telescopio! 2 tubos en vista', 14, '#80cbc4');
    } else if (key === 'amuleto') {
      rt.amuleto = true;
      FX.text(bird.x, bird.y - bird.r - 60, '📿 ¡Amuleto! +5% XP al final', 14, '#a5d6ff');
    } else if (key === 'rescate') {
      rt.rescate = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🚨 ¡Rescate activado!', 14, '#4dd0e1');
    } else if (key === 'ticket') {
      rt.ticket = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🎫 ¡Ticket Dorado!', 14, '#ffe066');
    } else if (key === 'radar') {
      rt.radar = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🛰️ ¡Radar! +60% 💎 y 🍒', 14, '#80deea');
    } else if (key === 'bala') {
      rt.bala = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🎯 ¡Bala de Jade! Cada 10 tubos', 14, '#c5e1a5');
    } else if (key === 'flot') {
      rt.flot = true;
      FX.text(bird.x, bird.y - bird.r - 60, '🎈 ¡Flotador! +1 choque', 14, '#ffcc80');
      updateHUD();
    }
  }

  const MANUAL_ORDER = ['magnet', 'coins', 'slow', 'luck', 'boost', 'score', 'sprint', 'start', 'treasure', 'clock', 'turbo', 'combo', 'shield', 'ghost', 'frenzy', 'eco', 'hype', 'bomb', 'aura', 'twin', 'oasis', 'doble', 'runa', 'titan', 'fenix', 'bateria', 'cris', 'ferro', 'para', 'zoom', 'mirilla', 'amuleto', 'rescate', 'ticket', 'radar', 'bala', 'flot'];

  // Herramientas armadas como 'manual': disponibles en la barra de vuelo
  function manualToolList() {
    const s = SAVE.get();
    const out = [];
    DAT.TOOLS.forEach(t => {
      if (SAVE.toolModeVal(t.key) === 'manual' && (s.items[t.key] || 0) > 0) out.push(t);
    });
    return out;
  }

  // Activa la herramienta indicada a mitad de vuelo (botón de la barra HUD)
  function useBagTool(key) {
    if (state !== 'play' || paused || replayMode) return;
    const tool = DAT.TOOLS.find(t => t.key === key);
    if (!tool || !SAVE.get() || (SAVE.get().items[key] || 0) < 1) return;
    SAVE.get().items[key]--;
    applyToolEffect(key, mode);
    SAVE.noteToolUse(key);
    SAVE.get().stats.manualUses = (SAVE.get().stats.manualUses || 0) + 1;
    SAVE.save();
    SND.sfx.power();
    FX.burst(bird.x, bird.y, '#cdefff', 12, 180);
    UI.toast('👆 ' + tool.icon + ' ' + tool.name + ' activada', 'info');
    updateHUD();
  }

  // Actualiza la barra de herramientas manuales del HUD
  function updateHudTools() {
    if (typeof UI !== 'undefined' && UI.refreshHudTools) UI.refreshHudTools();
  }

  function setMode(m) {
    if (m !== 'free' && m !== 'challenge' && m !== 'duel' && m !== 'zen' && m !== 'boss' && m !== 'wind') return;
    mode = m;
    if (m !== 'challenge' && m !== 'duel') SAVE.setSetting('mode', mode);
  }

  function togglePause() {
    if (state !== 'play') return;
    paused = !paused;
    if (!paused) autoPaused = false;
    UI.setPaused(paused);
    UI.setHudVisible(!paused);
    if (paused) SND.stopMusic(); else SND.startMusic();
  }

  function setPaused(p) {
    if (state !== 'play') return;
    paused = p;
    if (!p) autoPaused = false;
    UI.setPaused(p);
    UI.setHudVisible(!p);
    if (p) SND.stopMusic(); else SND.startMusic();
  }

  function goMenu() {
    state = 'menu';
    paused = false;
    for (const k in eff) eff[k] = 0;   // ningún cronómetro queda visible en el menú
    effDur = {};
    runShields = 0;        // los escudos recogidos no pasan al menú
    usedStockShield = false;
    if (typeof UI !== 'undefined' && UI.updateEffectTimers) UI.updateEffectTimers([]);
    if (mode === 'challenge' || mode === 'duel' || mode === 'replay') mode = SAVE.get().set.mode; // salir del modo especial libera el modo
    replayMode = false;
    if (replayRec) { try { replayRec.stop(); } catch (e) { } replayRec = null; }
    challengeMap = null;
    if (!bird) bird = { x: 0, y: 0, r: 17, vy: 0, wingPhase: 0, y0: 0, rot: 0, squish: 1, dead: false };
    bird.x = W * 0.5;
    bird.y0 = H * 0.34;
    bird.y = bird.y0;
    bird.rot = 0; bird.vy = 0; bird.dead = false;
    enemies = [];
    BG.init(SAVE.get().map);
    BG.reset();
    UI.showHome();
    SND.startMusic();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    const sh = FX.getShake();
    ctx.save();
    ctx.translate(sh.x, sh.y);
    BG.draw(ctx);

    const S = SAVE.get();
    const skin = DAT.getSkin(S.skin);
    const hat = S.hat;
    const birdStage = SAVE.skinStage(S.skin);
    const birdGolden = !!skin.golden;

    pipes.forEach(p => ENTS.drawPipe(ctx, p, BG.getMap(), groundH, W, H));
    if (rt.mirilla && state === 'play') drawMirilla(ctx);
    coins.forEach(c => ENTS.drawCoin(ctx, c, t));
    enemies.forEach(e => ENTS.drawEnemy(ctx, e, t));
    powers.forEach(pw => ENTS.drawPower(ctx, pw, t));

    birds.forEach((b) => {
      if (b === bird) {
        if (eff.magnet > t || rt.magnet) drawAura(ctx, b.x, b.y, b.r, '#ff7043');
        if (eff.slow > t || rt.slow) drawAura(ctx, b.x, b.y, b.r, '#ffd54f');
        if (eff.x2 > t) drawAura(ctx, b.x, b.y, b.r, '#ffe066');
        if (eff.xc > t) drawAura(ctx, b.x, b.y, b.r, '#b2ff59');
        if (eff.turbo > t) drawAura(ctx, b.x, b.y, b.r, '#ff5252');
        if (eff.combo > t) drawAura(ctx, b.x, b.y, b.r, '#ff9100');
        if (eff.clock > t) drawAura(ctx, b.x, b.y, b.r, '#4dd0e1');
        if (runShields > 0 || (SAVE.shieldCount() > 0 && !usedStockShield)) drawAura(ctx, b.x, b.y, b.r, '#29b6f6');
        if (eff.ghost > t) drawAura(ctx, b.x, b.y, b.r, '#b388ff');
        if (eff.frenzy > t) drawAura(ctx, b.x, b.y, b.r, '#ff8a65');
        if (eff.bomb > t) drawAura(ctx, b.x, b.y, b.r, '#ffab91');
        if (eff.aura > t) drawAura(ctx, b.x, b.y, b.r, '#b388ff');
        if (rt.sprint) drawAura(ctx, b.x, b.y, b.r, '#90caf9');
        if (rt.hype) drawAura(ctx, b.x, b.y, b.r, '#ff7043');
        if (rt.oasis) drawAura(ctx, b.x, b.y, b.r, '#69f0ae');
        if (rt.titan) drawAura(ctx, b.x, b.y, b.r, '#ff8a65');
        if (rt.fenix) drawAura(ctx, b.x, b.y, b.r, '#ffb74d');
      }
      ENTS.drawBird(ctx, b.x, b.y, {
        skin, hat, t, wingPhase: b.wingPhase, squash: b.squish, rot: b.rot, r: b.r,
        ghost: eff.ghost > t,
        stage: b === bird ? birdStage : 0,
        golden: b === bird ? birdGolden : false
      });
    });
    if (mode === 'boss' && bossGroup && !bossGroup.dead) drawBossBar();

    if (wind.on && !bird.dead && state === 'play') drawWind();
    if (mode === 'duel' && rival && bird && !bird.dead) drawRival();

    if (state === 'play' && readyTap) drawReady();
    FX.draw(ctx, false);
    ctx.restore();
  }

  // Rayas y flechas de viento lateral (flechas grandes en el modo Viento)
  function drawWind() {
    ctx.save();
    ctx.globalAlpha = windArrows ? 0.5 : 0.27;
    ctx.strokeStyle = '#d8f1ff';
    ctx.lineWidth = windArrows ? 4 : 2;
    ctx.lineCap = 'round';
    const n = windArrows ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const x = ((t * 260 + i * (windArrows ? 150 : 96)) % (W + 240)) - 120;
      const y = H * 0.28 + Math.sin(t * 3 + i * 1.7) * 12 + i * (H * 0.1);
      const L = windArrows ? 46 : 34;
      const tx = x + wind.dir * L;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, y + (i % 2 ? 8 : -6));
      ctx.stroke();
      if (windArrows) {
        ctx.beginPath();
        ctx.moveTo(tx, y + (i % 2 ? 8 : -6));
        ctx.lineTo(tx - wind.dir * 10, y + (i % 2 ? 8 : -6) + (wind.dir > 0 ? -6 : 6));
        ctx.moveTo(tx, y + (i % 2 ? 8 : -6));
        ctx.lineTo(tx - wind.dir * 10, y + (i % 2 ? 8 : -6) + (wind.dir > 0 ? 6 : -6));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Barra de vida del jefe 👹 (se llena a medida que le faltan golpes)
  function drawBossBar() {
    const g = bossGroup;
    let left = 1e9;
    for (const p of pipes) if (p.boss) left = Math.min(left, p.x);
    if (left >= 1e9) left = g.left;
    const w = Math.min(W - 40, 260);
    const x = clamp(left, 10, W - w - 10);
    const y = 46;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.font = '900 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('👹 JEFE', x + w / 2, y - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x, y, w, 10);
    const frac = Math.max(0, g.hp) / 3;
    ctx.fillStyle = frac <= 1 / 3 ? '#ff5252' : frac <= 2 / 3 ? '#ffb300' : '#69f0ae';
    ctx.fillRect(x, y, w * frac, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 10);
    ctx.restore();
  }

  // Ave rival (IA) del Duelo: posición según la ventaja de progreso
  function drawRival() {
    const lead = rival.prog - pipesDone;
    const rx = clamp(bird.x + 40 + lead * 30, 34, W - 34);
    const ry = H * 0.42 + Math.sin(t * 0.9) * 46 + lead * 8;
    const skin = DAT.getSkin('koi');
    ENTS.drawBird(ctx, rx, ry, {
      skin, hat: null, t, wingPhase: Math.sin(t * 7) * 0.5 + 0.5, squash: 1, rot: 0, r: bird.r * 0.85
    });
    ctx.globalAlpha = 0.9;
    ctx.font = '700 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = lead >= 0 ? '#ff8a80' : '#80cbc4';
    ctx.fillText('IA ' + rival.prog, rx, ry - bird.r - 14);
    ctx.globalAlpha = 1;
  }

  // Herramientas que se activarán solas (auto) esta partida
  function armedLine() {
    const s = SAVE.get();
    const mine = [];
    DAT.TOOLS.forEach(t => {
      if (SAVE.toolModeVal(t.key) === 'auto' && (s.items[t.key] || 0) > 0) mine.push(t.icon);
      else if (SAVE.toolModeVal(t.key) === 'manual' && (s.items[t.key] || 0) > 0) mine.push(t.icon + '?');
    });
    return mine.join(' ');
  }

  function drawReady() {
    ctx.globalAlpha = 0.95;
    ctx.font = '900 ' + Math.max(16, Math.min(20, W * 0.045)) + 'px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 4;
    ctx.strokeText('¡TOCA PARA VOLAR!', W / 2, H * 0.74);
    ctx.fillStyle = '#fff';
    ctx.fillText('¡TOCA PARA VOLAR!', W / 2, H * 0.74);
    ctx.font = '700 12px "Segoe UI", sans-serif';
    const sub = mode === 'challenge'
      ? '🌱 Semilla del día ' + dayKey() + ' · misma partida para todos · ¡Suma puntos!'
      : mode === 'duel'
        ? '🆚 Duelo de Aves · Pasa ' + DUEL_PIPES + ' tubos antes que la IA'
        : mode === 'replay'
          ? '🎬 Replay de tu mejor vuelo (se grabará un video)'
          : mode === 'zen'
            ? '🧘 Zen · sin tubos, solo vuelo, música y paisaje'
            : mode === 'boss'
              ? '👹 Boss cada ' + bossPendAt + ' tubos · ¡cruza sus huecos!'
              : mode === 'wind'
                ? '💨 Viento · tramos con ráfagas laterales y flechas'
                : 'Esquiva tubos, monedas y enemigos';
    const tools = armedLine();
    const line = (tools ? '🛠 ' + tools.trim() + ' · ' : '') + sub;
    ctx.strokeText(line, W / 2, H * 0.74 + 20);
    ctx.fillText(line, W / 2, H * 0.74 + 20);
    ctx.globalAlpha = 1;
  }

  const EFFECT_META = [
    ['x2', '✨', 'Doble puntos', '#ffe066'],
    ['xc', '💰', 'Monedas x2', '#b2ff59'],
    ['magnet', '🧲', 'Imán', '#ff7043'],
    ['slow', '⏳', 'Cámara lenta', '#ffd54f'],
    ['ghost', '👻', 'Fantasma', '#b388ff'],
    ['turbo', '⚡', 'Turbo', '#ff5252'],
    ['combo', '🔥', 'Racha', '#ff9100'],
    ['clock', '⏱', 'Reloj', '#4dd0e1'],
    ['frenzy', '🎇', 'Frenesí', '#ff8a65'],
    ['bomb', '🧨', 'Cosecha', '#ffab91'],
    ['aura', '🕉️', 'Aura', '#b388ff'],
    ['ferro', '🧲', 'Ferro', '#ffb74d']
  ];

  // Lista única de cronómetros activos (misma fuente que dibuja el HUD).
  function effectTimers() {
    const out = [];
    for (let i = 0; i < EFFECT_META.length; i++) {
      const key = EFFECT_META[i][0];
      const until = eff[key] || 0;
      if (until <= t) continue;
      const total = Math.max(0.1, effDur[key] || 1);
      const left = Math.max(0, until - t);
      out.push({
        key: key, icon: EFFECT_META[i][1], label: EFFECT_META[i][2], color: EFFECT_META[i][3],
        left: left, total: total, pct: Math.max(0, Math.min(1, left / total)),
        state: left <= 2 ? 'expiring' : 'active'
      });
    }
    return out;
  }

  const hudCache = {};
  function setHudText(id, value) {
    const v = String(value);
    if (hudCache[id] === v) return;
    const el = document.getElementById(id);
    if (el) el.textContent = v;
    hudCache[id] = v;
  }

  // Resumen de escudos para el HUD: los de la partida se gastan primero y
  // los guardados (comprados) permiten como máximo un bloqueo por vuelo.
  function shieldHud() {
    const stock = SAVE.shieldCount();
    const stockAvail = usedStockShield ? 0 : stock;
    let text;
    if (runShields > 0 && stockAvail > 0) text = '🛡️ ' + runShields + ' +' + stockAvail;
    else if (runShields > 0 && stock > 0) text = '🛡️ ' + runShields + ' +' + stock + '🔒';
    else if (runShields > 0) text = '🛡️ ' + runShields;
    else if (stockAvail > 0) text = '🛡️ ' + stockAvail;
    else if (stock > 0) text = '🛡️ 0 +' + stock + '🔒';
    else text = '🛡️ 0';
    let title = 'Escudos de la partida: ' + runShields + ' · Guardados: ' + stock +
      ' · Máximo 1 guardado por partida';
    if (usedStockShield) title += ' (ya usaste 1 guardado en este vuelo)';
    return { text: text, title: title };
  }

  function updateHUD() {
    setHudText('hudScore', score);
    setHudText('hudCoins', SAVE.get().coins);
    setHudText('hudDist', Math.floor(totalDist / 30) + ' m');
    setHudText('hudCombo', combo >= 3 ? '🔥 x' + combo : '');
    const sh = shieldHud();
    setHudText('hudShield', sh.text);
    const shEl = document.getElementById('hudShield');
    if (shEl && shEl.title !== sh.title) shEl.title = sh.title;
    updateHudTools();
    const timers = effectTimers();
    if (typeof UI !== 'undefined' && UI.updateEffectTimers) UI.updateEffectTimers(timers);
    const pf = document.getElementById('hudProgFill');
    let prog = null, grad = '', levelText = '';
    if (mode === 'challenge') {
      levelText = '🌱 Semilla ' + dayKey();
      grad = 'linear-gradient(90deg,#b39ddb,#7c4dff)';
      prog = Math.max(0, Math.min(100, score / 60 * 100));
    } else if (mode === 'duel') {
      levelText = '🆚 ' + pipesDone + '/' + DUEL_PIPES + (rival ? ' · IA ' + rival.prog : '');
      grad = 'linear-gradient(90deg,#ff7043,#d32f2f)';
      const Dx = curD(score);
      prog = fracTo(pipesDone, DUEL_PIPES, Dx);
    } else if (mode === 'zen') {
      levelText = '🧘 Zen · ' + Math.floor(totalDist / 30) + ' m';
      grad = 'linear-gradient(90deg,#69f0ae,#00bfa5)';
      prog = (Math.floor(totalDist / 30) % 100) * 1;
    } else if (mode === 'boss') {
      levelText = '👹 Boss · ' + pipesDone + ' tubos' + (bossGroup && !bossGroup.dead ? ' · ❤️ ' + bossGroup.hp : '');
      grad = 'linear-gradient(90deg,#ff7043,#d32f2f)';
      prog = bossGroup && !bossGroup.dead ? Math.max(0, Math.min(100, bossGroup.hp / 3 * 100)) : (pipesDone % bossPendAt) / bossPendAt * 100;
    } else if (mode === 'wind') {
      levelText = '💨 Viento · ' + score;
      grad = 'linear-gradient(90deg,#81d4fa,#0277bd)';
      prog = null; // barra de nivel normal
    } else if (mode === 'replay') {
      levelText = '🎬 Replay';
      grad = 'linear-gradient(90deg,#b39ddb,#7c4dff)';
      prog = 0;
    } else {
      levelText = 'Nivel ' + lvl;
    }
    setHudText('hudLevel', levelText);
    if (pf) {
      if (hudCache.pfGrad !== grad) { pf.style.background = grad; hudCache.pfGrad = grad; }
      const cp = prog === null
        ? Math.max(0, Math.min(100, (score % LEVEL_STEP) / LEVEL_STEP * 100))
        : Math.max(0, Math.min(100, prog));
      const w = cp + '%';
      if (hudCache.pfW !== w) { pf.style.width = w; hudCache.pfW = w; }
      const full = cp >= 99.5;
      if (hudCache.pfFull !== full) { pf.classList.toggle('full', full); hudCache.pfFull = full; }
    }
  }

  // Progreso fraccionado de la barra del modo (sube sin saltos entre tubo y tubo)
  function fracTo(done, total, Dx) {
    const base = done / total * 100;
    if (bird.dead || clearedFlag || !pipes.length) return base;
    let ahead = null;
    for (let i = 0; i < pipes.length; i++) {
      if (pipes[i].x + pipes[i].w > bird.x - bird.r) { ahead = pipes[i]; break; }
    }
    if (!ahead) return base;
    const d = Math.max(0, (ahead.x - ahead.w) - (bird.x + bird.r));
    const frac = 1 - Math.min(1, d / (ahead.w + (Dx.spawnEvery || 200)));
    return (done + Math.max(0, frac)) / total * 100;
  }

  return {
    resize, loop, flap, startPlay, togglePause, setPaused, goMenu,
    setMode,
    getState: () => state,
    isPlay: () => state === 'play',
    waitingFly: () => state === 'play' && readyTap,
    isPaused: () => paused,
    getMode: () => mode,
    getBirds: () => birds,
    getPipes: () => pipes.map(p => ({ x: p.x, w: p.w, gap: p.gap, gapHalf: p.gapHalf, big: !!p.big, boss: !!p.boss, seg: p.seg || 0 })),
    getBoss: () => bossGroup ? { hp: bossGroup.hp, left: bossGroup.left, dead: !!bossGroup.dead } : null,
    getEnemies: () => enemies,
    getCoins: () => coins.map(c => ({ x: c.x, y: c.y, r: c.r, big: !!c.big })),
    getPowers: () => powers.map(pw => ({ x: pw.x, y: pw.y, r: pw.r, type: pw.type })),
    getEnv: () => ({ H, W, groundH, pipesDone, D: curD(effScore()) }),
    getEffectTimers: effectTimers,
    getShields: () => SAVE.shieldCount(), // stock guardado (compatibilidad)
    getShieldState: () => ({
      run: runShields,
      stock: SAVE.shieldCount(),
      usedStock: usedStockShield,
      stockUsable: usedStockShield ? 0 : SAVE.shieldCount()
    }),
    useBagTool, manualToolList,
    getScore: () => score,
    getDist: () => Math.floor(totalDist / 30),
    getW: () => W, getH: () => H,
    canvas, ctx,
    forceRestart: newRun,
    suspend, resumeLoop,
    updateHudTools: updateHudTools,
    // Superficie interna para pruebas automáticas (no la usa la interfaz).
    __test: {
      resize: resize,
      newRun: newRun,
      mkPipe: mkPipe,
      preSpawnPipes: preSpawnPipes,
      effectTimers: effectTimers,
      hit: hitObstacleBird,
      activate: activatePower,
      applyTool: applyToolEffect,
      coinSafe: addCoinSafe,
      spawnEnemy: spawnEnemy,
      spawnPower: spawnPower,
      spawnMega: spawnMega,
      spawnChain: spawnChain,
      spawnPipe: spawnPipe,
      getEff: () => Object.assign({}, eff),
      getEffDur: () => Object.assign({}, effDur),
      setT: v => { t = v; },
      getT: () => t,
      getRunShields: () => runShields,
      getUsedStockShield: () => usedStockShield,
      isSpotFree: isSpotFree,
      freeY: freeY,
      pipes: () => pipes,
      bird: () => bird
    }
  };
})();