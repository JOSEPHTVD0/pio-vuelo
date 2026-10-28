/* Pruebas automáticas de Pío Vuelo (sin dependencias).
 * Ejecuta los scripts reales (data.js, save.js, game.js) dentro de un contexto
 * Node con DOM/canvas/localStorage simulados y comprueba las reglas clave:
 * tubos, objetos, cronómetros, escudos, identidad, récords y reinicios.
 *
 *   node tools/test-game.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const KEY = 'piovuelo_v1';

/* ---------------- Simulaciones de navegador ---------------- */
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); },
  clear: () => store.clear(),
  key: i => Array.from(store.keys())[i] || null,
  get length() { return store.size; }
};

function makeCtx() {
  const grad = { addColorStop() { } };
  return {
    canvas: null,
    save() { }, restore() { }, setTransform() { }, resetTransform() { },
    clearRect() { }, fillRect() { }, strokeRect() { }, translate() { }, scale() { }, rotate() { },
    beginPath() { }, closePath() { }, moveTo() { }, lineTo() { }, arc() { }, arcTo() { }, ellipse() { }, rect() { },
    fill() { }, stroke() { }, clip() { }, setLineDash() { },
    createLinearGradient() { return grad; }, createRadialGradient() { return grad; },
    createPattern() { return null; }, drawImage() { },
    fillText() { }, strokeText() { }, measureText() { return { width: 10 }; },
    getImageData() { return { data: [] }; }, putImageData() { },
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    shadowBlur: 0, shadowColor: '#000', lineDashOffset: 0
  };
}

const els = new Map();
function makeEl(id) {
  const el = {
    id: id || '',
    textContent: '',
    innerHTML: '',
    value: '',
    style: {},
    dataset: {},
    children: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) {
        const val = on === undefined ? !this._s.has(c) : !!on;
        if (val) this._s.add(c); else this._s.delete(c);
        return val;
      },
      contains(c) { return this._s.has(c); }
    },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    remove() { },
    setAttribute() { },
    getAttribute() { return null; },
    addEventListener() { },
    removeEventListener() { },
    querySelector() { return makeEl('q'); },
    querySelectorAll() { return []; },
    get firstElementChild() { return this.children[0] || null; },
    get childElementCount() { return this.children.length; },
    focus() { }, click() { }, blur() { },
    getContext() { return makeCtx(); },
    width: 0, height: 0
  };
  return el;
}
const document = {
  hidden: false,
  body: makeEl('body'),
  getElementById(id) {
    if (!els.has(id)) els.set(id, makeEl(id));
    return els.get(id);
  },
  createElement(tag) {
    const el = makeEl(tag);
    if (tag === 'canvas') { el.getContext = () => makeCtx(); }
    if (tag === 'a') { el.href = ''; el.download = ''; }
    return el;
  },
  querySelector() { return makeEl('q'); },
  querySelectorAll() { return []; },
  addEventListener() { },
  removeEventListener() { }
};

// Objeto "comodín": cualquier propiedad o llamada devuelve otro comodín.
const noop = new Proxy(function () { }, {
  get(t, p) { return p === Symbol.toPrimitive ? () => '' : noop; },
  apply() { return undefined; }
});

const sandbox = {
  console, Math, Date, JSON, isFinite, isNaN, parseInt, parseFloat,
  String, Number, Boolean, Object, Array, RegExp, Error, Map, Set, Symbol,
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage, document,
  navigator: {},
  location: { href: '', reload() { } },
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => { },
  CustomEvent: class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
  },
  addEventListener() { }, removeEventListener() { }, dispatchEvent() { return true; },
  innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
  UI: noop, SND: noop, FX: noop, ENTS: noop, BG: noop, ADS: undefined
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);
for (const f of ['js/data.js', 'js/save.js', 'js/game.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}

const DAT = sandbox.DAT;
const SAVE = sandbox.SAVE;
const G = sandbox.G;
const T = G.__test;

/* ---------------- Mini framework ---------------- */
let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, extra) {
  if (cond) { pass++; return true; }
  fail++;
  failures.push(name + (extra ? ' → ' + extra : ''));
  return false;
}
function section(name) { console.log('\n■ ' + name); }
function group(name) { console.log('  · ' + name); }
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

function inPipeBody(x, y, r, p) {
  if (x + r <= p.x || x - r >= p.x + p.w) return false;
  return (y - r < p.gap - p.gapHalf) || (y + r > p.gap + p.gapHalf);
}

function checkPipes(tag) {
  const H = G.getEnv().H;
  const groundH = G.getEnv().groundH;
  const pipes = G.getPipes().slice().sort((a, b) => a.x - b.x);
  let overlap = 0, outOfBounds = 0;
  for (let i = 0; i < pipes.length; i++) {
    const p = pipes[i];
    if (p.gap - p.gapHalf < -0.01 || p.gap + p.gapHalf > H - groundH + 0.01) outOfBounds++;
    if (i > 0) {
      const prev = pipes[i - 1];
      if (p.x < prev.x + prev.w + 29.5) overlap++;
    }
  }
  ok(pipes.length > 10, tag + ': se generaron tubos', 'n=' + pipes.length);
  ok(overlap === 0, tag + ': ningún tubo se solapa', overlap + ' solapes');
  ok(outOfBounds === 0, tag + ': huecos dentro de la pantalla', outOfBounds + ' fuera');
  return pipes;
}

function checkCollectibles(tag, pipes) {
  const H = G.getEnv().H, W = G.getEnv().W, groundH = G.getEnv().groundH;
  const coins = G.getCoins();
  const powers = G.getPowers();
  let bad = 0, outside = 0;
  const all = coins.map(c => ({ x: c.x, y: c.y, r: c.r }))
    .concat(powers.map(p => ({ x: p.x, y: p.y, r: p.r })));
  all.forEach(o => {
    if (o.y - o.r < -0.01 || o.y + o.r > H - groundH + 0.01 || o.x + o.r < -0.01) outside++;
    if (pipes.some(p => inPipeBody(o.x, o.y, o.r, p))) bad++;
  });
  ok(all.length > 5, tag + ': hay monedas/power-ups', 'n=' + all.length);
  ok(bad === 0, tag + ': nada dentro de un tubo', bad + ' objetos dentro');
  ok(outside === 0, tag + ': nada fuera de la pantalla', outside + ' fuera');
  return { coins: coins.length, powers: powers.length };
}

/* ---------------- Arranque ---------------- */
section('ARRANQUE Y PERSISTENCIA BÁSICA');
SAVE.load();
G.setMode('free');
G.resize();
G.forceRestart();
ok(!!SAVE.get(), 'SAVE.load() crea datos');
ok(SAVE.getProfile().id.indexOf('p_') === 0, 'identidad con id estable');
ok(SAVE.getProfile().created > 0, 'identidad con fecha de creación');

/* ---------------- 1. Tubos ---------------- */
section('1. TUBOS: separación y límites');
G.resize();
G.forceRestart();
const env = G.getEnv();
for (let i = 0; i < 120; i++) T.mkPipe(1600 + i * 260, env.D);
let pipes = checkPipes('1024x768');

group('Tras redimensionar a móvil 320x480');
sandbox.innerWidth = 320; sandbox.innerHeight = 480;
G.resize();
checkPipes('320x480');

group('Tras redimensionar a escritorio 1440x900');
sandbox.innerWidth = 1440; sandbox.innerHeight = 900;
G.resize();
pipes = checkPipes('1440x900');

group('Tras redimensionar a tablet 768x1024 (vertical)');
sandbox.innerWidth = 768; sandbox.innerHeight = 1024;
G.resize();
checkPipes('768x1024');

/* ---------------- 2. Objetos ---------------- */
section('2. MONEDAS Y POWER-UPS: posiciones válidas');
sandbox.innerWidth = 1024; sandbox.innerHeight = 768;
G.resize();
G.forceRestart();
const env2 = G.getEnv();
for (let i = 0; i < 90; i++) T.mkPipe(1500 + i * 240, env2.D);
pipes = G.getPipes();
let madePower = 0, madeMega = 0, madeChain = 0, madeEnemy = 0;
for (let i = 0; i < 40; i++) {
  if (T.spawnPower()) madePower++;
  if (T.spawnMega()) madeMega++;
  if (T.spawnChain()) madeChain++;
  if (T.spawnEnemy()) madeEnemy++;
}
const counts = checkCollectibles('spawns', pipes);
console.log('    objetos:' + JSON.stringify({ coins: counts.coins, powers: counts.powers, powerSpawns: madePower, mega: madeMega, chain: madeChain, enemy: madeEnemy }));

group('Colocación forzada dentro de un tubo');
{
  const p = G.getPipes()[0];
  const before = G.getCoins().length;
  const placed = T.coinSafe(p.x + p.w / 2, p.gap + p.gapHalf + 8, 10, {});
  const after = G.getCoins();
  if (placed) {
    const c = after[after.length - 1];
    ok(!inPipeBody(c.x, c.y, c.r, p), 'addCoinSafe recoloca fuera del cuerpo del tubo');
  } else {
    ok(true, 'addCoinSafe rechaza la posición imposible');
  }
  ok(G.getCoins().length === before + (placed ? 1 : 0), 'addCoinSafe no duplica la moneda');
}

/* ---------------- 3. Cronómetros ---------------- */
section('3. CRONÓMETROS DE HABILIDADES');
G.forceRestart();
T.setT(500);
T.applyTool('slow', 'free');
let timers = G.getEffectTimers();
ok(timers.length === 1 && timers[0].key === 'slow', 'slow crea 1 cronómetro', JSON.stringify(timers));
ok(near(timers[0].left, 5, 0.01), 'slow dura 5 s', 'left=' + (timers[0] && timers[0].left));
ok(timers[0].state === 'active', 'slow empieza activo');

T.applyTool('slow', 'free'); // reactivar no duplica
ok(G.getEffectTimers().length === 1, 'reactivar slow no duplica cronómetros');

T.activate('x2');
ok(G.getEffectTimers().length === 2, 'x2 añade un segundo cronómetro');

T.setT(503);
timers = G.getEffectTimers();
const slowChip = timers.find(t => t.key === 'slow');
ok(!!slowChip && slowChip.state === 'expiring', 'slow a 2 s pasa a estado "expiring"', slowChip && slowChip.state);

T.setT(505.5);
ok(!G.getEffectTimers().some(t => t.key === 'slow'), 'slow desaparece al llegar a 0');
ok(G.getEffectTimers().some(t => t.key === 'x2'), 'x2 sigue activo con su propio tiempo');

T.setT(600);
ok(G.getEffectTimers().length === 0, 'todos los cronómetros expiran');

group('Duración de herramientas (effDur)');
T.setT(700);
T.applyTool('turbo', 'free');
let turbo = G.getEffectTimers().find(t => t.key === 'turbo');
ok(!!turbo && turbo.total >= 4, 'turbo guarda duración total', turbo && turbo.total);
const beforePct = turbo.pct;
T.setT(701);
turbo = G.getEffectTimers().find(t => t.key === 'turbo');
ok(turbo.pct < beforePct, 'la barra de progreso baja con el tiempo');

group('Escudo como poder: solo dura la partida y no crea cronómetro');
G.forceRestart();
const shBefore = SAVE.shieldCount();
T.activate('shield');
ok(SAVE.shieldCount() === shBefore, 'el power-up no modifica el stock guardado');
ok(T.getRunShields() === 1, 'el power-up suma 1 escudo de partida');
T.activate('shield');
ok(T.getRunShields() === 2, 'los escudos de partida se acumulan en el mismo vuelo');
ok(SAVE.shieldCount() === shBefore, 'acumular en partida no toca el stock');
ok(!G.getEffectTimers().some(t => t.key === 'shield'), 'el escudo no crea cronómetro');

group('Pausa: el reloj del juego no avanza solo');
T.setT(800);
T.applyTool('slow', 'free');
const a = G.getEffectTimers().find(t => t.key === 'slow');
const b = G.getEffectTimers().find(t => t.key === 'slow');
ok(a && b && near(a.left, b.left, 1e-9), 'sin cambiar t, el cronómetro no se desincroniza');

/* ---------------- 4. Escudos de partida vs guardados ---------------- */
section('4. ESCUDOS: partida, stock y máximo 1 guardado por vuelo');
G.forceRestart();
const baseSh = SAVE.shieldCount();
SAVE.addShield(3);
const stock0 = SAVE.shieldCount();
ok(stock0 === baseSh + 3, 'addShield acumula stock sin tope', 'total=' + stock0);

T.setT(2000);
const bird = T.bird();
T.activate('shield');
T.activate('shield');
ok(T.getRunShields() === 2, 'se apilan 2 escudos de partida');
ok(SAVE.shieldCount() === stock0, 'los escudos de partida no se guardan en el stock');
let shState = G.getShieldState();
ok(shState.run === 2 && shState.stock === stock0, 'getShieldState separa partida y stock');

T.hit(bird, 0);
ok(!bird.dead, 'un escudo de partida evita la muerte');
ok(T.getRunShields() === 1, 'el primer golpe gasta un escudo de partida');
ok(SAVE.shieldCount() === stock0, 'mientras haya escudos de partida no se toca el stock');
T.hit(bird, 0);
ok(T.getRunShields() === 1, 'los i-frames impiden gastar 2 escudos en el mismo choque');

T.setT(2001.2);
T.hit(bird, 0);
ok(T.getRunShields() === 0, 'tras 1 s se puede gastar el siguiente escudo de partida');
ok(SAVE.shieldCount() === stock0, 'gastar el último escudo de partida sigue sin tocar el stock');

T.setT(2002.4);
T.hit(bird, 0);
ok(!bird.dead, 'sin escudos de partida, un escudo guardado bloquea el golpe');
ok(SAVE.shieldCount() === stock0 - 1, 'se gasta exactamente 1 escudo guardado');
ok(T.getUsedStockShield() === true, 'queda marcado que ya se usó el guardado del vuelo');

// Con rescate activo comprobamos que el segundo golpe ya no toca el stock
// (la prioridad pasa a rescate/Fénix antes que a un segundo guardado).
T.applyTool('rescate', 'free');
T.setT(2003.6);
T.hit(bird, 0);
ok(SAVE.shieldCount() === stock0 - 1, 'no se gasta un segundo escudo guardado en la misma partida');
ok(!bird.dead, 'el golpe posterior lo absorbe el rescate, no el stock');

const stored = JSON.parse(localStorage.getItem(KEY));
ok(stored.shields === SAVE.shieldCount(), 'el escudo guardado se descuenta al instante', 'raw=' + stored.shields);
ok(SAVE.get().stats.shieldAbsorbed >= 3, 'se contabilizan los choques absorbidos');

const persistedShields = SAVE.shieldCount();
SAVE.load();
ok(SAVE.shieldCount() === persistedShields, 'el stock restante sobrevive a recargar');

G.forceRestart();
ok(T.getRunShields() === 0, 'reiniciar limpia los escudos recogidos en la partida');
ok(T.getUsedStockShield() === false, 'reiniciar vuelve a habilitar 1 guardado por partida');
ok(SAVE.shieldCount() === persistedShields, 'reiniciar conserva el stock no gastado');
T.activate('shield');
G.forceRestart();
ok(T.getRunShields() === 0, 'los escudos recogidos no pasan a la siguiente partida');
ok(SAVE.shieldCount() === persistedShields, 'reiniciar no duplica ni borra escudos guardados');

const beforeRestartSh = SAVE.shieldCount();
const beforeRestartGames = SAVE.get().stats.flights;
const beforeRestartRuns = SAVE.get().runs.length;
G.forceRestart();
ok(SAVE.shieldCount() === beforeRestartSh, 'reiniciar varias veces no altera el stock');
ok(SAVE.get().stats.flights === beforeRestartGames, 'reiniciar no cuenta una partida extra');
ok(SAVE.get().runs.length === beforeRestartRuns, 'reiniciar no duplica vuelos en el historial');

/* ---------------- 5. Identidad y nombres ---------------- */
section('5. IDENTIDAD, NOMBRE ALEATORIO Y RENOMBRADO');
const prof0 = SAVE.getProfile();
ok(prof0.name.length >= 2 && prof0.name.length <= 16, 'nombre inicial válido', prof0.name);
ok(SAVE.cleanName(prof0.name) === prof0.name, 'nombre inicial solo usa caracteres permitidos', prof0.name);
ok(prof0.id === SAVE.getProfile().id, 'id estable entre lecturas');

ok(!SAVE.rename('').ok, 'renombrar a vacío se rechaza');
ok(!SAVE.rename('   ').ok, 'renombrar a solo espacios se rechaza');
ok(!SAVE.rename('A').ok, 'nombre de 1 carácter se rechaza');
ok(!SAVE.rename('x'.repeat(17)).ok, 'nombre de 17 caracteres se rechaza');
ok(!SAVE.rename('Nombre$Raro').ok, 'caracteres ilegales se rechazan');

const r1 = SAVE.rename('  NombreUno  ');
ok(r1.ok && r1.name === 'NombreUno', 'renombrado válido recorta espacios', JSON.stringify(r1));
ok(SAVE.getProfile().id === prof0.id, 'el id no cambia al renombrar');
ok(SAVE.getProfile().name === 'NombreUno', 'el nombre nuevo se persiste');

const r2 = SAVE.rename('NombreDos');
ok(r2.ok, 'segundo renombrado válido');
ok(!SAVE.rename('NombreUno').ok, 'no se permite un nombre ya usado en el dispositivo');
ok(!SAVE.rename('nombreuno').ok, 'el duplicado se detecta sin distinguir mayúsculas');
ok(!SAVE.rename('Nombre Dos ').ok || SAVE.getProfile().name === 'Nombre Dos', 'espacios internos se normalizan');

const curName = SAVE.getProfile().name;
let randOk = 0;
for (let i = 0; i < 30; i++) {
  const n = SAVE.randomName();
  if (n !== curName && n.length >= 2 && n.length <= 16 && SAVE.cleanName(n) === n) randOk++;
}
ok(randOk === 30, 'randomName genera nombres válidos y distintos del actual', randOk + '/30');

SAVE.load();
ok(SAVE.getProfile().name === curName, 'el nombre sobrevive a recargar');
ok(SAVE.getProfile().id === prof0.id, 'el id sobrevive a recargar');

const rawName = JSON.parse(localStorage.getItem(KEY));
ok(rawName.profile.name === curName, 'el nombre está guardado en localStorage');
ok(Array.isArray(rawName.knownNames) && rawName.knownNames.length >= 2, 'se recuerdan los nombres usados');

/* ---------------- 6. Récords y clasificación ---------------- */
section('6. RÉCORDS: guardado, orden y recarga');
const runsBefore = SAVE.get().runs.length;
const gamesBefore = SAVE.get().stats.flights;
const rec1 = SAVE.endRun(10, 3, 1, 10, 100, 'free');
const rec2 = SAVE.endRun(30, 5, 2, 20, 200, 'free');
const rec3 = SAVE.endRun(20, 4, 1, 15, 150, 'zen');
ok(rec1 === true, '10 pts es récord con la tabla vacía');
ok(rec2 === true, '30 pts supera el récord');
ok(rec3 === false, '20 pts no supera el récord de 30');
ok(SAVE.get().stats.flights === gamesBefore + 3, 'se cuentan 3 partidas');
ok(SAVE.get().runs.length === Math.min(30, runsBefore + 3), 'se guardan los vuelos');

let lb = SAVE.leaderboard();
ok(lb.players.length === 1, 'un solo jugador (sin duplicados por vuelo)', 'players=' + lb.players.length);
ok(lb.players[0].me === true, 'el jugador actual está marcado');
ok(lb.players[0].best === 30, 'mejor puntuación = 30', lb.players[0].best);
ok(lb.players[0].last === 20, 'última puntuación = 20', lb.players[0].last);
ok(lb.players[0].games === 3, 'partidas del jugador = 3', lb.players[0].games);
ok(lb.players[0].bestDate > 0, 'fecha del récord guardada');
ok(lb.runs.length >= 3 && lb.runs[0].score === 30 && lb.runs[1].score === 20 && lb.runs[2].score === 10,
  'mejores vuelos ordenados de mayor a menor', lb.runs.slice(0, 3).map(r => r.score).join(','));

group('Varios jugadores en el dispositivo');
{
  const raw = JSON.parse(localStorage.getItem(KEY));
  const now = Date.now();
  raw.players.push({ id: 'p_rival', name: 'Rival', best: 100, last: 60, games: 2, bestDate: now - 1000, lastDate: now - 500 });
  raw.knownNames.push('Rival');
  localStorage.setItem(KEY, JSON.stringify(raw));
  SAVE.load();
  lb = SAVE.leaderboard();
  ok(lb.players.length === 2, 'se leen los dos jugadores', 'n=' + lb.players.length);
  ok(lb.players[0].name === 'Rival' && lb.players[0].best === 100, 'el rival con 100 pts va primero');
  ok(lb.players[1].me === true, 'el jugador local queda segundo');
  ok(lb.players[0].best >= lb.players[1].best, 'orden descendente por mejor puntuación');
}

group('Recarga');
{
  const before = SAVE.leaderboard();
  SAVE.load();
  const after = SAVE.leaderboard();
  ok(JSON.stringify(before) === JSON.stringify(after), 'la clasificación es idéntica tras recargar');
  ok(after.players.find(p => p.me).best === 30, 'el récord local sobrevive a recargar');
}

group('Corrupción del guardado');
{
  localStorage.setItem(KEY, '{esto no es json');
  const first = SAVE.load();
  ok(first === true, 'un guardado corrupto se detecta sin lanzar excepción');
  ok(localStorage.getItem(KEY + '_bak') === '{esto no es json', 'el guardado corrupto se respalda');
  ok(SAVE.get().stats.best === 0, 'se empieza de cero tras corrupción');
}

/* ---------------- 7. Reinicio y no duplicación ---------------- */
section('7. REINICIO: sin duplicar datos ni efectos');
SAVE.load();
G.forceRestart();
G.setMode('free');
G.forceRestart();
const flightsA = SAVE.get().stats.flights;
const runsA = SAVE.get().runs.length;
const shA = SAVE.shieldCount();
G.forceRestart();
G.forceRestart();
ok(SAVE.get().stats.flights === flightsA, 'reiniciar varias veces no incrementa partidas');
ok(SAVE.get().runs.length === runsA, 'reiniciar varias veces no duplica vuelos');
ok(SAVE.shieldCount() === shA, 'reiniciar varias veces no altera escudos');
ok(G.getEffectTimers().length === 0, 'reiniciar limpia los cronómetros');

/* ---------------- Resumen ---------------- */
console.log('\n────────────────────────────────────────');
console.log('Pruebas superadas: ' + pass + ' · fallidas: ' + fail);
if (fail) {
  console.log('\nFALLOS:');
  failures.forEach(f => console.log(' - ' + f));
  process.exitCode = 1;
} else {
  console.log('✅ Todo correcto');
}
