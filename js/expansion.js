/* PÍO VUELO · EXPANSIÓN v3.2
 * Catálogos y lógica pura de los sistemas nuevos:
 * personajes, accesorios, mascotas, habilidades, modos, jefes, mapas
 * dinámicos, eventos reales, insignias, títulos, colecciones, maestría,
 * herramientas legendarias, temas, presets y liga local.
 *
 * Este archivo no toca el DOM ni el guardado: solo datos y funciones
 * deterministas que consumen SAVE, G y la interfaz. Se carga después de
 * data.js y antes de save.js.
 */
window.EXP = (function () {
  'use strict';

  /* ==================================================================
   * RAREZAS
   * ================================================================== */
  const RARITY = {
    common:    { id: 'common',    name: 'Común',       color: '#9fb2d8', weight: 55 },
    uncommon:  { id: 'uncommon',  name: 'Poco común',  color: '#69f0ae', weight: 25 },
    rare:      { id: 'rare',      name: 'Raro',        color: '#4fc3f7', weight: 13 },
    epic:      { id: 'epic',      name: 'Épico',       color: '#b388ff', weight: 6 },
    legendary: { id: 'legendary', name: 'Legendario',  color: '#ffca28', weight: 1 }
  };
  function rarityOf(id) { return RARITY[id] || RARITY.common; }

  /* ==================================================================
   * PERSONAJES
   * Cada personaje cambia la paleta del ave y aporta una ventaja pequeña
   * y acotada. Los desbloqueos se comprueban contra datos reales del save.
   * ================================================================== */
  const CHARACTERS = [
    {
      id: 'pio', name: 'Pío', icon: '🐤', rarity: 'common', free: true,
      colors: { body: '#ffd54f', belly: '#fff3c4', wing: '#ffb300', beak: '#ff8f00' },
      desc: 'El ave de siempre. Sin ventajas, sin sorpresas.',
      perk: {}
    },
    {
      id: 'chispa', name: 'Chispa', icon: '⚡', rarity: 'uncommon', price: 1800,
      colors: { body: '#ffe082', belly: '#fffde7', wing: '#ffb300', beak: '#ff6f00' },
      desc: 'Vuela cerca de los rayos: +5 % de monedas en cada vuelo.',
      perk: { coins: 0.05 }
    },
    {
      id: 'brisa', name: 'Brisa', icon: '🍃', rarity: 'uncommon',
      req: { level: 3 },
      colors: { body: '#b2dfdb', belly: '#e0f2f1', wing: '#80cbc4', beak: '#ffb74d' },
      desc: 'Alcanza el nivel 3. El viento la empuja: empieza con 2 s de vuelo lento.',
      perk: { slowStart: 2 }
    },
    {
      id: 'trueno', name: 'Trueno', icon: '🌩️', rarity: 'rare',
      req: { stat: 'bossDefeated', value: 3 },
      colors: { body: '#90a4ae', belly: '#eceff1', wing: '#546e7a', beak: '#ffca28' },
      desc: 'Derrota 3 jefes. +8 % de puntos al cruzar tubos.',
      perk: { score: 0.08 }
    },
    {
      id: 'nebula', name: 'Nébula', icon: '🌌', rarity: 'rare', price: 5200,
      colors: { body: '#7e57c2', belly: '#d1c4e9', wing: '#4527a0', beak: '#ffd54f' },
      desc: 'Nacida en el espacio: el imán atrae monedas un 25 % más lejos.',
      perk: { magnet: 0.25 }
    },
    {
      id: 'titan', name: 'Titán', icon: '🛡️', rarity: 'epic',
      req: { level: 12 },
      colors: { body: '#8d6e63', belly: '#d7ccc8', wing: '#5d4037', beak: '#ffb300' },
      desc: 'Alcanza el nivel 12. Empieza cada vuelo con 1 escudo de partida.',
      perk: { startShield: 1 }
    },
    {
      id: 'fenix', name: 'Fénix', icon: '🔥', rarity: 'epic',
      req: { best: 40 },
      colors: { body: '#ff7043', belly: '#ffe0b2', wing: '#d84315', beak: '#ffca28' },
      desc: 'Consigue 40 puntos en un vuelo. Renace una vez por partida.',
      perk: { revive: 1 }
    },
    {
      id: 'guardian', name: 'Guardián', icon: '🦅', rarity: 'epic', price: 9800,
      colors: { body: '#4e6e81', belly: '#cfd8dc', wing: '#263238', beak: '#ffb300' },
      desc: 'Vigila el cielo: +10 % de XP al terminar cada vuelo.',
      perk: { xp: 0.10 }
    },
    {
      id: 'cronos', name: 'Cronos', icon: '⏳', rarity: 'legendary',
      req: { event: 'halloween' },
      colors: { body: '#6a1b9a', belly: '#e1bee7', wing: '#311b92', beak: '#ff8f00' },
      desc: 'Se desbloquea durante Halloween. Los 4 primeros segundos van al 80 % de velocidad.',
      perk: { slowStart: 4 }
    },
    {
      id: 'aurora', name: 'Aurora', icon: '🌠', rarity: 'legendary',
      req: { level: 25 },
      colors: { body: '#26c6da', belly: '#e0f7fa', wing: '#00838f', beak: '#ffd54f' },
      desc: 'Alcanza el nivel 25. +8 % de monedas y +8 % de XP.',
      perk: { coins: 0.08, xp: 0.08 }
    },
    {
      id: 'espectro', name: 'Espectro', icon: '👻', rarity: 'legendary',
      req: { stat: 'duelWins', value: 10 },
      colors: { body: '#b39ddb', belly: '#ede7f6', wing: '#5e35b1', beak: '#b0bec5' },
      desc: 'Gana 10 duelos. El imán y el fantasma duran un 15 % más.',
      perk: { magnet: 0.15, duration: 0.15 }
    },
    {
      id: 'dorado', name: 'Dorado', icon: '👑', rarity: 'legendary',
      req: { stat: 'coinsEarned', value: 25000 },
      colors: { body: '#ffd54f', belly: '#fffde7', wing: '#ff8f00', beak: '#ff6f00' },
      desc: 'Gana 25.000 monedas en total. +10 % de puntos y +10 % de monedas.',
      perk: { coins: 0.10, score: 0.10 }
    }
  ];

  function getChar(id) { return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]; }
  function charOwned(save, id) {
    const c = CHARACTERS.find(x => x.id === id);
    return !!c && (!!c.free || (save.charsOwned || []).indexOf(id) !== -1);
  }
  function charUnlocked(save, id) { return reqMet(getChar(id).req, save); }
  function charPerk(id) { return Object.assign({}, getChar(id).perk || {}); }

  /* ==================================================================
   * ACCESORIOS POR RANURA (100 % cosméticos)
   * ================================================================== */
  const ACCESSORY_SLOTS = [
    { id: 'frame', name: 'Marco', icon: '🖼️' },
    { id: 'banner', name: 'Fondo', icon: '🎴' },
    { id: 'emote', name: 'Emote', icon: '💬' }
  ];
  const ACCESSORIES = [
    { id: 'fr-madera', slot: 'frame', name: 'Marco de madera', icon: '🪵', price: 0, color: '#a1887f', desc: 'Sencillo y cálido.' },
    { id: 'fr-plata', slot: 'frame', name: 'Marco de plata', icon: '🥈', price: 900, color: '#cfd8dc', desc: 'Brillo discreto.' },
    { id: 'fr-oro', slot: 'frame', name: 'Marco dorado', icon: '🥇', price: 2600, color: '#ffca28', desc: 'Para perfiles con historia.' },
    { id: 'fr-neon', slot: 'frame', name: 'Marco neón', icon: '🟣', price: 4200, color: '#e040fb', desc: 'Luz de arcade.' },
    { id: 'fr-hielo', slot: 'frame', name: 'Marco de hielo', icon: '❄️', price: 3600, color: '#81d4fa', desc: 'Frío, limpio, brillante.' },

    { id: 'bn-cielo', slot: 'banner', name: 'Fondo cielo', icon: '🌤️', price: 0, color: '#4fc3f7', desc: 'El cielo de siempre.' },
    { id: 'bn-atardecer', slot: 'banner', name: 'Fondo atardecer', icon: '🌅', price: 1200, color: '#ff8a65', desc: 'Naranjas de domingo.' },
    { id: 'bn-galaxia', slot: 'banner', name: 'Fondo galaxia', icon: '🌌', price: 3400, color: '#7e57c2', desc: 'Estrellas a medianoche.' },
    { id: 'bn-bosque', slot: 'banner', name: 'Fondo bosque', icon: '🌲', price: 2400, color: '#66bb6a', desc: 'Verde que respira.' },
    { id: 'bn-volcan', slot: 'banner', name: 'Fondo volcán', icon: '🌋', price: 4600, color: '#ff7043', desc: 'Lava bajo las plumas.' },

    { id: 'em-hola', slot: 'emote', name: 'Emote ¡Hola!', icon: '👋', price: 0, color: '#ffffff', text: '¡Hola!', desc: 'Saludo rápido.' },
    { id: 'em-gg', slot: 'emote', name: 'Emote GG', icon: '🏆', price: 700, color: '#ffd54f', text: '¡GG!', desc: 'Buen vuelo.' },
    { id: 'em-uy', slot: 'emote', name: 'Emote ¡Uy!', icon: '😅', price: 700, color: '#ffab91', text: '¡Uy!', desc: 'Casi casi.' },
    { id: 'em-fuego', slot: 'emote', name: 'Emote fuego', icon: '🔥', price: 1800, color: '#ff7043', text: '¡EN LLAMAS!', desc: 'Racha imparable.' },
    { id: 'em-luna', slot: 'emote', name: 'Emote luna', icon: '🌙', price: 2200, color: '#b39ddb', text: 'Buenas noches', desc: 'Para volar de madrugada.' }
  ];
  function getAccessory(id) { return ACCESSORIES.find(a => a.id === id) || null; }
  function accessoriesBySlot(slot) { return ACCESSORIES.filter(a => a.slot === slot); }

  /* ==================================================================
   * MASCOTAS (cosméticas)
   * Acompañan al ave, cambian de aspecto con el nivel de mascota y no
   * aportan ninguna ventaja de juego.
   * ================================================================== */
  const PET_LEVEL_XP = [0, 60, 160, 320, 600];
  const PETS = [
    { id: 'pet-pollito', name: 'Pío Pollito', icon: '🐥', rarity: 'common', price: 0, color: '#ffd54f', style: 'hop', desc: 'El primer amigo de cada vuelo.' },
    { id: 'pet-gato', name: 'Michi', icon: '🐱', rarity: 'common', price: 650, color: '#ffb74d', style: 'float', desc: 'Duerme en el aire hasta que aleteas.' },
    { id: 'pet-zorro', name: 'Zorro', icon: '🦊', rarity: 'uncommon', price: 1400, color: '#ff7043', style: 'zigzag', desc: 'Astuto, curioso y algo presumido.' },
    { id: 'pet-tortuga', name: 'Tortuga', icon: '🐢', rarity: 'uncommon', price: 1200, color: '#66bb6a', style: 'float', desc: 'Va a su ritmo. Siempre llega.' },
    { id: 'pet-murci', name: 'Murci', icon: '🦇', rarity: 'rare', price: 2600, color: '#7e57c2', style: 'zigzag', desc: 'Nocturno y muy teatral.' },
    { id: 'pet-dragon', name: 'Dragón', icon: '🐲', rarity: 'epic', price: 5400, color: '#26a69a', style: 'orbit', desc: 'Pequeño, pero con mucha presencia.' },
    { id: 'pet-estrella', name: 'Estelita', icon: '⭐', rarity: 'epic', price: 4800, color: '#ffd54f', style: 'orbit', desc: 'Brilla más cuando vuelas rápido.' },
    { id: 'pet-fantasma', name: 'Bruma', icon: '👻', rarity: 'legendary', req: { event: 'halloween' }, color: '#b39ddb', style: 'float', desc: 'Solo aparece durante Halloween.' },
    { id: 'pet-fenix', name: 'Chispita', icon: '🔥', rarity: 'legendary', price: 12000, color: '#ff7043', style: 'orbit', desc: 'Una chispa del ave que renace.' }
  ];
  function getPet(id) { return PETS.find(p => p.id === id) || PETS[0]; }
  function petLevel(xp) {
    const v = Math.max(0, Math.floor(Number(xp) || 0));
    let lv = 1;
    for (let i = 1; i < PET_LEVEL_XP.length; i++) if (v >= PET_LEVEL_XP[i]) lv = i + 1;
    return lv;
  }
  function petNextXp(xp) {
    const lv = petLevel(xp);
    return lv >= PET_LEVEL_XP.length ? 0 : PET_LEVEL_XP[lv];
  }
  function petOwned(save, id) {
    const p = PETS.find(x => x.id === id);
    return !!p && (p.price === 0 || (save.petsOwned || []).indexOf(id) !== -1);
  }
  function petUnlocked(save, id) { return reqMet(getPet(id).req, save); }

  /* ==================================================================
   * ÁRBOL DE HABILIDADES
   * Puntos reales ganados al subir de nivel (y con insignias). Cada nivel
   * mejora un efecto que el juego aplica de verdad.
   * ================================================================== */
  const SKILLS = [
    { id: 'sk_coins', name: 'Instinto de oro', icon: '🪙', max: 5, req: null, desc: '+2 % de valor de monedas por nivel.' },
    { id: 'sk_magnet', name: 'Atracción', icon: '🧲', max: 5, req: null, desc: '+12 % de radio del imán por nivel.' },
    { id: 'sk_xp', name: 'Aprendiz', icon: '📘', max: 5, req: null, desc: '+3 % de XP por nivel.' },
    { id: 'sk_guard', name: 'Piel dura', icon: '🛡️', max: 1, req: { skill: 'sk_coins', level: 2 }, desc: 'Empiezas cada vuelo con 1 escudo de partida.' },
    { id: 'sk_calm', name: 'Calma inicial', icon: '🌬️', max: 3, req: { skill: 'sk_magnet', level: 1 }, desc: '2 s de velocidad reducida al empezar, por nivel.' },
    { id: 'sk_power', name: 'Poder prolongado', icon: '⏱️', max: 5, req: { skill: 'sk_xp', level: 2 }, desc: '+5 % de duración de power-ups por nivel.' },
    { id: 'sk_revive', name: 'Segunda oportunidad', icon: '💞', max: 1, req: { skill: 'sk_guard', level: 1 }, desc: 'Sobrevives una vez por vuelo (con 1,5 s de invulnerabilidad).' },
    { id: 'sk_boss', name: 'Cazador de jefes', icon: '👹', max: 3, req: { skill: 'sk_power', level: 2 }, desc: 'Cada nivel suma +4 puntos al golpear a un jefe.' }
  ];
  function getSkill(id) { return SKILLS.find(s => s.id === id) || null; }
  function skillLv(save, id) { const v = (save.skills || {})[id]; return Math.max(0, Math.min((getSkill(id) || {}).max || 0, Math.floor(Number(v) || 0))); }
  function skillReqMet(save, id) {
    const s = getSkill(id);
    if (!s || !s.req) return true;
    return skillLv(save, s.req.skill) >= s.req.level;
  }
  function skillCost(save, id) {
    const s = getSkill(id);
    if (!s) return 999;
    const next = skillLv(save, id) + 1;
    return next >= s.max ? 0 : 1; // 1 punto por nivel; el árbol se limita con requisitos
  }
  function skillBuffs(save) {
    const v = id => skillLv(save, id);
    return {
      coins: v('sk_coins') * 0.02,
      magnet: v('sk_magnet') * 0.12,
      xp: v('sk_xp') * 0.03,
      startShield: v('sk_guard') > 0 ? 1 : 0,
      slowStart: v('sk_calm') * 2,
      duration: v('sk_power') * 0.05,
      revive: v('sk_revive') > 0 ? 1 : 0,
      bossScore: v('sk_boss') * 4
    };
  }

  /* ==================================================================
   * MODOS NUEVOS DE JUEGO
   * ================================================================== */
  const MODES = [
    {
      id: 'survival', name: 'Supervivencia', icon: '💀', tag: 'Sin red', rarity: 'uncommon',
      req: { level: 5 },
      desc: 'Empiezas con la dificultad alta y sin segunda oportunidad. +50 % de puntos.',
      cfg: { startLevel: 6, speed: 1.12, scoreMul: 1.5, enemies: 1.3, lives: 1 }
    },
    {
      id: 'timeattack', name: 'Contrarreloj', icon: '⏱️', tag: '60 s', rarity: 'uncommon',
      req: { best: 10 },
      desc: 'Sesenta segundos para hacer el máximo de puntos posible.',
      cfg: { time: 60, scoreMul: 1.2 }
    },
    {
      id: 'extreme', name: 'Desafío extremo', icon: '🔥', tag: '×2 puntos', rarity: 'rare',
      req: { best: 25 },
      desc: 'Huecos más estrechos, más velocidad y el doble de puntos.',
      cfg: { speed: 1.28, gap: 0.84, scoreMul: 2, enemies: 1.5 }
    },
    {
      id: 'gauntlet', name: 'Carrera de obstáculos', icon: '🏁', tag: '3 vidas', rarity: 'rare',
      req: { level: 8 },
      desc: 'Cruza 20 tubos con 3 vidas y obstáculos densos.',
      cfg: { lives: 3, pipes: 20, gap: 0.92, enemies: 1.35, scoreMul: 1.4 }
    },
    {
      id: 'coinrush', name: 'Fiebre de monedas', icon: '💰', tag: '45 s', rarity: 'rare',
      req: { stat: 'coinsEarned', value: 2000 },
      desc: 'Cuarenta y cinco segundos de monedas x3. La puntuación sale del botín.',
      cfg: { time: 45, coinMul: 3, scoreFromCoins: true, noPowers: true }
    },
    {
      id: 'finalboss', name: 'Jefe final', icon: '👑', tag: '6 golpes', rarity: 'epic',
      req: { stat: 'bossDefeated', value: 3 },
      desc: 'Un jefe de cinco segmentos y seis golpes. Al caer, victoria.',
      cfg: { bossHp: 6, bossSeg: 6, bossOnly: true, map: 'abismo', scoreMul: 1.5 }
    },
    {
      id: 'endless', name: 'Infinito', icon: '♾️', tag: 'Sin techo', rarity: 'epic',
      req: { best: 35 },
      desc: 'Empieza en el nivel 20 y acelera sin techo. Solo cuenta sobrevivir.',
      cfg: { startLevel: 20, speed: 1.1, endless: true, scoreMul: 1.3 }
    },
    {
      id: 'competitive', name: 'Competitivo', icon: '🆚', tag: 'Tu fantasma', rarity: 'epic',
      req: { flights: 10 },
      desc: 'Corre contra el fantasma de tu mejor vuelo en este modo. Sin rivales falsos.',
      cfg: { ghostRace: true, pipes: 30, scoreMul: 1.25 }
    },
    {
      id: 'event', name: 'Modo evento', icon: '🎃', tag: 'Temporal', rarity: 'legendary',
      req: null, eventOnly: true,
      desc: 'El modo del evento activo, con su mapa y sus bonus. Cambia cada temporada.',
      cfg: {}
    }
  ];
  function getMode(id) { return MODES.find(m => m.id === id) || null; }
  function modeCfg(id) {
    const m = getMode(id);
    if (!m) return {};
    const cfg = Object.assign({}, m.cfg);
    if (id === 'event') {
      const ev = activeEvent();
      if (ev) {
        cfg.map = ev.map;
        cfg.coins = ev.buffs && ev.buffs.coins || 0;
        cfg.enemies = ev.buffs && ev.buffs.enemies || 1;
        cfg.eventId = ev.id;
        cfg.time = ev.time || 0;
      }
    }
    return cfg;
  }
  function modeUnlocked(save, id) {
    const m = getMode(id);
    if (!m) return false;
    if (m.eventOnly) return !!activeEvent();
    return reqMet(m.req, save);
  }

  /* ==================================================================
   * JEFES
   * ================================================================== */
  const BOSSES = [
    { id: 'rey-tormenta', name: 'Rey Tormenta', icon: '🌩️', maps: ['tormenta', 'night', 'nocturno'], hp: 3, seg: 3, amp: 1, speed: 1, attack: 'wind', color: '#4fc3f7', desc: 'Sacude el cielo con rachas laterales.' },
    { id: 'coloso-volcan', name: 'Coloso del Volcán', icon: '🌋', maps: ['volcano', 'abismo'], hp: 4, seg: 4, amp: 1.1, speed: 1.05, attack: 'meteor', color: '#ff7043', desc: 'Lanza ascuas mientras se mueve.' },
    { id: 'espectro-nocturno', name: 'Espectro Nocturno', icon: '👻', maps: ['night', 'nocturno', 'pantano'], hp: 3, seg: 3, amp: 1.25, speed: 0.9, attack: 'bats', color: '#b39ddb', desc: 'Invoca murciélagos en mitad del combate.' },
    { id: 'leviatan', name: 'Leviatán', icon: '🐋', maps: ['oceano', 'playa', 'water'], hp: 5, seg: 4, amp: 0.9, speed: 0.95, attack: 'bats', color: '#26c6da', desc: 'Lento y enorme, pero no perdona.' },
    { id: 'quimera', name: 'Quimera', icon: '🦁', maps: ['mitologia', 'ruinas', 'egipto'], hp: 5, seg: 5, amp: 1.15, speed: 1.1, attack: 'meteor', color: '#ffca28', desc: 'Tres bestias en una sola sombra.' },
    { id: 'cronos-final', name: 'Cronos', icon: '⏳', maps: [], hp: 6, seg: 5, amp: 1.2, speed: 1.15, attack: 'wind', color: '#7e57c2', desc: 'El jefe final: seis golpes y cinco huecos.' }
  ];
  function bossFor(mapId, modeId) {
    if (modeId === 'finalboss') return BOSSES.find(b => b.id === 'cronos-final');
    const ev = activeEvent();
    if (ev && ev.boss) {
      const eb = BOSSES.find(b => b.id === ev.boss);
      if (eb) return eb;
    }
    const found = BOSSES.find(b => b.maps.indexOf(mapId) !== -1);
    if (found) return found;
    // Determinista por mapa: mismo escenario, mismo jefe.
    let h = 0;
    const s = String(mapId || 'day');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const pool = BOSSES.filter(b => b.id !== 'cronos-final');
    return pool[h % pool.length];
  }

  /* ==================================================================
   * MAPAS DINÁMICOS
   * Cada escenario puede activar mecánicas propias que el bucle aplica.
   * ================================================================== */
  const DYNAMIC = {
    day:       { mv: 0.20, feature: 'coins' },
    sunset:    { mv: 0.22, feature: 'coins' },
    night:     { mv: 0.24, feature: 'secret' },
    space:     { mv: 0.34, grav: 0.82, feature: 'coins' },
    neon:      { mv: 0.30, feature: 'secret' },
    water:     { mv: 0.18, gap: 1.06, feature: 'coins' },
    forest:    { mv: 0.20, gap: 1.04, feature: 'secret' },
    tundra:    { mv: 0.26, feature: 'coins' },
    candy:     { mv: 0.28, grav: 0.92, feature: 'coins' },
    volcano:   { mv: 0.30, feature: 'meteor' },
    tormenta:  { mv: 0.32, feature: 'wind' },
    abismo:    { mv: 0.36, feature: 'meteor' },
    nocturno:  { mv: 0.30, feature: 'secret' },
    mitologia: { mv: 0.32, feature: 'meteor' },
    oceano:    { mv: 0.24, feature: 'coins' },
    playa:     { mv: 0.20, feature: 'coins' },
    ruinas:    { mv: 0.28, feature: 'secret' },
    pantano:   { mv: 0.26, feature: 'wind' },
    cometa:    { mv: 0.38, grav: 0.78, feature: 'coins' },
    cristal:   { mv: 0.30, feature: 'secret' },
    glitch:    { mv: 0.40, feature: 'meteor' },
    aurora:    { mv: 0.30, grav: 0.86, feature: 'coins' }
  };
  function dynamicFor(mapId) {
    return Object.assign({ mv: 0.2, grav: 1, gap: 1, feature: 'coins' }, DYNAMIC[mapId] || {});
  }

  /* ==================================================================
   * EVENTOS ANUALES REALES
   * Las fechas se evalúan con el reloj del dispositivo. Los rangos que
   * cruzan el año (Navidad/Año Nuevo) se manejan aparte.
   * ================================================================== */
  const EVENTS = [
    {
      id: 'halloween', name: 'Halloween', icon: '🎃', start: [10, 20], end: [11, 2],
      map: 'nocturno', theme: 'halloween', boss: 'espectro-nocturno',
      buffs: { coins: 0.5, enemies: 1.2 }, metric: 'runs',
      desc: 'El cielo se cubre de murciélagos. +50 % de monedas.',
      rewards: [
        { id: 'h1', name: 'Calabaza de bienvenida', icon: '🎃', need: 1, coins: 300, petXp: 20, skill: 1 },
        { id: 'h2', name: 'Noche de murciélagos', icon: '🦇', need: 3, coins: 700, petXp: 40, skill: 1 },
        { id: 'h3', name: 'Señor del anochecer', icon: '🌕', need: 6, coins: 1500, petXp: 80, skill: 2 }
      ]
    },
    {
      id: 'navidad', name: 'Navidad', icon: '🎄', start: [12, 15], end: [1, 7],
      map: 'nevadoM', theme: 'navidad',
      buffs: { coins: 0.35 }, metric: 'coins',
      desc: 'Nieve, regalos y monedas extra al recogerlas.',
      rewards: [
        { id: 'n1', name: 'Copo de nieve', icon: '❄️', need: 50, coins: 300, petXp: 20 },
        { id: 'n2', name: 'Trineo veloz', icon: '🛷', need: 200, coins: 800, petXp: 50, skill: 1 },
        { id: 'n3', name: 'Estrella de Navidad', icon: '⭐', need: 500, coins: 1800, petXp: 100, skill: 2 }
      ]
    },
    {
      id: 'carnaval', name: 'Carnaval', icon: '🎭', start: [2, 10], end: [2, 25],
      map: 'carnaval', theme: 'carnaval',
      buffs: { score: 0.25 }, metric: 'pipes',
      desc: 'Confeti y ritmo: +25 % de puntos por tubo.',
      rewards: [
        { id: 'c1', name: 'Máscara de papel', icon: '🎭', need: 10, coins: 250, petXp: 20 },
        { id: 'c2', name: 'Comparsa', icon: '🥁', need: 40, coins: 700, petXp: 45 },
        { id: 'c3', name: 'Rey del carnaval', icon: '👑', need: 90, coins: 1600, petXp: 90, skill: 2 }
      ]
    },
    {
      id: 'aniversario', name: 'Aniversario', icon: '🎂', start: [5, 1], end: [5, 12],
      map: 'fiesta', theme: 'fiesta',
      buffs: { coins: 0.25, score: 0.25 }, metric: 'runs',
      desc: 'Pío Vuelo cumple un año más: monedas y puntos extra.',
      rewards: [
        { id: 'a1', name: 'Velita', icon: '🕯️', need: 1, coins: 400, petXp: 25, skill: 1 },
        { id: 'a2', name: 'Tarta de vuelo', icon: '🎂', need: 4, coins: 1000, petXp: 60 },
        { id: 'a3', name: 'Globo de fiesta', icon: '🎈', need: 8, coins: 2200, petXp: 120, skill: 2 }
      ]
    },
    {
      id: 'verano', name: 'Verano', icon: '🏖️', start: [6, 21], end: [9, 22],
      map: 'playa', theme: 'verano',
      buffs: { coins: 0.20 }, metric: 'score',
      desc: 'Vuelo largo, sol y botín. Suma puntos para las recompensas.',
      rewards: [
        { id: 'v1', name: 'Sombrilla', icon: '⛱️', need: 50, coins: 300, petXp: 20 },
        { id: 'v2', name: 'Tabla de vuelo', icon: '🏄', need: 180, coins: 800, petXp: 50, skill: 1 },
        { id: 'v3', name: 'Sol de mediodía', icon: '☀️', need: 400, coins: 1900, petXp: 100, skill: 2 }
      ]
    },
    {
      id: 'anonuevo', name: 'Año Nuevo', icon: '🎆', start: [12, 30], end: [1, 2],
      map: 'cometa', theme: 'anonuevo', boss: 'rey-tormenta',
      buffs: { score: 0.3 }, metric: 'boss',
      desc: 'Fuegos artificiales y jefes con más puntos. Cierra el año volando.',
      rewards: [
        { id: 'y1', name: 'Cohete', icon: '🚀', need: 1, coins: 500, petXp: 30, skill: 1 },
        { id: 'y2', name: 'Fuegos', icon: '🎆', need: 2, coins: 1200, petXp: 70 },
        { id: 'y3', name: 'Año dorado', icon: '🥂', need: 4, coins: 2600, petXp: 140, skill: 2 }
      ]
    }
  ];

  function mdValue(d) { return (d.getMonth() + 1) * 100 + d.getDate(); }
  function inRange(md, start, end) {
    const a = start[0] * 100 + start[1], b = end[0] * 100 + end[1];
    if (a <= b) return md >= a && md <= b;
    return md >= a || md <= b; // rango que cruza el año
  }
  function activeEvents(date) {
    const d = date instanceof Date ? date : new Date();
    const md = mdValue(d);
    return EVENTS.filter(e => inRange(md, e.start, e.end));
  }
  function activeEvent(date) { return activeEvents(date)[0] || null; }
  function eventKey(ev, date) {
    const d = date instanceof Date ? date : new Date();
    return ev ? ev.id + '-' + d.getFullYear() : '';
  }
  function getEvent(id) { return EVENTS.find(e => e.id === id) || null; }
  function eventProgress(save, ev, date) {
    if (!ev) return 0;
    const key = eventKey(ev, date);
    const box = (save.events || {})[key];
    return box ? Math.max(0, Math.floor(Number(box.progress) || 0)) : 0;
  }
  function eventRewardClaimed(save, ev, rid, date) {
    if (!ev) return false;
    const box = (save.events || {})[eventKey(ev, date)];
    return !!box && Array.isArray(box.claimed) && box.claimed.indexOf(rid) !== -1;
  }

  /* ==================================================================
   * INSIGNIAS, TÍTULOS Y COLECCIONES
   * ================================================================== */
  const BADGES = [
    { id: 'bg-first', name: 'Primer aleteo', icon: '🐣', desc: 'Completa tu primer vuelo.', reward: { coins: 100 }, test: s => (s.stats.flights || 0) >= 1 },
    { id: 'bg-pipes100', name: 'Cien tubos', icon: '🚧', desc: 'Cruza 100 tubos en total.', reward: { coins: 300, skill: 1 }, test: s => (s.stats.pipes || 0) >= 100 },
    { id: 'bg-coins1k', name: 'Ahorrador', icon: '🏦', desc: 'Gana 1.000 monedas en total.', reward: { coins: 200 }, test: s => (s.stats.coinsGot || 0) >= 1000 },
    { id: 'bg-boss5', name: 'Cazador de jefes', icon: '👹', desc: 'Derrota 5 jefes.', reward: { petXp: 60 }, test: s => (s.stats.bossDefeated || 0) >= 5 },
    { id: 'bg-duel10', name: 'Duelista', icon: '🆚', desc: 'Gana 10 duelos.', reward: { coins: 500 }, test: s => (s.stats.duelWins || 0) >= 10 },
    { id: 'bg-zen1000', name: 'Mente en calma', icon: '🧘', desc: 'Alcanza 1.000 m en Zen.', reward: { coins: 400 }, test: s => (s.stats.zenBest || 0) >= 1000 },
    { id: 'bg-nohit', name: 'Pluma intacta', icon: '🪶', desc: 'Vuela 300 m sin chocar.', reward: { petXp: 50 }, test: s => (s.stats.maxDistNoHit || 0) >= 300 },
    { id: 'bg-level10', name: 'Veterano', icon: '⭐', desc: 'Alcanza el nivel 10.', reward: { skill: 1 }, test: s => (s.level || 1) >= 10 },
    { id: 'bg-missions20', name: 'Cumplidor', icon: '📋', desc: 'Completa 20 misiones.', reward: { coins: 600 }, test: s => (s.stats.missionsDone || 0) >= 20 },
    { id: 'bg-challenge10', name: 'Semilla constante', icon: '🌱', desc: 'Juega 10 desafíos diarios.', reward: { petXp: 40 }, test: s => (s.stats.challengePlayed || 0) >= 10 },
    { id: 'bg-master', name: 'Maestro de mapas', icon: '🗺️', desc: 'Consigue maestría de oro en 3 mapas.', reward: { coins: 1500, skill: 1 }, test: s => Object.keys(s.mapBest || {}).filter(k => (s.mapBest[k] || 0) >= 60).length >= 3 },
    { id: 'bg-legend', name: 'Leyenda del cielo', icon: '🌟', desc: 'Consigue 100 puntos en un vuelo.', reward: { coins: 1200, petXp: 100 }, test: s => (s.stats.best || 0) >= 100 }
  ];
  function badgeClaimed(save, id) { return (save.badges || []).indexOf(id) !== -1; }
  function badgeReady(save, b) { try { return !badgeClaimed(save, b.id) && b.test(save); } catch (e) { return false; } }

  const TITLES = [
    { id: 'ti-novato', name: 'Novato', icon: '🐤', desc: 'Empieza a volar.', test: s => (s.stats.flights || 0) >= 1 },
    { id: 'ti-veloz', name: 'Velocista', icon: '💨', desc: 'Alcanza 30 puntos.', test: s => (s.stats.best || 0) >= 30 },
    { id: 'ti-coleccionista', name: 'Coleccionista', icon: '🎒', desc: 'Ten 8 aves distintas.', test: s => (s.skinsOwned || []).length >= 8 },
    { id: 'ti-jefe', name: 'Rompejefes', icon: '👹', desc: 'Derrota 10 jefes.', test: s => (s.stats.bossDefeated || 0) >= 10 },
    { id: 'ti-duelista', name: 'Duelista', icon: '🆚', desc: 'Gana 20 duelos.', test: s => (s.stats.duelWins || 0) >= 20 },
    { id: 'ti-explorador', name: 'Explorador', icon: '🗺️', desc: 'Ten 6 mapas.', test: s => (s.mapsOwned || []).length >= 6 },
    { id: 'ti-mecenas', name: 'Mecenas', icon: '💎', desc: 'Gasta 5.000 monedas.', test: s => (s.stats.spent || 0) >= 5000 },
    { id: 'ti-leyenda', name: 'Leyenda', icon: '👑', desc: 'Consigue 80 puntos.', test: s => (s.stats.best || 0) >= 80 },
    { id: 'ti-halloween', name: 'Hijo de la noche', icon: '🎃', desc: 'Juega durante Halloween.', test: () => !!activeEvent() },
    { id: 'ti-maestro', name: 'Maestro del cielo', icon: '🌟', desc: 'Completa 20 insignias.', test: s => (s.badges || []).length >= 12 }
  ];
  function getTitle(id) { return TITLES.find(t => t.id === id) || TITLES[0]; }
  function titleUnlocked(save, t) { try { return t.test(save); } catch (e) { return false; } }

  const COLLECTIONS = [
    { id: 'co-starter', name: 'Primeras plumas', icon: '🐥', items: ['skin:classic'], desc: 'Ten el ave clásica.', reward: { coins: 100 } },
    { id: 'co-tools', name: 'Caja de herramientas', icon: '🧰', items: [], toolCount: 6, desc: 'Ten 6 tipos de herramienta distintos.', reward: { coins: 500, skill: 1 } },
    { id: 'co-pets', name: 'Guardería', icon: '🐾', items: ['pet:pio-pollito', 'pet:gato', 'pet:zorro', 'pet:tortuga'], desc: 'Ten 4 mascotas.', reward: { petXp: 80 } },
    { id: 'co-chars', name: 'Tripulación', icon: '🧑‍✈️', items: ['pio', 'brisa', 'trueno'], desc: 'Ten 3 personajes.', reward: { coins: 700, skill: 1 } },
    { id: 'co-maps', name: 'Cartógrafo', icon: '🗺️', items: [], mapCount: 8, desc: 'Ten 8 mapas.', reward: { coins: 900 } },
    { id: 'co-badges', name: 'Vitrina', icon: '🏅', items: [], badgeCount: 8, desc: 'Consigue 8 insignias.', reward: { coins: 1200, petXp: 100 } }
  ];
  function collectionMet(save, c) {
    if (c.toolCount) {
      const n = Object.keys(save.items || {}).filter(k => (save.items[k] || 0) > 0).length;
      if (n < c.toolCount) return false;
    }
    if (c.mapCount && (save.mapsOwned || []).length < c.mapCount) return false;
    if (c.badgeCount && (save.badges || []).length < c.badgeCount) return false;
    for (const it of (c.items || [])) {
      if (it.indexOf('skin:') === 0) {
        if (!(save.skinsOwned || []).some(x => (x.id || x) === it.slice(5))) return false;
      } else if (it.indexOf('pet:') === 0) {
        if (!petOwned(save, it.slice(4))) return false;
      } else if (!(save.charsOwned || []).some(x => x === it)) return false;
    }
    return true;
  }
  function collectionClaimed(save, id) { return (save.collections || []).indexOf(id) !== -1; }

  /* ==================================================================
   * MAESTRÍA POR MAPA
   * ================================================================== */
  const MASTERY_TIERS = [
    { id: 'bronce', name: 'Bronce', icon: '🥉', need: 10, reward: { coins: 120 } },
    { id: 'plata', name: 'Plata', icon: '🥈', need: 30, reward: { coins: 350, petXp: 20 } },
    { id: 'oro', name: 'Oro', icon: '🥇', need: 60, reward: { coins: 800, petXp: 50, skill: 1 } }
  ];
  function masteryTier(best) {
    let t = 0;
    for (let i = 0; i < MASTERY_TIERS.length; i++) if ((best || 0) >= MASTERY_TIERS[i].need) t = i + 1;
    return t;
  }
  function masteryKey(mapId, tierId) { return mapId + ':' + tierId; }
  function masteryClaimed(save, mapId, tierId) { return (save.masteryClaimed || []).indexOf(masteryKey(mapId, tierId)) !== -1; }

  /* ==================================================================
   * HERRAMIENTAS LEGENDARIAS (permanentes, 1 equipada)
   * Se activan al empezar el vuelo y tienen un uso manual por partida.
   * ================================================================== */
  const LEGENDARY_TOOLS = [
    { key: 'lg-electric', name: 'Tormenta Eléctrica', icon: '⚡', price: 6000, req: { level: 6 }, color: '#ffe066', effect: 'electric', desc: 'Elimina a todos los enemigos en pantalla y los aturde 4 s.' },
    { key: 'lg-magnetic', name: 'Corazón Magnético', icon: '🧲', price: 7500, req: { level: 8 }, color: '#ff7043', effect: 'magnetic', desc: 'Atrae todas las monedas cercanas durante 9 s.' },
    { key: 'lg-energy', name: 'Núcleo de Energía', icon: '🔋', price: 9000, req: { level: 10 }, color: '#69f0ae', effect: 'energy', desc: 'Otorga 2 escudos de partida y ralentiza el mundo 6 s.' },
    { key: 'lg-freeze', name: 'Aliento Glacial', icon: '❄️', price: 10500, req: { level: 12 }, color: '#81d4fa', effect: 'freeze', desc: 'Congela los tubos móviles y reduce la velocidad un 40 % durante 6 s.' },
    { key: 'lg-impulse', name: 'Impulso Estelar', icon: '🚀', price: 12000, req: { level: 14 }, color: '#ff8a65', effect: 'impulse', desc: 'Acelera el vuelo y da 3 s de invulnerabilidad.' },
    { key: 'lg-build', name: 'Constructor', icon: '🧱', price: 13500, req: { level: 16 }, color: '#ffb74d', effect: 'build', desc: 'Despeja los tubos próximos y crea un puente seguro de monedas.' },
    { key: 'lg-future', name: 'Futurista', icon: '🛸', price: 16000, req: { level: 18 }, color: '#e040fb', effect: 'future', desc: 'Puntuación x3 y monedas x2 durante 12 s.' }
  ];
  function getLegendary(key) { return LEGENDARY_TOOLS.find(t => t.key === key) || null; }
  function legendaryOwned(save, key) { return (save.legendaryOwned || []).indexOf(key) !== -1; }
  function legendaryUnlocked(save, t) { return reqMet(t.req, save); }

  /* ==================================================================
   * TEMAS Y PRESETS
   * ================================================================== */
  const THEMES = [
    { id: 'theme-default', name: 'Cielo clásico', icon: '🌤️', req: null, vars: { accent: '#ffd54f', panel: 'rgba(18,28,50,.92)', bg: 'rgba(10,14,30,.55)', glow: '#4fc3f7' } },
    { id: 'theme-sunset', name: 'Atardecer', icon: '🌅', req: { level: 4 }, vars: { accent: '#ff8a65', panel: 'rgba(44,22,34,.93)', bg: 'rgba(32,12,24,.58)', glow: '#ff7043' } },
    { id: 'theme-forest', name: 'Bosque', icon: '🌲', req: { stat: 'coinsEarned', value: 1500 }, vars: { accent: '#69f0ae', panel: 'rgba(12,36,26,.93)', bg: 'rgba(6,26,18,.58)', glow: '#66bb6a' } },
    { id: 'theme-neon', name: 'Neón', icon: '🟣', req: { level: 15 }, vars: { accent: '#e040fb', panel: 'rgba(26,10,48,.93)', bg: 'rgba(14,4,30,.6)', glow: '#00e5ff' } },
    { id: 'theme-halloween', name: 'Halloween', icon: '🎃', req: { event: 'halloween' }, vars: { accent: '#ff9100', panel: 'rgba(32,14,10,.94)', bg: 'rgba(18,6,4,.62)', glow: '#b388ff' } },
    { id: 'theme-ice', name: 'Hielo', icon: '❄️', req: { level: 22 }, vars: { accent: '#81d4fa', panel: 'rgba(12,30,48,.93)', bg: 'rgba(8,20,34,.58)', glow: '#4fc3f7' } },
    { id: 'theme-gold', name: 'Oro', icon: '👑', req: { stat: 'best', value: 60 }, vars: { accent: '#ffca28', panel: 'rgba(42,30,6,.94)', bg: 'rgba(26,18,2,.6)', glow: '#ffd54f' } }
  ];
  function getTheme(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }
  function themeUnlocked(save, t) { return reqMet(t.req, save); }
  function applyTheme(save, doc) {
    const t = getTheme(save && save.set && save.set.theme);
    const root = doc && (doc.documentElement || doc.body);
    if (!root) return t;
    root.setAttribute('data-theme', t.id);
    return t;
  }

  const PRESETS = [
    { id: 'pre-balance', name: 'Equilibrado', icon: '⚖️', desc: 'La configuración recomendada.', set: { gfx: 'high', reduced: false, shake: true, uiAnim: true, cine: 'full', fps: 0, sens: 1 } },
    { id: 'pre-rendimiento', name: 'Rendimiento', icon: '🚀', desc: 'Menos efectos, más fluidez.', set: { gfx: 'low', reduced: true, shake: false, uiAnim: false, cine: 'reduced', fps: 30 } },
    { id: 'pre-cine', name: 'Cinematográfico', icon: '🎬', desc: 'Todos los efectos y cinemáticas.', set: { gfx: 'high', reduced: false, shake: true, uiAnim: true, cine: 'full', fps: 0 } },
    { id: 'pre-silencioso', name: 'Silencioso', icon: '🔇', desc: 'Sin sonido, notificaciones ni vibración.', set: { sfx: false, music: false, vib: false, notif: false } },
    { id: 'pre-experto', name: 'Experto', icon: '🎯', desc: 'Alta sensibilidad y contracción apagada.', set: { sens: 1.3, lift: false, confirmBuy: true, cine: 'reduced' } }
  ];
  function getPreset(id) { return PRESETS.find(p => p.id === id) || null; }

  /* ==================================================================
   * LIGA LOCAL SEMANAL (progresión social sin simular online)
   * Los rivales son registros reales de este dispositivo: otras partidas
   * tuyas y perfiles locales. Nunca se inventan jugadores.
   * ================================================================== */
  const LEAGUE_TIERS = [
    { id: 'bronce', name: 'Bronce', icon: '🥉', need: 0, reward: { coins: 150 } },
    { id: 'plata', name: 'Plata', icon: '🥈', need: 600, reward: { coins: 400, petXp: 25 } },
    { id: 'oro', name: 'Oro', icon: '🥇', need: 1500, reward: { coins: 900, petXp: 50, skill: 1 } },
    { id: 'diamante', name: 'Diamante', icon: '💎', need: 3000, reward: { coins: 1800, petXp: 90, skill: 1 } },
    { id: 'campeon', name: 'Campeón', icon: '👑', need: 5000, reward: { coins: 3200, petXp: 150, skill: 2 } }
  ];
  function weekKey(date) {
    const d = date instanceof Date ? new Date(date.getTime()) : new Date();
    const wd = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - wd);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function weekPoints(save, date) {
    const key = weekKey(date);
    const start = new Date(key + 'T00:00:00').getTime();
    return (save.runs || []).reduce((sum, r) => (r && r.date >= start ? sum + Math.max(0, Math.floor(Number(r.score) || 0)) : sum), 0);
  }
  function leagueTierFor(points) {
    let t = LEAGUE_TIERS[0];
    for (const tier of LEAGUE_TIERS) if ((points || 0) >= tier.need) t = tier;
    return t;
  }
  function nextLeagueTier(points) {
    for (const tier of LEAGUE_TIERS) if ((points || 0) < tier.need) return tier;
    return null;
  }
  // Rivales fantasma: solo datos reales del dispositivo (historial + otros perfiles).
  function ghostRivals(save, limit) {
    const out = [];
    const me = (save.profile && save.profile.name) || 'Tú';
    (save.players || []).forEach(p => {
      if (!p || p.id === (save.profile && save.profile.id)) return;
      out.push({ name: p.name || 'Jugador', score: Math.max(0, p.best || 0), source: 'perfil local', me: false });
    });
    const topRuns = (save.runs || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    const seen = {};
    topRuns.forEach((r, i) => {
      if (out.length >= (limit || 5)) return;
      const key = 'r' + (r.score || 0);
      if (seen[key]) return;
      seen[key] = true;
      out.push({ name: 'Tu vuelo #' + (i + 1), score: Math.max(0, r.score || 0), source: 'tu historial', me: true });
    });
    if (!out.length) out.push({ name: me, score: 0, source: 'tu historial', me: true });
    return out.sort((a, b) => b.score - a.score).slice(0, limit || 5);
  }

  /* ==================================================================
   * REQUISITOS
   * ================================================================== */
  function statValue(save, key) {
    const s = save || {};
    if (key === 'level') return Math.max(1, Math.floor(Number(s.level) || 1));
    if (key === 'coins') return Math.max(0, Math.floor(Number(s.coins) || 0));
    if (key === 'coinsEarned') return Math.max(0, Math.floor(Number(s.coinsEarned) || 0));
    if (key === 'best') return Math.max(0, Math.floor(Number(s.stats && s.stats.best) || 0));
    if (key === 'flights') return Math.max(0, Math.floor(Number(s.stats && s.stats.flights) || 0));
    return Math.max(0, Math.floor(Number(s.stats && s.stats[key]) || 0));
  }
  function reqMet(req, save) {
    if (!req) return true;
    if (req.level && statValue(save, 'level') < req.level) return false;
    if (req.best && statValue(save, 'best') < req.best) return false;
    if (req.flights && statValue(save, 'flights') < req.flights) return false;
    if (req.stat && statValue(save, req.stat) < (req.value || 0)) return false;
    if (req.event) {
      const ev = activeEvent();
      if (!ev || ev.id !== req.event) return false;
    }
    if (req.skill) {
      if (skillLv(save, req.skill) < (req.level || 1)) return false;
    }
    return true;
  }
  function reqText(req) {
    if (!req) return 'Disponible';
    if (req.level) return 'Nivel ' + req.level;
    if (req.best) return 'Récord ' + req.best + ' pts';
    if (req.flights) return req.flights + ' vuelos';
    if (req.event) {
      const ev = getEvent(req.event);
      return 'Evento ' + (ev ? ev.name : req.event);
    }
    if (req.stat) {
      const names = {
        bossDefeated: 'jefes derrotados', duelWins: 'duelos ganados', coinsEarned: 'monedas ganadas',
        missionsDone: 'misiones', zenBest: 'm de Zen', maxDistNoHit: 'm sin chocar', pipes: 'tubos'
      };
      return (req.value || 0) + ' ' + (names[req.stat] || req.stat);
    }
    return 'Disponible';
  }

  /* ==================================================================
   * UTILIDADES
   * ================================================================== */
  function totalXp(save) {
    let total = 0;
    for (let l = 1; l < statValue(save, 'level'); l++) total += Math.floor(55 * Math.pow(l, 1.35) + 30);
    return total + Math.max(0, Number(save && save.xp) || 0);
  }
  function fmt(n) { return String(Math.max(0, Math.floor(Number(n) || 0))); }
  function rarityWeight(id) { return rarityOf(id).weight; }
  function itemListForCollection(c) {
    return (c.items || []).slice();
  }
  function allCatalogs() {
    return { CHARACTERS, ACCESSORIES, PETS, SKILLS, MODES, BOSSES, EVENTS, BADGES, TITLES, COLLECTIONS, LEGENDARY_TOOLS, THEMES, PRESETS, LEAGUE_TIERS, MASTERY_TIERS };
  }

  return {
    RARITY, rarityOf, rarityWeight,
    CHARACTERS, getChar, charOwned, charUnlocked, charPerk,
    ACCESSORY_SLOTS, ACCESSORIES, getAccessory, accessoriesBySlot,
    PETS, getPet, petLevel, petNextXp, petOwned, petUnlocked, PET_LEVEL_XP,
    SKILLS, getSkill, skillLv, skillReqMet, skillCost, skillBuffs,
    MODES, getMode, modeCfg, modeUnlocked,
    BOSSES, bossFor,
    DYNAMIC, dynamicFor,
    EVENTS, activeEvent, activeEvents, eventKey, getEvent, eventProgress, eventRewardClaimed,
    BADGES, badgeReady, badgeClaimed,
    TITLES, getTitle, titleUnlocked,
    COLLECTIONS, collectionMet, collectionClaimed,
    MASTERY_TIERS, masteryTier, masteryKey, masteryClaimed,
    LEGENDARY_TOOLS, getLegendary, legendaryOwned, legendaryUnlocked,
    THEMES, getTheme, themeUnlocked, applyTheme,
    PRESETS, getPreset,
    LEAGUE_TIERS, weekKey, weekPoints, leagueTierFor, nextLeagueTier, ghostRivals,
    statValue, reqMet, reqText, totalXp, fmt, itemListForCollection, allCatalogs
  };
})();
