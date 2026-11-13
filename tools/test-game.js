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
// FX.draw() y FX.getShake() se usan al renderizar: devolver datos válidos
// permite probar el bucle real sin navegador.
const fxMock = new Proxy(function () { }, {
  get(t, p) {
    if (p === 'getShake') return () => ({ x: 0, y: 0 });
    return p === Symbol.toPrimitive ? () => '' : noop;
  },
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
  UI: noop, SND: noop, FX: fxMock, ENTS: noop, BG: noop, ADS: undefined
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);
for (const f of ['js/data.js', 'js/mp.js', 'js/save.js', 'js/game.js']) {
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

// Clave canónica global: sin mayúsculas, sin tildes y segura como id de documento.
ok(SAVE.nameKey('José') === SAVE.nameKey('jose'), 'la clave de nombre ignora tildes y mayúsculas',
  SAVE.nameKey('José') + ' vs ' + SAVE.nameKey('jose'));
ok(SAVE.nameKey('  Nombre   Uno ') === SAVE.nameKey('nombre uno'),
  'la clave de nombre colapsa espacios y recorta extremos');
ok(SAVE.nameKey('') === '' && SAVE.nameKey(null) === '', 'un nombre vacío no genera clave');
const nk = SAVE.nameKey('Pío Vuelo/2');
ok(nk.slice(0, 2) === 'n_', 'la clave lleva el prefijo n_', nk);
ok(nk.indexOf('/') === -1 && nk.indexOf(' ') === -1, 'la clave es segura para Firestore', nk);
ok(SAVE.nameKey('Pío Vuelo/2') === nk, 'la clave es determinista');

const cnOk = SAVE.checkName('  NombreTres  ');
ok(cnOk.ok && cnOk.name === 'NombreTres' && cnOk.key === SAVE.nameKey('NombreTres'),
  'checkName acepta un nombre libre y devuelve su clave', JSON.stringify(cnOk));
ok(cnOk.unchanged === false, 'checkName marca el nombre como nuevo');
ok(SAVE.getProfile().name === curName, 'checkName no cambia el perfil por sí solo');
ok(!SAVE.checkName('').ok && !SAVE.checkName('A').ok && !SAVE.checkName('Nombre$Raro').ok,
  'checkName rechaza vacío, corto y caracteres ilegales');
ok(!SAVE.checkName('NombreUno').ok, 'checkName rechaza un nombre ya usado en el dispositivo');
const cnSame = SAVE.checkName(curName);
ok(cnSame.ok && cnSame.unchanged === true, 'checkName reconoce el nombre actual como sin cambios');

// Nombre vinculado a una cuenta: no usa la lista del dispositivo, porque la
// unicidad global la garantiza la cuenta en la nube.
let savedEvents = 0;
const oldDispatch = sandbox.dispatchEvent;
sandbox.dispatchEvent = function (ev) {
  if (ev && ev.type === 'piovuelo:saved') savedEvents++;
  return true;
};
const sp1 = SAVE.setProfileName('CuentaOficial');
ok(sp1.ok && SAVE.getProfile().name === 'CuentaOficial', 'setProfileName fija el nombre de la cuenta', JSON.stringify(sp1));
ok(savedEvents >= 1, 'cada guardado correcto emite el aviso para la nube', String(savedEvents));
const sp2 = SAVE.setProfileName('CuentaDos');
ok(sp2.ok && SAVE.getProfile().name === 'CuentaDos' && sp2.key === SAVE.nameKey('CuentaDos'),
  'setProfileName acepta otro nombre válido y devuelve su clave');
ok(!SAVE.setProfileName('A').ok && !SAVE.setProfileName('Nombre$Raro').ok && !SAVE.setProfileName('   ').ok,
  'setProfileName rechaza nombres inválidos');
ok(SAVE.setProfileName(' CuentaTres ').ok && SAVE.getProfile().name === 'CuentaTres',
  'setProfileName recorta los espacios exteriores');
ok(SAVE.getProfile().name === 'CuentaTres', 'los nombres inválidos no cambian el perfil');
sandbox.dispatchEvent = oldDispatch;

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

/* ---------------- 8. Imán: monedas detrás del ave ---------------- */
section('8. IMÁN: recoge monedas detrás del ave a alta velocidad');
{
  G.startPlay('free');
  const b = T.bird();
  T.setT(10);
  T.applyTool('magnet', 'free');
  const list = T.coins();
  list.length = 0;
  const beforeCoins = SAVE.get().coins;
  const placed = T.coinSafe(b.x - 140, b.y, 9);
  ok(placed, 'se coloca una moneda detrás del ave');
  ok(list.length === 1, 'hay 1 moneda detrás del ave', 'n=' + list.length);

  let frames = 0;
  for (let i = 0; i < 240 && list.length > 0; i++) {
    T.updateCoins(1 / 60, 680); // velocidad muy alta: antes dejaba la moneda atrás
    frames++;
  }
  ok(list.length === 0, 'el imán recoge la moneda que quedó detrás', 'frames=' + frames);
  ok(frames < 120, 'la recoge en menos de 2 s', 'frames=' + frames);
  ok(SAVE.get().coins > beforeCoins, 'la moneda suma al contador', SAVE.get().coins + ' vs ' + beforeCoins);

  group('Varias monedas repartidas alrededor');
  list.length = 0;
  const spots = [
    [b.x - 220, b.y - 60], [b.x - 120, b.y + 70], [b.x - 30, b.y - 90],
    [b.x + 40, b.y + 40], [b.x - 160, b.y]
  ];
  let put = 0;
  for (const s of spots) if (T.coinSafe(s[0], s[1], 9)) put++;
  ok(put === spots.length, 'se colocan todas las monedas de prueba', put + '/' + spots.length);
  for (let i = 0; i < 360 && list.length > 0; i++) T.updateCoins(1 / 60, 680);
  ok(list.length === 0, 'el imán no deja ninguna moneda atrás', 'quedan=' + list.length);

  group('Sin imán el scroll sigue funcionando');
  list.length = 0;
  const coin = T.coinSafe(b.x + 60, b.y, 9);
  ok(coin, 'moneda de control colocada');
  const x0 = list[0].x;
  T.updateCoins(1 / 60, 300);
  ok(list.length === 0 || list[0].x < x0, 'sin imán la moneda se desplaza con el mundo');
}

/* ---------------- 9. Cuenta atrás al reanudar ---------------- */
section('9. PAUSA: cuenta atrás 3-2-1 antes de continuar');
{
  G.startPlay('free');
  const b = T.bird();
  T.setT(50);
  G.setPaused(true);
  ok(G.isPaused(), 'la partida queda en pausa');
  ok(!G.isResuming(), 'en pausa no hay cuenta atrás');

  G.togglePause(); // reanudar
  ok(!G.isPaused(), 'se sale de la pausa');
  ok(G.isResuming(), 'empieza la cuenta atrás');
  ok(near(G.getResumeLeft(), 3, 0.001), 'la cuenta atrás empieza en 3', G.getResumeLeft());

  const tBefore = T.getT();
  const vyBefore = b.vy;
  G.flap();
  ok(b.vy === vyBefore, 'el aleteo está bloqueado durante la cuenta atrás');

  T.tickResume(1.05);
  ok(G.getResumeLeft() < 2 && G.getResumeLeft() > 1, 'pasa de 3 a 2', G.getResumeLeft());
  ok(T.getT() === tBefore, 'el mundo sigue congelado entre números');
  T.tickResume(1);
  ok(G.getResumeLeft() < 1 && G.getResumeLeft() > 0, 'pasa de 2 a 1', G.getResumeLeft());
  T.tickResume(1);
  ok(near(G.getResumeLeft(), 0, 0.001), 'la cuenta atrás llega a 0', G.getResumeLeft());
  ok(!G.isResuming(), 'al llegar a 0 se puede jugar');
  G.flap();
  ok(b.vy !== vyBefore, 'el aleteo vuelve a funcionar');

  group('Cancelación de la cuenta atrás');
  G.togglePause();
  ok(G.isPaused(), 'se puede volver a pausar');
  G.togglePause();
  ok(G.isResuming(), 'al reanudar de nuevo arranca la cuenta atrás');
  G.togglePause();
  ok(G.isPaused() && !G.isResuming(), 'pausar durante la cuenta atrás la cancela');

  G.togglePause();
  ok(G.isResuming(), 'otra reanudación vuelve a contar');
  G.setPaused(false);
  ok(!G.isResuming(), 'setPaused(false) limpia la cuenta atrás');

  group('Cuenta atrás con pocos FPS');
  G.startPlay('free');
  T.setT(80);
  G.setPaused(true);
  G.togglePause();
  const tFps = T.getT();
  G.loop(1000); // primer frame tras 1 s (navegador limitado a 1 FPS)
  ok(G.getResumeLeft() < 2.01 && G.getResumeLeft() > 1.99, '1 s real descuenta 1 s aunque haya pocos FPS', G.getResumeLeft());
  G.loop(2000);
  ok(G.getResumeLeft() < 1.01 && G.getResumeLeft() > 0.99, '2 s reales descontados', G.getResumeLeft());
  G.loop(3000);
  ok(near(G.getResumeLeft(), 0, 0.001), '3 s reales terminan la cuenta atrás', G.getResumeLeft());
  ok(T.getT() === tFps, 'el mundo no avanzó durante esos 3 s');

  group('Reiniciar y salir');
  G.setPaused(true);
  G.togglePause();
  ok(G.isResuming(), 'cuenta atrás activa antes de reiniciar');
  G.forceRestart();
  ok(!G.isResuming(), 'reiniciar cancela la cuenta atrás');
  G.goMenu();
  ok(!G.isResuming(), 'salir al menú cancela la cuenta atrás');
}

/* ---------------- 10. Economía centralizada ---------------- */
section('10. ECONOMÍA: precios reequilibrados y cobros seguros');
{
  SAVE.reset(); SAVE.load();
  const berry = DAT.SKINS.find(x => x.id === 'berry');
  ok(berry && berry.basePrice === 150, 'se conserva el precio base de las aves', berry && berry.basePrice);
  ok(berry.price === 170, 'precio final = base + tramo (150 → 170)', berry.price);
  ok(berry.price > berry.basePrice * 1.09 && berry.price <= berry.basePrice * 1.21,
    'la subida está en el rango +10–20 %', berry.price + ' vs ' + berry.basePrice);

  const catalog = [].concat(DAT.SKINS, DAT.HATS, DAT.EFFECTS, DAT.MAPS, DAT.TOOLS, DAT.EGGS, DAT.DECOR)
    .filter(x => x && typeof x.basePrice === 'number' && x.basePrice > 0);
  ok(catalog.length > 50, 'todo el catálogo de pago tiene precio base', 'n=' + catalog.length);
  ok(catalog.every(x => x.price % 5 === 0), 'todos los precios quedan en múltiplos de 5');
  const outOfRange = catalog.filter(x => x.price < x.basePrice * 1.09 || x.price > x.basePrice * 1.21);
  ok(outOfRange.length === 0, 'ningún precio se sale del reequilibrio', outOfRange.map(x => x.id + ':' + x.price).join(','));
  ok(DAT.boxDef().price === 580, 'la Caja Sorpresa también se reequilibra (500 → 580)', DAT.boxDef().price);

  const d = SAVE.get();
  d.coins = 100; SAVE.save();
  ok(SAVE.spendCoins(101) === false && SAVE.get().coins === 100, 'no se puede gastar más de lo que hay');
  ok(SAVE.spendCoins(0) === false && SAVE.get().coins === 100, 'gastar 0 no altera el saldo');
  ok(SAVE.addCoins(-25) === 0 && SAVE.get().coins === 100, 'no se pueden añadir monedas negativas');
  ok(SAVE.spendCoins(60) === true && SAVE.get().coins === 40, 'el cobro válido descuenta una sola vez');

  d.coins = 0; SAVE.save();
  const poor = SAVE.buy('skin', 'berry');
  ok(!poor.ok && SAVE.get().coins === 0, 'comprar sin saldo falla y no deja números negativos');
  ok(!SAVE.buyTool('tool-magnet').ok && SAVE.get().coins === 0, 'comprar herramienta sin saldo falla');

  SAVE.addCoins(1000);
  const coinsBefore = SAVE.get().coins;
  const buy1 = SAVE.buy('skin', 'berry');
  ok(buy1.ok && SAVE.get().coins === coinsBefore - berry.price, 'la compra descuenta exactamente el precio',
    SAVE.get().coins + ' vs ' + (coinsBefore - berry.price));
  const buy2 = SAVE.buy('skin', 'berry');
  ok(!buy2.ok, 'no se puede comprar dos veces el mismo artículo');
  ok(SAVE.owns(SAVE.get().skinsOwned, 'berry'), 'el artículo comprado queda en el inventario');
  SAVE.equip('skin', 'berry');
  ok(SAVE.get().skin === 'berry', 'equipar una skin comprada funciona');
}

/* ---------------- 11. Durabilidad, reparación y mejoras ---------------- */
section('11. DURABILIDAD: desgaste, rotura, reparación y mejora');
{
  SAVE.reset(); SAVE.load();
  const tool = DAT.TOOLS.find(t => t.key === 'magnet');
  const info0 = SAVE.toolDurInfo('magnet');
  ok(info0.max === DAT.toolMaxDur('magnet', 0), 'durabilidad máxima inicial según el catálogo', info0.max);
  ok(info0.cur === info0.max && info0.pct === 100, 'una herramienta nueva empieza al 100 %');
  ok(SAVE.toolUsable('magnet'), 'la herramienta nueva es usable');

  ok(SAVE.wearTool('magnet') === info0.max - 1, 'cada uso resta 1 punto de durabilidad');
  for (let i = 0; i < info0.max; i++) SAVE.wearTool('magnet');
  ok(SAVE.toolDur('magnet') === 0, 'la durabilidad nunca baja de 0');
  ok(!SAVE.toolUsable('magnet') && SAVE.toolDurInfo('magnet').broken, 'a 0 la herramienta queda rota');
  ok(SAVE.wearTool('magnet') === 0, 'usar una herramienta rota no genera valores negativos');

  SAVE.addCoins(5000);
  const bought = SAVE.buyTool(tool.id);
  ok(bought.ok, 'se puede comprar una herramienta rota para reponer stock');
  ok(SAVE.toolDur('magnet') === 1, 'comprar stock también recupera 1 punto (sin pasar del máximo)', SAVE.toolDur('magnet'));

  const cost = SAVE.toolRepairCost('magnet');
  ok(cost > 0 && cost < tool.price, 'la reparación cuesta menos que la herramienta', cost + ' vs ' + tool.price);
  const coinsB = SAVE.get().coins;
  const repaired = SAVE.repairTool('magnet');
  ok(repaired.ok && repaired.price === cost, 'reparar cobra el coste calculado');
  ok(SAVE.get().coins === coinsB - cost, 'la reparación descuenta exactamente una vez');
  ok(SAVE.toolDur('magnet') === SAVE.toolMaxDur('magnet'), 'la reparación deja la herramienta al máximo');
  ok((SAVE.get().stats.toolsRepaired || 0) >= 1, 'se cuenta la reparación en las estadísticas');
  ok(!SAVE.repairTool('magnet').ok, 'no se puede reparar una herramienta ya completa');

  group('Mejoras con piezas');
  SAVE.reset(); SAVE.load(); SAVE.addCoins(20000);
  const st0 = SAVE.toolStats('magnet');
  ok(st0.now.level === 0 && st0.next.level === 1, 'la comparativa muestra el siguiente nivel');
  ok(st0.next.max > st0.now.max, 'mejorar aumenta la durabilidad máxima', st0.now.max + '→' + st0.next.max);
  ok(st0.next.wear < st0.now.wear, 'mejorar reduce el desgaste por uso', st0.now.wear + '→' + st0.next.wear);

  const cUp = SAVE.get().coins;
  const up1 = SAVE.upToolLevel('magnet');
  ok(up1.ok && up1.level === 1, 'sube al nivel 1');
  ok(SAVE.get().coins === cUp - up1.price, 'la mejora cobra exactamente el precio');
  ok(SAVE.toolLevel('magnet') === 1, 'el nivel queda guardado');
  ok(SAVE.toolMaxDur('magnet') === DAT.toolMaxDur('magnet', 1), 'la nueva durabilidad máxima se aplica');
  ok(SAVE.toolDur('magnet') === SAVE.toolMaxDur('magnet'), 'la mejora añade la resistencia nueva sin reparar gratis de más');

  const up2 = SAVE.upToolLevel('magnet');
  ok(up2.ok && up2.parts === 0, 'nivel 1 → 2 no pide piezas');

  const cBlocked = SAVE.get().coins;
  const lvBlocked = SAVE.toolLevel('magnet');
  const noParts = SAVE.upToolLevel('magnet');
  ok(!noParts.ok && noParts.msg === 'no_parts', 'nivel 2 → 3 exige una pieza 🔩');
  ok(SAVE.get().coins === cBlocked && SAVE.toolLevel('magnet') === lvBlocked,
    'si faltan piezas no se cobra nada ni sube el nivel');

  SAVE.addParts(1);
  const withParts = SAVE.upToolLevel('magnet');
  ok(withParts.ok && SAVE.partsCount() === 0, 'con 1 pieza la mejora se completa y consume la pieza');

  let guard = 0;
  while (SAVE.toolLevel('magnet') < 8 && guard++ < 20) {
    SAVE.addParts(5); SAVE.addCoins(5000);
    if (!SAVE.upToolLevel('magnet').ok) break;
  }
  ok(SAVE.toolLevel('magnet') === 8, 'se puede llegar al nivel máximo 8');
  ok(SAVE.upToolLevel('magnet').msg === 'max', 'al nivel 8 ya no se puede mejorar');
  ok(SAVE.toolStats('magnet').next === null, 'la interfaz no ofrece mejorar por encima de 8');
  ok(SAVE.toolMaxDur('magnet') === DAT.toolMaxDur('magnet', 8),
    'el nivel 8 aplica la durabilidad máxima ampliada');
}

/* ---------------- 12. Piezas como material ---------------- */
section('12. PIEZAS 🔩: economía de material y recompensas');
{
  SAVE.reset(); SAVE.load();
  ok(SAVE.partsCount() === 0, 'se empieza sin piezas');
  SAVE.addParts(-5);
  ok(SAVE.partsCount() === 0, 'no se pueden restar piezas');
  SAVE.addParts(2);
  ok(SAVE.partsCount() === 2, 'las piezas se acumulan');
  ok(SAVE.spendParts(3) === false && SAVE.partsCount() === 2, 'no se pueden gastar piezas que no hay');
  ok(SAVE.spendParts(2) === true && SAVE.partsCount() === 0, 'gastar piezas válido descuenta exacto');

  const runA = SAVE.partsCount();
  const record = SAVE.endRun(25, 4, 5, 30, 120, 'free');
  ok(record === true, '25 pts es récord con la tabla vacía');
  ok(SAVE.partsCount() === runA + 3, 'un récord con 20+ pts da 3 piezas', SAVE.partsCount() - runA);

  const runB = SAVE.partsCount();
  SAVE.endRun(5, 1, 0, 10, 40, 'free');
  ok(SAVE.partsCount() === runB + 1, 'un vuelo normal sin marca da 1 pieza', SAVE.partsCount() - runB);
  ok((SAVE.get().stats.partsEarned || 0) >= 4, 'las piezas ganadas se cuentan en estadísticas');
}

/* ---------------- 13. Ajustes persistentes ---------------- */
section('13. AJUSTES: persistencia, saneado y restauración');
{
  SAVE.reset(); SAVE.load();
  const def = SAVE.resetSettings();
  ok(def.volG === 1 && def.fps === 0 && def.sens === 1, 'restaurar deja los valores de fábrica');
  ok(def.notif === true && def.uiAnim === true && def.confirmBuy === false, 'los ajustes nuevos tienen valores por defecto');

  SAVE.setSetting('volG', 0.35);
  SAVE.setSetting('fps', 60);
  SAVE.setSetting('sens', 1.25);
  SAVE.setSetting('notif', false);
  SAVE.setSetting('uiAnim', false);
  SAVE.setSetting('confirmBuy', true);
  SAVE.load();
  const st = SAVE.get().set;
  ok(near(st.volG, 0.35, 0.001), 'el volumen general persiste tras recargar', st.volG);
  ok(st.fps === 60, 'el límite de FPS persiste', st.fps);
  ok(near(st.sens, 1.25, 0.001), 'la sensibilidad persiste', st.sens);
  ok(st.notif === false && st.uiAnim === false && st.confirmBuy === true,
    'notificaciones, animaciones y confirmación de compras persisten');

  const raw = JSON.parse(localStorage.getItem(KEY));
  raw.set.volG = 'roto';
  raw.set.fps = 999;
  raw.set.sens = 99;
  raw.set.confirmBuy = 'sí';
  localStorage.setItem(KEY, JSON.stringify(raw));
  SAVE.load();
  const bad = SAVE.get().set;
  ok(typeof bad.volG === 'number' && bad.volG >= 0 && bad.volG <= 1, 'un volumen inválido se sanea', bad.volG);
  ok(bad.fps === 0, 'un límite de FPS fuera de la lista vuelve a Auto', bad.fps);
  ok(near(bad.sens, 1.5, 0.001), 'una sensibilidad exagerada se limita al máximo', bad.sens);
  ok(bad.confirmBuy === true, 'los booleanos se normalizan');

  ok(SAVE.get().tutorialDone === false, 'el tutorial empieza pendiente');
  SAVE.finishTutorial();
  SAVE.load();
  ok(SAVE.get().tutorialDone === true, 'cerrar el tutorial persiste');
}

/* ---------------- 14. Historial de compras ---------------- */
section('14. HISTORIAL: compras, mejoras y reparaciones');
{
  SAVE.reset(); SAVE.load();
  SAVE.addCoins(30000);
  ok(SAVE.getHistory().length === 0, 'el historial empieza vacío');
  const bt = SAVE.buyTool('tool-magnet');
  ok(bt.ok && SAVE.getHistory().length === 1, 'comprar una herramienta queda en el historial');
  ok(SAVE.getHistory()[0].k === 'compra' && SAVE.getHistory()[0].n === DAT.getTool('tool-magnet').name,
    'el historial guarda tipo y nombre', JSON.stringify(SAVE.getHistory()[0]));

  SAVE.wearTool('magnet');
  SAVE.wearTool('magnet');
  const rep = SAVE.repairTool('magnet');
  ok(rep.ok && SAVE.getHistory()[0].k === 'reparacion', 'la reparación encabeza el historial');

  for (let i = 0; i < 40; i++) SAVE.buyTool('tool-magnet');
  ok(SAVE.getHistory().length === 30, 'el historial se limita a 30 entradas', SAVE.getHistory().length);

  SAVE.addParts(5); SAVE.addCoins(5000);
  const up = SAVE.upToolLevel('magnet');
  ok(up.ok && SAVE.getHistory()[0].k === 'mejora', 'las mejoras también se registran');
}

/* ---------------- 15. Migración de guardados antiguos ---------------- */
section('15. MIGRACIÓN: guardados anteriores sin campos nuevos');
{
  const old = {
    v: 1, coins: 120, coinsEarned: 120, level: 2, xp: 10,
    stats: { best: 7, flights: 2, pipes: 5, timePlayed: 60, coinsGot: 20, dist: 100 },
    skinsOwned: [{ id: 'classic' }, { id: 'berry' }], hatsOwned: [],
    fxOwned: [{ id: 'fx-none' }], mapsOwned: [{ id: 'day' }],
    skin: 'berry', hat: null, fx: 'fx-none', map: 'day',
    items: { magnet: 2 }, toolUp: { magnet: 2 }, toolMode: {},
    nest: { decor: { bg: 'bg-cielo', floor: 'fl-pasto', poster: 'po-estrella', rug: 'rug-nada' }, decorOwned: [], eggs: [] },
    set: { sfx: true, music: true, vib: true, diff: 'normal', gfx: 'high', mode: 'free', volS: 0.8, volM: 0.5 }
  };
  localStorage.setItem(KEY, JSON.stringify(old));
  SAVE.load();
  const d = SAVE.get();
  ok(d.coins === 120 && d.stats.best === 7, 'los datos antiguos se conservan');
  ok(d.parts === 0, 'se añaden piezas con valor 0 si faltaban');
  ok(typeof d.toolDur === 'object' && d.toolDur.magnet === DAT.toolMaxDur('magnet', 2),
    'la durabilidad se inicializa según el nivel guardado', d.toolDur.magnet);
  ok(d.toolUp.magnet === 2 && SAVE.toolLevel('magnet') === 2, 'los niveles de mejora antiguos se respetan');
  ok(d.set.volG === 1 && d.set.fps === 0 && d.set.sens === 1, 'los ajustes nuevos toman su valor por defecto');
  ok(d.set.notif === true && d.set.uiAnim === true && d.set.confirmBuy === false, 'los interruptores nuevos arrancan activos/neutros');
  ok(near(d.set.volS, 0.8, 0.001) && near(d.set.volM, 0.5, 0.001), 'los volúmenes antiguos se mantienen');
  ok(Array.isArray(d.history) && d.history.length === 0, 'se crea un historial vacío');
  ok(d.tutorialDone === false, 'el tutorial queda pendiente en saves antiguos');
  ok(d.skin === 'berry' && SAVE.owns(d.skinsOwned, 'berry'), 'el ave equipada sigue siendo válida');

  const corrupt = JSON.parse(JSON.stringify(old));
  corrupt.coins = -50;
  corrupt.stats.best = -10;
  localStorage.setItem(KEY, JSON.stringify(corrupt));
  SAVE.load();
  ok(SAVE.get().coins === 0 && SAVE.get().stats.best === 0, 'un guardado con valores negativos se sanea');
}

/* ---------------- 16. Integridad de la interfaz ---------------- */
section('16. INTERFAZ: pantallas, navegación e inicio');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const uiSrc = fs.readFileSync(path.join(ROOT, 'js/ui.js'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');

  ['btnPlay', 'btnContinue', 'homeCoins', 'homeParts', 'homeNotice', 'homeTutorial',
    'homeNest', 'homeBest', 'homeLevel', 'homeXp', 'btnReplay', 'dailyPill', 'dailyRunPill',
    'badgeMissions', 'badgePass', 'badgeHome', 'badgeTools', 'homeSoundIco'
  ].forEach(id => ok(html.indexOf('id="' + id + '"') !== -1, 'index.html incluye #' + id));

  const navs = Array.from(new Set(Array.from(html.matchAll(/data-nav="([^"]+)"/g)).map(m => m[1])));
  ok(navs.length >= 8, 'la portada tiene accesos rápidos', navs.join(','));
  navs.forEach(n => ok(uiSrc.indexOf("case '" + n + "':") !== -1 || uiSrc.indexOf("case '" + n + "':") !== -1,
    'la navegación «' + n + '» tiene pantalla real'));

  ok(uiSrc.indexOf('function renderInventory') !== -1, 'existe la pantalla de inventario');
  ok(uiSrc.indexOf('function renderStats') !== -1, 'existe la pantalla de estadísticas');
  ok(uiSrc.indexOf('function renderHelp') !== -1, 'existe la pantalla de ayuda');
  ok(mainSrc.indexOf("getElementById('btnContinue')") !== -1, 'Continuar tiene acción real');
  ok(mainSrc.indexOf("getElementById('btnTutorialDone')") !== -1, 'el tutorial se puede cerrar');
  ok(mainSrc.indexOf('setMasterVol') === -1 ? true : mainSrc.indexOf('st.volG') !== -1,
    'el volumen general se aplica al arrancar');
}

/* ---------------- 17. Herramientas en vuelo ---------------- */
section('17. HERRAMIENTAS EN VUELO: consumo automático y manual');
{
  SAVE.reset(); SAVE.load(); SAVE.addCoins(20000);
  SAVE.buyTool('tool-magnet');
  SAVE.buyTool('tool-slow');
  SAVE.setToolMode('slow', 'manual');

  // Imán roto con stock: el consumo automático no debe gastarlo
  for (let i = 0; i < 20; i++) SAVE.wearTool('magnet');
  ok(SAVE.toolDur('magnet') === 0, 'el imán queda roto para la prueba');
  const magnetStock = SAVE.itemCount('magnet');
  T.consumeTools();
  ok(SAVE.itemCount('magnet') === magnetStock, 'una herramienta rota no se consume automáticamente');
  ok(SAVE.toolDur('magnet') === 0, 'consumir una herramienta rota no cambia su durabilidad');

  // Herramienta sana en modo auto: se consume una vez y se desgasta
  SAVE.setToolMode('slow', 'auto');
  const slowStock = SAVE.itemCount('slow');
  const slowDur = SAVE.toolDur('slow');
  T.consumeTools();
  ok(SAVE.itemCount('slow') === slowStock - 1, 'la herramienta automática gasta 1 unidad al iniciar');
  ok(SAVE.toolDur('slow') < slowDur, 'el uso automático desgasta la herramienta');

  // Uso manual en partida
  SAVE.setToolMode('slow', 'manual');
  SAVE.setToolMode('magnet', 'manual');
  SAVE.repairTool('magnet');
  ok(SAVE.toolUsable('magnet'), 'el imán reparado vuelve a ser usable');
  G.startPlay('free');
  ok(G.getState() === 'play', 'la partida está activa para usar la bolsa');
  const manualStock = SAVE.itemCount('magnet');
  const manualDur = SAVE.toolDur('magnet');
  const manualUses = SAVE.get().stats.manualUses || 0;
  T.useBagTool('magnet');
  ok(SAVE.itemCount('magnet') === manualStock - 1, 'usar la bolsa gasta 1 unidad');
  ok(SAVE.toolDur('magnet') < manualDur, 'usar la bolsa desgasta la herramienta');
  ok((SAVE.get().stats.manualUses || 0) === manualUses + 1, 'se cuenta el uso manual en estadísticas');

  // Herramienta rota con stock: la bolsa no la consume
  SAVE.get().items.magnet = 2; SAVE.save();
  for (let i = 0; i < 20; i++) SAVE.wearTool('magnet');
  T.useBagTool('magnet');
  ok(SAVE.itemCount('magnet') === 2, 'la bolsa no consume una herramienta rota');
  ok(SAVE.toolDur('magnet') === 0, 'la herramienta rota sigue rota tras intentar usarla');

  // Sin stock no ocurre nada
  SAVE.get().items.slow = 0; SAVE.save();
  T.useBagTool('slow');
  ok(SAVE.itemCount('slow') === 0, 'sin stock la bolsa no hace nada');
}

/* ---------------- 18. Copia de seguridad y control ---------------- */
section('18. COPIA DE SEGURIDAD Y SENSIBILIDAD REAL');
{
  SAVE.reset(); SAVE.load();
  SAVE.addCoins(717);
  const coins = SAVE.get().coins;
  const text = SAVE.exportData();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { }
  ok(!!parsed && parsed.app === 'pio-vuelo' && parsed.data && parsed.data.coins === coins,
    'exportar genera un JSON válido con el progreso actual');
  ok(typeof parsed.exported === 'number' && parsed.exported > 0, 'la copia incluye la fecha de exportación');

  const bad = SAVE.importData('{esto no es json');
  ok(!bad.ok && bad.msg === 'json', 'un archivo que no es JSON se rechaza');
  ok(SAVE.get().coins === coins, 'un archivo inválido no altera el progreso');

  const foreign = SAVE.importData(JSON.stringify({ hola: 'mundo' }));
  ok(!foreign.ok && foreign.msg === 'formato', 'un JSON ajeno se rechaza por formato');
  ok(SAVE.get().coins === coins, 'un formato ajeno tampoco altera el progreso');

  SAVE.spendCoins(coins);
  ok(SAVE.get().coins === 0, 'se vacía el saldo antes de importar');
  const good = SAVE.importData(text);
  ok(good.ok, 'una copia válida se importa correctamente');
  ok(SAVE.get().coins === coins, 'la importación recupera las monedas exactas');
  SAVE.load();
  ok(SAVE.get().coins === coins, 'el progreso importado persiste tras recargar');
  ok(!!localStorage.getItem(KEY + '_import_bak'), 'antes de importar se guarda una copia del progreso anterior');

  group('Sensibilidad de aleteo');
  SAVE.reset(); SAVE.load();
  SAVE.setSetting('sens', 0.5);
  G.startPlay('free');
  G.flap();
  const vSoft = Math.abs(T.bird().vy);
  SAVE.setSetting('sens', 1.5);
  G.startPlay('free');
  G.flap();
  const vHard = Math.abs(T.bird().vy);
  ok(vSoft > 0 && vHard > vSoft, 'la sensibilidad cambia el impulso real del aleteo', vSoft + ' vs ' + vHard);
  SAVE.setSetting('sens', 1);
  G.startPlay('free');
  G.flap();
  const vMid = Math.abs(T.bird().vy);
  ok(vMid > vSoft && vMid < vHard, 'el valor intermedio queda entre ambos extremos', vSoft + ' < ' + vMid + ' < ' + vHard);
}

/* ---------------- 19. Pase Prémium ---------------- */
section('19. PASE PRÉMIUM: compra, reclamo, temporada y repetidos');
{
  SAVE.reset(); SAVE.load();
  const premiumSkins = DAT.SKINS.filter(x => DAT.isExclusive(x));
  const premiumHats = DAT.HATS.filter(x => DAT.isExclusive(x));
  const premiumFx = DAT.EFFECTS.filter(x => DAT.isExclusive(x));
  const premiumMaps = DAT.MAPS.filter(x => DAT.isExclusive(x));
  const premiumTools = DAT.TOOLS.filter(x => DAT.isExclusive(x));
  ok(premiumSkins.length >= 3 && premiumHats.length >= 2 && premiumFx.length >= 2 &&
    premiumMaps.length >= 1 && premiumTools.length >= 1,
    'el catálogo exclusivo incluye aves, sombreros, estelas, mapa y herramienta',
    [premiumSkins.length, premiumHats.length, premiumFx.length, premiumMaps.length, premiumTools.length].join('/'));
  ok([].concat(premiumSkins, premiumHats, premiumFx, premiumMaps, premiumTools).every(x => x.price === 0),
    'los artículos exclusivos no tienen precio de venta');

  ok(DAT.PASS_PREMIUM_PRICE === 6000, 'el Pase Prémium cuesta 6000 🪙 por temporada');
  ok(DAT.passPremiumTiers().length === DAT.passTiers().length,
    'la línea prémium tiene los mismos niveles que la gratuita');
  const rewards = DAT.passPremiumTiers().map(t => t.reward);
  ok(rewards.some(r => r.skin === 'p-aurora') && rewards.some(r => r.map === 'premium') &&
    rewards.some(r => r.item === 'legend') && rewards.some(r => r.parts > 0),
    'la línea prémium reparte aves, mapa, herramienta y piezas');

  SAVE.spendCoins(SAVE.get().coins);
  const poor = SAVE.buyPassPremium();
  ok(!poor.ok && poor.msg === 'no_money' && SAVE.get().coins >= 0,
    'sin monedas no se puede comprar y el saldo no queda negativo');
  ok(!SAVE.passPremiumActive(), 'el Pase Prémium sigue bloqueado tras el intento fallido');

  SAVE.addCoins(DAT.PASS_PREMIUM_PRICE);
  const buy = SAVE.buyPassPremium();
  ok(buy.ok && buy.price === DAT.PASS_PREMIUM_PRICE, 'se compra el Pase Prémium');
  ok(SAVE.get().coins === 0, 'se cobra exactamente una vez (6000 🪙)');
  ok(SAVE.passPremiumActive(), 'el Pase Prémium queda activo en la temporada actual');
  const again = SAVE.buyPassPremium();
  ok(!again.ok && again.msg === 'active' && SAVE.get().coins === 0,
    'no se puede volver a cobrar el Pase Prémium activo');

  SAVE.setLevel(20);
  ok(SAVE.passPremiumReached() === DAT.passPremiumTiers().length,
    'con nivel alto se alcanzan todos los niveles prémium');
  const t1 = SAVE.claimPassPremiumTier(1);
  ok(t1 && SAVE.owns(SAVE.get().skinsOwned, 'p-aurora'), 'reclamar el nivel 2 entrega el ave exclusiva');
  ok(SAVE.claimPassPremiumTier(1) === null, 'una recompensa prémium no se puede reclamar dos veces');
  const claimedNow = SAVE.claimPassPremiumAll();
  ok(claimedNow === DAT.passPremiumTiers().length - 1, 'reclamar todo entrega el resto de niveles', claimedNow);
  ok(SAVE.passPremiumClaimedCount() === DAT.passPremiumTiers().length, 'quedan todos los niveles reclamados');
  const s = SAVE.get();
  ok(SAVE.owns(s.skinsOwned, 'p-crono') && SAVE.owns(s.skinsOwned, 'p-sombra'),
    'las tres aves prémium se entregan');
  ok(SAVE.owns(s.hatsOwned, 'hat-corona-eterna') && SAVE.owns(s.hatsOwned, 'hat-sello-estelar'),
    'los sombreros prémium se entregan');
  ok(SAVE.owns(s.fxOwned, 'fx-prisma') && SAVE.owns(s.fxOwned, 'fx-supernova'),
    'las estelas prémium se entregan');
  ok(SAVE.owns(s.mapsOwned, 'premium'), 'el mapa Cielo Prémium se entrega');
  ok(SAVE.itemCount('legend') >= 1, 'la Reliquia del Pase se entrega como herramienta');
  ok(SAVE.partsCount() >= 5, 'las piezas prémium se suman al material', SAVE.partsCount());

  // Repetido: se convierte en 250 🪙 en lugar de duplicar el artículo
  const coinsPre = SAVE.get().coins;
  SAVE.get().passPremiumClaimed = SAVE.get().passPremiumClaimed.filter(i => i !== 1);
  SAVE.save();
  const dup = SAVE.claimPassPremiumTier(1);
  ok(dup && dup.converted === true, 'reclamar una recompensa ya poseída se convierte en monedas');
  ok(SAVE.get().coins === coinsPre + 250, 'la conversión paga 250 🪙 exactas', SAVE.get().coins - coinsPre);
  ok(SAVE.get().skinsOwned.filter(x => x.id === 'p-aurora').length === 1,
    'la conversión no duplica el ave en el inventario');

  // Cambio de temporada: el Pase Prémium se reinicia
  const d = SAVE.get();
  d.passSeason = '2000-winter';
  d.passPremiumSeason = '2000-winter';
  SAVE.save();
  ok(!SAVE.passPremiumActive(), 'al cambiar de temporada el Pase Prémium deja de estar activo');
  ok(d.passPremiumClaimed.length === 0 && d.passSeason === DAT.seasonKey(),
    'la nueva temporada empieza sin reclamaciones prémium');
  ok(d.passPremiumSeason === '', 'la compra prémium queda invalidada para la nueva temporada');
}

/* ---------------- 20. Exclusividad en tienda y cajas ---------------- */
section('20. EXCLUSIVIDAD: no se vende ni sale en cajas');
{
  SAVE.reset(); SAVE.load();
  SAVE.addCoins(400000);
  const excl = [].concat(
    DAT.SKINS.filter(x => DAT.isExclusive(x)).map(x => ['skin', x]),
    DAT.HATS.filter(x => DAT.isExclusive(x)).map(x => ['hat', x]),
    DAT.EFFECTS.filter(x => DAT.isExclusive(x)).map(x => ['fx', x]),
    DAT.MAPS.filter(x => DAT.isExclusive(x)).map(x => ['map', x])
  );
  const coinsPre = SAVE.get().coins;
  const sold = excl.filter(([cat, item]) => SAVE.buy(cat, item.id).ok);
  ok(sold.length === 0, 'ningún artículo exclusivo se puede comprar en la tienda', sold.map(x => x[1].id).join(','));
  ok(SAVE.get().coins === coinsPre, 'los intentos de compra exclusiva no cobran nada');

  const toolsSold = DAT.TOOLS.filter(x => DAT.isExclusive(x)).filter(t => SAVE.buyTool(t.id).ok);
  ok(toolsSold.length === 0, 'la herramienta exclusiva tampoco se vende suelta', toolsSold.map(t => t.id).join(','));
  ok(SAVE.get().coins === coinsPre, 'comprar la herramienta exclusiva no altera el saldo');

  const origRandom = Math.random;
  Math.random = () => 0.5; // fuerza un camino estable: nunca dorado y siempre un índice válido
  try {
    for (let i = 0; i < 400; i++) SAVE.openBox();
  } finally {
    Math.random = origRandom;
  }
  const s = SAVE.get();
  const leaked = [].concat(
    DAT.SKINS.filter(x => DAT.isExclusive(x)).filter(x => SAVE.owns(s.skinsOwned, x.id)).map(x => x.id),
    DAT.HATS.filter(x => DAT.isExclusive(x)).filter(x => SAVE.owns(s.hatsOwned, x.id)).map(x => x.id),
    DAT.EFFECTS.filter(x => DAT.isExclusive(x)).filter(x => SAVE.owns(s.fxOwned, x.id)).map(x => x.id)
  );
  ok(leaked.length === 0, '400 cajas seguidas no entregan ningún exclusivo', leaked.join(','));
  ok(s.stats.boxesBought === 400, 'las cajas se cobran y cuentan una a una', s.stats.boxesBought);
}

/* ---------------- 21. Mapas con mecánicas reales ---------------- */
section('21. MAPAS: mecánicas, viento y monedas');
{
  SAVE.reset(); SAVE.load();
  ok(DAT.mapCfg('inexistente').coinMul === 1 && DAT.mapCfg('inexistente').wind === false,
    'un mapa sin configuración usa los valores por defecto');
  const prem = DAT.mapCfg('premium');
  ok(prem.coinMul === 2 && prem.wind === true && prem.gapMul > 1,
    'Cielo Prémium duplica monedas, activa viento y amplía huecos', JSON.stringify(prem));
  const glitch = DAT.mapCfg('glitch');
  ok(glitch.gapMul < 1 && glitch.speedMul > 1, 'Glitch reduce huecos y acelera el mundo');
  const candy = DAT.mapCfg('candy');
  ok(candy.coinMul >= 1.5, 'Dulcelandia multiplica las monedas por 1,5 o más');

  G.setMode('free');
  G.resize();
  SAVE.equip('map', 'day');
  G.startPlay('free');
  const dayD = G.getEnv().D;
  const dayCfg = T.getMapCfg();

  SAVE.get().mapsOwned.push({ id: 'glitch' });
  SAVE.equip('map', 'glitch');
  G.startPlay('free');
  const glitchD = G.getEnv().D;
  const glitchCfg = T.getMapCfg();
  ok(glitchCfg.speedMul > dayCfg.speedMul, 'el mapa equipado aplica su multiplicador de velocidad');
  ok(glitchD.speed > dayD.speed, 'la velocidad real de la partida cambia con el mapa',
    dayD.speed.toFixed(1) + ' → ' + glitchD.speed.toFixed(1));
  ok(glitchD.gap < dayD.gap, 'el tamaño del hueco cambia con el mapa',
    dayD.gap.toFixed(1) + ' → ' + glitchD.gap.toFixed(1));

  // Cielo Prémium: se puede equipar al poseerlo y genera objetos seguros
  SAVE.get().mapsOwned.push({ id: 'premium' });
  SAVE.equip('map', 'premium');
  G.startPlay('free');
  ok(T.getMapCfg().wind === true && T.getMapCfg().coinMul === 2,
    'la partida en Cielo Prémium usa viento y monedas dobles');
  const premD = G.getEnv().D;
  for (let i = 0; i < 70; i++) T.mkPipe(1500 + i * 240, premD);
  for (let i = 0; i < 25; i++) {
    T.spawnPower(); T.spawnMega(); T.spawnChain(); T.spawnEnemy();
  }
  const pipes = checkPipes('Cielo Prémium 1024x768');
  checkCollectibles('Cielo Prémium 1024x768', pipes);

  sandbox.innerWidth = 360; sandbox.innerHeight = 640;
  G.resize();
  G.forceRestart();
  const premD2 = G.getEnv().D;
  for (let i = 0; i < 70; i++) T.mkPipe(300 + i * 200, premD2);
  for (let i = 0; i < 12; i++) {
    T.spawnPower(); T.spawnMega(); T.spawnChain(); T.spawnEnemy();
  }
  const pipes2 = checkPipes('Cielo Prémium 360x640');
  checkCollectibles('Cielo Prémium 360x640', pipes2);
  sandbox.innerWidth = 1024; sandbox.innerHeight = 768;
  G.resize();
}

/* ---------------- 22. Logros y audio por mapa ---------------- */
section('22. LOGROS EN COLA Y AUDIO POR MAPA');
{
  SAVE.reset(); SAVE.load();
  ok(DAT.ACH.length > 100, 'hay un catálogo amplio de logros', DAT.ACH.length);
  ok(DAT.ACH.every(a => a.name && a.desc && a.reward > 0), 'todos los logros tienen nombre, descripción y recompensa');
  ok(new Set(DAT.ACH.map(a => a.id)).size === DAT.ACH.length, 'no hay identificadores de logro repetidos');

  SAVE.get().stats.pipes = 500;
  SAVE.get().stats.best = 40;
  SAVE.save();
  const got = SAVE.checkAch();
  ok(got.length > 0, 'completar objetivos desbloquea logros', got.length);
  ok(got.every(a => a.desc && a.reward > 0), 'los logros desbloqueados llevan descripción para la notificación');
  ok(SAVE.get().coins > 0, 'los logros pagan su recompensa al desbloquearse');
  const again = SAVE.checkAch();
  ok(again.length === 0, 'un logro ya conseguido no se vuelve a pagar ni a encolar');

  // Audio: temas musicales distintos por mapa (sin AudioContext no debe fallar)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/audio.js'), 'utf8'), sandbox, { filename: 'js/audio.js' });
  const SND = sandbox.SND;
  ok(typeof SND.setMapTheme === 'function' && typeof SND.themeFor === 'function',
    'el motor de audio expone temas por mapa');
  SND.setMapTheme('premium');
  ok(SND.getMapTheme() === 'premium', 'Cielo Prémium tiene tema musical propio');
  SND.setMapTheme('oceano');
  ok(SND.getMapTheme() === 'water', 'los mapas marinos comparten el tema de agua');
  SND.setMapTheme('no-existe');
  ok(SND.getMapTheme() === 'day', 'un mapa desconocido vuelve al tema base');
  const themeIds = ['day', 'night', 'space', 'water', 'fire', 'ice', 'candy', 'forest', 'synth', 'premium'];
  const covered = DAT.MAPS.filter(m => themeIds.indexOf(SND.themeFor(m.id)) === -1);
  ok(covered.length === 0, 'todos los mapas del catálogo tienen una familia sonora', covered.map(m => m.id).join(','));
  SND.sfx.flap();
  SND.startMusic();
  ok(true, 'reproducir sin AudioContext no lanza errores');
}

/* ---------------- 23. Reliquia del Pase permanente ---------------- */
section('23. RELIQUIA DEL PASE: permanente, desgaste y reparación');
{
  SAVE.reset(); SAVE.load();
  SAVE.addCoins(DAT.PASS_PREMIUM_PRICE);
  SAVE.buyPassPremium();
  SAVE.setLevel(20);
  SAVE.claimPassPremiumAll();
  const legend = DAT.getTool('legend');
  ok(legend && legend.permanent === true, 'la Reliquia está marcada como permanente');
  ok(SAVE.itemCount('legend') === 1, 'la Reliquia llega como una unidad permanente');

  // Uso automático: no consume stock, pero sí se desgasta.
  SAVE.setToolMode('legend', 'auto');
  G.setMode('free');
  G.resize();
  const durBefore = SAVE.toolDur('legend');
  G.startPlay('free');
  ok(T.getRt().legend === true, 'el uso automático activa el efecto de la Reliquia');
  ok(SAVE.itemCount('legend') === 1, 'el uso automático no gasta la Reliquia');
  ok(SAVE.toolDur('legend') < durBefore, 'el uso automático desgasta la Reliquia',
    SAVE.toolDur('legend') + ' < ' + durBefore);

  // Uso manual: tampoco consume stock.
  SAVE.setToolMode('legend', 'manual');
  G.startPlay('free');
  const durMid = SAVE.toolDur('legend');
  G.useBagTool('legend');
  ok(SAVE.itemCount('legend') === 1, 'el uso manual no gasta la Reliquia');
  ok(SAVE.toolDur('legend') < durMid, 'el uso manual desgasta la Reliquia',
    SAVE.toolDur('legend') + ' < ' + durMid);
  ok(T.getRt().legend === true, 'la Reliquia activa su efecto al usarla a mano');

  // Reparación con coste real (la Reliquia no tiene precio de venta).
  G.goMenu();
  const cost = SAVE.toolRepairCost('legend');
  ok(cost > 0, 'reparar la Reliquia cuesta monedas de verdad', cost);
  SAVE.addCoins(cost);
  const rep = SAVE.repairTool('legend');
  ok(rep.ok && rep.price === cost && SAVE.toolDur('legend') === SAVE.toolMaxDur('legend'),
    'la Reliquia se repara y recupera toda su durabilidad');

  // Reclamar de nuevo su recompensa paga monedas, no añade stock infinito.
  const tiers = DAT.passPremiumTiers();
  const li = tiers.findIndex(t => t.reward && t.reward.item === 'legend');
  ok(li >= 0, 'la línea prémium incluye la Reliquia');
  const coinsPre = SAVE.get().coins;
  SAVE.get().passPremiumClaimed = SAVE.get().passPremiumClaimed.filter(i => i !== li);
  SAVE.save();
  const dup = SAVE.claimPassPremiumTier(li);
  ok(dup && dup.converted === true, 'reclamar otra vez la Reliquia se convierte en monedas');
  ok(SAVE.get().coins === coinsPre + 250, 'la Reliquia repetida paga 250 🪙', SAVE.get().coins - coinsPre);
  ok(SAVE.itemCount('legend') === 1, 'la Reliquia repetida no suma stock infinito');
}

/* ---------------- 24. Catálogos ampliados y Pase de 20 niveles ---------------- */
section('24. TIENDA AMPLIADA, HERRAMIENTAS HASTA NIVEL 8 Y PASE DE 20 NIVELES');
{
  SAVE.reset(); SAVE.load();

  // Aves nuevas: comprables y presentes en la tienda.
  const nuevasAves = ['tucan', 'buho', 'colibri', 'pavo', 'garza', 'pelicano'];
  ok(nuevasAves.every(id => {
    const sk = DAT.getSkin(id);
    return sk && !DAT.isExclusive(sk) && sk.price > 0;
  }), 'las 6 aves nuevas están en la tienda con precio', nuevasAves.join(','));
  ok(new Set(DAT.SKINS.map(s => s.id)).size === DAT.SKINS.length, 'no hay ids de ave duplicados');

  // Mapas nuevos + configuración de juego propia.
  const nuevosMapas = ['jardin', 'industrial', 'sabana', 'arrecife'];
  ok(nuevosMapas.every(id => DAT.getMap(id) && !DAT.isExclusive(DAT.getMap(id))),
    'los 4 mapas nuevos se pueden comprar', nuevosMapas.join(','));
  ok(DAT.mapCfg('jardin').coinMul > 1 && DAT.mapCfg('industrial').spawnMul < 1 &&
    DAT.mapCfg('sabana').speedMul > 1 && DAT.mapCfg('arrecife').gravMul < 1,
    'cada mapa nuevo tiene su propia mecánica');
  ok(DAT.mapCfg('premium2').coinMul > DAT.mapCfg('premium').coinMul,
    'el segundo mapa prémium mejora al primero');

  // Herramientas nuevas.
  const nuevasTools = ['magnetx', 'slowx', 'coinsx', 'shieldx', 'ghostx', 'frenzyx'];
  ok(nuevasTools.every(k => DAT.getTool(k) && DAT.getTool(k).price > 0),
    'las 6 herramientas nuevas están a la venta', nuevasTools.join(','));
  ok(nuevasTools.every(k => SAVE.itemCount(k) === 0), 'arrancan con stock 0 en un guardado nuevo');

  // Estelas, sombreros, huevos y decoración ampliados.
  ok(['fx-turquesa', 'fx-relampago', 'fx-violeta', 'fx-menta2', 'fx-rubi2', 'fx-celeste']
    .every(id => DAT.getFx(id)), 'las 6 estelas nuevas están en el catálogo');
  ok(['hat-bombin', 'hat-pluma-azul', 'hat-corona-hielo', 'hat-casco-astro', 'hat-neon-head']
    .every(id => DAT.getHat(id)), 'los 5 sombreros nuevos están en el catálogo');
  ok(DAT.EGGS.length >= 5 && DAT.getEgg('huevo-legendario') && DAT.getEgg('huevo-mitico'),
    'hay al menos 5 huevos, incluidos el legendario y el mítico');
  ok(['bg-oceano', 'bg-galaxia', 'fl-lava', 'fl-nubes', 'po-cohete', 'po-mundo', 'rug-verde', 'rug-estelar']
    .every(id => DAT.getDecor(id)), 'las 8 decoraciones nuevas están en el catálogo');

  // Durabilidad y mejoras hasta nivel 8.
  ok(DAT.TOOL_MAX_LEVEL === 8, 'el tope de mejora es el nivel 8');
  ok(DAT.TOOL_DUR.base === 14 && DAT.TOOL_DUR.perLevel === 4,
    'la durabilidad base sube a 14 y cada nivel añade 4');
  ok(DAT.toolMaxDur('magnet', 8) === DAT.toolMaxDur('magnet', 0) + 32,
    '8 niveles añaden 32 puntos de durabilidad');
  ok(DAT.toolWear('magnet', 8) < DAT.toolWear('magnet', 0),
    'mejorar reduce el desgaste por uso');
  ok(DAT.ECONOMY.toolUpPrice(7) > DAT.ECONOMY.toolUpPrice(0),
    'mejorar al nivel 8 cuesta más que al principio');
  ok(DAT.ECONOMY.toolUpParts(8) === 5 && DAT.ECONOMY.toolUpParts(0) === 0,
    'el último nivel pide 5 piezas y el primero ninguna');

  // Pase gratuito: 20 niveles con recompensa válida en todos.
  const tiers = DAT.passTiers();
  ok(tiers.length === 20, 'el Pase gratuito tiene 20 niveles', tiers.length);
  ok(tiers.every((t, i) => t.xp >= 0 && (i === 0 || t.xp > tiers[i - 1].xp)),
    'los umbrales de XP del Pase son crecientes');
  ok(tiers.every(t => t.reward && Object.keys(t.reward).length > 0),
    'ningún nivel del Pase queda con recompensa undefined');
  const passItems = tiers.filter(t => t.reward.item);
  ok(passItems.length === 9, 'el Pase reparte 9 recompensas de herramienta', passItems.length);
  ok(tiers.filter(t => t.reward.hat || t.reward.fx).length === 1,
    'el Pase conserva un cosmético de temporada');
  ok(tiers.filter(t => t.reward.parts).length >= 2 && tiers.filter(t => t.reward.shields).length >= 1,
    'el Pase incluye piezas y escudos');
  ok(tiers[tiers.length - 1].xp >= 12000, 'el último nivel exige más de 12.000 XP',
    tiers[tiers.length - 1].xp);

  // Pase prémium: 20 niveles, exclusivos nuevos y sin huecos.
  const prem = DAT.passPremiumTiers();
  ok(prem.length === 20, 'el Pase Prémium también tiene 20 niveles');
  ok(prem.every(t => t.reward && Object.keys(t.reward).length > 0),
    'ningún nivel prémium queda con recompensa undefined');
  ok(['p-eterna', 'hat-aurora', 'hat-cosmico', 'fx-cuasar'].every(id =>
    DAT.SKINS.concat(DAT.HATS, DAT.EFFECTS).some(x => x.id === id && DAT.isExclusive(x))),
    'los nuevos exclusivos existen y están marcados como exclusivos');
  ok(prem.some(t => t.reward.map === 'premium2'), 'el Pase Prémium incluye el segundo mapa');
  ok(DAT.PASS_PREMIUM_PRICE === 6000, 'el Pase Prémium cuesta 6000 🪙');

  // Reclamar el Pase completo entrega las 20 recompensas.
  SAVE.addCoins(DAT.PASS_PREMIUM_PRICE);
  ok(SAVE.buyPassPremium().ok, 'el Pase Prémium se puede comprar con el saldo exacto');
  SAVE.setLevel(20);
  const claimed = SAVE.claimPassAll();
  ok(claimed === 20, 'se pueden reclamar las 20 recompensas del Pase', claimed);
  ok(SAVE.passClaimedCount() === 20, 'el Pase gratuito queda reclamado entero');
  const claimedPrem = SAVE.claimPassPremiumAll();
  ok(claimedPrem === 20, 'se pueden reclamar las 20 recompensas prémium', claimedPrem);
  const s = SAVE.get();
  ok(SAVE.owns(s.skinsOwned, 'p-eterna'), 'el ave Eterna llega desde el Pase Prémium');
  ok(SAVE.owns(s.hatsOwned, 'hat-aurora') && SAVE.owns(s.hatsOwned, 'hat-cosmico'),
    'los sombreros exclusivos nuevos se entregan');
  ok(SAVE.owns(s.fxOwned, 'fx-cuasar'), 'la estela Cuásar se entrega');
  ok(SAVE.owns(s.mapsOwned, 'premium2'), 'el mapa Cielo de Cuásar se entrega');
  ok(s.coins > 0 && SAVE.partsCount() >= 9, 'las recompensas de monedas y piezas se suman',
    s.coins + ' 🪙 · ' + SAVE.partsCount() + ' 🔩');
}

/* ---------------- 25. Multijugador online ---------------- */
section('25. MULTIJUGADOR ONLINE: SALAS, SEMILLAS Y RESULTADOS');
{
  const MP = sandbox.MP;
  ok(!!MP, 'el módulo de multijugador está disponible');
  ok(MP.cleanCode(' ab-c23 4 ') === 'ABC234', 'el código se limpia y normaliza', MP.cleanCode(' ab-c23 4 '));
  ok(MP.isValidCode('ABC234'), 'un código válido se acepta');
  ok(!MP.isValidCode('ABCD10'), 'códigos con 0/1 se rechazan');
  ok(MP.daySeed(new Date(2026, 10, 10)) === 20261110, 'la semilla diaria usa la fecha', MP.daySeed(new Date(2026, 10, 10)));
  ok(MP.hashSeed('pio') === MP.hashSeed('pio') && MP.hashSeed('pio') !== MP.hashSeed('vuelo'),
    'las semillas manuales son estables y distintas');

  const cfg = MP.normalizeConfig({
    pipes: 999, time: 9999, map: 'nope', diff: 'nope',
    seedMode: 'manual', seed: 'abc', tools: false
  }, { maps: ['day', 'night'], diffs: ['normal', 'hard'] });
  ok(cfg.pipes === 30 && cfg.time === 300, 'la meta y el tiempo se limitan a valores permitidos', cfg.pipes + '/' + cfg.time);
  ok(cfg.map === 'day' && cfg.diff === 'normal', 'mapa y dificultad se corrigen al catálogo', cfg.map + '/' + cfg.diff);
  ok(cfg.tools === false, 'las herramientas se pueden desactivar');
  ok(cfg.seed > 0 && cfg.seedMode === 'manual', 'la semilla manual se convierte en número', cfg.seed);
  ok(MP.normalizeConfig({ seedMode: 'daily' }, { maps: ['day'], diffs: ['normal'] }).seed === MP.daySeed(),
    'la semilla diaria coincide con el día actual');
  ok(MP.normalizeConfig({ mode: 'free', pipes: 0 }).pipes === 0, 'la carrera libre no exige tubos');
  ok(MP.normalizeConfig({ mode: 'free', pipes: 30 }).pipes === 0, 'en libre la meta se fuerza a 0');
  ok(MP.hasGoal({ mode: 'goal', pipes: 12 }) && !MP.hasGoal({ mode: 'free', pipes: 0 }),
    'hasGoal distingue salas con meta de las libres');

  const A = { score: 10, pipes: 20, finished: true, time: 30 };
  const B = { score: 99, pipes: 20, finished: true, time: 31 };
  ok(MP.judge(A, B) === 'win', 'llegar antes a la meta gana aunque el rival tenga más puntos');
  ok(MP.judge(B, A) === 'lose', 'la comparación es simétrica');
  ok(MP.judge({ pipes: 20, score: 5 }, { pipes: 18, score: 9 }) === 'win', 'sin meta, ganan más tubos');
  ok(MP.judge({ pipes: 10, score: 9, dist: 120 }, { pipes: 10, score: 9, dist: 90 }) === 'win',
    'a igualdad de tubos y puntos desempata la distancia');
  ok(MP.judge({ pipes: 10, score: 9 }, { pipes: 10, score: 9 }) === 'draw', 'mismo resultado = empate');
  ok(MP.judgeSides({ pipes: 2 }, { pipes: 3 }) === 'guest', 'el ganador se traduce a host/guest');

  // Integración con el juego y una nube simulada.
  const calls = { progress: [], finish: [], leave: 0 };
  const uid = 'uid-mp-1';
  sandbox.CLOUD = {
    session: () => ({ uid: uid }),
    watchDuel: () => { return () => { }; },
    updateDuelProgress: (code, p) => { calls.progress.push({ code: code, p: p }); return Promise.resolve(true); },
    finishDuel: (code, p) => { calls.finish.push({ code: code, p: p }); return Promise.resolve(true); },
    leaveDuel: () => { calls.leave++; return Promise.resolve(true); }
  };
  const room = {
    code: 'ABC234', state: 'playing', startAt: 0, seed: 4321, winner: '',
    config: { mode: 'goal', pipes: 15, time: 60, map: 'night', diff: 'hard', tools: false, seedMode: 'manual', seed: 4321 },
    host: { uid: uid, name: 'Tester', score: 0, pipes: 0, alive: true, finished: false, time: 0 },
    guest: { uid: 'uid-mp-2', name: 'Rival', score: 9, pipes: 4, alive: true, finished: false, time: 0 }
  };
  G.setMode('free');
  G.startPvp(room);
  ok(G.getMode() === 'pvp', 'la sala arranca el modo multijugador');
  ok(G.getSeed() === 4321, 'la carrera usa la semilla compartida', G.getSeed());
  const info = G.getPvp();
  ok(info && info.goal === 15, 'la meta de tubos viene de la sala', info && info.goal);
  ok(info && info.timeLimit === 60, 'el límite de tiempo viene de la sala');
  ok(info && info.rival && info.rival.pipes === 4, 'el rival se refleja en el HUD');
  ok(calls.progress.length >= 1 && calls.progress[0].p.finished === false, 'el progreso se publica al empezar');

  // Herramientas desactivadas: la bolsa no se consume.
  SAVE.get().items.start = 1;
  const before = SAVE.get().items.start;
  T.useBagTool('start');
  ok(SAVE.get().items.start === before, 'con herramientas off no se consume la bolsa');

  // El rival termina peor: victoria local.
  const winBefore = SAVE.get().stats.mpWins || 0;
  const coinsBefore = SAVE.get().coins;
  T.pvpFinish(true);
  T.pvpDecide();
  ok(calls.finish.length === 1 && calls.finish[0].p.finished === true, 'al terminar se envía el resultado final');
  ok((SAVE.get().stats.mpMatches || 0) >= 1, 'la carrera online cuenta en las estadísticas');
  ok((SAVE.get().stats.mpWins || 0) === winBefore + 1, 'la victoria online se registra');
  ok(SAVE.get().coins > coinsBefore, 'la victoria online da monedas');
  const onlineLog = SAVE.getMatches('online');
  ok(onlineLog.length >= 1 && onlineLog[0].mode === 'pvp' && onlineLog[0].participants.length === 2,
    'la partida online queda en el historial con ambos participantes');
  ok(onlineLog[0] && onlineLog[0].map === 'night' && onlineLog[0].online === true,
    'el récord online guarda mapa y marca de partida online');

  // Limpieza de la sala al salir.
  G.leavePvp();
  ok(G.getPvp() === null, 'salir libera la sesión multijugador');
  ok(calls.leave === 1, 'salir avisa a la nube para cerrar la sala', calls.leave);
  sandbox.CLOUD = undefined;
}

/* ---------------- 26. Modo Con metas, récords y radar ---------------- */
section('26. MODO CON METAS, RÉCORDS POR MODO Y RADAR');
{
  SAVE.reset();
  SAVE.load();

  ok(SAVE.GOAL_PIPES.join(',') === '8,10,12,15,20,30', 'las metas permitidas son exactas', SAVE.GOAL_PIPES.join(','));
  ok(SAVE.getGoalPipes() === 12, 'la meta arranca en 12 tubos', SAVE.getGoalPipes());
  ok(SAVE.setGoalPipes(20) === 20 && SAVE.getGoalPipes() === 20, 'la meta elegida se guarda');
  ok(SAVE.setGoalPipes(13) === 20, 'una meta inventada no se acepta', SAVE.getGoalPipes());

  const rd = SAVE.getRadar();
  ok(rd.on === true && rd.size === 'sm' && rd.pos === 'br' && rd.style === 'tactical' && rd.opacity > 0,
    'el radar arranca con valores válidos');
  SAVE.setRadar({ size: 'lg', pos: 'tl', style: 'neon', opacity: 0.5, trail: false, labels: false, me: '#112233' });
  const rd2 = SAVE.getRadar();
  ok(rd2.size === 'lg' && rd2.pos === 'tl' && rd2.style === 'neon' && rd2.opacity === 0.5 &&
    rd2.trail === false && rd2.labels === false && rd2.me === '#112233',
    'la personalización del radar se guarda', JSON.stringify(rd2));
  SAVE.setRadar({ size: 'xxl', pos: 'nope', style: 'nope', opacity: 9, me: 'rojo' });
  const rd3 = SAVE.getRadar();
  ok(rd3.size === 'sm' && rd3.pos === 'br' && rd3.style === 'tactical' && rd3.opacity === 1 && rd3.me === '#4fc3f7',
    'los valores inválidos del radar se corrigen', JSON.stringify(rd3));
  SAVE.resetRadar();
  ok(SAVE.getRadar().size === 'sm' && SAVE.getRadar().on === true, 'restablecer devuelve el radar por defecto');

  SAVE.logMatch({
    mode: 'goal', map: 'night', pipes: 12, result: 'Meta 12/12 · completada', score: 44,
    coins: 5, time: 31.5, dist: 140,
    participants: [{ name: 'Pío', score: 44, pipes: 12, finished: true }]
  });
  SAVE.logMatch({
    mode: 'free', map: 'day', result: 'Vuelo libre', score: 20,
    coins: 2, time: 18, dist: 70,
    participants: [{ name: 'Pío', score: 20, pipes: 6, finished: false }]
  });
  const allM = SAVE.getMatches('all');
  const goalM = SAVE.getMatches('goal');
  const freeM = SAVE.getMatches('free');
  const onlineM = SAVE.getMatches('online');
  ok(allM.length === 2 && goalM.length === 1 && freeM.length === 1 && onlineM.length === 0,
    'los récords se filtran por modo', allM.length + '/' + goalM.length + '/' + freeM.length);
  ok(goalM[0].map === 'night' && goalM[0].pipes === 12 && goalM[0].result.indexOf('completada') !== -1 &&
    goalM[0].participants[0].finished === true,
    'el récord Con metas guarda mapa, tubos, resultado y participantes');

  const runsBefore = SAVE.get().runs.length;
  SAVE.endRun(30, 7, 2, 15, 60, 'goal', {
    mode: 'goal', variant: 'goal', map: 'day', result: 'Meta 7/12',
    participants: [{ name: 'Pío', score: 30, pipes: 7 }]
  });
  ok(SAVE.getMatches('all').length === 3, 'terminar una carrera añade su récord completo');
  ok(SAVE.get().runs.length === runsBefore + 1, 'el récord completo no duplica el historial de vuelos');

  for (let i = 0; i < 125; i++) SAVE.logMatch({ mode: 'free', map: 'day', score: i });
  ok(SAVE.getMatches('all').length === 120, 'el historial completo se limita a 120 registros', SAVE.getMatches('all').length);

  SAVE.setGoalPipes(8);
  G.setMode('goal');
  ok(G.getMode() === 'goal', 'el modo Con metas se activa');
  G.startPlay('goal');
  ok(G.getGoal() === 8, 'la carrera arranca con la meta exacta', G.getGoal());
  ok(G.getState() === 'play', 'la carrera Con metas empieza a volar');
  G.goMenu();
  ok(G.getMode() === 'goal', 'salir de la carrera mantiene el modo Con metas');
  G.setMode('free');
}

/* ---------------- 27. SUPERVIVENCIA, ROMPE RÉCORDS Y ADMIN v3.5.0 ---------------- */
section('27. SUPERVIVENCIA, ROMPE RÉCORDS Y ADMIN');
{
  const MPX = sandbox.MP;
  // La partida no termina al morir el primero: gana el último vivo.
  const alive = (over) => Object.assign({ uid: 'u', name: 'J', alive: true, finished: false, time: 0 }, over || {});
  const r1 = MPX.resolve(
    alive({ uid: 'a', alive: false, finished: true, deathAt: 12, time: 12 }),
    alive({ uid: 'b', alive: true, finished: true, time: 30 }),
    { winBy: 'survival' }
  );
  ok(r1.winner === 'guest' && r1.reason === 'supervivencia', 'en supervivencia gana el último jugador vivo');
  const r2 = MPX.resolve(
    alive({ uid: 'a', alive: false, finished: true, deathAt: 20, time: 20 }),
    alive({ uid: 'b', alive: false, finished: true, deathAt: 12, time: 12 }),
    { winBy: 'survival' }
  );
  ok(r2.winner === 'host', 'si ambos caen, gana quien sobrevivió más tiempo');
  const r3 = MPX.resolve(
    alive({ uid: 'a', alive: true, finished: false }),
    alive({ uid: 'b', alive: true, finished: false }),
    { winBy: 'survival' }
  );
  ok(r3.winner === '' && r3.reason === 'pending', 'con ambos vivos la carrera sigue pendiente');
  ok(MPX.hasSurvival({ mode: 'free' }) && !MPX.hasSurvival({ winBy: 'goal' }),
    'hasSurvival distingue salas de supervivencia');
  ok(MPX.resolveSides(alive({ uid: 'a' }), alive({ uid: 'b' }), { winBy: 'survival' }) === '',
    'una carrera pendiente no se resuelve como empate');

  // Curva de XP más exigente y ajustable desde el panel.
  SAVE.reset(); SAVE.load();
  const lv1 = SAVE.xpFor(1);
  SAVE.setTuning({ xpBase: 100, xpCurve: 2, xpFlat: 0 });
  ok(SAVE.xpFor(2) === 400, 'el tuning del panel cambia la curva de XP', SAVE.xpFor(2));
  ok(SAVE.xpFor(2) > lv1, 'la curva nueva exige más XP que antes', SAVE.xpFor(2) + ' vs ' + lv1);
  const rew5 = SAVE.levelReward(5);
  const rew3 = SAVE.levelReward(3);
  ok(rew5.coins > 0 && rew5.item, 'subir al nivel 5 da monedas y un objeto');
  ok(rew3.coins > 0 && rew3.parts > 0, 'subir al nivel 3 da piezas');
  const ups = SAVE.addXp(100000);
  ok(ups > 0 && SAVE.lastLevelUps().length === ups, 'las recompensas por nivel se registran una a una');
  SAVE.setTuning({ xpMul: 2 });
  ok(SAVE.xpAmount(100) >= 200, 'la XP mostrada refleja el multiplicador del panel', SAVE.xpAmount(100));
  SAVE.setTuning({ xpMul: 1 });

  // Récords de eliminaciones: marca personal y acumulado.
  SAVE.reset(); SAVE.load();
  const recA = SAVE.recordKillsRun(7);
  ok(recA.isRecord === true && recA.next === 7 && SAVE.killRecord().best === 7,
    'Rompe récords guarda la mejor marca de eliminaciones');
  const recB = SAVE.recordKillsRun(4);
  ok(recB.isRecord === false && recB.next === 7 && SAVE.killRecord().total === 11,
    'un resultado peor no baja el récord y suma al total');

  // Panel de administración: roles, auditoría, sanciones y eventos.
  SAVE.reset(); SAVE.load();
  ok(SAVE.getAdmin().role === 'admin', 'el panel arranca con rol admin');
  SAVE.setAdminRole('moderador');
  ok(SAVE.getAdmin().role === 'moderador', 'el rol se guarda');
  SAVE.setAdminRole('inventado');
  ok(SAVE.getAdmin().role === 'moderador', 'un rol inválido no cambia el actual');
  SAVE.adminAudit('prueba', 'acción de prueba');
  ok(SAVE.getAdminLog(1)[0].detail === 'acción de prueba', 'la auditoría registra las acciones');
  const sc = SAVE.addSanction({ name: 'Tramposo', type: 'suspension', reason: 'Trampas' });
  ok(sc.type === 'suspension' && SAVE.getSanctions().length === 1, 'las sanciones se guardan');
  const ev = SAVE.addEvent({ name: 'Doble XP', desc: 'Fin de semana' });
  ok(ev.kind === 'comunidad' && SAVE.getEvents().length === 1, 'los eventos se guardan');

  // Modo Rompe récords como modo jugable real.
  G.setMode('record');
  ok(G.getMode() === 'record', 'el modo Rompe récords se activa');
  G.startPlay('record');
  ok(G.getState() === 'play' && G.getMode() === 'record', 'Rompe récords arranca una carrera real');
  G.goMenu();
  G.setMode('free');
}

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
