/* Catálogo: aves, sombreros, efectos, mapas, logros, dificultades */
window.DAT = (function () {
  'use strict';

  /* ------------------------------------------------------------------
   * ECONOMÍA CENTRALIZADA
   * Todos los precios de tienda pasan por econPrice() una sola vez al
   * cargar el catálogo. Así la interfaz y el cobro usan SIEMPRE el mismo
   * número y el reequilibrio se ajusta desde aquí.
   * ------------------------------------------------------------------ */
  const ECONOMY = {
    // subida moderada: común +10 %, poco común +13 %, raro +16 %, especial +20 %
    mult: { common: 1.10, uncommon: 1.13, rare: 1.16, special: 1.20 },
    tier(base) {
      if (base < 120) return 'common';
      if (base < 300) return 'uncommon';
      if (base < 800) return 'rare';
      return 'special';
    },
    round5(n) { return Math.max(5, Math.round(n / 5) * 5); },
    price(base) {
      if (typeof base !== 'number' || !isFinite(base) || base <= 0) return 0;
      return this.round5(base * this.mult[this.tier(base)]);
    },
    // Mejora de herramienta: coste creciente por nivel (base ya reequilibrada)
    toolUpPrice(level) { return this.round5(90 + Math.max(0, Math.min(4, level | 0)) * 82); },
    // Materiales (🔩) que pide cada nivel: 1→2 gratis, 2→3 una pieza, ...
    toolUpParts(level) { return [0, 0, 1, 2, 3][Math.max(0, Math.min(4, level | 0))] || 0; },
    repairPrice(tool, missing, max) {
      // Las herramientas exclusivas tienen precio de venta 0: usan un valor
      // de referencia para que repararlas no sea gratis.
      const raw = tool && (tool.repairValue || tool.basePrice || tool.price);
      const price = typeof raw === 'number' && raw > 0 ? raw : 100;
      const ratio = max > 0 ? Math.max(0, Math.min(1, missing / max)) : 1;
      return this.round5(Math.max(10, price * 0.35 * ratio));
    }
  };

  /* --- Durabilidad de herramientas (compartida por tipo) --------------- */
  const TOOL_DUR = { base: 12, perLevel: 3, wearPerLevel: 0.1, minWear: 0.4 };
  function toolBaseDur(tool) { return (tool && tool.dur) || TOOL_DUR.base; }
  function toolMaxDur(key, level) {
    const t = getTool(key);
    return toolBaseDur(t) + Math.max(0, Math.min(5, level | 0)) * TOOL_DUR.perLevel;
  }
  function toolWear(key, level) {
    return Math.max(TOOL_DUR.minWear, 1 - Math.max(0, Math.min(5, level | 0)) * TOOL_DUR.wearPerLevel);
  }

  const SKINS = [
    { id: 'classic',       name: 'Pío Clásico',  desc: 'El legendario pajarito amarillo.', price: 0, body: '#ffd63f', wing: '#f4ad00', belly: '#fff3c0', beak: '#ff7b2e', cheek: '#ff8a5c' },
    { id: 'berry',         name: 'Fruti Roja',   desc: 'Roja como una fresa.',           price: 150, body: '#ff5c5c', wing: '#d63131', belly: '#ffd6d6', beak: '#ffa02e', cheek: '#ffb3a8' },
    { id: 'azulito',       name: 'Azulito',      desc: 'Fresco como el cielo.',          price: 150, body: '#4fc3f7', wing: '#1e88e5', belly: '#e3f7ff', beak: '#ff9d2e', cheek: '#a5d8ff' },
    { id: 'verdecito',     name: 'Palta',        desc: 'Aguacate con alas.',             price: 200, body: '#7cb342', wing: '#4c8a1f', belly: '#eaffd6', beak: '#ff9d2e', cheek: '#b7e07a' },
    { id: 'pink',          name: 'Chicle',       desc: 'Dulce y esponjoso.',             price: 200, body: '#ff8fd4', wing: '#f062b8', belly: '#ffe9f7', beak: '#ff7b2e', cheek: '#ffc4ea' },
    { id: 'night',         name: 'Ninja',        desc: 'Sigilosa bajo la luna.',         price: 350, body: '#5d4e8c', wing: '#3d3370', belly: '#cfc4f4', beak: '#2e9eff', cheek: '#9a86d8' },
    { id: 'robot',         name: 'Robo-Pío',     desc: 'Unidad #17 lista para volar.',   price: 500, body: '#90a4ae', wing: '#546e7a', belly: '#d5e1e6', beak: '#37474f', cheek: '#29b6f6' },
    { id: 'oro',           name: 'Dorada',       desc: 'Solo para campeones.',           price: 1200, body: '#ffd54f', wing: '#ffab00', belly: '#fff7cc', beak: '#ff8f00', cheek: '#ffca28', shine: true },
    { id: 'fantasma',      name: 'Fantasma',     desc: 'Flota entre mundos.',            price: 700, body: '#e7ecf2', wing: '#b9c4d1', belly: '#ffffff', beak: '#9aa7b5', cheek: '#d3dce6', ghost: true },
    { id: 'arcoiris',      name: 'Arcoíris',     desc: 'Todos los colores en uno.',      price: 1500, body: '#fff', wing: '#fff', belly: '#fff', beak: '#ff8f00', cheek: '#fff', rainbow: true },
    { id: 'hada',          name: 'Hada',         desc: 'Alas brillantes de luz.',        price: 800, body: '#b388ff', wing: '#d1c4e9', belly: '#f0e7ff', beak: '#ffd54f', cheek: '#ffe0f0', sparkle: true },
    { id: 'skate',         name: 'Skater',       desc: 'Vuela con actitud.',             price: 600, body: '#6d4c41', wing: '#4e342e', belly: '#efe4d8', beak: '#8d6e63', cheek: '#ffb74d', skate: true },
    { id: 'lindo',         name: 'Lindo',        desc: 'El más tierno de todos.',        price: 250, body: '#ffe082', wing: '#ffca28', belly: '#fff8e1', beak: '#ff7043', cheek: '#f48fb1', blush: true },
    { id: 'ice',           name: 'Glaciar',      desc: 'Fría como el hielo.',            price: 900, body: '#b3e5fc', wing: '#4fc3f7', belly: '#e1f5fe', beak: '#29b6f6', cheek: '#81d4fa', ice: true },
    { id: 'nebula',        name: 'Nébula',       desc: 'Nacida en el espacio profundo.', price: 2000, body: '#7e57c2', wing: '#4527a0', belly: '#ede7f6', beak: '#ffb300', cheek: '#7e57c2', nebula: true },
    { id: 'tigre',         name: 'Tigre',        desc: 'Rugidos y rayas.',                price: 1100, body: '#ff9d2e', wing: '#e07b00', belly: '#ffe9c4', beak: '#c0392b', cheek: '#ffd54f', tiger: true },
    { id: 'gato',          name: 'Michi',        desc: 'Orejas de gato incluidas.',       price: 900,  body: '#9aa7b5', wing: '#6d7d8a', belly: '#eef2f5', beak: '#4a5560', cheek: '#ff9db0', kitty: true },
    { id: 'cacto',         name: 'Cacto',        desc: 'Pica, pero vuela.',               price: 800,  body: '#66bb6a', wing: '#388e3c', belly: '#d6f5d8', beak: '#ff7043', cheek: '#a5d6a7', cactus: true },
    { id: 'alien',         name: 'Marciano',     desc: 'Procede de otro planeta.',        price: 1300, body: '#81c784', wing: '#4c8c5d', belly: '#c8e6c9', beak: '#37474f', cheek: '#c5e1a5', alien: true },
    { id: 'cafe',          name: 'Café',         desc: 'Espresso y alas.',                price: 450,  body: '#8d6e63', wing: '#6d4c41', belly: '#efe4d8', beak: '#ff7043', cheek: '#d7ccc8', blush: true },
    { id: 'marina',        name: 'Marina',       desc: 'Limpia como el océano.',          price: 500,  body: '#26a69a', wing: '#00897b', belly: '#e0f2f1', beak: '#ffb300', cheek: '#80cbc4', shine: true },
    { id: 'sol',           name: 'Solar',        desc: 'Brilla como el mediodía.',        price: 1600, body: '#ffee58', wing: '#fbc02d', belly: '#fff9c4', beak: '#fb8c00', cheek: '#fff176', shine: true },
    { id: 'pantera',       name: 'Pantera',      desc: 'Rayas de silencio nocturno.',     price: 1300, body: '#37474f', wing: '#263238', belly: '#cfd8dc', beak: '#ff5252', cheek: '#607d8b', tiger: true },
    { id: 'lava',          name: 'Lava',         desc: 'Creada en el corazón del volcán.', price: 950,  body: '#e64a19', wing: '#bf360c', belly: '#ffe0b2', beak: '#ffd54f', cheek: '#ff8a65', shine: true },
    { id: 'nevado',        name: 'Copo',         desc: 'Suave como la nieve fresca.',     price: 600,  body: '#e3f2fd', wing: '#90caf9', belly: '#ffffff', beak: '#42a5f5', cheek: '#bbdefb', ice: true },
    /* ---- DESBLOQUES SEMANALES (2 por semana): AVES ---- */
    { id: 'choco',         name: 'Chocolate',     desc: 'Corazón de cacao puro.',         price: 400,  body: '#6d4c41', wing: '#4e342e', belly: '#efe4d8', beak: '#ff8f00', cheek: '#a1887f', blush: true, week: 1 },
    { id: 'menta',         name: 'Menta',         desc: 'Fresca y refrescante.',          price: 400,  body: '#81c784', wing: '#4caf50', belly: '#e8f5e9', beak: '#388e3c', cheek: '#c8e6c9', ice: true,  week: 1 },
    { id: 'zen',           name: 'Zen',           desc: 'Paz interior y alas.',           price: 500,  body: '#90a4ae', wing: '#78909c', belly: '#eceff1', beak: '#546e7a', cheek: '#b0bec5', shine: true, week: 6 },
    { id: 'fruta',         name: 'Fruta Exótica', desc: 'Sabor tropical directo.',        price: 500,  body: '#ffb74d', wing: '#fb8c00', belly: '#fff3e0', beak: '#e53935', cheek: '#ffcc80', sparkle: true, week: 6 },
    { id: 'dragon',        name: 'Dragón',        desc: 'Escamas de campeón.',            price: 700,  body: '#e57373', wing: '#d32f2f', belly: '#ffcdd2', beak: '#c62828', cheek: '#ef9a9a', tiger: true, week: 11 },
    { id: 'pingu',         name: 'Pingüino',      desc: 'Elegante en el hielo.',          price: 700,  body: '#37474f', wing: '#263238', belly: '#ffffff', beak: '#ffb300', cheek: '#eceff1', ice: true, week: 11 },
    { id: 'unic',          name: 'Unicornio',     desc: 'Brillo de arcoíris.',            price: 800,  body: '#f8bbd0', wing: '#f48fb1', belly: '#fce4ec', beak: '#ffd54f', cheek: '#f8bbd0', sparkle: true, week: 15 },
    { id: 'abeja',         name: 'Abejita',       desc: 'Zumba como una flor.',           price: 650,  body: '#ffe082', wing: '#ffb300', belly: '#fff8e1', beak: '#4e342e', cheek: '#ffca28', tiger: true, week: 15 },
    { id: 'luxo',          name: 'Lujo',          desc: 'Solo oro y más oro.',            price: 1300, body: '#ffca28', wing: '#ff8f00', belly: '#fff9c4', beak: '#8d6e63', cheek: '#ffe082', shine: true, week: 19 },
    { id: 'fenix',         name: 'Fénix',         desc: 'Renace entre las llamas.',       price: 1200, body: '#ff7043', wing: '#e64a19', belly: '#ffe0b2', beak: '#ffd54f', cheek: '#ffab91', shine: true, week: 19 },
    { id: 'elfo',          name: 'Elfo',          desc: 'Ayudante de los regalos.',       price: 600,  body: '#66bb6a', wing: '#43a047', belly: '#e8f5e9', beak: '#6d4c41', cheek: '#a5d6a7', blush: true, week: 23 },
    { id: 'robotx',        name: 'Robo-X',        desc: 'La unidad definitiva.',          price: 1000, body: '#263238', wing: '#37474f', belly: '#cfd8dc', beak: '#00e5ff', cheek: '#78909c', nebula: true, week: 23 },
    /* ---- OLEADA 2027: más aves (semanas 27-29) ---- */
    { id: 'jaguar',       name: 'Jaguar',        desc: 'Realeza de la selva.',           price: 1000, body: '#ffb300', wing: '#e65100', belly: '#fff3e0', beak: '#37474f', cheek: '#ffe082', tiger: true, week: 27 },
    { id: 'nube',         name: 'Nubecita',      desc: 'Flota suave en el cielo.',       price: 700,  body: '#e3f2fd', wing: '#bbdefb', belly: '#ffffff', beak: '#90a4ae', cheek: '#e1f5fe', ice: true, week: 27 },
    { id: 'rana',         name: 'Ranita',        desc: 'Brinca de hoja en hoja.',        price: 550,  body: '#8bc34a', wing: '#689f38', belly: '#f1f8e9', beak: '#33691e', cheek: '#ffcc80', blush: true, week: 28 },
    { id: 'faro',         name: 'Faro',          desc: 'Guía entre la niebla.',          price: 850,  body: '#ffcc80', wing: '#ffa726', belly: '#fff8e1', beak: '#5d4037', cheek: '#ffb74d', shine: true, week: 28 },
    { id: 'marip',        name: 'Mariposín',     desc: 'Alas de mil colores.',           price: 900,  body: '#ce93d8', wing: '#ba68c8', belly: '#f3e5f5', beak: '#6a1b9a', cheek: '#e1bee7', rainbow: true, week: 29 },
    { id: 'sirena',       name: 'Sirena',        desc: 'Canta bajo el mar.',             price: 1100, body: '#4db6ac', wing: '#009688', belly: '#e0f2f1', beak: '#ffb300', cheek: '#80cbc4', sparkle: true, week: 29 },
    /* ---- OLEADA 2027: más aves (semanas 30-33) ---- */
    { id: 'koi',          name: 'Koi',           desc: 'Pececito dorado con alas.',      price: 900,  body: '#ffb74d', wing: '#ef6c00', belly: '#fff3e0', beak: '#37474f', cheek: '#ffcc80', sparkle: true, week: 30 },
    { id: 'sakura',       name: 'Sakura',        desc: 'Pétalos de cerezo al vuelo.',    price: 850,  body: '#f8bbd0', wing: '#f06292', belly: '#fce4ec', beak: '#ad1457', cheek: '#f8bbd0', blush: true,  week: 30 },
    { id: 'quetzal',      name: 'Quetzal',       desc: 'Plumas de jade real.',           price: 1100, body: '#26a69a', wing: '#00897b', belly: '#e0f2f1', beak: '#ffb300', cheek: '#4db6ac', sparkle: true, week: 31 },
    { id: 'zombie',       name: 'Pío Zombi',     desc: 'Regresa de la tumba a volar.',   price: 950,  body: '#7cb342', wing: '#558b2f', belly: '#dcedc8', beak: '#33691e', cheek: '#aed581', ghost: true, week: 31 },
    { id: 'astro',        name: 'Astronauta',    desc: 'Listo para el espacio.',         price: 1200, body: '#eceff1', wing: '#90a4ae', belly: '#ffffff', beak: '#546e7a', cheek: '#b0bec5', shine: true, week: 32 },
    { id: 'arandano',     name: 'Arándano',      desc: 'Pequeño y dulce.',               price: 650,  body: '#5c6bc0', wing: '#3949ab', belly: '#e8eaf6', beak: '#ff8f00', cheek: '#7986cb', sparkle: true, week: 32 },
    { id: 'pastel',       name: 'Pastelito',     desc: 'Relleno de crema y velitas.',    price: 800,  body: '#ffcc80', wing: '#ffb74d', belly: '#fff3e0', beak: '#8d6e63', cheek: '#f48fb1', blush: true, week: 33 },
    { id: 'rayo',         name: 'Rayo',          desc: 'Velocidad pura.',                price: 1000, body: '#fff176', wing: '#ffd600', belly: '#fffde7', beak: '#37474f', cheek: '#ffff00', tiger: true, week: 33 },
    /* ---- OLEADA "VAPOR": semanas 39-42 ---- */
    { id: 'cobre',    name: 'Cobre',      desc: 'Engranajes de latón.',        price: 950,  body: '#b87333', wing: '#8b5a2b', belly: '#e8c9a0', beak: '#5d4037', cheek: '#ffb74d', shine: true, week: 39 },
    { id: 'engranaje',name: 'Engranaje',  desc: 'Rueda dentada al vuelo.',     price: 1050, body: '#78909c', wing: '#546e7a', belly: '#cfd8dc', beak: '#37474f', cheek: '#ffab00', shine: true, week: 39 },
    { id: 'kraken',   name: 'Kraken',     desc: 'Ocho brazos de tinta.',       price: 1400, body: '#37474f', wing: '#263238', belly: '#80cbc4', beak: '#00bfa5', cheek: '#4dd0e1', ghost: true, week: 40 },
    { id: 'medusa',   name: 'Medusa',     desc: 'Pulso luminoso en el abismo.',price: 1150, body: '#7e57c2', wing: '#5e35b1', belly: '#e1bee7', beak: '#f8bbd0', cheek: '#ce93d8', sparkle: true, week: 40 },
    { id: 'trex',     name: 'T-Rex',      desc: 'Rugido de dos metros.',       price: 1600, body: '#66bb6a', wing: '#2e7d32', belly: '#c8e6c9', beak: '#fdd835', cheek: '#8d6e63', tiger: true, week: 41 },
    { id: 'trice',    name: 'Triceratops',desc: 'Tres cuernos, cero dudas.',   price: 1500, body: '#8d6e63', wing: '#5d4037', belly: '#d7ccc8', beak: '#ffe082', cheek: '#a1887f', blush: true,  week: 41 },
    { id: 'kitsune',  name: 'Kitsune',    desc: 'Nueve colas de fuego.',       price: 1450, body: '#ff7043', wing: '#d84315', belly: '#ffe0b2', beak: '#ffca28', cheek: '#ffab91', shine: true, week: 42 },
    { id: 'saiyo',    name: 'Saiyo',      desc: 'Seda al viento.',             price: 900,  body: '#f06292', wing: '#ad1457', belly: '#fce4ec', beak: '#fff59d', cheek: '#f8bbd0', blush: true,  week: 42 },
    /* ---- OLEADA "ANTIGUO": semanas 43-46 ---- */
    { id: 'escarab',  name: 'Escarabajo', desc: 'Ojo de Horus en el caparazón.',price: 1100, body: '#2e7d32', wing: '#1b5e20', belly: '#a5d6a7', beak: '#f9a825', cheek: '#ffd54f', shine: true, week: 43 },
    { id: 'esfinge',  name: 'Esfinge',    desc: 'Guardiana de mil años.',     price: 1650, body: '#d4a017', wing: '#a8790c', belly: '#f3e0b5', beak: '#4e342e', cheek: '#ffb300', shine: true, week: 43 },
    { id: 'valkiria', name: 'Valkiria',    desc: 'Elige quién cae.',           price: 1350, body: '#b0bec5', wing: '#78909c', belly: '#eceff1', beak: '#ff5252', cheek: '#e1bee7', sparkle: true, week: 44 },
    { id: 'cuervo',   name: 'Cuervo',     desc: 'Mensajero entre mundos.',    price: 1200, body: '#37474f', wing: '#1a237e', belly: '#7986cb', beak: '#ffab00', cheek: '#9fa8da', ghost: true, week: 44 },
    { id: 'saxo',     name: 'Saxofón',    desc: 'Nota golden en cada aleteo.',price: 1300, body: '#f9a825', wing: '#ef6c00', belly: '#fff3c0', beak: '#3e2723', cheek: '#ffca28', shine: true, week: 45 },
    { id: 'tamboril', name: 'Tamboril',   desc: 'Ritmo de Shalme.',           price: 1250, body: '#8d6e63', wing: '#5d4037', belly: '#d7ccc8', beak: '#ff7043', cheek: '#a1887f', blush: true,  week: 45 },
    { id: 'raquet',   name: 'Ráquet',     desc: 'Sin falta desde el tie-break.',price: 1000, body: '#c0ca33', wing: '#33691e', belly: '#f0f4c3', beak: '#ff6f00', cheek: '#dce775', shine: true, week: 46 },
    { id: 'bicis',    name: 'Ciclista',   desc: 'Pedalea contra el viento.',   price: 1050, body: '#0288d1', wing: '#01579b', belly: '#e1f5fe', beak: '#ff6d00', cheek: '#4fc3f7', blush: true,  week: 46 },
    /* ---- OLEADA "FAUNA": semanas 47-50 ---- */
    { id: 'libelula', name: 'Libélula',   desc: 'Cuatro alas de cristal.',    price: 1150, body: '#00bcd4', wing: '#0097a7', belly: '#e0f7fa', beak: '#ff6f00', cheek: '#4dd0e1', ice: true, week: 47 },
    { id: 'luciernaga',name: 'Luciérnaga', desc: 'Farol de la noche.',         price: 1250, body: '#33691e', wing: '#1b5e20', belly: '#dcedc8', beak: '#ffee58', cheek: '#ffeb3b', sparkle: true, week: 47 },
    { id: 'halcon',   name: 'Halcón',     desc: 'Vista de águila.',           price: 1700, body: '#5d4037', wing: '#3e2723', belly: '#d7ccc8', beak: '#ffb300', cheek: '#ff8f00', tiger: true, week: 48 },
    { id: 'milano',   name: 'Milano Real', desc: 'Planea sin aletear.',        price: 1300, body: '#6d4c41', wing: '#4e342e', belly: '#d7ccc8', beak: '#fdd835', cheek: '#a1887f', blush: true,  week: 48 },
    { id: 'cheesecake',name: 'Cheesecake',desc: 'Básico de la casa.',         price: 700,  body: '#ffe0b2', wing: '#ffcc80', belly: '#fff8e1', beak: '#8d6e63', cheek: '#f48fb1', blush: true, week: 49 },
    { id: 'macaron',  name: 'Macarón',    desc: 'Dulce por fuera, duro por dentro.',price: 750, body: '#f8bbd0', wing: '#f06292', belly: '#fff0f5', beak: '#ad1457', cheek: '#ce93d8', sparkle: true, week: 49 },
    { id: 'grifo',    name: 'Grifo',      desc: 'Cabeza de león, alas de águila.',price: 1800, body: '#d4a017', wing: '#8d6e63', belly: '#f3e0b5', beak: '#ff6f00', cheek: '#ffca28', shine: true, week: 50 },
    { id: 'ciclope',  name: 'Cíclope',    desc: 'Un ojo, mil Schottys.',      price: 1750, body: '#6d4c41', wing: '#4e342e', belly: '#d7ccc8', beak: '#ffee58', cheek: '#9ccc65', ghost: true, week: 50 }
  ];

  /* ---- RECOMPENSAS EXCLUSIVAS DEL PASE PRÉMIUM ----
   * Estos artículos NUNCA se venden en la tienda, ni salen en cajas.
   * Solo se obtienen reclamando la línea prémium del Pase de la temporada. */
  SKINS.push(
    { id: 'p-aurora', name: 'Aurora Polar', desc: 'Exclusiva del Pase Prémium: brilla con luz polar.', price: 0, exclusive: true, rarity: 'legendaria', body: '#7de3ff', wing: '#3aa0ff', belly: '#eaffff', beak: '#ffd54f', cheek: '#b3f0ff', sparkle: true, shine: true },
    { id: 'p-crono',  name: 'Cronos', desc: 'Exclusiva del Pase Prémium: el tiempo la obedece.', price: 0, exclusive: true, rarity: 'mítica', body: '#ffd54f', wing: '#ff8f00', belly: '#fff8e1', beak: '#ff6f00', cheek: '#ffe082', shine: true },
    { id: 'p-sombra', name: 'Sombra Real', desc: 'Exclusiva del Pase Prémium: nadie más la tiene.', price: 0, exclusive: true, rarity: 'épica', body: '#3b2f63', wing: '#241a45', belly: '#b39ddb', beak: '#ffd54f', cheek: '#7e57c2', ghost: true }
  );

  /* Atributos por ave: multiplicadores de vuelo (spd=velocidad del mundo, flap=aleteo, grav=caída, gap=hueco).
   Valores por defecto 1. Solo se listan las que difieren. */
  const SKIN_STATS = {
    night:   { spd: 0.98, grav: 0.92 },   // Ninja: cae más lento, más sigilosa
    robot:   { spd: 1.06 },               // Robo-Pío: unidad veloz
    oro:     { flap: 1.08 },              // Dorada: aleteo de campeón
    fantasma:{ grav: 0.9 },               // Fantasma: flota
    hada:    { grav: 0.96 },
    ice:     { gap: 1.06, grav: 0.98 },   // Glaciar: huecos más amplios
    nebula:  { gap: 1.05 },
    pantera: { spd: 1.04, grav: 0.95 },
    sol:     { spd: 1.05 },
    dragon:  { flap: 1.1 },
    abeja:   { grav: 0.97, flap: 1.05 },
    zen:     { gap: 1.05, grav: 0.97 },
    unic:    { flap: 1.05 },
    fenix:   { flap: 1.12 },              // Fénix: aletea más fuerte
    quetzal: { spd: 0.96 },
    astro:   { grav: 0.9 },
    koi:     { gap: 1.04 },
    rayo:    { spd: 1.1 },
    sakura:  { grav: 0.98 },
    lava:    { flap: 1.08 },
    nube:    { grav: 0.95, gap: 1.04 },
    /* ---- OLEADA "VAPOR": semanas 39-42 ---- */
    cobre:   { spd: 1.03, flap: 1.04 },
    engranaje:{ spd: 1.07, grav: 0.97 },
    kraken:  { gap: 1.07, grav: 0.93 },   // el hueco generoso
    medusa:  { grav: 0.9 },
    trex:    { flap: 1.14, spd: 0.94 },   // potente pero lenta
    trice:   { gap: 1.06 },
    kitsune: { flap: 1.09, spd: 1.03 },
    saiyo:   { grav: 0.96 },
    /* ---- OLEADA "ANTIGUO": semanas 43-46 ---- */
    escarab: { gap: 1.05, grav: 0.98 },
    esfinge: { grav: 0.92, spd: 1.02 },
    valkiria:{ flap: 1.07 },
    cuervo:  { spd: 1.08, grav: 0.95 },
    saxo:    { flap: 1.06 },
    tamboril:{ grav: 0.97 },
    raquet:  { flap: 1.08, grav: 0.96 },
    bicis:   { spd: 1.05 },
    /* ---- OLEADA "FAUNA": semanas 47-50 ---- */
    libelula:{ gap: 1.05, spd: 1.04 },
    luciernaga:{ grav: 0.92 },
    halcon:  { spd: 1.12, flap: 1.05 },   // el ave más rápida del juego
    milano:  { spd: 1.06, grav: 0.94 },
    cheesecake:{ gap: 1.05, grav: 0.95 },
    macaron: { grav: 0.98 },
    grifo:   { flap: 1.11, gap: 1.04 },
    ciclope: { flap: 1.1, grav: 0.94 },
    /* ---- EXCLUSIVAS DEL PASE PRÉMIUM ---- */
    'p-aurora': { gap: 1.05, grav: 0.93 },
    'p-crono':  { flap: 1.12, spd: 1.02 },
    'p-sombra': { spd: 1.06, grav: 0.94 }
  };
  const SKIN_STATS_DEF = { spd: 1, flap: 1, grav: 1, gap: 1 };
  function skinStats(id) { return Object.assign({}, SKIN_STATS_DEF, SKIN_STATS[id] || {}); }

  /* Variantes doradas: se consiguen (5%) al abrir una Caja Sorpresa (huevo) */
  function makeGold(base) {
    return {
      id: base.id + '-gold', name: 'Dorada ' + base.name,
      desc: 'Variante dorada de ' + base.name + ' · brilla con luz propia.',
      price: 0, body: '#ffd54f', wing: '#ffab00', belly: '#fff7cc', beak: '#ff8f00', cheek: '#ffca28',
      shine: true, golden: true, baseOf: base.id
    };
  }
  function boxDef() {
    return { name: 'Caja Sorpresa', price: ECONOMY.price(500), desc: 'Abre un huevo sorpresa: te lleva un ave, sombrero o estela que aún no tengas (5% de que salga una variante dorada con brillo ✨).' };
  }

  /* Evolución del ave: la XP acumulada al volar sube su etapa (1 → 2 → 3) */
  const SKIN_EVOLVE_XP = [0, 600, 1800];
  function evolveStage(xp) { return xp >= SKIN_EVOLVE_XP[2] ? 3 : xp >= SKIN_EVOLVE_XP[1] ? 2 : 1; }

  /* ---- NIDO (meta-juego: cada moneda ganada en vuelo añade un objeto decorativo) ---- */
  const NEST_MAX_OBJ = 48;
  const NEST_LEVELS = [
    { coins: 0, name: 'Ramas vacías' },
    { coins: 50, name: 'Nido' },
    { coins: 150, name: 'Nido de plumas' },
    { coins: 400, name: 'Nido acogedor' },
    { coins: 900, name: 'Mini-casita' },
    { coins: 1600, name: 'Casita del árbol' },
    { coins: 2600, name: 'Chalet de campo' },
    { coins: 4000, name: 'Mansión' },
    { coins: 6500, name: 'Castillo' },
    { coins: 10000, name: 'Palacio' }
  ];
  function nestInfo(co) {
    let i = 0;
    for (let k = NEST_LEVELS.length - 1; k >= 0; k--) { if (co >= NEST_LEVELS[k].coins) { i = k; break; } }
    const cur = NEST_LEVELS[i];
    const nxt = NEST_LEVELS[i + 1] || null;
    const pct = nxt ? Math.min(100, Math.round((co - cur.coins) / (nxt.coins - cur.coins) * 100)) : 100;
    const objCount = Math.min(NEST_MAX_OBJ, co);
    return { level: i, name: cur.name, coins: co, cur: cur, next: nxt, pct: pct, objCount: objCount };
  }
  /* posición pseudoaleatoria estable por objeto decorativo (mismo lugar cada frame) */
  function nestObjPos(i) {
    const a = (i * 137.508) % 360;
    const rr = 14 + (i % 9) * 5.5;
    const rad = a * Math.PI / 180;
    const wob = Math.sin(i * 12.9898) * 6;
    return { x: Math.cos(rad) * rr, y: Math.sin(rad) * rr * 0.62 + wob, t: i % 8 };
  }

  /* ---- CRÍA DE HUEVOS (incuban con tiempo real mientras no juegas) ---- */
  const EGGS = [
    { id: 'huevo-sencillo', name: 'Huevo Sencillo', price: 200, mins: 45, icon: '🥚',   desc: 'En 45 min te da un ave o una estela nueva.' },
    { id: 'huevo-fino',     name: 'Huevo Fino',     price: 450, mins: 120, icon: '🐣',   desc: 'En 2 h te da un ave o una estela nueva.' },
    { id: 'huevo-magico',   name: 'Huevo Mágico',   price: 900, mins: 300, icon: '⭐',   desc: 'En 5 h te da un ave o una estela nueva.' }
  ];
  function getEgg(id) { return EGGS.find(e => e.id === id) || null; }
  /* premios posibles de los huevos: aves o estelas que aún no tengas */
  function eggPool(save) {
    const s = save.get();
    const pool = [];
    SKINS.forEach(sk => { if (!save.owns(s.skinsOwned, sk.id)) pool.push({ kind: 'skin', item: sk }); });
    EFFECTS.forEach(f => { if (!save.owns(s.fxOwned, f.id)) pool.push({ kind: 'fx', item: f }); });
    return pool;
  }

  /* ---- DECORACIÓN DEL HOGAR (fondo, suelo, póster, alfombra) ---- */
  const DECOR = [
    { id: 'bg-cielo',    cat: 'bg',     name: 'Cielo azul',    price: 0,   bg1: '#7ec8ff', bg2: '#cdeeff', art: '☁️' },
    { id: 'bg-tarde',    cat: 'bg',     name: 'Atardecer',     price: 150, bg1: '#ff9a76', bg2: '#ffd9a0', art: '🌇' },
    { id: 'bg-noche',    cat: 'bg',     name: 'Noche',         price: 250, bg1: '#232a56', bg2: '#5a3d7a', art: '🌌' },
    { id: 'bg-bosque',   cat: 'bg',     name: 'Bosque',        price: 200, bg1: '#5fa86e', bg2: '#c9e8b0', art: '🌳' },
    { id: 'bg-aurora',   cat: 'bg',     name: 'Aurora',        price: 500, bg1: '#12355d', bg2: '#2e6b6b', art: '🌠' },
    { id: 'fl-pasto',    cat: 'floor',  name: 'Pasto',         price: 0,   bg1: '#5f9e4e', bg2: '#7fc968', art: '🌿' },
    { id: 'fl-madera',   cat: 'floor',  name: 'Madera',        price: 150, bg1: '#9a6a3f', bg2: '#b98a55', art: '🪵' },
    { id: 'fl-arena',    cat: 'floor',  name: 'Arena',         price: 120, bg1: '#ecd9a0', bg2: '#f2e6be', art: '🏖️' },
    { id: 'fl-nieve',    cat: 'floor',  name: 'Nieve',         price: 200, bg1: '#e8f4ff', bg2: '#ffffff', art: '❄️' },
    { id: 'fl-petalo',   cat: 'floor',  name: 'Pétalos',       price: 250, bg1: '#f7b7d0', bg2: '#fbd9e8', art: '🌸' },
    { id: 'po-estrella', cat: 'poster', name: 'Póster estrella', price: 100, bg1: '#3d3d6b', bg2: '#5a5a96', art: '⭐' },
    { id: 'po-corazon',  cat: 'poster', name: 'Póster corazón',  price: 100, bg1: '#7a3350', bg2: '#a54a72', art: '💖' },
    { id: 'po-corona',   cat: 'poster', name: 'Póster corona',   price: 150, bg1: '#6b5a1e', bg2: '#9a842f', art: '👑' },
    { id: 'po-trofeo',   cat: 'poster', name: 'Póster trofeo',   price: 200, bg1: '#2e5a6b', bg2: '#3f7d94', art: '🏆' },
    { id: 'po-fiesta',   cat: 'poster', name: 'Póster fiesta',   price: 250, bg1: '#5a2e6b', bg2: '#8a3fa5', art: '🎉' },
    { id: 'rug-nada',    cat: 'rug',    name: 'Sin alfombra',  price: 0,   bg1: '', bg2: '', art: '' },
    { id: 'rug-roja',    cat: 'rug',    name: 'Alfombra roja',  price: 150, bg1: '#b23a3a', bg2: '#d24a4a', art: '🔴' },
    { id: 'rug-azul',    cat: 'rug',    name: 'Alfombra azul',  price: 150, bg1: '#2f5f9e', bg2: '#3f7fbe', art: '🔵' },
    { id: 'rug-dorada',  cat: 'rug',    name: 'Alfombra dorada', price: 250, bg1: '#b08a1e', bg2: '#d0aa2f', art: '🟡' },
    { id: 'rug-magica',  cat: 'rug',    name: 'Alfombra mágica', price: 500, bg1: '#5a3fbe', bg2: '#7f5fd0', art: '🌀' }
  ];
  function getDecor(id) { return DECOR.find(d => d.id === id) || DECOR[0]; }
  function decorsByCat(cat) { return DECOR.filter(d => d.cat === cat); }

  const HATS = [
    { id: 'hat-crown',    name: 'Corona',        price: 400,  type: 'crown' },
    { id: 'hat-xmas',     name: 'Gorro Navideño', price: 300, type: 'xmas' },
    { id: 'hat-cowboy',   name: 'Sombrero Vaquero', price: 300, type: 'cowboy' },
    { id: 'hat-head',     name: 'Audífonos',     price: 350,  type: 'headphones' },
    { id: 'hat-halo',     name: 'Halo',          price: 450,  type: 'halo' },
    { id: 'hat-party',    name: 'Sombrerito Fiesta', price: 250, type: 'party' },
    { id: 'hat-prop',     name: 'Hélice',        price: 500,  type: 'propeller' },
    { id: 'hat-pirate',   name: 'Sombrero Pirata', price: 550, type: 'piracy' },
    { id: 'hat-flower',   name: 'Florcita',      price: 200,  type: 'flower' },
    { id: 'hat-cool',     name: 'Gorro de Noche', price: 320, type: 'bonnet' },
    { id: 'hat-ears',     name: 'Orejitas de Gato', price: 220, type: 'ears' },
    { id: 'hat-mushroom', name: 'Champiñón',        price: 280, type: 'mushroom' },
    { id: 'hat-wizard',   name: 'Gorro de Mago',    price: 420, type: 'wizard' },
    { id: 'hat-star',     name: 'Estrella',         price: 350, type: 'star' },
    { id: 'hat-band',     name: 'Cinta Deportiva',  price: 150, type: 'band' },
    { id: 'hat-house',    name: 'Casita',           price: 500, type: 'house' },
    { id: 'hat-antenna',  name: 'Antena',           price: 180, type: 'antenna' },
    { id: 'hat-bow',      name: 'Lazo',             price: 160, type: 'bow' },
    { id: 'hat-vr',       name: 'Gafas Neón 2026',  price: 550, type: 'vr' },
    /* ---- DESBLOQUES SEMANALES (2 por semana): SOMBREROS ---- */
    { id: 'hat-tigrito',   name: 'Orejitas Tigre',   price: 260, type: 'ears',    week: 2 },
    { id: 'hat-duende',    name: 'Gorrito Duende',   price: 300, type: 'xmas',    week: 2 },
    { id: 'hat-fuego',     name: 'Diadema de Fuego', price: 480, type: 'crown',   week: 7 },
    { id: 'hat-almohada',  name: 'Almohadita',       price: 340, type: 'bonnet',  week: 7 },
    { id: 'hat-punk',      name: 'Cresta Punk',      price: 320, type: 'antenna', week: 12 },
    { id: 'hat-avion',     name: 'Avioncito',        price: 420, type: 'propeller', week: 12 },
    { id: 'hat-girasol',   name: 'Girasol',          price: 280, type: 'flower',  week: 16 },
    { id: 'hat-estrellita', name: 'Estrellita',      price: 300, type: 'star',    week: 16 },
    { id: 'hat-banda2',    name: 'Cinta Campeón',    price: 200, type: 'band',    week: 20 },
    { id: 'hat-capitan',   name: 'Gorra Capitán',    price: 440, type: 'piracy',  week: 20 },
    { id: 'hat-luces',     name: 'Luces de Feria',   price: 360, type: 'party',   week: 24 },
    { id: 'hat-vaquerox',  name: 'Rancho Élite',     price: 380, type: 'cowboy',  week: 24 },
    /* ---- OLEADA 2027: más sombreros (semanas 27-28) ---- */
    { id: 'hat-cuernos',   name: 'Cuernos de Dragón', price: 500, type: 'crown',   week: 27 },
    { id: 'hat-bandana',   name: 'Bandana Pirata',    price: 320, type: 'piracy',  week: 27 },
    { id: 'hat-huevo',     name: 'Caja Sorpresa',     price: 300, type: 'party',   week: 28 },
    { id: 'hat-pin',       name: 'Pasador de Luz',    price: 280, type: 'star',    week: 28 },
    /* ---- OLEADA 2027: más sombreros (semanas 34-35) ---- */
    { id: 'hat-brujo',     name: 'Sombrero de Brujo', price: 450, type: 'wizard',  week: 34 },
    { id: 'hat-setas',     name: 'Honguito',          price: 420, type: 'mushroom', week: 35 },
    /* ---- OLEADA 2027: más sombreros (semanas 29-33) ---- */
    { id: 'hat-cinta',    name: 'Cinta de Vuelo',     price: 180, type: 'band',     week: 29 },
    { id: 'hat-cometa',   name: 'Gorro Cometa',       price: 340, type: 'bonnet',   week: 29 },
    { id: 'hat-lentes',   name: 'Anteojos Redondos',  price: 300, type: 'vr',       week: 30 },
    { id: 'hat-tiara',    name: 'Tiara Lunar',        price: 450, type: 'crown',    week: 30 },
    { id: 'hat-bufanda',  name: 'Bufanda Roja',       price: 260, type: 'bonnet',   week: 31 },
    { id: 'hat-real',     name: 'Corona Real',        price: 550, type: 'crown',    week: 31 },
    { id: 'hat-arco',     name: 'Arco Floral',        price: 280, type: 'flower',   week: 32 },
    { id: 'hat-vela',     name: 'Velita de Cumple',   price: 300, type: 'party',    week: 32 },
    { id: 'hat-farol',    name: 'Farol Mágico',       price: 360, type: 'star',     week: 33 },
    { id: 'hat-yelmo',    name: 'Yelmo Dorado',       price: 500, type: 'crown',    week: 33 },
    /* ---- OLEADA "VAPOR→FAUNA": más sombreros (semanas 39-46) ---- */
    { id: 'hat-gorra-vapor', name: 'Gorra Chula',   price: 320, type: 'bonnet',   week: 39 },
    { id: 'hat-anzuelo',     name: 'Anzuelo',       price: 380, type: 'star',     week: 39 },
    { id: 'hat-coral',       name: 'Corona de Coral',price: 520, type: 'crown',   week: 40 },
    { id: 'hat-medusa',      name: 'Campana de Medusa',price: 460, type: 'bonnet', week: 40 },
    { id: 'hat-dino',        name: 'Colmillo',      price: 400, type: 'horns',   week: 41 },
    { id: 'hat-pluma-oro',   name: 'Penacho Dorado',price: 500, type: 'star',     week: 41 },
    { id: 'hat-mascara',     name: 'Máscara Kitsune',price: 480, type: 'mask',    week: 42 },
    { id: 'hat-samurai',     name: 'Kabura',        price: 620, type: 'helmet',   week: 42 },
    { id: 'hat-nemes',       name: 'Nemes',         price: 540, type: 'helmet',   week: 43 },
    { id: 'hat-ancla',      name: 'Ancla',         price: 420, type: 'antenna',  week: 43 },
    { id: 'hat-ala',         name: 'Alas',          price: 480, type: 'ears',     week: 44 },
    { id: 'hat-narval',      name: 'Colmillo',      price: 440, type: 'horns',    week: 44 },
    { id: 'hat-sombrero-f',  name: 'Faja',          price: 300, type: 'band',     week: 45 },
    { id: 'hat-antena2',     name: 'Antena Doble',  price: 340, type: 'antenna',  week: 45 },
    { id: 'hat-visera',      name: 'Visera',        price: 560, type: 'helmet',   week: 46 },
    { id: 'hat-turbante',    name: 'Turbante',      price: 600, type: 'wizard',   week: 46 }
  ];
  HATS.push(
    { id: 'hat-corona-eterna', name: 'Corona Eterna', price: 0, exclusive: true, rarity: 'legendaria', type: 'crown' },
    { id: 'hat-sello-estelar', name: 'Sello Estelar', price: 0, exclusive: true, rarity: 'épica', type: 'halo' }
  );

  const EFFECTS = [
    { id: 'fx-none',   name: 'Sin estela',      price: 0,    color: null },
    { id: 'fx-marip',  name: 'Estela Dorada',   price: 250,  color: '#ffd54f' },
    { id: 'fx-flame',  name: 'Estela de Fuego', price: 450,  color: '#ff7043' },
    { id: 'fx-cyan',   name: 'Estela Cósmica',  price: 400,  color: '#29b6f6' },
    { id: 'fx-rosado', name: 'Estela Rosa',     price: 300,  color: '#ff8fd4' },
    { id: 'fx-verde',  name: 'Estela Mágica',   price: 350,  color: '#69f0ae' },
    { id: 'fx-star',   name: 'Polvo de Estrellas', price: 800, color: '#fff9c4', stars: true },
    { id: 'fx-vaper',  name: 'Estela Oscura',   price: 500,  color: '#b39ddb' },
    { id: 'fx-galaxy', name: 'Estela Galaxia',   price: 950,  color: '#7e57c2', stars: true },
    { id: 'fx-neon',   name: 'Estela Neón',      price: 650,  color: '#22e4ff' },
    { id: 'fx-perla',  name: 'Estela Perla',     price: 1000, color: '#b2dfdb', stars: true },
    { id: 'fx-burbuja', name: 'Burbujas',        price: 750,  color: '#7ff3ff' },
    { id: 'fx-laser',  name: 'Láser',            price: 550,  color: '#eeff41' },
    { id: 'fx-oro',    name: 'Estela 24k',       price: 1200, color: '#c8910f', stars: true },
    { id: 'fx-llama',  name: 'Llama Viva',       price: 350,  color: '#ff7043' },
    { id: 'fx-mistico', name: 'Brillo Místico',   price: 550,  color: '#ce93d8', stars: true },
    { id: 'fx-arcoiris', name: 'Arcoíris',        price: 750,  color: '#ffca28', rainbow: true },
    /* ---- DESBLOQUES SEMANALES (2 por semana): ESTELAS ---- */
    { id: 'fx-miel',   name: 'Melaza',          price: 300,  color: '#ffab00', week: 3 },
    { id: 'fx-lava',   name: 'Lava Viva',       price: 450,  color: '#ff3d00', stars: true, week: 3 },
    { id: 'fx-cielo',  name: 'Cielo Abierto',   price: 350,  color: '#4fc3f7', stars: true, week: 8 },
    { id: 'fx-nevada', name: 'Nieve',           price: 400,  color: '#e0f7fa', week: 8 },
    { id: 'fx-limo',   name: 'Limonada',        price: 350,  color: '#aed581', week: 13 },
    { id: 'fx-manga',  name: 'Anime',           price: 500,  color: '#ff80ab', rainbow: true, week: 13 },
    { id: 'fx-cristal', name: 'Cristal',        price: 700,  color: '#b2dfdb', stars: true, week: 17 },
    { id: 'fx-uv',     name: 'Ultravioleta',    price: 600,  color: '#651fff', week: 17 },
    { id: 'fx-pixel',  name: 'Píxel',           price: 550,  color: '#64ffda', stars: true, week: 21 },
    { id: 'fx-canela', name: 'Canela',          price: 400,  color: '#a1887f', week: 21 },
    { id: 'fx-galactico', name: 'Galáctico',    price: 900,  color: '#00e5ff', stars: true, week: 25 },
    { id: 'fx-coral',  name: 'Coral',           price: 500,  color: '#ff7043', stars: true, week: 25 },
    /* ---- OLEADA 2027: más estelas (semanas 29-30) ---- */
    { id: 'fx-dragon', name: 'Fuego de Dragón', price: 850,  color: '#ff5722', stars: true, week: 29 },
    { id: 'fx-sirena', name: 'Espuma de Mar',   price: 650,  color: '#4dd0e1', week: 29 },
    { id: 'fx-neonx',  name: 'Neón Ciber',      price: 750,  color: '#00e676', stars: true, week: 30 },
    { id: 'fx-nubes',  name: 'Algodón',         price: 400,  color: '#ffffff', week: 30 },
    /* ---- OLEADA 2027: más estelas (semanas 34-36) ---- */
    { id: 'fx-magma', name: 'Lava',              price: 800,  color: '#ff6d00', stars: true, week: 34 },
    { id: 'fx-cometa', name: 'Cola de Cometa',   price: 700,  color: '#69f0ae', stars: true, week: 36 },
    /* ---- OLEADA 2027: más estelas (semanas 31-33 y 37-38) ---- */
    { id: 'fx-koi',   name: 'Escamas Koi',       price: 650,  color: '#ffb74d', stars: true, week: 31 },
    { id: 'fx-petalo', name: 'Pétalos',          price: 500,  color: '#f48fb1', week: 31 },
    { id: 'fx-sol',   name: 'Destellos Solares', price: 700,  color: '#fff176', stars: true, week: 32 },
    { id: 'fx-chispa', name: 'Chispas',          price: 550,  color: '#ffd600', week: 32 },
    { id: 'fx-lunar', name: 'Polvo Lunar',       price: 600,  color: '#e1bee7', stars: true, week: 33 },
    { id: 'fx-brisa', name: 'Brisa',             price: 450,  color: '#81d4fa', week: 33 },
    { id: 'fx-hielo', name: 'Estela Helada',     price: 750,  color: '#b3e5fc', stars: true, week: 37 },
    { id: 'fx-real',  name: 'Estela Real',       price: 900,  color: '#ffca28', stars: true, week: 38 },
    /* ---- OLEADA "VAPOR→FAUNA": más estelas (semanas 39-46) ---- */
    { id: 'fx-algodoncillo', name: 'Pétalos',        price: 550,  color: '#ffab91', week: 39 },
    { id: 'fx-burbujas2',    name: 'Espuma',         price: 600,  color: '#b2ebf2', week: 39 },
    { id: 'fx-cobre',        name: 'Herrumbre',      price: 700,  color: '#b87333', week: 40 },
    { id: 'fx-algas',        name: 'Algas',          price: 550,  color: '#66bb6a', week: 40 },
    { id: 'fx-ojo',          name: 'Ojo de Horus',   price: 800,  color: '#00acc1', stars: true, week: 41 },
    { id: 'fx-bronce',       name: 'Bronce Antiguo', price: 750,  color: '#a1887f', week: 41 },
    { id: 'fx-pua',          name: 'Púa',            price: 650,  color: '#ff6f00', stars: true, week: 42 },
    { id: 'fx-sello',        name: 'Sello Rojo',     price: 700,  color: '#d32f2f', week: 42 },
    { id: 'fx-nomadas',      name: 'Dunas',          price: 600,  color: '#ffcc80', week: 43 },
    { id: 'fx-teal',         name: 'Verde Ámbar',    price: 650,  color: '#ffd54f', stars: true, week: 43 },
    { id: 'fx-ambar',        name: 'Ámbar',          price: 700,  color: '#ffab00', week: 44 },
    { id: 'fx-ascuas',       name: 'Ascuas',         price: 750,  color: '#ff3d00', stars: true, week: 44 },
    { id: 'fx-holograma',    name: 'Holograma',      price: 950,  color: '#18ffff', rainbow: true, week: 45 },
    { id: 'fx-neon2',        name: 'Circuito',       price: 850,  color: '#76ff03', stars: true, week: 45 },
    { id: 'fx-pluma',        name: 'Pluma',          price: 500,  color: '#eceff1', week: 46 },
    { id: 'fx-vapor',        name: 'Vapor',          price: 450,  color: '#cfd8dc', week: 46 }
  ];
  EFFECTS.push(
    { id: 'fx-prisma',    name: 'Prisma Prémium', price: 0, exclusive: true, rarity: 'legendaria', color: '#b388ff', rainbow: true, stars: true },
    { id: 'fx-supernova', name: 'Supernova',      price: 0, exclusive: true, rarity: 'mítica',     color: '#ffd54f', stars: true }
  );

  const MAPS = [
    { id: 'day',        name: 'Día Soleado',   icon: '🌞', price: 0,    minScore: 0,   unlock: null,  sky: ['#6ec6ff', '#d4f2ff'], ground: '#7cba55', hill1: '#8fce63', hill2: '#a9dc87', cloud: '#ffffff', stars: false, bubbles: false, grid: false, pipe: '#5fae43', pipeRim: '#3e8e2f', accent: '#ffd54f' },
    { id: 'sunset',     name: 'Atardecer',     icon: '🌇', price: 350,  minScore: 10,  unlock: 'coins', sky: ['#ff9a8b', '#ff6a88'], ground: '#a4686f', hill1: '#b57a80', hill2: '#c98f94', cloud: '#ffe3d6', stars: false, bubbles: false, grid: false, pipe: '#9c5f6a', pipeRim: '#80434e', accent: '#ffd166' },
    { id: 'night',      name: 'Noche Estrellada', icon: '🌙', price: 500, minScore: 25, unlock: 'coins', sky: ['#1a2254', '#35407a'], ground: '#2c4a63', hill1: '#365b6e', hill2: '#43727f', cloud: '#5b6a94', stars: true,  bubbles: false, grid: false, pipe: '#3d7ea8', pipeRim: '#2c5f85', accent: '#ffe066' },
    { id: 'space',      name: 'Espacio Profundo', icon: '🚀', price: 900, minScore: 45, unlock: 'coins', sky: ['#050816', '#141242'], ground: '#2a2c5a', hill1: '#34376b', hill2: '#40427d', cloud: '#20224a', stars: true,  bubbles: false, grid: false, pipe: '#5e3f9e', pipeRim: '#472f80', accent: '#7ee0ff' },
    { id: 'neon',       name: 'Sintetizador',  icon: '🎧', price: 700,  minScore: 30,  unlock: 'coins', sky: ['#16003d', '#3a0ca3'], ground: '#12065c', hill1: '#1d0f6e', hill2: '#281482', cloud: '#2a0f77', stars: true,  bubbles: false, grid: true,  pipe: '#ff5f9e', pipeRim: '#c22e8a', accent: '#22e4ff' },
    { id: 'water',      name: 'Fondo del Mar', icon: '🐠', price: 600,  minScore: 20,  unlock: 'coins', sky: ['#7fd8df', '#0f8f9c'], ground: '#2f9e78', hill1: '#3dab8a', hill2: '#4bb79a', cloud: '#bff4ee', stars: false, bubbles: true,  grid: false, pipe: '#2e8f7a', pipeRim: '#1d6f5f', accent: '#ffe066' },
    { id: 'forest',     name: 'Bosque Encantado', icon: '🌲', price: 400, minScore: 15, unlock: 'coins', sky: ['#a5d662', '#e6f5c8'], ground: '#5f8b3a', hill1: '#6f9d49', hill2: '#80ae5b', cloud: '#f2fae0', stars: false, bubbles: true,  grid: false, pipe: '#4d7c33', pipeRim: '#3a611f', accent: '#ffd54f' },
    { id: 'tundra',     name: 'Tundra Blanca', icon: '❄️', price: 500,  minScore: 22,  unlock: 'coins', sky: ['#cfe3f2', '#eef7fd'], ground: '#dbe7ee', hill1: '#cfdfe9', hill2: '#e3ebf1', cloud: '#ffffff', stars: false, bubbles: false, grid: false, pipe: '#a8c4dc', pipeRim: '#7fa4c4', accent: '#7bd8f6' },
    { id: 'candy',      name: 'Tierra de Dulces', icon: '🍭', price: 450, minScore: 18,  unlock: 'coins', sky: ['#ffd6e8', '#ffe9f5'], ground: '#f4a7c8', hill1: '#ffb9d5', hill2: '#ffcfe3', cloud: '#ffffff', stars: false, bubbles: true,  grid: false, pipe: '#ff9ec3', pipeRim: '#e0679c', accent: '#ffffff' },
    { id: 'volcano',    name: 'Volcán',          icon: '🌋', price: 750, minScore: 35,  unlock: 'coins', sky: ['#2d1b1b', '#6b2d28'], ground: '#5d4037', hill1: '#6d4c41', hill2: '#795548', cloud: 'rgba(255,255,255,0.6)', stars: true,  bubbles: false, grid: false, pipe: '#8d5a45', pipeRim: '#6b3f2e', accent: '#ffab40' },
    { id: 'primavera', name: 'Cerezos',         icon: '🌸', price: 550, minScore: 26,  unlock: 'coins', sky: ['#ffd6ef', '#fff0f7'], ground: '#f2a7c4', hill1: '#f7bcd4', hill2: '#fbcfdf', cloud: '#ffffff', stars: false, bubbles: true,  grid: false, pipe: '#e88fb3', pipeRim: '#c05a8f', accent: '#ff80ab' },
    { id: 'desierto',  name: 'Desierto',        icon: '🏜️', price: 600, minScore: 28,  unlock: 'coins', sky: ['#ffd180', '#ffe8c0'], ground: '#e0b57c', hill1: '#eac189', hill2: '#f0cf9d', cloud: '#fff3e0', stars: false, bubbles: false, grid: false, pipe: '#c88e4f', pipeRim: '#a86f34', accent: '#ffcd70' },
    { id: 'cyber',     name: 'Cyberpunk',       icon: '🌃', price: 1100, minScore: 60, unlock: 'coins', sky: ['#0b0531', '#2a1a6e'], ground: '#140a45', hill1: '#1d1058', hill2: '#281a70', cloud: '#2a0f77', stars: true,  bubbles: false, grid: true,  pipe: '#00e5ff', pipeRim: '#0091b3', accent: '#ff2ec4' },
    { id: 'arcade',     name: 'Retro Arcade',     icon: '🕹️', price: 900, minScore: 50, unlock: 'coins', sky: ['#12002b', '#3d0a91'], ground: '#1d0f6e', hill1: '#28127f', hill2: '#331896', cloud: '#2a0f77', stars: true,  bubbles: false, grid: true, pipe: '#ff2e88', pipeRim: '#b3145e', accent: '#00e5ff' },
    { id: 'volt',      name: 'Alta Tensión',      icon: '⚡', price: 800, minScore: 42, unlock: 'coins', sky: ['#0b1d3a', '#1e3a8a'], ground: '#143a66', hill1: '#1d4a78', hill2: '#255a8a', cloud: '#3b6ea8', stars: false, bubbles: false, grid: true, pipe: '#39ff14', pipeRim: '#00b8a9', accent: '#ffe600' },
    /* ---- DESBLOQUES SEMANALES (2 por semana): MAPAS ---- */
    { id: 'nevadoM',   name: 'Noche Polar',     icon: '❄️', price: 700, minScore: 38, unlock: 'coins', sky: ['#0e2a47', '#1b3f6e'], ground: '#2e5d86', hill1: '#3a6f9c', hill2: '#4880ad', cloud: '#3b6ea8', stars: true,  bubbles: false, grid: false, pipe: '#3d7ea8', pipeRim: '#2c5f85', accent: '#7bd8f6', week: 5 },
    { id: 'selva',    name: 'Selva Tropical',  icon: '🌴', price: 650, minScore: 34, unlock: 'coins', sky: ['#0e7a4b', '#2ecc71'], ground: '#2f6e4e', hill1: '#3d7e5f', hill2: '#4b8f6f', cloud: '#e0f7e9', stars: false, bubbles: true,  grid: false, pipe: '#2e8f5e', pipeRim: '#1d6f45', accent: '#ffd54f', week: 5 },
    { id: 'playa',    name: 'Playa',           icon: '🏖️', price: 600, minScore: 30, unlock: 'coins', sky: ['#7ed7ff', '#d9f6ff'], ground: '#f6d18a', hill1: '#ffdf9e', hill2: '#ffe9bc', cloud: '#ffffff', stars: false, bubbles: true,  grid: false, pipe: '#e6a756', pipeRim: '#c07e2e', accent: '#ffffff', week: 10 },
    { id: 'ciudad',   name: 'Ciudad',          icon: '🏙️', price: 800, minScore: 44, unlock: 'coins', sky: ['#20263f', '#39406b'], ground: '#2c2f42', hill1: '#383b52', hill2: '#454863', cloud: '#4c5478', stars: false, bubbles: false, grid: true,  pipe: '#8ea3ff', pipeRim: '#5a72cf', accent: '#8ea3ff', week: 10 },
    { id: 'magia',    name: 'Bosque Mágico',   icon: '🪄', price: 900, minScore: 48, unlock: 'coins', sky: ['#2a1a5e', '#4c2a8a'], ground: '#443a7a', hill1: '#52448f', hill2: '#6150a3', cloud: '#6a5fb8', stars: true,  bubbles: true,  grid: false, pipe: '#8a6fe8', pipeRim: '#5f42c8', accent: '#ffd54f', week: 14 },
    { id: 'glitch',   name: 'Glitch',          icon: '👾', price: 950, minScore: 52, unlock: 'coins', sky: ['#0d0221', '#301934'], ground: '#1d0f3a', hill1: '#2a1248', hill2: '#37165a', cloud: '#3d1b66', stars: true,  bubbles: false, grid: true,  pipe: '#39ff14', pipeRim: '#00e5ff', accent: '#ff00c8', week: 14 },
    { id: 'aurora',   name: 'Aurora',          icon: '🌠', price: 1000, minScore: 55, unlock: 'coins', sky: ['#0b1420', '#1b4a3a'], ground: '#1e3a2f', hill1: '#2a4a3c', hill2: '#365b4a', cloud: '#2f4f43', stars: true,  bubbles: false, grid: false, pipe: '#5bdc7e', pipeRim: '#2ea85a', accent: '#69f0ae', week: 18 },
    { id: 'tormenta', name: 'Tormenta',        icon: '⛈️', price: 850, minScore: 46, unlock: 'coins', sky: ['#3a3f47', '#5d6570'], ground: '#4a5058', hill1: '#585f68', hill2: '#676f78', cloud: '#5d6570', stars: false, bubbles: false, grid: true,  pipe: '#ffd54f', pipeRim: '#b8860b', accent: '#ffe082', week: 18 },
    { id: 'rubi',     name: 'Rubí',            icon: '💎', price: 1100, minScore: 60, unlock: 'coins', sky: ['#2b0f14', '#5a1f2b'], ground: '#3a1520', hill1: '#4b1c2a', hill2: '#5c2335', cloud: '#6b2a3d', stars: true,  bubbles: false, grid: false, pipe: '#ff5f8f', pipeRim: '#c22e5e', accent: '#ff80ab', week: 22 },
    { id: 'esmeralda', name: 'Esmeralda',      icon: '🔮', price: 1100, minScore: 62, unlock: 'coins', sky: ['#0f2b1f', '#1d4d38'], ground: '#1e4030', hill1: '#2a5040', hill2: '#366050', cloud: '#2a5040', stars: false, bubbles: true,  grid: false, pipe: '#34e07c', pipeRim: '#1aa05c', accent: '#69f0ae', week: 22 },
    /* ---- OLEADA 2027: más mapas (semanas 31-33) ---- */
    { id: 'luna',    name: 'Luna',            icon: '🌖', price: 1000, minScore: 58, unlock: 'coins', sky: ['#0a0e2a', '#232b56'], ground: '#2e3560', hill1: '#3a4170', hill2: '#464d80', cloud: '#4a5188', stars: true,  bubbles: false, grid: false, pipe: '#6c7bd8', pipeRim: '#44509f', accent: '#ffe066', week: 31 },
    { id: 'cafe',    name: 'Café',            icon: '☕', price: 850,  minScore: 50, unlock: 'coins', sky: ['#4e342e', '#795548'], ground: '#4a3728', hill1: '#5a4432', hill2: '#6a533c', cloud: '#8d6e63', stars: false, bubbles: false, grid: false, pipe: '#8d5a45', pipeRim: '#6b3f2e', accent: '#ffcc80', week: 32 },
    { id: 'oceano',  name: 'Océano',          icon: '🌊', price: 950,  minScore: 54, unlock: 'coins', sky: ['#013a63', '#046a9b'], ground: '#1b4d6b', hill1: '#276084', hill2: '#337396', cloud: '#4d96b8', stars: false, bubbles: true,  grid: false, pipe: '#29a2cf', pipeRim: '#14708f', accent: '#a5e6ff', week: 33 },
    /* ---- OLEADA 2027: más mapas (semanas 34-36) ---- */
    { id: 'ruinas',  name: 'Ruinas Perdidas', icon: '🏺', price: 900,  minScore: 52, unlock: 'coins', sky: ['#3d2816', '#6b4423'], ground: '#4a2f16', hill1: '#584027', hill2: '#684f31', cloud: '#7a5c39', stars: false, bubbles: false, grid: false, pipe: '#9c7a5a', pipeRim: '#6f4f33', accent: '#ffe082', week: 34 },
    { id: 'pantano', name: 'Pantano',         icon: '🐊', price: 880,  minScore: 51, unlock: 'coins', sky: ['#1a2e1a', '#2c522e'], ground: '#274a26', hill1: '#335c31', hill2: '#3f6e3c', cloud: '#4c7a4f', stars: false, bubbles: true,  grid: false, pipe: '#4c7a4f', pipeRim: '#315030', accent: '#9ccc65', week: 35 },
    { id: 'cometa',  name: 'Cometa',          icon: '☄️', price: 1050, minScore: 60, unlock: 'coins', sky: ['#070a1a', '#1c2450'], ground: '#161d3a', hill1: '#212a52', hill2: '#2c386a', cloud: '#2c386a', stars: true,  bubbles: false, grid: false, pipe: '#5f6fd0', pipeRim: '#3b4297', accent: '#69f0ae', week: 36 },
    { id: 'cristal', name: 'Cristal Helado',  icon: '💎', price: 1150, minScore: 64, unlock: 'coins', sky: ['#0e1b3a', '#2b4a7a'], ground: '#3f5f8f', hill1: '#4c6f9f', hill2: '#5a80b0', cloud: '#aac4e0', stars: true,  bubbles: false, grid: true,  pipe: '#7fd0ff', pipeRim: '#3f8fd0', accent: '#a5e6ff', week: 37 },
    { id: 'fiesta', name: 'Fiesta de Luces',  icon: '🎉', price: 1200, minScore: 66, unlock: 'coins', sky: ['#1a0b2e', '#3d1666'], ground: '#2a1142', hill1: '#391956', hill2: '#482166', cloud: '#5b2f85', stars: true,  bubbles: false, grid: true,  pipe: '#ff5fd8', pipeRim: '#c22e9f', accent: '#ffe066', week: 38 },
    /* ---- OLEADA "VAPOR→FAUNA": más mapas (semanas 39-50) ---- */
    { id: 'vapor',    name: 'Ciudad de Vapor',  icon: '⚙️', price: 1250, minScore: 66, unlock: 'coins', sky: ['#3e2723', '#8d6e63'], ground: '#4e342e', hill1: '#5d4037', hill2: '#6d4c41', cloud: '#bcaaa4', stars: false, bubbles: false, grid: false, pipe: '#a1887f', pipeRim: '#795548', accent: '#ffb300', week: 39 },
    { id: 'abismo',   name: 'Fosa Abisal',     icon: '🦑', price: 1300, minScore: 68, unlock: 'coins', sky: ['#001b26', '#00405a'], ground: '#012a4a', hill1: '#013a63', hill2: '#01497a', cloud: '#4dd0e1', stars: true,  bubbles: true,  grid: false, pipe: '#00838f', pipeRim: '#006064', accent: '#80deea', week: 40 },
    { id: 'prehist',  name: 'Era Primordial',  icon: '🦖', price: 1280, minScore: 67, unlock: 'coins', sky: ['#ffca28', '#ff8f00'], ground: '#5d4037', hill1: '#6d4c41', hill2: '#795548', cloud: '#ffe0b2', stars: false, bubbles: false, grid: false, pipe: '#4caf50', pipeRim: '#2e7d32', accent: '#ffeb3b', week: 41 },
    { id: 'japon',    name: 'Pétalos de Ki',   icon: '⛩️', price: 1320, minScore: 69, unlock: 'coins', sky: ['#fce4ec', '#fff0f5'], ground: '#8e2449', hill1: '#ad1457', hill2: '#c2185b', cloud: '#ffffff', stars: false, bubbles: false, grid: false, pipe: '#d81b60', pipeRim: '#880e4f', accent: '#ffd54f', week: 42 },
    { id: 'egipto',   name: 'Egipto',          icon: '🏺', price: 1340, minScore: 70, unlock: 'coins', sky: ['#ffb300', '#ffe082'], ground: '#8d6e63', hill1: '#a1887f', hill2: '#bcaaa4', cloud: '#fff3e0', stars: false, bubbles: false, grid: false, pipe: '#c0a062', pipeRim: '#8d7348', accent: '#00bfa5', week: 43 },
    { id: 'viking',   name: 'Fjordo',          icon: '🛡️', price: 1300, minScore: 68, unlock: 'coins', sky: ['#37474f', '#78909c'], ground: '#263238', hill1: '#37474f', hill2: '#546e7a', cloud: '#b0bec5', stars: false, bubbles: false, grid: false, pipe: '#607d8b', pipeRim: '#455a64', accent: '#80cbc4', week: 44 },
    { id: 'carnaval', name: 'Carnaval',        icon: '🎭', price: 1260, minScore: 66, unlock: 'coins', sky: ['#ff1e88', '#7b1fa2'], ground: '#4a148c', hill1: '#6a1b9a', hill2: '#8e24aa', cloud: '#ffd54f', stars: false, bubbles: false, grid: false, pipe: '#ffca28', pipeRim: '#ff6f00', accent: '#00e5ff', week: 45 },
    { id: 'cathedral',name: 'Catedral',        icon: '⛪', price: 1360, minScore: 71, unlock: 'coins', sky: ['#1a237e', '#3949ab'], ground: '#283593', hill1: '#303f9f', hill2: '#3949ab', cloud: '#9fa8da', stars: true,  bubbles: false, grid: false, pipe: '#ffd700', pipeRim: '#c0a000', accent: '#ffe082', week: 46 },
    { id: 'selva2',   name: 'Canopy',          icon: '🌿', price: 1290, minScore: 67, unlock: 'coins', sky: ['#004d40', '#26a69a'], ground: '#1b5e20', hill1: '#2e7d32', hill2: '#388e3c', cloud: '#b2dfdb', stars: false, bubbles: true,  grid: false, pipe: '#2e7d32', pipeRim: '#1b5e20', accent: '#ccff90', week: 47 },
    { id: 'nocturno', name: 'Vuelo Nocturno',  icon: '🦉', price: 1330, minScore: 70, unlock: 'coins', sky: ['#0a0e27', '#1b1f3b'], ground: '#12162e', hill1: '#1a1f3a', hill2: '#232845', cloud: '#3a3f5c', stars: true,  bubbles: false, grid: false, pipe: '#4a4e69', pipeRim: '#2f334d', accent: '#ffe082', week: 48 },
    { id: 'dulce',    name: 'Reino de Azúcar', icon: '🍰', price: 1270, minScore: 66, unlock: 'coins', sky: ['#fff3e0', '#ffe0b2'], ground: '#e6a8c8', hill1: '#f0bcd4', hill2: '#f8d2e0', cloud: '#ffffff', stars: false, bubbles: true,  grid: false, pipe: '#f06292', pipeRim: '#ad1457', accent: '#fff59d', week: 49 },
    { id: 'mitologia',name: 'Sala de Dioses',  icon: '⚡', price: 1450, minScore: 75, unlock: 'coins', sky: ['#0d0033', '#4a148c'], ground: '#1a0033', hill1: '#25004d', hill2: '#310064', cloud: '#5e35b1', stars: true,  bubbles: false, grid: true,  pipe: '#ffd700', pipeRim: '#c0a000', accent: '#18ffff', week: 50 }
  ];
  /* Mapa exclusivo del Pase Prémium: cielo auroral, monedas dobles y rachas de viento. */
  MAPS.push({
    id: 'premium', name: 'Cielo Prémium', icon: '🌌', price: 0, exclusive: true, rarity: 'legendaria',
    minScore: 0, unlock: 'premium',
    sky: ['#07162e', '#2b1e5c'], ground: '#1b2a52', hill1: '#25396e', hill2: '#31498a', cloud: '#6f7fd8',
    stars: true, bubbles: false, grid: false, pipe: '#7de3ff', pipeRim: '#2e8fd0', accent: '#c7a6ff'
  });

  /* ---- MECÁNICAS POR MAPA ----
   * Cada escenario modifica de verdad la partida (no es solo decoración):
   * velocidad, gravedad, tamaño de hueco, frecuencia de tubos, valor de
   * monedas y viento lateral. Los valores se aplican en game.js. */
  const MAP_CFG_DEF = { speedMul: 1, gravMul: 1, gapMul: 1, spawnMul: 1, coinMul: 1, wind: false };
  const MAP_CFG = {
    day:        { coinMul: 1 },
    sunset:     { speedMul: 0.96, coinMul: 1.1 },
    night:      { gravMul: 0.92, gapMul: 0.97 },
    space:      { gravMul: 0.72, coinMul: 1.15 },
    luna:       { gravMul: 0.7, coinMul: 1.2 },
    neon:       { speedMul: 1.12, coinMul: 1.2 },
    cyber:      { speedMul: 1.16, coinMul: 1.25 },
    arcade:     { speedMul: 1.14, coinMul: 1.2 },
    volt:       { speedMul: 1.15, spawnMul: 0.95 },
    glitch:     { speedMul: 1.18, gapMul: 0.96 },
    water:      { gravMul: 0.82, speedMul: 0.92, coinMul: 1.1 },
    oceano:     { gravMul: 0.8, speedMul: 0.9, coinMul: 1.15 },
    abismo:     { gravMul: 0.78, speedMul: 0.88, coinMul: 1.25 },
    forest:     { gapMul: 1.04, coinMul: 1.1 },
    selva:      { gapMul: 1.05, coinMul: 1.15 },
    selva2:     { gapMul: 1.06, coinMul: 1.15 },
    tundra:     { gapMul: 0.94, gravMul: 0.95 },
    nevadoM:    { gapMul: 0.93, speedMul: 1.05 },
    cristal:    { gapMul: 0.92, coinMul: 1.2 },
    candy:      { coinMul: 1.5 },
    dulce:      { coinMul: 1.55 },
    volcano:    { speedMul: 1.1, spawnMul: 0.94, coinMul: 1.2 },
    prehist:    { speedMul: 1.12, spawnMul: 0.92, coinMul: 1.2 },
    tormenta:   { wind: true, speedMul: 1.06 },
    prisma:     { coinMul: 1.3 },
    desierto:   { speedMul: 1.04, gapMul: 0.98 },
    primavera:  { coinMul: 1.15 },
    ciudad:     { spawnMul: 0.95 },
    aurora:     { gapMul: 1.05, coinMul: 1.2 },
    premium:    { speedMul: 1.06, gravMul: 0.94, gapMul: 1.05, coinMul: 2, wind: true }
  };
  function mapCfg(id) { return Object.assign({}, MAP_CFG_DEF, MAP_CFG[id] || {}); }

  const TOOLS = [
    { id: 'tool-start',  key: 'start',     name: 'Arranque Estelar', icon: '✨', desc: 'Empieza con +5 pts (modo libre).',          price: 80 },
    { id: 'tool-magnet', key: 'magnet',    name: 'Imán Total',       icon: '🧲', desc: 'Atrapa monedas 7 s · más con mejoras.',        price: 100 },
    { id: 'tool-slow',   key: 'slow',      name: 'Crucero Lento',    icon: '⏳', desc: 'Cámara lenta 5 s · más con mejoras.',           price: 90 },
    { id: 'tool-coins',  key: 'coins',     name: 'Monedas Plus',     icon: '💰', desc: 'Monedas dobles 8 s · más con mejoras.',         price: 120 },
    { id: 'tool-boost',  key: 'boost',     name: 'Empuje Turbo',     icon: '🚀', desc: 'Empiezas con +3 pts (cualquier modo).',         price: 85 },
    { id: 'tool-luck',   key: 'luck',      name: 'Suerte',           icon: '🍀', desc: 'Todas las monedas valen +1 toda la partida.',  price: 110 },
    { id: 'tool-score',  key: 'score',     name: 'Puntos Plus',      icon: '🎯', desc: 'Cada tubo pasado da +1 punto extra.',           price: 95 },
    { id: 'tool-sprint', key: 'sprint',    name: 'Alas Ligeras',     icon: '🪽', desc: 'Caes un 15% más despacio toda la partida.',     price: 105 },
    { id: 'tool-treasure', key: 'treasure', name: 'Tesoro Cercano',  icon: '💎', desc: 'Robas +6 🪙 y +1 pt al instante.',             price: 90 },
    { id: 'tool-clock',  key: 'clock',     name: 'Reloj Estelar',    icon: '⏱', desc: 'Congela la dificultad 5 s · más con mejoras.', price: 95 },
    { id: 'tool-turbo',  key: 'turbo',     name: 'Aliento de Cohete', icon: '⚡', desc: 'Velocidad extra 4 s · más con mejoras.',        price: 100 },
    { id: 'tool-combo',  key: 'combo',     name: 'Racha Extra',     icon: '🔥', desc: '+2 pts por tubo extra 10 s · más con mejoras.', price: 110 },
    { id: 'tool-shield', key: 'shield',    name: 'Escudo Celeste',   icon: '🛡️', desc: 'Suma 1 escudo guardado (se acumula), pero solo puedes gastar 1 por partida.', price: 120 },
    { id: 'tool-ghost',  key: 'ghost',     name: 'Pase Fantasma',    icon: '👻', desc: 'Atraviesas obstáculos 4 s al inicio.',           price: 120 },
    { id: 'tool-frenzy', key: 'frenzy',    name: 'Frenesí',         icon: '🎇', desc: '+1 pt por cada power-up durante 12 s.',          price: 140 },
    /* ---- DESBLOQUES SEMANALES (2 por semana): HERRAMIENTAS ---- */
    { id: 'tool-eco',   key: 'eco',      name: 'Eco Bolsa',       icon: '🛍️', desc: 'Robas +10 🪙 al instante.',                       price: 90,  week: 4 },
    { id: 'tool-hype',  key: 'hype',     name: 'Hype',            icon: '🔥', desc: '+2 pts por cada power-up, toda la partida.',      price: 150, week: 4 },
    { id: 'tool-bomb',  key: 'bomb',     name: 'Cosecha',         icon: '🧨', desc: '+1 pt por cada moneda durante 10 s.',             price: 100, week: 9 },
    { id: 'tool-aura',  key: 'aura',     name: 'Aura Ascendente', icon: '🕉️', desc: '+1 pt extra por tubo durante 20 s.',             price: 110, week: 9 },
    { id: 'tool-twin',  key: 'twin',     name: 'Géminis',         icon: '🧿', desc: 'Empiezas con +8 pts (cualquier modo).',            price: 120, week: 26 },
    { id: 'tool-oasis', key: 'oasis',    name: 'Oasis',           icon: '💧', desc: '+1 pt por cada 10 m volados, toda la partida.',   price: 130, week: 26 },
    /* ---- OLEADA 2027: más herramientas (semanas 30-31) ---- */
    { id: 'tool-doble', key: 'doble',    name: 'Doble Punto',     icon: '♦️', desc: '+1 pt extra por tubo, toda la partida.',         price: 150, week: 30 },
    { id: 'tool-runa',  key: 'runa',     name: 'Runa Ancestral',  icon: '🗿', desc: '+15 XP de jugador al instante.',                price: 140, week: 31 },
    /* ---- HERRAMIENTAS NUEVAS (semanas 33-36) ---- */
    { id: 'tool-titan',  key: 'titan',   name: 'Modo Titán',     icon: '🥊', desc: '+2 pts por cada tubo, toda la partida.',         price: 160, week: 33 },
    { id: 'tool-fenix',  key: 'fenix',   name: 'Fénix',          icon: '🦅', desc: 'Revive una vez por vuelo.',                     price: 200, week: 34 },
    { id: 'tool-bateria', key: 'bateria', name: 'Batería Cósmica', icon: '🔋', desc: 'Da +5 puntos al activarla en pleno vuelo.', price: 150, week: 35 },
    { id: 'tool-cris',   key: 'cris',    name: 'Cristal Mágico', icon: '🪄', desc: '+20 monedas de oro al instante.',               price: 140, week: 36 },
    /* ---- OLEADA "VAPOR→FAUNA": más herramientas (semanas 39-48) ---- */
    { id: 'tool-ferro',   key: 'ferro',   name: 'Ferromagnético', icon: '🧲', desc: 'Todas las monedas valen +2 mientras dure.',              price: 190, week: 39 },
    { id: 'tool-paracaidas',key: 'para',  name: 'Paracaídas',     icon: '🪂', desc: 'Caes un 40% más despacio, toda la partida.',           price: 175, week: 40 },
    { id: 'tool-zoom',    key: 'zoom',    name: 'Cámara Lenta',   icon: '🎥', desc: 'El mundo va un 25% más lento toda la partida.',         price: 185, week: 41 },
    { id: 'tool-mirilla', key: 'mirilla', name: 'Telescopio',     icon: '🔭', desc: 'Ves los 2 próximos obstáculos desde el inicio.',        price: 165, week: 42 },
    { id: 'tool-amuleto', key: 'amuleto', name: 'Amuleto',        icon: '📿', desc: '+5 % de XP de jugador por partida.',                    price: 200, week: 43 },
    { id: 'tool-rescate', key: 'rescate', name: 'Rescate',        icon: '🚨', desc: 'Anula un error de control cada 20 s.',                  price: 210, week: 44 },
    { id: 'tool-ticket',  key: 'ticket',  name: 'Ticket Dorado',  icon: '🎫', desc: 'Al acabar, multiplica por 2 las monedas no recogidas.',price: 195, week: 45 },
    { id: 'tool-radar',   key: 'radar',   name: 'Radar',          icon: '🛰️', desc: 'Las 💎 y 🍒 aparecen un 60% más a menudo.',            price: 180, week: 46 },
    { id: 'tool-bala',    key: 'bala',    name: 'Bala de Jade',   icon: '🎯', desc: 'Cada 10 tubos, un golpe teledirigido a una moneda.',   price: 205, week: 47 },
    { id: 'tool-flot',    key: 'flot',    name: 'Flotador',       icon: '🎈', desc: 'Aguanta un choque adicional por partida.',              price: 220, week: 48 }
  ];
  TOOLS.push(
    { id: 'tool-legend', key: 'legend', name: 'Reliquia del Pase', icon: '🏆', desc: 'Exclusiva y permanente: +1 pt por tubo y monedas +25 % toda la partida.', price: 0, exclusive: true, rarity: 'mítica', permanent: true, repairValue: 600, dur: 14 }
  );

  const ACH = [
    { id: 'a-first',      name: 'Primer Vuelo',      desc: 'Completa tu primera partida.',      check: s => s.get().stats.flights >= 1,                              reward: 50 },
    { id: 'a-10',         name: 'Tomando Vuelo',     desc: 'Cruza 10 obstáculos en total.',     check: s => s.get().stats.pipes >= 10,                              reward: 50 },
    { id: 'a-50',         name: 'Racha Imparable',   desc: 'Cruza 50 obstáculos en total.',     check: s => s.get().stats.pipes >= 50,                              reward: 100 },
    { id: 'a-500',        name: 'Leyenda Voladora',  desc: 'Cruza 500 obstáculos en total.',    check: s => s.get().stats.pipes >= 500,                             reward: 300 },
    { id: 'a-point30',    name: 'Puntaje Épico',     desc: 'Alcanza 30 puntos en una partida.', check: s => s.get().stats.best >= 30,                               reward: 100 },
    { id: 'a-point60',    name: 'Invencible',        desc: 'Alcanza 60 puntos en una partida.', check: s => s.get().stats.best >= 60,                               reward: 250 },
    { id: 'a-lv3',        name: 'Nivel 3',           desc: 'Alcanza el nivel de jugador 3.',    check: s => s.get().level >= 3,                                reward: 100 },
    { id: 'a-lv7',        name: 'Nivel 7',           desc: 'Alcanza el nivel de jugador 7.',    check: s => s.get().level >= 7,                                reward: 250 },
    { id: 'a-coins300',   name: 'Coleccionista',     desc: 'Consigue 300 monedas en total.',    check: s => s.get().coinsEarned >= 300,                        reward: 150 },
    { id: 'a-coins1000',  name: 'Rico Pío',          desc: 'Consigue 1.000 monedas en total.',  check: s => s.get().coinsEarned >= 1000,                       reward: 500 },
    { id: 'a-skin3',      name: 'Estilista',         desc: 'Compra 3 aves diferentes.',        check: s => s.get().skinsOwned.length >= 4,                    reward: 100 },
    { id: 'a-shop',       name: 'Moda Divina',       desc: 'Compra algo en las 3 tiendas.',     check: s => s.get().skinsOwned.length > 1 && s.get().hatsOwned.length > 0 && s.get().fxOwned.length > 1, reward: 150 },
    { id: 'a-map',        name: 'Explorador',        desc: 'Desbloquea un mapa nuevo.',        check: s => s.get().mapsOwned.length >= 2,                     reward: 100 },
    { id: 'a-map3',       name: 'Aventurero',        desc: 'Desbloquea 3 mapas nuevos.',       check: s => s.get().mapsOwned.length >= 4,                     reward: 200 },
    { id: 'a-perfect',    name: 'Vuelo Perfecto',    desc: 'Cruza 3 obstáculos seguidos.',      check: s => s.get().maxCombo >= 3,                             reward: 50 },
    { id: 'a-dist200',   name: 'Explorador de Largas Distancias', desc: 'Vuela 200 metros en total.',     check: s => s.get().stats.dist >= 200,                          reward: 100 },
    { id: 'a-dist1000',  name: 'Maratonista',                      desc: 'Vuela 1.000 metros en total.',    check: s => s.get().stats.dist >= 1000,                         reward: 300 },
    { id: 'a-lv15',      name: 'As del Cielo',                    desc: 'Alcanza el nivel de jugador 15.', check: s => s.get().level >= 15,                                reward: 400 },
    { id: 'a-power5',    name: 'Cazador de Poder',                desc: 'Recoge 5 power-ups.',             check: s => s.get().stats.powersGot >= 5,                       reward: 120 },
    { id: 'a-flights5',  name: 'Piloto Frecuente',                desc: 'Completa 5 partidas.',            check: s => s.get().stats.flights >= 5,                         reward: 75 },
    { id: 'a-flights25', name: 'Aviador Constante',               desc: 'Completa 25 partidas.',           check: s => s.get().stats.flights >= 25,                        reward: 150 },
    { id: 'a-flights100', name: 'Capitán del Cielo',              desc: 'Completa 100 partidas.',          check: s => s.get().stats.flights >= 100,                       reward: 400 },
    { id: 'a-combo5',    name: 'En Racha',                        desc: 'Cruza 5 obstáculos seguidos.',    check: s => s.get().maxCombo >= 5,                              reward: 80 },
    { id: 'a-combo10',   name: 'Racha Legendaria',                desc: 'Cruza 10 obstáculos seguidos.',   check: s => s.get().maxCombo >= 10,                             reward: 200 },
    { id: 'a-coins500',  name: 'Ahorrador',                       desc: 'Consigue 500 monedas en total.',  check: s => s.get().coinsEarned >= 500,                         reward: 200 },
    { id: 'a-coins2000', name: 'Banquero',                        desc: 'Consigue 2.000 monedas en total.', check: s => s.get().coinsEarned >= 2000,                        reward: 600 },
    { id: 'a-spend1000', name: 'Gastón',                          desc: 'Gasta 1.000 monedas en la tienda.', check: s => (s.get().stats.spent || 0) >= 1000,                  reward: 250 },
    { id: 'a-spend3000', name: 'Mejor Cliente',                   desc: 'Gasta 3.000 monedas en la tienda.', check: s => (s.get().stats.spent || 0) >= 3000,                  reward: 800 },
    { id: 'a-map5',      name: 'Grandioso Viajero',               desc: 'Desbloquea 5 mapas.',             check: s => s.get().mapsOwned.length >= 6,                      reward: 300 },
    { id: 'a-power10',   name: 'Maestro del Poder',               desc: 'Recoge 10 power-ups.',            check: s => s.get().stats.powersGot >= 10,                      reward: 150 },
    { id: 'a-power25',   name: 'Amo del Poder',                   desc: 'Recoge 25 power-ups.',            check: s => s.get().stats.powersGot >= 25,                      reward: 350 },
    { id: 'a-time3600',  name: 'Increíble Resistencia',           desc: 'Vuela 1 hora en total.',          check: s => s.get().stats.timePlayed >= 3600,                   reward: 300 },
    { id: 'a-mega5',    name: 'Cazador de Tesoros',               desc: 'Recoge 5 monedas de oro 🪙.',     check: s => (s.get().stats.megaGot || 0) >= 5,                  reward: 200 },
    { id: 'a-mega15',   name: 'Rey del Tesoro',                   desc: 'Recoge 15 monedas de oro 🪙.',    check: s => (s.get().stats.megaGot || 0) >= 15,                 reward: 500 },
    { id: 'a-daily3',   name: 'Constancia',                       desc: 'Reclama la recompensa diaria 3 días.', check: s => (s.get().stats.dailyClaimed || 0) >= 3,           reward: 150 },
    { id: 'a-daily10',  name: 'Maestro de Rutina',                desc: 'Reclama la recompensa diaria 10 días.', check: s => (s.get().stats.dailyClaimed || 0) >= 10,         reward: 400 },
    { id: 'a-skin6',    name: 'Galería de Aves',                  desc: 'Compra 6 aves diferentes.',       check: s => s.get().skinsOwned.length >= 7,                     reward: 350 },
    { id: 'a-hat4',     name: 'Sombrerero',                       desc: 'Compra 4 sombreros.',             check: s => s.get().hatsOwned.length >= 4,                      reward: 200 },
    { id: 'a-fx4',      name: 'Estelista',                        desc: 'Compra 4 estelas.',               check: s => s.get().fxOwned.length >= 5,                        reward: 200 },
    { id: 'a-coins5k',  name: 'Multimillonario',                  desc: 'Consigue 5.000 monedas en total.', check: s => s.get().coinsEarned >= 5000,                        reward: 1000 },
    { id: 'a-xc5',      name: 'Codicia',                          desc: 'Recoge 5 poderes de doble monedas.', check: s => (s.get().stats.xcGot || 0) >= 5,                  reward: 150 },
    { id: 'a-xc15',     name: 'Magnate',                          desc: 'Recoge 15 poderes de doble monedas.', check: s => (s.get().stats.xcGot || 0) >= 15,                reward: 400 },
    { id: 'a-enemies25', name: 'Cazador Implacable',              desc: 'Esquiva 25 enemigos en total.',   check: s => (s.get().stats.enemiesGot || 0) >= 25,             reward: 150 },
    { id: 'a-enemies100', name: 'Ángel de la Muerte',             desc: 'Esquiva 100 enemigos en total.',  check: s => (s.get().stats.enemiesGot || 0) >= 100,            reward: 500 },
    { id: 'a-map4',     name: 'Cartógrafo',                       desc: 'Desbloquea 4 mapas nuevos.',      check: s => s.get().mapsOwned.length >= 5,                      reward: 250 },
    { id: 'a-skin8',    name: 'Mega Coleccionista',               desc: 'Compra 10 aves diferentes.',      check: s => s.get().skinsOwned.length >= 10,                    reward: 600 },
    { id: 'a-tool3',    name: 'Preparado',                        desc: 'Usa 3 herramientas de la bolsa.',  check: s => (s.get().stats.toolsUsed || 0) >= 3,                reward: 150 },
    { id: 'a-tool15',   name: 'Ingeniero',                        desc: 'Usa 15 herramientas de la bolsa.', check: s => (s.get().stats.toolsUsed || 0) >= 15,               reward: 500 },
    { id: 'a-toolbuy',  name: 'Ferretería',                       desc: 'Compra 5 herramientas.',           check: s => (s.get().stats.toolsBought || 0) >= 5,              reward: 200 },
    { id: 'a-share',    name: 'Compartir es Vivir',               desc: 'Comparte tu marcador.',            check: s => (s.get().stats.shared || 0) >= 1,                   reward: 100 },
    { id: 'a-gem5',     name: 'Buscafuentes',                     desc: 'Recoge 5 diamantes 💎.',          check: s => (s.get().stats.gemsGot || 0) >= 5,                  reward: 150 },
    { id: 'a-gem20',    name: 'Magnate de Gemas',                 desc: 'Recoge 20 diamantes 💎.',         check: s => (s.get().stats.gemsGot || 0) >= 20,                 reward: 500 },
    { id: 'a-chain15',  name: 'Racimo Dorado',                    desc: 'Recoge 15 monedas de cadenas 🍒.', check: s => (s.get().stats.chainGot || 0) >= 15,               reward: 150 },
    { id: 'a-bat10',    name: 'Esquiva Murciélagos',              desc: 'Esquiva 10 murciélagos 🦇.',      check: s => (s.get().stats.batsGot || 0) >= 10,                reward: 150 },
    { id: 'a-chal1',    name: 'Manos a la Obra',                  desc: 'Juega tu primer desafío diario 🌙.', check: s => (s.get().stats.challengePlayed || 0) >= 1,         reward: 100 },
    { id: 'a-chal5',    name: 'Veterano del Desafío',             desc: 'Juega 5 desafíos diarios 🌙.',    check: s => (s.get().stats.challengePlayed || 0) >= 5,         reward: 300 },
    { id: 'a-fx6',      name: 'Arcoíris Completo',                desc: 'Compra 6 estelas.',               check: s => s.get().fxOwned.length >= 7,                        reward: 250 },
    { id: 'a-upg10',    name: 'Mejorador Experto',               desc: 'Mejora herramientas 10 veces.',   check: s => (s.get().stats.upgs || 0) >= 10,                     reward: 300 },
    { id: 'a-manual3',  name: 'Táctico',                         desc: 'Activa 3 herramientas a mano.',  check: s => (s.get().stats.manualUses || 0) >= 3,                reward: 150 },
    { id: 'a-mix5',     name: 'Manitas',                         desc: 'Usa 5 herramientas distintas.',   check: s => (s.get().stats.toolTypes || []).length >= 5,          reward: 250 },
    { id: 'a-mix12',    name: 'Juego de Herramientas',           desc: 'Usa 12 herramientas distintas.',  check: s => (s.get().stats.toolTypes || []).length >= 12,         reward: 500 },
    { id: 'a-miss1',    name: 'Héroe Local',                     desc: 'Completa una misión diaria.',     check: s => (s.get().stats.missionsDone || 0) >= 1,               reward: 100 },
    { id: 'a-miss15',   name: 'Devoto de las Misiones',          desc: 'Completa 15 misiones diarias.',   check: s => (s.get().stats.missionsDone || 0) >= 15,              reward: 400 },
    { id: 'a-pass1',    name: 'Viajero del Pase',               desc: 'Reclama una recompensa del Pase de Vuelo.', check: s => (s.get().passClaimed || []).length >= 1,        reward: 150 },
    { id: 'a-pass9',    name: 'Coleccionista del Pase',         desc: 'Reclama 9 recompensas del Pase de Vuelo.',   check: s => (s.get().passClaimed || []).length >= 9,        reward: 500 },
    { id: 'a-power40',  name: 'Supremacía de Poder',            desc: 'Recoge 40 power-ups.',                       check: s => s.get().stats.powersGot >= 40,                  reward: 500 },
    { id: 'a-shield5',  name: 'Blindaje',                       desc: 'Absorbe 5 choques con el escudo 🛡️.',       check: s => (s.get().stats.shieldAbsorbed || 0) >= 5,       reward: 150 },
    { id: 'a-shield15', name: 'Inquebrantable',                 desc: 'Absorbe 15 choques con el escudo 🛡️.',      check: s => (s.get().stats.shieldAbsorbed || 0) >= 15,      reward: 500 },
    { id: 'a-fenix',    name: 'Reinicio Llameante',            desc: 'Revive 5 veces con el Fénix 🦅.',           check: s => (s.get().stats.fenixUsed || 0) >= 5,         reward: 300 },
    { id: 'a-ghostp10', name: 'Mística',                        desc: 'Atraviesa 10 obstáculos en modo fantasma 👻.', check: s => (s.get().stats.ghostPassed || 0) >= 10,        reward: 200 },
    { id: 'a-arcade',   name: 'Arcade',                         desc: 'Desbloquea el mapa Retro Arcade 🕹️.',       check: s => s.get().mapsOwned.some(m => m.id === 'arcade'),  reward: 150 },
    { id: 'a-season1',  name: 'Temporada 2026',                 desc: 'Reclama 1 recompensa de Temporada.',         check: s => (s.get().seasonClaimed || []).length >= 1,      reward: 100 },
    { id: 'a-season10', name: 'Veterano 2026',                  desc: 'Reclama 10 recompensas de Temporada.',       check: s => (s.get().seasonClaimed || []).length >= 10,     reward: 500 },
    { id: 'a-wknd',     name: 'Semana Pro',                     desc: 'Juega un vuelo un fin de semana (XP ×1,5).',  check: s => (s.get().stats.weekendRuns || 0) >= 1,          reward: 100 },
    /* ---- MEDALLAS OCULTAS (condiciones raras) ---- */
    { id: 'a-clean',    name: 'Aguilucho',                      desc: 'Vuela 500 m sin tocar nada en una partida 🌪️.', check: s => (s.get().stats.maxDistNoHit || 0) >= 500,   reward: 300 },
    { id: 'a-zero',     name: 'El Ahorrativo',                  desc: 'Termina una partida sin recoger ni una moneda 🤲.', check: s => (s.get().stats.zeroCoinRuns || 0) >= 1,      reward: 200 },
    { id: 'a-duel1',    name: 'Pelea de Gallos',                desc: 'Gana tu primer Duelo de Aves 🆚.',           check: s => (s.get().stats.duelWins || 0) >= 1,            reward: 150 },
    { id: 'a-duel10',   name: 'Campeón del Cielo',              desc: 'Gana 10 Duelos de Aves 🆚.',                 check: s => (s.get().stats.duelWins || 0) >= 10,           reward: 500 },
    { id: 'a-wind5',    name: 'Surfista del Viento',            desc: 'Cruza 5 tramos de viento lateral 💨.',       check: s => (s.get().stats.windZones || 0) >= 5,           reward: 200 },
    { id: 'a-giant20',  name: 'Cazagigantes',                   desc: 'Pasa 20 tuberías gigantes 🌋.',              check: s => (s.get().stats.giantPassed || 0) >= 20,        reward: 300 },
    { id: 'a-replay',   name: 'Hacer de Director',              desc: 'Reproduce tu mejor vuelo con el Replay 🎬.', check: s => (s.get().stats.replaysWatched || 0) >= 1,      reward: 150 },
    { id: 'a-seed7',    name: 'Fiel Seguidor',                  desc: 'Juega 7 Semillas diarias 🌱.',               check: s => (s.get().stats.seedDays || 0) >= 7,            reward: 250 },
    { id: 'a-seed30',   name: 'Guardia del Jardín',             desc: 'Juega 30 Semillas diarias 🌱.',              check: s => (s.get().stats.seedDays || 0) >= 30,           reward: 600 },
    /* ---- OLEADA "VAPOR→FAUNA": más logros ---- */
    { id: 'a-duel3',     name: 'Duelista',              desc: 'Gana 3 Duelos 🆚.',                       check: s => s.get().stats.duelWins >= 3,               reward: 200 },
    { id: 'a-zen500',    name: 'Meditador',             desc: 'Vuela 500 m en modo Zen 🧘.',            check: s => (s.get().stats.zenBest || 0) >= 500,       reward: 200 },
    { id: 'a-zen2000',   name: 'Maestro Zen',           desc: 'Vuela 2.000 m en modo Zen 🧘.',          check: s => (s.get().stats.zenBest || 0) >= 2000,      reward: 500 },
    { id: 'a-boss1',     name: 'Cazador de Jefes',      desc: 'Derrota a un Jefe 👹.',                  check: s => (s.get().stats.bossDefeated || 0) >= 1,    reward: 300 },
    { id: 'a-boss5',     name: 'Cazador de Titanes',    desc: 'Derrota 5 Jefes 👹.',                    check: s => (s.get().stats.bossDefeated || 0) >= 5,    reward: 700 },
    { id: 'a-wind25',    name: 'Maestro del Viento',    desc: 'Cruza 25 tramos de viento 💨.',          check: s => (s.get().stats.windZones || 0) >= 25,      reward: 400 },
    { id: 'a-nohit500',  name: 'Intocable',             desc: '500 m sin tocar nada 🛡️.',               check: s => (s.get().stats.maxDistNoHit || 0) >= 500, reward: 450 },
    { id: 'a-nohit1500', name: 'Legendario del Vuelo',  desc: '1.500 m sin tocar nada 🛡️.',             check: s => (s.get().stats.maxDistNoHit || 0) >= 1500,reward: 900 },
    { id: 'a-zerocoin',  name: 'Asceta',                desc: 'Termina una partida sin recoger monedas.',check: s => (s.get().stats.zeroCoinRuns || 0) >= 1,   reward: 250 },
    { id: 'a-replay5',   name: 'Crítico',               desc: 'Reproduce 5 Replays 🎬.',                check: s => (s.get().stats.replaysWatched || 0) >= 5,   reward: 200 },
    { id: 'a-skin15',    name: 'Ala de Oro',            desc: 'Compra 16 aves diferentes 🐤.',          check: s => s.get().skinsOwned.length >= 17,           reward: 700 },
    { id: 'a-skin25',    name: 'Criador de Aves',       desc: 'Compra 26 aves diferentes 🐤.',          check: s => s.get().skinsOwned.length >= 27,           reward: 1200 },
    { id: 'a-hat12',     name: 'Millanero',             desc: 'Compra 13 sombreros 🎩.',                check: s => s.get().hatsOwned.length >= 13,            reward: 500 },
    { id: 'a-fx12',      name: 'Galería de Luz',        desc: 'Compra 13 estelas ✨.',                   check: s => s.get().fxOwned.length >= 13,             reward: 500 },
    { id: 'a-map10',     name: 'Topógrafo',             desc: 'Desbloquea 11 mapas 🗺️.',               check: s => s.get().mapsOwned.length >= 11,            reward: 600 },
    { id: 'a-map15',     name: 'Cartógrafo Real',       desc: 'Desbloquea 16 mapas 🗺️.',               check: s => s.get().mapsOwned.length >= 16,            reward: 1000 },
    { id: 'a-tool20',    name: 'Constructor',           desc: 'Usa 20 herramientas 🎒.',                check: s => (s.get().stats.toolsUsed || 0) >= 20,     reward: 400 },
    { id: 'a-tool40',    name: 'Mano de Maestro',       desc: 'Usa 40 herramientas 🎒.',                check: s => (s.get().stats.toolsUsed || 0) >= 40,     reward: 900 },
    { id: 'a-mix20',     name: 'Todo en Uno',           desc: 'Usa 20 herramientas distintas.',         check: s => (s.get().stats.toolTypes || []).length >= 20, reward: 800 },
    { id: 'a-upg40',     name: 'Ingeniero Jefe',        desc: 'Mejora herramientas 40 veces ⭐.',       check: s => (s.get().stats.upgs || 0) >= 40,          reward: 800 },
    { id: 'a-lv25',      name: 'Maestro del Cielo',     desc: 'Alcanza el nivel 25 de jugador.',        check: s => s.get().level >= 25,                        reward: 1200 },
    { id: 'a-lv40',      name: 'Leyenda Viviente',      desc: 'Alcanza el nivel 40 de jugador.',        check: s => s.get().level >= 40,                        reward: 2500 },
    { id: 'a-pipes2000', name: 'Dominio Total',         desc: 'Cruza 2.000 obstáculos en total.',      check: s => s.get().stats.pipes >= 2000,               reward: 1000 },
    { id: 'a-dist10k',   name: 'Aeroespacial',          desc: 'Vuela 10.000 metros en total.',          check: s => s.get().stats.dist >= 10000,               reward: 1500 },
    { id: 'a-coins10k',  name: 'Millonario',            desc: 'Consigue 10.000 monedas en total.',      check: s => s.get().coinsEarned >= 10000,               reward: 2000 },
    { id: 'a-spend10k',  name: 'Magnate de la Tienda',  desc: 'Gasta 10.000 monedas 🛒.',               check: s => (s.get().stats.spent || 0) >= 10000,     reward: 2000 },
    { id: 'a-flights500',name: 'Píonero',               desc: 'Completa 500 partidas.',                 check: s => s.get().stats.flights >= 500,               reward: 1500 },
    { id: 'a-seed100',   name: 'Jardinero Eterno',      desc: 'Juega 100 Semillas diarias 🌱.',          check: s => (s.get().stats.seedDays || 0) >= 100,     reward: 1500 },
    { id: 'a-streak30',  name: 'Hábito',                desc: 'Consigue una racha diaria de 30 🔥.',    check: s => (s.get().dailyStreak || 0) >= 30,        reward: 2000 }
  ];

  const DIFFS = [
    { id: 'easy',   name: 'Fácil',   gapMul: 1.15, speedMul: 0.85, gravityMul: 0.9,  spawnMul: 1.1,  coinMul: 1 },
    { id: 'normal', name: 'Normal',  gapMul: 1.0,  speedMul: 1.0,  gravityMul: 1.0,  spawnMul: 1.0,  coinMul: 1 },
    { id: 'hard',   name: 'Difícil', gapMul: 0.85, speedMul: 1.2,  gravityMul: 1.12, spawnMul: 0.9,  coinMul: 1.5 },
    { id: 'insane', name: 'Loco',    gapMul: 0.7,  speedMul: 1.35, gravityMul: 1.25, spawnMul: 0.8,  coinMul: 2 }
  ];

  function getSkin(id) {
    if (id && id.length > 5 && id.slice(-5) === '-gold') {
      const base = SKINS.find(s => s.id === id.slice(0, -5));
      if (base) return makeGold(base);
    }
    return SKINS.find(s => s.id === id) || SKINS[0];
  }
  function getHat(id) { return HATS.find(h => h.id === id) || null; }
  function getFx(id) { return EFFECTS.find(e => e.id === id) || EFFECTS[0]; }
  function getMap(id) { return MAPS.find(m => m.id === id) || MAPS[0]; }
  function getDiff(id) { return DIFFS.find(d => d.id === id) || DIFFS[1]; }
  function getAch(id) { return ACH.find(a => a.id === id) || null; }
  // Un artículo exclusivo solo puede obtenerse desde el Pase Prémium.
  function isExclusive(o) { return !!(o && o.exclusive); }
  const RARITY_BY_TIER = { common: 'Común', uncommon: 'Poco común', rare: 'Raro', special: 'Especial' };
  function rarityOf(o) {
    if (!o) return 'Común';
    if (o.rarity) return o.rarity.charAt(0).toUpperCase() + o.rarity.slice(1);
    if (isExclusive(o)) return 'Exclusiva';
    return RARITY_BY_TIER[ECONOMY.tier(o.basePrice || o.price || 0)] || 'Común';
  }
  // Acepta el id ('tool-magnet') o la clave interna ('magnet') indistintamente.
  function getTool(id) { return TOOLS.find(t => t.id === id) || TOOLS.find(t => t.key === id) || null; }

  /* Misiones diarias/semanales: metric recibe el estado SAVE y devuelve progreso */
  const MISSIONS = [
    { id: 'm-fly',   name: 'Zumo del Aire',        desc: 'Vuela 300 metros',  target: 300, metric: s => s.get().stats.dist,      reward: 60,  weekly: false },
    { id: 'm-coins', name: 'Cazarrecompensas',     desc: 'Recoge 40 monedas', target: 40,  metric: s => s.get().stats.coinsGot,  reward: 50,  weekly: false },
    { id: 'm-pipes', name: 'Slalom entre Tubos',   desc: 'Cruza 35 tubos',    target: 35,  metric: s => s.get().stats.pipes,      reward: 65,  weekly: false },
    { id: 'm-enemy', name: 'Radar de Enemigos',       desc: 'Esquiva 20 enemigos', target: 20, metric: s => s.get().stats.enemiesGot, reward: 55, weekly: false },
    { id: 'm-w-week', name: 'Semana Épica',        desc: 'Vuela 2.500 metros esta semana', target: 2500, metric: s => s.get().stats.dist, reward: 300, weekly: true },
    { id: 'm-w-2026', name: 'Retro Récord',       desc: 'Cruza 500 tubos esta semana',     target: 500,  metric: s => s.get().stats.pipes, reward: 250, weekly: true },
    { id: 'm-w-nohit', name: 'Intocable',     desc: 'Vuela 3.000 m sin tocar nada esta semana',   target: 3000, metric: s => s.get().stats.maxDistNoHit, reward: 400, weekly: true },
    { id: 'm-w-duel',  name: 'Peleas Aéreos', desc: 'Gana 8 Duelos esta semana 🆚',                 target: 8,    metric: s => s.get().stats.duelWins,       reward: 350, weekly: true },
    { id: 'm-w-zen',   name: 'Respira',       desc: 'Acumula 1.500 m en modo Zen esta semana 🧘',   target: 1500, metric: s => s.get().stats.zenBest,       reward: 300, weekly: true },
    { id: 'm-powers',  name: 'Glotón',        desc: 'Recoge 8 power-ups',                          target: 8,    metric: s => s.get().stats.powersGot,     reward: 70,  weekly: false },
    { id: 'm-tools',   name: 'Inventivo',     desc: 'Usa 3 herramientas distintas',                target: 3,    metric: s => (s.get().stats.toolTypes||[]).length, reward: 55, weekly: false },
    { id: 'm-boss',    name: 'Cazador',       desc: 'Derrota a 2 Jefes 👹',                        target: 2,    metric: s => s.get().stats.bossDefeated,   reward: 90,  weekly: false },
    { id: 'm-gems',    name: 'Buscatesoros',  desc: 'Recoge 5 💎',                                 target: 5,    metric: s => s.get().stats.gemsGot,       reward: 60,  weekly: false }
  ];

  /* Temporada 2026 🗓: recompensas por XP acumulada (misma XP del jugador) */
  const SEASON_TIERS = [
    { xp: 0,    reward: { coins: 50 } },
    { xp: 250,  reward: { item: 'magnet', n: 1 } },
    { xp: 500,  reward: { coins: 80 } },
    { xp: 750,  reward: { item: 'luck', n: 1 } },
    { xp: 1000, reward: { item: 'shield', n: 1 } },
    { xp: 1200, reward: { coins: 120 } },
    { xp: 1500, reward: { item: 'ghost', n: 1 } },
    { xp: 1800, reward: { item: 'treasure', n: 1 } },
    { xp: 2200, reward: { coins: 180 } },
    { xp: 2700, reward: { item: 'boost', n: 1 } },
    { xp: 3200, reward: { item: 'turbo', n: 1 } },
    { xp: 4000, reward: { coins: 300 } },
    { xp: 5000, reward: { item: 'combo', n: 2 } },
    { xp: 6500, reward: { coins: 500 } }
  ];

  /* Contenido semanal: cada semana se habilitan 2 ítems nuevos en su sección.
   El reloj arranca el lunes 21 sep 2026 (v2.0) y avanza 1 semana cada 7 días. */
  const CONTENT_EPOCH = new Date(2026, 8, 21);
  function curWeek(d) {
    const now = d || new Date();
    const ms = now.getTime() - CONTENT_EPOCH.getTime();
    if (ms < 0) return 1;
    return Math.floor(ms / (7 * 864e5)) + 1;
  }
  function isUnlocked(o, d) { return !o.week || o.week <= curWeek(d); }
  function weekLabel(o) { return o.week ? 'Semana ' + o.week : null; }

  /* Temporadas del año (el Pase rota automáticamente según la fecha real) */
  const SEASON_ORDER = ['winter', 'spring', 'summer', 'autumn'];
  const SEASONS = [
    { id: 'winter', name: 'Invierno',  icon: '❄️', accent: '#7bd8f6', months: 'dic – feb', pass: { icon: '🎿', name: 'Pase Cuaternario' } },
    { id: 'spring', name: 'Primavera', icon: '🌸', accent: '#ff9ce6', months: 'mar – may', pass: { icon: '🌷', name: 'Pase Florecer' } },
    { id: 'summer', name: 'Verano',    icon: '☀️', accent: '#ffd54f', months: 'jun – ago', pass: { icon: '🏖️', name: 'Pase Solsticio' } },
    { id: 'autumn', name: 'Otoño',     icon: '🍂', accent: '#ffab40', months: 'sep – nov', pass: { icon: '🎃', name: 'Pase Cosecha' } }
  ];

  function seasonIndex(d) {
    const m = (d || new Date()).getMonth();
    if (m >= 11 || m <= 1) return 0; /* dic – feb */
    if (m <= 4) return 1;            /* mar – may */
    if (m <= 7) return 2;            /* jun – ago */
    return 3;                        /* sep – nov */
  }
  function seasonKey(d) {
    const now = d || new Date();
    return now.getFullYear() + '-' + SEASON_ORDER[seasonIndex(now)];
  }
  function seasonInfo(d) { return SEASONS[seasonIndex(d)]; }

  /* Pase rotativo: mismos niveles de XP, pero las recompensas dependen de la temporada */
  const PASS_XP   = [0, 150, 350, 600, 900, 1250, 1650, 2100, 2600, 3150, 3750, 4400, 5200, 6100];
  const PASS_COINS = [60, 80, 120, 150, 200, 260, 500, 800, 1200]; // 9 recompensas de monedas (la tier 6100 XP es la última)
  /* Pool de herramientas que puede regalar el Pase (incluye las nuevas de las semanas) */
  const PASS_ITEMS = ['magnet', 'luck', 'slow', 'boost', 'treasure', 'turbo', 'combo', 'shield', 'ghost', 'frenzy', 'eco', 'hype', 'bomb', 'aura', 'twin', 'oasis', 'titan', 'fenix', 'bateria', 'cris'];
  /* Recompensa cosmética especial de cada temporada (sombrero / estela) */
  const SEASON_BONUS = [
    { hat: 'hat-duende',    fx: 'fx-nevada' },   // invierno
    { hat: 'hat-girasol',   fx: 'fx-limo' },     // primavera
    { hat: 'hat-estrellita', fx: 'fx-galactico' }, // verano
    { hat: 'hat-banda2',    fx: 'fx-coral' }     // otoño
  ];
  function passTiers(d) {
    const si = seasonIndex(d);
    const tiers = [];
    let coinI = 0, itemI = 0;
    PASS_XP.forEach((xp, idx) => {
      if (idx === 2 || idx === 4 || idx === 6 || idx === 8 || idx === 10) {
        // stride 4 para repartir las 20 herramientas entre las 4 temporadas (5 por temporada)
        const it = PASS_ITEMS[(itemI * 4 + si) % PASS_ITEMS.length];
        tiers.push({ xp, reward: { item: it, n: idx >= 8 ? 2 : 1 } });
        itemI++;
      } else {
        tiers.push({ xp, reward: { coins: PASS_COINS[coinI++] } });
      }
    });
    /* la tier de 150 XP regala el cosmético de la temporada */
    tiers[1] = { xp: 150, reward: si % 2 === 0 ? { hat: SEASON_BONUS[si].hat } : { fx: SEASON_BONUS[si].fx } };
    return tiers;
  }

  /* Pase de Vuelo base (referencia: primavera), se usa passTiers() en runtime */
  const PASS_TIERS = passTiers(new Date(2026, 2, 15));

  /* ------------------------------------------------------------------
   * PASE PRÉMIUM (segunda línea por temporada)
   * Se desbloquea con monedas del juego, dura la temporada actual y sus
   * recompensas son EXCLUSIVAS: no se venden en tienda ni salen en cajas.
   * ------------------------------------------------------------------ */
  const PASS_PREMIUM_PRICE = 3000;
  function passPremiumTiers() {
    return PASS_XP.map((xp, idx) => {
      let reward;
      switch (idx) {
        case 1:  reward = { skin: 'p-aurora' }; break;
        case 2:  reward = { hat: 'hat-corona-eterna' }; break;
        case 3:  reward = { fx: 'fx-prisma' }; break;
        case 4:  reward = { parts: 2 }; break;
        case 5:  reward = { map: 'premium' }; break;
        case 6:  reward = { item: 'legend', n: 1 }; break;
        case 7:  reward = { hat: 'hat-sello-estelar' }; break;
        case 8:  reward = { fx: 'fx-supernova' }; break;
        case 9:  reward = { parts: 3 }; break;
        case 10: reward = { skin: 'p-sombra' }; break;
        case 12: reward = { skin: 'p-crono' }; break;
        case 13: reward = { coins: 1000 }; break;
        default: reward = { coins: idx === 0 ? 150 : 500 };
      }
      return { xp: xp, reward: reward };
    });
  }
  const PASS_PREMIUM_TIERS = passPremiumTiers();

  /* Aplica el reequilibrio UNA vez a todo el catálogo de tienda.
   * Los precios 0 (iniciales/gratis) se conservan. */
  [SKINS, HATS, EFFECTS, MAPS, TOOLS, EGGS, DECOR].forEach(list => {
    list.forEach(it => {
      if (typeof it.price === 'number' && it.price > 0) {
        it.basePrice = it.price;
        it.price = ECONOMY.price(it.price);
      }
    });
  });

  return {
    SKINS, HATS, EFFECTS, MAPS, ACH, DIFFS, TOOLS, MISSIONS, PASS_TIERS, SEASON_TIERS,
    PASS_PREMIUM_TIERS, PASS_PREMIUM_PRICE, passPremiumTiers,
    SEASONS, SEASON_ORDER, seasonIndex, seasonKey, seasonInfo, passTiers,
    CONTENT_EPOCH, curWeek, isUnlocked, weekLabel,
    getSkin, getHat, getFx, getMap, getDiff, getAch, getTool,
    isExclusive, rarityOf, mapCfg,
    skinStats, boxDef, evolveStage,
    ECONOMY, TOOL_DUR, toolMaxDur, toolWear,
    NEST_LEVELS, NEST_MAX_OBJ, nestInfo, nestObjPos,
    EGGS, getEgg, eggPool,
    DECOR, getDecor, decorsByCat
  };
})();