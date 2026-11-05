/* Pío Vuelo 3.3 «ÉLITE»
 * Módulo puro (sin DOM al cargar): calidad adaptativa, cámara cinematográfica,
 * IA de enemigos, habilidades activas, combos perfectos, eventos dinámicos,
 * rangos, contratos, códice, cosméticos de élite y postal de vuelo.
 *
 * Todo el estado de partida vive aquí; game.js solo ejecuta los efectos.
 */
window.ELITE = (function () {
  'use strict';

  const VERSION = '3.3.0';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function num(v, def) { const n = Number(v); return isFinite(n) ? n : (def || 0); }
  function hashStr(s) {
    let h = 2166136261;
    s = String(s || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function todayKey(d) {
    const n = d || new Date();
    const p = v => (v < 10 ? '0' : '') + v;
    return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate());
  }

  /* ============================================================
   * 1. CALIDAD ADAPTATIVA
   * ============================================================ */
  const QUALITY = {
    low: {
      id: 'low', name: 'Baja', rank: 0,
      particles: 0.35, trail: 0.18, weather: 0.25, lights: false, reflections: false,
      fog: false, shadows: false, decor: 0, enemies: 3, camera: 0.45, zoom: false,
      bloom: false, scanlines: false, maxDpr: 1
    },
    medium: {
      id: 'medium', name: 'Media', rank: 1,
      particles: 0.7, trail: 0.5, weather: 0.6, lights: true, reflections: false,
      fog: true, shadows: false, decor: 1, enemies: 5, camera: 0.75, zoom: false,
      bloom: false, scanlines: false, maxDpr: 1.25
    },
    high: {
      id: 'high', name: 'Alta', rank: 2,
      particles: 1, trail: 0.9, weather: 1, lights: true, reflections: true,
      fog: true, shadows: true, decor: 2, enemies: 7, camera: 1, zoom: true,
      bloom: false, scanlines: false, maxDpr: 2
    },
    ultra: {
      id: 'ultra', name: 'Ultra', rank: 3,
      particles: 1.55, trail: 1.25, weather: 1.35, lights: true, reflections: true,
      fog: true, shadows: true, decor: 3, enemies: 9, camera: 1.18, zoom: true,
      bloom: true, scanlines: true, maxDpr: 2
    }
  };
  const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

  let qualityMode = 'high';   // ajuste elegido: low|medium|high|ultra|auto
  let qualityId = 'high';     // perfil realmente activo
  const perf = { ema: 1 / 60, samples: 0, lowFor: 0, highFor: 0, drops: 0, resolved: 'high' };

  function detectAuto() {
    let id = 'high';
    try {
      const nav = (typeof navigator !== 'undefined' && navigator) || {};
      const mem = num(nav.deviceMemory, 4);
      const cores = num(nav.hardwareConcurrency, 4);
      const touch = !!(nav.maxTouchPoints > 0);
      if (mem <= 2 || cores <= 2) id = 'low';
      else if (mem <= 3 || cores <= 4) id = touch ? 'medium' : 'high';
      else if (cores >= 8 && mem >= 8) id = 'ultra';
      else id = 'high';
    } catch (e) { id = 'medium'; }
    return id;
  }

  function setQuality(mode) {
    qualityMode = QUALITY[mode] ? mode : (mode === 'auto' ? 'auto' : 'high');
    qualityId = qualityMode === 'auto' ? detectAuto() : qualityMode;
    perf.resolved = qualityId;
    perf.ema = 1 / 60; perf.samples = 0; perf.lowFor = 0; perf.highFor = 0;
    return qualityId;
  }
  function profile() { return QUALITY[qualityId] || QUALITY.high; }
  function quality() { return qualityId; }
  function mode() { return qualityMode; }
  function qualityList() {
    return QUALITY_ORDER.map(id => ({ id: id, name: QUALITY[id].name }));
  }

  // Monitor real de rendimiento: degrada si el FPS cae de forma sostenida y
  // vuelve a subir cuando el dispositivo se recupera. Solo actúa en modo "auto".
  function updatePerf(dt) {
    if (!(dt > 0)) return null;
    const fps = 1 / dt;
    perf.ema = perf.ema * 0.92 + fps * 0.08;
    perf.samples++;
    if (perf.samples < 45) return null;
    const target = perf.ema;
    let changed = null;
    if (target < 44) {
      perf.lowFor += dt; perf.highFor = 0;
      if (perf.lowFor > 2.2) {
        const i = QUALITY_ORDER.indexOf(qualityId);
        if (i > 0 && qualityMode === 'auto') {
          qualityId = QUALITY_ORDER[i - 1];
          perf.resolved = qualityId;
          perf.drops++;
          changed = qualityId;
        }
        perf.lowFor = 0;
      }
    } else if (target > 57) {
      perf.highFor += dt; perf.lowFor = 0;
      if (perf.highFor > 9 && qualityMode === 'auto') {
        const i = QUALITY_ORDER.indexOf(qualityId);
        const cap = detectAuto();
        if (i < QUALITY_ORDER.indexOf(cap)) {
          qualityId = QUALITY_ORDER[i + 1];
          perf.resolved = qualityId;
          changed = qualityId;
        }
        perf.highFor = 0;
      }
    } else { perf.lowFor = 0; perf.highFor = 0; }
    return changed;
  }
  function perfInfo() {
    return { fps: Math.round(perf.ema), level: qualityId, mode: qualityMode, drops: perf.drops };
  }

  /* ============================================================
   * 2. CÁMARA CINEMATOGRÁFICA
   * ============================================================ */
  function newCamera() {
    return {
      enabled: true, x: 0, y: 0, rot: 0, zoom: 1,
      ix: 0, iy: 0, kick: 0, slow: 0, flash: 0
    };
  }
  function cameraKick(cam, power) {
    if (!cam) return;
    cam.kick = Math.min(22, (cam.kick || 0) + num(power, 6));
    const a = Math.random() * Math.PI * 2;
    cam.ix += Math.cos(a) * cam.kick * 0.5;
    cam.iy += Math.sin(a) * cam.kick * 0.5;
  }
  function cameraPulse(cam, amount) {
    if (!cam) return;
    cam.flash = Math.min(1, (cam.flash || 0) + num(amount, 0.25));
  }
  function updateCamera(cam, dt, info) {
    if (!cam) return cam;
    info = info || {};
    const q = clamp(num(info.quality, 1), 0.4, 1.3);
    const enabled = cam.enabled !== false && info.enabled !== false;
    const vy = clamp(num(info.vy), -950, 950);
    const spd = clamp(num(info.speed), 0, 900);
    const targetX = enabled ? clamp(spd * 0.008, 0, 8) * q : 0;
    const targetY = enabled ? clamp(vy * 0.013, -11, 13) * q : 0;
    const targetRot = enabled ? clamp(vy / 900, -1, 1) * 0.028 * q : 0;
    const targetZoom = enabled ? 1 + (info.perfect ? 0.008 : 0) + (info.dash ? 0.018 : 0) : 1;
    const k = Math.min(1, dt * (info.snap ? 14 : 5.5));
    cam.x += (targetX - cam.x) * k;
    cam.y += (targetY - cam.y) * k;
    cam.rot += (targetRot - cam.rot) * k;
    cam.zoom += (targetZoom - cam.zoom) * k;
    cam.kick = Math.max(0, cam.kick - dt * 34);
    cam.ix += (0 - cam.ix) * Math.min(1, dt * 9);
    cam.iy += (0 - cam.iy) * Math.min(1, dt * 9);
    cam.flash = Math.max(0, cam.flash - dt * 2.6);
    return cam;
  }
  function applyCamera(ctx, cam, W, H) {
    if (!ctx || !cam || cam.enabled === false) return;
    ctx.translate(W / 2 + cam.x + cam.ix, H / 2 + cam.y + cam.iy);
    if (cam.rot) ctx.rotate(cam.rot);
    if (cam.zoom && Math.abs(cam.zoom - 1) > 0.0005) ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-W / 2, -H / 2);
  }

  /* ============================================================
   * 3. IA DE ENEMIGOS (director de vuelo)
   * ============================================================ */
  const AI_STATES = ['patrol', 'telegraph', 'dive', 'charge', 'retreat'];
  function initEnemyAI(e, seed) {
    if (!e) return e;
    e.ai = {
      state: 'patrol',
      timer: 0.7 + (Math.random() * 1.1),
      homeY: e.y,
      targetY: e.y,
      phase: (seed || Math.random()) * Math.PI * 2,
      aggression: 0.35 + Math.random() * 0.45,
      telegraph: 0,
      flank: Math.random() < 0.5 ? -1 : 1
    };
    return e;
  }
  function updateEnemyAI(e, dt, info) {
    if (!e || !e.ai) return e;
    const ai = e.ai;
    info = info || {};
    const bird = info.bird;
    const H = num(info.H, 700), groundH = num(info.groundH, 80);
    const minY = 48, maxY = H - groundH - 48;
    ai.timer -= dt;
    ai.telegraph = Math.max(0, ai.telegraph - dt);
    if (e.type === 'bat' || e.type === 'ghost') {
      // Los murciélagos hacen pasadas rápidas: telegrafían y luego pican.
      if (ai.state === 'patrol' && ai.timer <= 0 && bird && !bird.dead) {
        const dx = bird.x - e.x;
        if (dx < 320 && dx > -40) {
          ai.state = 'telegraph'; ai.timer = 0.42; ai.telegraph = 0.42;
          ai.targetY = clamp(bird.y, minY, maxY);
        } else { ai.timer = 0.8; }
      } else if (ai.state === 'telegraph' && ai.timer <= 0) {
        ai.state = 'dive'; ai.timer = 0.62;
      } else if (ai.state === 'dive') {
        const seek = clamp(bird.y + Math.sin(ai.phase + info.t * 4) * 18, minY, maxY);
        ai.targetY = seek;
        ai.timer -= dt * 0.1;
        if (ai.timer <= 0) { ai.state = 'retreat'; ai.timer = 1.0; }
      } else if (ai.state === 'retreat') {
        ai.targetY = clamp(ai.homeY + Math.sin(ai.phase) * 40, minY, maxY);
        if (ai.timer <= 0) { ai.state = 'patrol'; ai.timer = 1.1 + Math.random(); }
      }
      const pull = ai.state === 'dive' ? 9 : 3.2;
      e.y += clamp(ai.targetY - e.y, -pull * 60 * dt, pull * 60 * dt);
      e.y = clamp(e.y, minY, maxY);
      e.aiState = ai.state;
    } else {
      // Enemigos flotantes: patrullan y se abren para flanquear.
      if (ai.timer <= 0) {
        ai.state = Math.random() < ai.aggression ? 'charge' : 'patrol';
        ai.timer = ai.state === 'charge' ? 1.2 : 1.8;
        ai.targetY = ai.state === 'charge'
          ? clamp(e.y + (bird ? (bird.y - e.y) * 0.5 : 0) + (Math.random() - 0.5) * 90, minY, maxY)
          : clamp(ai.homeY + (Math.random() - 0.5) * 70, minY, maxY);
      }
      e.y += clamp(ai.targetY - e.y, -130 * dt, 130 * dt);
      e.aiState = ai.state;
    }
    return e;
  }
  function aiTelegraphing(e) { return !!(e && e.ai && e.ai.state === 'telegraph'); }

  /* ============================================================
   * 4. HABILIDADES ACTIVAS
   * ============================================================ */
  const ABILITIES = [
    {
      id: 'dash', key: '1', name: 'Impulso', icon: '⚡', color: '#ffd54f',
      cd: 8.5, dur: 0.85,
      desc: 'Avanza con un impulso que rompe barreras y atraviesa peligros.'
    },
    {
      id: 'warp', key: '2', name: 'Distorsión', icon: '🌀', color: '#b388ff',
      cd: 13, dur: 2.4,
      desc: 'Curva el tiempo: el mundo va a cámara lenta durante 2,4 s.'
    },
    {
      id: 'pulse', key: '3', name: 'Pulso', icon: '💠', color: '#4dd0e1',
      cd: 10.5, dur: 4,
      desc: 'Pulso magnético que atrae monedas y revela el camino.'
    }
  ];
  const ABILITY_BY_ID = {};
  ABILITIES.forEach(a => { ABILITY_BY_ID[a.id] = a; });

  /* ============================================================
   * 5. EVENTOS DINÁMICOS
   * ============================================================ */
  const EVENTS = [
    { id: 'rush', name: 'Fiebre de monedas', icon: '🪙', dur: 10, color: '#ffd54f', desc: 'Monedas dobles y más botín.' },
    { id: 'meteor', name: 'Lluvia de meteoros', icon: '☄️', dur: 10, color: '#ff7043', desc: 'Meteoros cruzan la ruta.' },
    { id: 'solar', name: 'Viento solar', icon: '🌞', dur: 9, color: '#81d4fa', desc: 'Ráfagas que empujan el vuelo.' },
    { id: 'dark', name: 'Élite oscura', icon: '🌑', dur: 10, color: '#b388ff', desc: 'Enemigos más rápidos y agresivos.' },
    { id: 'gates', name: 'Ruptura de compuertas', icon: '🌀', dur: 10, color: '#4dd0e1', desc: 'Compuertas de energía extra.' }
  ];
  const EVENT_BY_ID = {};
  EVENTS.forEach(e => { EVENT_BY_ID[e.id] = e; });

  /* ============================================================
   * 6. RANGOS, CONTRATOS, CÓDICE Y COSMÉTICOS
   * ============================================================ */
  const RANKS = [
    { id: 'S', name: 'ÉLITE', min: 520, color: '#ffd54f', icon: '👑' },
    { id: 'A', name: 'AS DEL CIELO', min: 320, color: '#69f0ae', icon: '🏆' },
    { id: 'B', name: 'VETERANO', min: 190, color: '#4dd0e1', icon: '🥈' },
    { id: 'C', name: 'PILOTO', min: 90, color: '#b0bec5', icon: '🥉' },
    { id: 'D', name: 'NOVATO', min: 0, color: '#90a4ae', icon: '🐣' }
  ];
  const RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];
  function rankFor(points) {
    const p = Math.max(0, num(points));
    for (let i = 0; i < RANKS.length; i++) if (p >= RANKS[i].min) return RANKS[i];
    return RANKS[RANKS.length - 1];
  }
  function rankIndex(id) { return RANK_ORDER.indexOf(id); }
  function runPoints(r) {
    r = r || {};
    return Math.max(0, Math.round(
      num(r.score) * 1 +
      num(r.pipes) * 8 +
      num(r.perfects) * 14 +
      num(r.gates) * 10 +
      num(r.relics) * 25 +
      num(r.maxCombo) * 5 +
      num(r.events) * 20 +
      num(r.barriers) * 12 +
      num(r.abilities) * 6
    ));
  }

  const CONTRACT_POOL = [
    { id: 'perfect', metric: 'perfects', icon: '🎯', base: 4, inc: 2, reward: 140, xp: 45, text: n => 'Consigue ' + n + ' pasos perfectos en un vuelo.' },
    { id: 'gates', metric: 'gates', icon: '🌀', base: 3, inc: 1, reward: 120, xp: 35, text: n => 'Cruza ' + n + ' compuertas de energía.' },
    { id: 'relics', metric: 'relics', icon: '💎', base: 1, inc: 1, reward: 160, xp: 55, text: n => 'Recoge ' + n + ' reliquias de élite.' },
    { id: 'barriers', metric: 'barriers', icon: '💥', base: 2, inc: 1, reward: 130, xp: 40, text: n => 'Rompe ' + n + ' barreras cristalinas.' },
    { id: 'ability', metric: 'abilities', icon: '⚡', base: 3, inc: 2, reward: 110, xp: 30, text: n => 'Usa ' + n + ' habilidades activas.' },
    { id: 'combo', metric: 'maxCombo', icon: '🔥', base: 8, inc: 4, reward: 150, xp: 50, text: n => 'Alcanza un combo de ' + n + '.' },
    { id: 'score', metric: 'score', icon: '⭐', base: 18, inc: 6, reward: 100, xp: 25, text: n => 'Anota ' + n + ' puntos en un vuelo.' },
    { id: 'distance', metric: 'dist', icon: '📏', base: 220, inc: 80, reward: 90, xp: 20, text: n => 'Vuela ' + n + ' metros.' }
  ];
  function contractsFor(dateKey) {
    const key = typeof dateKey === 'string' && dateKey ? dateKey : todayKey();
    const seed = hashStr('elite-contracts:' + key);
    const pool = CONTRACT_POOL.slice();
    const picked = [];
    let s = seed || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    while (picked.length < 3 && pool.length) {
      const i = Math.floor(rnd() * pool.length);
      const c = pool.splice(i, 1)[0];
      const week = Math.floor(num(String(key).replace(/-/g, ''), 0) / 100) % 7;
      const target = c.base + c.inc * (week % 3);
      picked.push({
        id: c.id, metric: c.metric, icon: c.icon, target: target,
        reward: c.reward, xp: c.xp, text: c.text(target)
      });
    }
    return picked;
  }

  const CODEX = [
    { id: 'perfect', icon: '🎯', name: 'Paso perfecto', desc: 'Cruzar el centro de un hueco sin rozar los bordes.' },
    { id: 'dash', icon: '⚡', name: 'Impulso', desc: 'Romper una barrera cristalina con el impulso.' },
    { id: 'warp', icon: '🌀', name: 'Distorsión', desc: 'Activar la cámara lenta de élite.' },
    { id: 'pulse', icon: '💠', name: 'Pulso magnético', desc: 'Atraer monedas con el pulso.' },
    { id: 'gate', icon: '🔵', name: 'Compuerta de energía', desc: 'Cruzar el aro central de una compuerta.' },
    { id: 'barrier', icon: '💥', name: 'Barrera cristalina', desc: 'Romper una barrera cristalina con el impulso.' },
    { id: 'relic', icon: '💎', name: 'Reliquia de élite', desc: 'Recoger una reliquia que mejora una habilidad.' },
    { id: 'zone', icon: '🌬️', name: 'Corriente térmica', desc: 'Usar una columna de aire para remontar.' },
    { id: 'hunter', icon: '🦇', name: 'Director de IA', desc: 'Ver a un enemigo telegrafiar una picada.' },
    { id: 'event', icon: '🎉', name: 'Evento dinámico', desc: 'Sobrevivir a un evento de élite.' },
    { id: 'rank', icon: '🏅', name: 'Rango de vuelo', desc: 'Terminar un vuelo con rango B o superior.' },
    { id: 'contract', icon: '📜', name: 'Contrato de élite', desc: 'Completar un contrato diario.' },
    { id: 'postal', icon: '📮', name: 'Postal de vuelo', desc: 'Descargar la postal de un vuelo.' },
    { id: 'quality', icon: '🎚️', name: 'Calidad adaptativa', desc: 'El juego ajusta los efectos según el rendimiento.' },
    { id: 'camera', icon: '🎥', name: 'Cámara cinematográfica', desc: 'Sentir el impulso de la cámara en un paso perfecto.' }
  ];
  const CODEX_BY_ID = {};
  CODEX.forEach(c => { CODEX_BY_ID[c.id] = c; });

  const ELITE_COSMETICS = [
    { id: 'elite-trail-gold', name: 'Estela Dorada', icon: '✨', color: '#ffd54f', minRank: 'B', kind: 'trail' },
    { id: 'elite-trail-cyan', name: 'Estela de Plasma', icon: '💠', color: '#4dd0e1', minRank: 'A', kind: 'trail' },
    { id: 'elite-trail-void', name: 'Estela del Vacío', icon: '🌌', color: '#b388ff', minRank: 'S', kind: 'trail' },
    { id: 'elite-aura-crown', name: 'Aura de Corona', icon: '👑', color: '#ffe082', minRank: 'S', kind: 'aura' }
  ];

  /* 15 características sorpresa de la actualización. */
  const SURPRISES = [
    { id: 'perfect', icon: '🎯', name: 'Paso perfecto', desc: 'Cruza el centro exacto del hueco para encadenar multiplicador y cámara lenta.' },
    { id: 'dash', icon: '⚡', name: 'Impulso de élite', desc: 'Una habilidad activa que rompe barreras y da inmunidad breve.' },
    { id: 'warp', icon: '🌀', name: 'Distorsión temporal', desc: 'Cámara lenta real con el mundo ralentizado y el ave estable.' },
    { id: 'pulse', icon: '💠', name: 'Pulso magnético', desc: 'Atrae monedas a distancia y recarga el combo.' },
    { id: 'gate', icon: '🔵', name: 'Compuertas de energía', desc: 'Aros que recargan habilidades si cruzas su centro.' },
    { id: 'barrier', icon: '💥', name: 'Barreras cristalinas', desc: 'Obstáculos destructibles que premian el impulso.' },
    { id: 'relic', icon: '💎', name: 'Reliquias de élite', desc: 'Mejoran una habilidad aleatoria durante el vuelo.' },
    { id: 'zone', icon: '🌬️', name: 'Corrientes térmicas', desc: 'Columnas de aire que empujan el ave hacia arriba o abajo.' },
    { id: 'hunter', icon: '🦇', name: 'Director de IA', desc: 'Los enemigos telegrafían, pican y flanquean con estados reales.' },
    { id: 'event', icon: '🎉', name: 'Eventos dinámicos', desc: 'Fiebre de monedas, meteoros, viento solar, élite oscura y compuertas.' },
    { id: 'rank', icon: '🏅', name: 'Rango de vuelo', desc: 'Nota S/A/B/C/D con desglose de perfectos, compuertas y reliquias.' },
    { id: 'contract', icon: '📜', name: 'Contratos de élite', desc: 'Tres encargos diarios con recompensas reales en monedas y XP.' },
    { id: 'codex', icon: '📖', name: 'Códice de élite', desc: 'Registro permanente de cada mecánica descubierta.' },
    { id: 'postal', icon: '📮', name: 'Postal de vuelo', desc: 'Genera y descarga una postal PNG con tu rango y estadísticas.' },
    { id: 'camera', icon: '🎥', name: 'Calidad y cámara adaptativas', desc: 'Perfiles bajo/medio/alto/ultra + auto, con cámara cinematográfica y degradación automática.' }
  ];

  /* ============================================================
   * 7. ESTADO DE PARTIDA DE ÉLITE
   * ============================================================ */
  let run = null;
  let lastResult = null;

  function startRun(cfg) {
    cfg = cfg || {};
    const abilities = {};
    const cd = {};
    ABILITIES.forEach(a => { abilities[a.id] = 0; cd[a.id] = 0; });
    run = {
      started: true,
      seed: num(cfg.seed, Date.now()),
      mapId: cfg.mapId || 'day',
      mode: cfg.mode || 'free',
      score: 0,
      distance: 0,
      pipes: 0,
      perfects: 0,
      gates: 0,
      relics: 0,
      barriers: 0,
      eventsSeen: 0,
      events: [],
      abilitiesUsed: 0,
      abilityUses: abilities,
      cooldowns: cd,
      combo: 0,
      maxCombo: 0,
      comboTimer: 0,
      lastPerfectAt: -99,
      event: null,
      nextEventAt: 190 + Math.random() * 90,
      eventCool: 0,
      startedAt: 0,
      scoreBonus: 0,
      rank: null,
      discovered: [],
      camera: newCamera(),
      quality: qualityId
    };
    run.camera.enabled = cfg.camera !== false;
    lastResult = null;
    return run;
  }
  function activeRun() { return run; }
  function finishRun() {
    if (!run) return null;
    const points = runPoints({
      score: run.score, pipes: run.pipes || 0, perfects: run.perfects,
      gates: run.gates, relics: run.relics, maxCombo: run.maxCombo,
      events: run.eventsSeen, barriers: run.barriers,
      abilities: run.abilitiesUsed, distance: run.distance
    });
    const rank = rankFor(points);
    const out = {
      score: run.score,
      distance: Math.round(run.distance),
      perfects: run.perfects,
      gates: run.gates,
      relics: run.relics,
      barriers: run.barriers,
      events: run.eventsSeen,
      abilities: run.abilitiesUsed,
      maxCombo: run.maxCombo,
      points: points,
      rank: rank,
      discovered: run.discovered.slice()
    };
    lastResult = out;
    run = null;
    return out;
  }
  function getLastResult() { return lastResult; }

  function abilityInfo() {
    return ABILITIES.map(a => {
      const cd = run ? num(run.cooldowns[a.id]) : 0;
      return {
        id: a.id, key: a.key, name: a.name, icon: a.icon, color: a.color,
        cd: Math.max(0, cd), total: a.cd, ready: cd <= 0.001,
        pct: clamp(1 - cd / a.cd, 0, 1), desc: a.desc
      };
    });
  }
  function useAbility(id) {
    if (!run) return { ok: false, reason: 'idle' };
    const a = ABILITY_BY_ID[id];
    if (!a) return { ok: false, reason: 'unknown' };
    if (num(run.cooldowns[id]) > 0.001) return { ok: false, reason: 'cooldown', left: run.cooldowns[id] };
    run.cooldowns[id] = a.cd;
    run.abilitiesUsed++;
    run.abilityUses[id] = num(run.abilityUses[id]) + 1;
    discover(id);
    return { ok: true, ability: a, dur: a.dur };
  }
  function chargeAbility(amount, id) {
    if (!run) return;
    const n = Math.max(0, num(amount, 1));
    if (id && run.cooldowns[id] !== undefined) {
      run.cooldowns[id] = Math.max(0, run.cooldowns[id] - n);
      return;
    }
    ABILITIES.forEach(a => { run.cooldowns[a.id] = Math.max(0, run.cooldowns[a.id] - n); });
  }
  function discover(id) {
    if (!run || !CODEX_BY_ID[id]) return false;
    if (run.discovered.indexOf(id) !== -1) return false;
    run.discovered.push(id);
    return true;
  }

  // Paso de tubo/compuerta: devuelve si fue perfecto y el bonus real de puntos.
  function onPipe(info) {
    if (!run) return { perfect: false, bonus: 0, combo: 0, mult: 1, label: '' };
    info = info || {};
    run.score += Math.max(0, num(info.scoreAdded, 0));
    run.pipes++;
    const gapHalf = num(info.gapHalf, 0);
    const off = Math.abs(num(info.distToCenter, 9999));
    const perfect = gapHalf > 0 && off <= gapHalf * 0.34;
    if (perfect) {
      run.perfects++;
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.comboTimer = 3.4;
      run.scoreBonus += 2 + Math.min(8, Math.floor(run.combo / 3));
      discover('perfect');
      discover('camera');
      const mult = 1 + Math.min(4, Math.floor(run.combo / 4) * 0.5);
      return {
        perfect: true, bonus: 2 + Math.min(8, Math.floor(run.combo / 3)),
        combo: run.combo, mult: mult, label: 'PERFECTO x' + run.combo
      };
    }
    // Un paso normal mantiene el combo si no se tarda demasiado.
    if (run.comboTimer > 0) {
      run.scoreBonus += 1;
      return { perfect: false, bonus: 1, combo: run.combo, mult: 1, label: '' };
    }
    return { perfect: false, bonus: 0, combo: run.combo, mult: 1, label: '' };
  }
  function onGate(centerError, radius) {
    if (!run) return { ok: false };
    run.gates++;
    run.scoreBonus += 4;
    discover('gate');
    const perfect = radius > 0 && Math.abs(num(centerError)) <= radius * 0.35;
    if (perfect) {
      chargeAbility(2.2);
      run.perfects++;
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.comboTimer = 3.4;
      discover('perfect');
      return { ok: true, perfect: true, bonus: 4, charge: 2.2 };
    }
    chargeAbility(1);
    return { ok: true, perfect: false, bonus: 2, charge: 1 };
  }
  function onRelic() {
    if (!run) return { ok: false };
    run.relics++;
    run.scoreBonus += 8;
    discover('relic');
    const id = ABILITIES[Math.floor(Math.random() * ABILITIES.length)].id;
    chargeAbility(4, id);
    return { ok: true, ability: id, bonus: 8 };
  }
  function onBarrierBroken() {
    if (!run) return 0;
    run.barriers++;
    run.scoreBonus += 6;
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.comboTimer = 3.2;
    discover('barrier');
    return 6 + Math.min(6, run.combo);
  }
  function onEnemyTelegraph() {
    if (!run) return;
    discover('hunter');
  }

  // Evento activo: empieza y termina de forma determinista por distancia.
  function tick(dt, info) {
    if (!run) return { started: null, ended: null };
    info = info || {};
    const d = Math.max(0, num(info.distance));
    run.distance = d;
    run.score = Math.max(run.score, num(info.score, run.score));
    run.scoreBonus = Math.max(0, num(info.scoreBonus, run.scoreBonus));
    ABILITIES.forEach(a => {
      if (run.cooldowns[a.id] > 0) run.cooldowns[a.id] = Math.max(0, run.cooldowns[a.id] - dt);
    });
    if (run.comboTimer > 0) {
      run.comboTimer = Math.max(0, run.comboTimer - dt);
      if (run.comboTimer === 0) run.combo = 0;
    }
    const out = { started: null, ended: null };
    if (run.event) {
      run.event.left = Math.max(0, run.event.left - dt);
      if (run.event.left <= 0) {
        out.ended = run.event;
        run.events.push({ id: run.event.id, survived: true });
        run.event = null;
        run.eventCool = 7;
      }
    } else if (run.eventCool > 0) {
      run.eventCool = Math.max(0, run.eventCool - dt);
    } else if (d >= run.nextEventAt && !info.dead) {
      // El modo libre no tiene meteoros: se excluye ese evento de su sorteo.
      const pool = run.mode === 'free' ? EVENTS.filter(e => e.id !== 'meteor') : EVENTS;
      const ev = pool[Math.floor(Math.random() * pool.length)];
      run.event = { id: ev.id, name: ev.name, icon: ev.icon, color: ev.color, left: ev.dur, total: ev.dur };
      run.nextEventAt = d + 210 + Math.random() * 140;
      run.eventsSeen++;
      discover('event');
      out.started = run.event;
    }
    return out;
  }
  function event() { return run ? run.event : null; }
  function eventActive(id) { return !!(run && run.event && run.event.id === id); }
  function combo() { return run ? run.combo : 0; }
  function stats() {
    if (!run) return { combo: 0, maxCombo: 0, perfects: 0, gates: 0, relics: 0, barriers: 0, events: 0, abilities: 0, event: null };
    return {
      combo: run.combo, maxCombo: run.maxCombo, perfects: run.perfects, gates: run.gates,
      relics: run.relics, barriers: run.barriers, events: run.eventsSeen,
      abilities: run.abilitiesUsed, event: run.event
    };
  }
  function noteScore(v) { if (run) run.score = Math.max(run.score, num(v)); }

  /* ============================================================
   * 8. PERSISTENCIA
   * ============================================================ */
  function blankElite() {
    return {
      bestRank: '',
      bestPoints: 0,
      runs: 0,
      totals: { perfects: 0, gates: 0, relics: 0, barriers: 0, events: 0, abilities: 0 },
      contracts: { date: '', progress: {}, claimed: [] },
      codex: [],
      cosmetics: [],
      camera: 'auto',
      lastRun: null
    };
  }
  function ensureSave(saveData) {
    if (!saveData || typeof saveData !== 'object') return blankElite();
    let e = saveData.elite;
    if (!e || typeof e !== 'object' || Array.isArray(e)) e = saveData.elite = blankElite();
    const def = blankElite();
    if (RANK_ORDER.indexOf(e.bestRank) === -1) e.bestRank = '';
    e.bestPoints = Math.max(0, Math.floor(num(e.bestPoints)));
    e.runs = Math.max(0, Math.floor(num(e.runs)));
    if (!e.totals || typeof e.totals !== 'object') e.totals = {};
    Object.keys(def.totals).forEach(k => { e.totals[k] = Math.max(0, Math.floor(num(e.totals[k]))); });
    if (!e.contracts || typeof e.contracts !== 'object') e.contracts = { date: '', progress: {}, claimed: [] };
    if (typeof e.contracts.date !== 'string') e.contracts.date = '';
    if (!e.contracts.progress || typeof e.contracts.progress !== 'object') e.contracts.progress = {};
    if (!Array.isArray(e.contracts.claimed)) e.contracts.claimed = [];
    if (!Array.isArray(e.codex)) e.codex = [];
    e.codex = e.codex.filter(id => !!CODEX_BY_ID[id]).filter((id, i, a) => a.indexOf(id) === i);
    if (!Array.isArray(e.cosmetics)) e.cosmetics = [];
    e.cosmetics = e.cosmetics.filter(id => ELITE_COSMETICS.some(c => c.id === id)).filter((id, i, a) => a.indexOf(id) === i);
    if (['auto', 'cine', 'off'].indexOf(e.camera) === -1) e.camera = 'auto';
    if (e.lastRun && typeof e.lastRun !== 'object') e.lastRun = null;
    return e;
  }

  // Firma de los contratos de hoy + progreso acumulado real.
  function contracts(saveData, dateKey) {
    const e = ensureSave(saveData);
    const key = typeof dateKey === 'string' && dateKey ? dateKey : todayKey();
    if (e.contracts.date !== key) {
      e.contracts.date = key;
      e.contracts.progress = {};
      e.contracts.claimed = [];
    }
    const list = contractsFor(key);
    return list.map(c => {
      const prog = Math.min(c.target, Math.max(0, Math.floor(num(e.contracts.progress[c.id]))));
      return Object.assign({}, c, {
        progress: prog,
        done: prog >= c.target,
        claimed: e.contracts.claimed.indexOf(c.id) !== -1
      });
    });
  }
  function claimContract(saveData, id, grant) {
    const e = ensureSave(saveData);
    const list = contracts(saveData);
    const c = list.find(x => x.id === id);
    if (!c || !c.done || c.claimed) return null;
    e.contracts.claimed.push(id);
    if (typeof grant === 'function') grant(c.reward, c.xp);
    discoverPersistent(saveData, 'contract');
    return c;
  }

  function discoverPersistent(saveData, id) {
    if (!CODEX_BY_ID[id]) return false;
    const e = ensureSave(saveData);
    if (e.codex.indexOf(id) !== -1) return false;
    e.codex.push(id);
    return true;
  }

  // Registra el vuelo: rangos, totales, códice, cosméticos y contratos.
  function recordRun(saveData, result) {
    const e = ensureSave(saveData);
    const r = result || {};
    const points = Math.max(0, Math.round(num(r.points, runPoints(r))));
    const rank = r.rank && r.rank.id ? r.rank : rankFor(points);
    const prevBest = e.bestRank || '';
    const isNewBest = !prevBest || rankIndex(rank.id) > rankIndex(prevBest);
    if (isNewBest) e.bestRank = rank.id;
    e.bestPoints = Math.max(e.bestPoints, points);
    e.runs++;
    e.totals.perfects += Math.max(0, Math.floor(num(r.perfects)));
    e.totals.gates += Math.max(0, Math.floor(num(r.gates)));
    e.totals.relics += Math.max(0, Math.floor(num(r.relics)));
    e.totals.barriers += Math.max(0, Math.floor(num(r.barriers)));
    e.totals.events += Math.max(0, Math.floor(num(r.events)));
    e.totals.abilities += Math.max(0, Math.floor(num(r.abilities)));

    // Códice por hitos reales del vuelo.
    const found = [];
    if (num(r.perfects) > 0) found.push('perfect');
    if (num(r.gates) > 0) found.push('gate');
    if (num(r.relics) > 0) found.push('relic');
    if (num(r.barriers) > 0) found.push('barrier');
    if (num(r.events) > 0) found.push('event');
    if (rankIndex(rank.id) >= rankIndex('B')) found.push('rank');
    if (num(r.distance) > 0) found.push('camera');
    (r.discovered || []).forEach(id => found.push(id));
    found.forEach(id => {
      if (e.codex.indexOf(id) === -1 && CODEX_BY_ID[id]) { e.codex.push(id); }
    });

    // Contratos: progreso acumulado por métrica.
    const list = contracts(saveData);
    list.forEach(c => {
      const metricValue = num(r[c.metric], c.metric === 'dist' ? num(r.distance) : 0);
      if (metricValue <= 0) return;
      const cur = Math.max(0, num(e.contracts.progress[c.id]));
      if (cur < c.target) e.contracts.progress[c.id] = Math.min(c.target, cur + Math.floor(metricValue));
    });
    const doneContracts = list.filter(c => num(e.contracts.progress[c.id]) >= c.target);

    // Cosméticos de élite desbloqueados por rango y hazañas.
    const unlocked = [];
    ELITE_COSMETICS.forEach(c => {
      if (e.cosmetics.indexOf(c.id) !== -1) return;
      const byRank = rankIndex(rank.id) >= rankIndex(c.minRank);
      if (byRank) { e.cosmetics.push(c.id); unlocked.push(c); }
    });
    if (num(r.perfects) >= 5) discoverPersistent(saveData, 'perfect');
    if (num(r.relics) > 0) discoverPersistent(saveData, 'relic');
    if (num(r.events) > 0) discoverPersistent(saveData, 'event');
    if (e.runs >= 3) discoverPersistent(saveData, 'quality');
    if (num(r.gates) > 0) discoverPersistent(saveData, 'gate');
    if (num(r.barriers) > 0) discoverPersistent(saveData, 'barrier');
    if (num(r.abilities) > 0) discoverPersistent(saveData, 'dash');
    if (num(r.abilities) > 0) discoverPersistent(saveData, 'camera');

    e.lastRun = {
      date: Date.now(),
      score: Math.max(0, Math.floor(num(r.score))),
      distance: Math.max(0, Math.floor(num(r.distance))),
      perfects: Math.max(0, Math.floor(num(r.perfects))),
      gates: Math.max(0, Math.floor(num(r.gates))),
      relics: Math.max(0, Math.floor(num(r.relics))),
      barriers: Math.max(0, Math.floor(num(r.barriers))),
      events: Math.max(0, Math.floor(num(r.events))),
      points: points,
      rank: rank.id
    };
    return {
      points: points, rank: rank, isNewBest: isNewBest, bestRank: e.bestRank,
      unlocked: unlocked, contracts: doneContracts, codex: e.codex.slice()
    };
  }

  /* ============================================================
   * 9. POSTAL DE VUELO (canvas real, sin librerías)
   * ============================================================ */
  function drawPostal(ctx, W, H, payload) {
    if (!ctx) return;
    const p = payload || {};
    const e = p.elite || {};
    const rank = e.rank || rankFor(num(e.points));
    W = num(W, 720); H = num(H, 960);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b1b3a');
    g.addColorStop(0.5, '#16305e');
    g.addColorStop(1, '#3a1f63');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Estrellas / motas
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 12543.123) % 1;
      const r = 1 + (i % 3);
      ctx.globalAlpha = 0.18 + (i % 5) * 0.08;
      ctx.fillStyle = i % 4 === 0 ? '#ffd54f' : '#d9ecff';
      ctx.beginPath(); ctx.arc(Math.abs(x) * W, Math.abs(y) * H, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Marco
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 ' + Math.round(W * 0.09) + 'px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PÍO VUELO', W / 2, H * 0.14);
    ctx.fillStyle = '#9fd7ff';
    ctx.font = '900 ' + Math.round(W * 0.035) + 'px "Segoe UI", Arial, sans-serif';
    ctx.fillText('POSTAL DE VUELO · v' + VERSION, W / 2, H * 0.19);

    // Rango
    ctx.fillStyle = rank.color || '#ffd54f';
    ctx.font = '900 ' + Math.round(W * 0.30) + 'px "Segoe UI", Arial, sans-serif';
    ctx.fillText(rank.id || 'D', W / 2, H * 0.44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 ' + Math.round(W * 0.048) + 'px "Segoe UI", Arial, sans-serif';
    ctx.fillText((rank.icon ? rank.icon + ' ' : '') + (rank.name || ''), W / 2, H * 0.50);

    // Datos
    const rows = [
      ['PUNTOS', String(Math.floor(num(p.score)))],
      ['DISTANCIA', Math.floor(num(p.dist)) + ' m'],
      ['PERFECTOS', String(Math.floor(num(e.perfects)))],
      ['COMPUERTAS', String(Math.floor(num(e.gates)))],
      ['RELIQUIAS', String(Math.floor(num(e.relics)))],
      ['COMBO MÁX.', String(Math.floor(num(p.maxCombo)))]
    ];
    const colW = (W - 180) / 2;
    const startX = 90 + colW / 2;
    const startY = H * 0.60;
    rows.forEach((row, i) => {
      const col = i % 2;
      const line = Math.floor(i / 2);
      const x = startX + col * colW;
      const y = startY + line * H * 0.095;
      ctx.fillStyle = '#9fd7ff';
      ctx.font = '700 ' + Math.round(W * 0.027) + 'px "Segoe UI", Arial, sans-serif';
      ctx.fillText(row[0], x, y);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 ' + Math.round(W * 0.046) + 'px "Segoe UI", Arial, sans-serif';
      ctx.fillText(row[1], x, y + H * 0.038);
    });

    ctx.fillStyle = '#ffd54f';
    ctx.font = '900 ' + Math.round(W * 0.032) + 'px "Segoe UI", Arial, sans-serif';
    ctx.fillText('PUNTOS ÉLITE ' + Math.floor(num(e.points)), W / 2, H * 0.905);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 ' + Math.round(W * 0.024) + 'px "Segoe UI", Arial, sans-serif';
    const d = p.date ? new Date(p.date) : new Date();
    ctx.fillText(todayKey(d) + ' · Pío Vuelo ÉLITE', W / 2, H * 0.945);
  }

  /* ============================================================
   * 10. DIBUJO DE ELEMENTOS DE ÉLITE
   * ============================================================ */
  function drawGate(ctx, g, t) {
    if (!ctx || !g) return;
    const col = g.color || '#4dd0e1';
    const pul = 1 + Math.sin(t * 5 + (g.ph || 0)) * 0.06;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, g.r * 1.5 * pul, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, g.r * 0.09);
    ctx.beginPath(); ctx.arc(0, 0, g.r * pul, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, g.r * 0.045);
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, g.r * 0.68, t * 2.2, t * 2.2 + Math.PI * 1.35); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, g.r * 0.42, -t * 2.6, -t * 2.6 + Math.PI * 1.1); ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-g.r * 0.24, 0); ctx.lineTo(g.r * 0.24, 0);
    ctx.moveTo(0, -g.r * 0.24); ctx.lineTo(0, g.r * 0.24);
    ctx.stroke();
    ctx.restore();
  }

  function drawBarrier(ctx, b, t) {
    if (!ctx || !b) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    const wob = Math.sin(t * 3 + (b.ph || 0)) * 3;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = b.color || '#80deea';
    ctx.fillRect(-b.w / 2 - 8 + wob, -b.h / 2, b.w + 16, b.h);
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(-b.w / 2, 0, b.w / 2, 0);
    g.addColorStop(0, 'rgba(180,240,255,0.55)');
    g.addColorStop(0.5, b.color || '#80deea');
    g.addColorStop(1, 'rgba(120,200,255,0.35)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-b.w / 2, -b.h / 2);
    ctx.lineTo(b.w / 2 - 4, -b.h / 2 + 10);
    ctx.lineTo(b.w / 2, b.h / 2 - 8);
    ctx.lineTo(-b.w / 2 + 5, b.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-b.w * 0.16, -b.h / 2 + 8);
    ctx.lineTo(b.w * 0.08, b.h / 2 - 10);
    ctx.stroke();
    ctx.restore();
  }

  function drawRelic(ctx, r, t) {
    if (!ctx || !r) return;
    ctx.save();
    ctx.translate(r.x, r.y);
    const pul = 1 + Math.sin(t * 4.4 + (r.ph || 0)) * 0.1;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = r.color || '#ffd54f';
    ctx.beginPath(); ctx.arc(0, 0, r.r * 1.8 * pul, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.rotate(t * 1.6 + (r.ph || 0));
    ctx.fillStyle = r.color || '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(0, -r.r);
    ctx.lineTo(r.r * 0.72, 0);
    ctx.lineTo(0, r.r);
    ctx.lineTo(-r.r * 0.72, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -r.r * 0.55);
    ctx.lineTo(r.r * 0.28, 0);
    ctx.lineTo(0, r.r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawZone(ctx, z, t) {
    if (!ctx || !z) return;
    const up = z.dir >= 0;
    const col = up ? '#69f0ae' : '#ff8a65';
    ctx.save();
    ctx.globalAlpha = 0.12;
    const g = ctx.createLinearGradient(z.x, z.yTop, z.x, z.yBot);
    g.addColorStop(0, up ? 'rgba(105,240,174,0)' : 'rgba(255,138,101,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, up ? 'rgba(105,240,174,0.55)' : 'rgba(255,138,101,0)');
    ctx.fillStyle = g;
    ctx.fillRect(z.x - z.w / 2, z.yTop, z.w, z.yBot - z.yTop);
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const yy = z.yTop + ((t * (up ? -70 : 70) + i * (z.yBot - z.yTop) / n) % (z.yBot - z.yTop) + (z.yBot - z.yTop)) % (z.yBot - z.yTop);
      ctx.beginPath();
      ctx.moveTo(z.x - z.w * 0.28, yy);
      ctx.lineTo(z.x, yy + (up ? 10 : -10));
      ctx.lineTo(z.x + z.w * 0.28, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAbilityFx(ctx, bird, t, state) {
    if (!ctx || !bird || !state) return;
    if (state.dashUntil > t) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(bird.x - i * 18, bird.y, bird.r * (1 + i * 0.08), -0.6, 0.6);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (state.warpUntil > t) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#b388ff';
      ctx.lineWidth = 2;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(bird.x, bird.y, bird.r + i * 22 + Math.sin(t * 4 + i) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (state.pulseUntil > t) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#4dd0e1';
      const rr = ((t * 260) % 160);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bird.x, bird.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /* ============================================================
   * 11. API PÚBLICA
   * ============================================================ */
  return {
    VERSION: VERSION,
    QUALITY: QUALITY, QUALITY_ORDER: QUALITY_ORDER,
    profile: profile, quality: quality, qualityMode: mode, qualityList: qualityList,
    setQuality: setQuality, updatePerf: updatePerf, perfInfo: perfInfo, detectAuto: detectAuto,

    newCamera: newCamera, updateCamera: updateCamera, applyCamera: applyCamera,
    cameraKick: cameraKick, cameraPulse: cameraPulse,

    AI_STATES: AI_STATES, initEnemyAI: initEnemyAI, updateEnemyAI: updateEnemyAI, aiTelegraphing: aiTelegraphing,

    ABILITIES: ABILITIES, EVENTS: EVENTS, RANKS: RANKS, CODEX: CODEX,
    ELITE_COSMETICS: ELITE_COSMETICS, SURPRISES: SURPRISES,
    CONTRACT_POOL: CONTRACT_POOL,

    startRun: startRun, activeRun: activeRun, finishRun: finishRun, getLastResult: getLastResult,
    abilityInfo: abilityInfo, useAbility: useAbility, chargeAbility: chargeAbility,
    onPipe: onPipe, onGate: onGate, onRelic: onRelic, onBarrierBroken: onBarrierBroken,
    onEnemyTelegraph: onEnemyTelegraph,
    tick: tick, event: event, eventActive: eventActive, combo: combo, stats: stats, noteScore: noteScore,
    discover: discover,

    rankFor: rankFor, runPoints: runPoints, rankIndex: rankIndex,
    contractsFor: contractsFor, contracts: contracts, claimContract: claimContract,
    ensureSave: ensureSave, blankElite: blankElite, recordRun: recordRun,
    discoverPersistent: discoverPersistent,
    drawPostal: drawPostal,
    drawGate: drawGate, drawBarrier: drawBarrier, drawRelic: drawRelic, drawZone: drawZone,
    drawAbilityFx: drawAbilityFx,
    todayKey: todayKey, hashStr: hashStr
  };
})();
