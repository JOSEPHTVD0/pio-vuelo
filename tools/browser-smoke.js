/* Prueba de humo en un navegador real (Chrome/Edge headless) mediante CDP.
 * No usa dependencias npm: arranca el servidor local, abre el juego, juega,
 * compra el Pase Prémium y revisa las pantallas principales buscando errores
 * de JavaScript.
 *
 *   node tools/browser-smoke.js
 *
 * Requiere Google Chrome o Microsoft Edge instalado. Se puede indicar otro
 * ejecutable con la variable de entorno CHROME_PATH.
 */
'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8123;
const URL = 'http://127.0.0.1:' + PORT + '/';
const DEBUG_PORT = 9223;

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe')
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p)) || null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
function ok(cond, name, extra) {
  results.push({ ok: !!cond, name, extra });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' -> ' + extra : ''));
}

async function waitFor(url, tries, ms) {
  for (let i = 0; i < (tries || 60); i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch (e) { }
    await sleep(ms || 250);
  }
  return null;
}

function makeClient(ws) {
  const pending = new Map();
  const events = [];
  let id = 0;
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });
  const send = (method, params) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  return { send, events };
}

(async () => {
  const browser = findBrowser();
  if (!browser) {
    console.error('No se encontró Chrome ni Edge. Define CHROME_PATH.');
    process.exitCode = 1;
    return;
  }

  let server = null;
  let serverOwned = false;
  if (!(await waitFor(URL, 1, 1))) {
    server = spawn(process.execPath, [path.join(__dirname, 'test-server.js')], { cwd: ROOT, stdio: 'ignore' });
    serverOwned = true;
    if (!(await waitFor(URL, 60, 250))) {
      console.error('No se pudo arrancar el servidor local en ' + URL);
      process.exitCode = 1;
      return;
    }
  }

  const profile = path.join(os.tmpdir(), 'piovuelo-cdp-' + Date.now());
  const chrome = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + DEBUG_PORT, '--user-data-dir=' + profile, URL
  ], { stdio: 'ignore' });

  try {
    const listRes = await waitFor('http://127.0.0.1:' + DEBUG_PORT + '/json/list', 80, 250);
    if (!listRes) throw new Error('el navegador no abrió el puerto de depuración');
    const list = await listRes.json();
    const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!page) throw new Error('no hay pestaña depurable');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const c = makeClient(ws);
    await c.send('Runtime.enable');
    await c.send('Log.enable');
    await c.send('Page.enable');

    const evalJs = async (expr) => {
      const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        throw new Error('JS: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
      }
      return r.result.value;
    };

    await sleep(2500);
    ok(await evalJs("typeof DAT === 'object' && typeof SAVE === 'object' && typeof G === 'object'"), 'los módulos reales cargan en el navegador');
    ok(await evalJs("SAVE.get().coins >= 0"), 'el guardado existe y tiene saldo válido');
    ok(await evalJs("!document.getElementById('homeScreen') || getComputedStyle(document.getElementById('homeScreen')).display !== 'none'"), 'la portada es visible al arrancar');

    // Partida real: Jugar → modo libre
    await evalJs("document.getElementById('btnPlay').click()");
    await sleep(300);
    ok(await evalJs("!document.getElementById('screen-modepick').classList.contains('hidden')"), 'el botón Jugar abre la elección de modo');
    await evalJs("document.getElementById('mpFree').click()");
    await sleep(1200);
    const state = await evalJs("G.getState()");
    ok(state === 'play', 'el modo libre inicia una partida real', state);
    await evalJs("G.setPaused(true)");
    await sleep(200);
    ok(await evalJs("G.isPaused()"), 'la partida se puede pausar');
    await evalJs("G.goMenu()");
    await sleep(400);

    // Tienda sin exclusivos
    await evalJs("UI.openGeneric('shop')");
    await sleep(500);
    const shopInfo = await evalJs("(function(){var b=document.getElementById('genBody');return {vis:!!b && b.offsetHeight>0, excl:b?b.querySelectorAll('.exclusive-item').length:-1}})()");
    ok(shopInfo.vis, 'la tienda se abre con contenido visible');
    ok(shopInfo.excl === 0, 'la tienda no muestra artículos exclusivos sin poseerlos', String(shopInfo.excl));

    // Pase Prémium: tarjeta, dos líneas y compra
    await evalJs("document.querySelector('[data-nav=pass]').click()");
    await sleep(500);
    const passInfo = await evalJs("(function(){var b=document.getElementById('genBody');return {card:!!b.querySelector('.pass-premium-card'), blocks:b.querySelectorAll('.pass-block').length, premiumBlocks:b.querySelectorAll('.pass-block.premium').length, text:b.textContent.indexOf('PASE PRÉMIUM')!==-1}})()");
    ok(passInfo.card, 'el Pase muestra la tarjeta del Pase Prémium');
    ok(passInfo.blocks === 2 && passInfo.premiumBlocks === 1, 'el Pase dibuja las líneas gratuita y prémium', passInfo.blocks + '/' + passInfo.premiumBlocks);
    ok(passInfo.text, 'el Pase indica claramente el Pase Prémium');
    await evalJs("SAVE.setSetting('confirmBuy', false); SAVE.addCoins(4000); document.querySelector('.ppc-buy').click()");
    await sleep(700);
    ok(await evalJs("SAVE.passPremiumActive()"), 'el botón de compra activa el Pase Prémium');
    ok((await evalJs("document.getElementById('genBody').textContent")).indexOf('PASE PRÉMIUM ACTIVO') !== -1, 'la interfaz refleja el estado activo');
    const claim = await evalJs("SAVE.setLevel(25); SAVE.claimPassPremiumAll()");
    ok(claim === 14, 'se reclaman las 14 recompensas prémium', String(claim));
    ok(await evalJs("SAVE.owns(SAVE.get().skinsOwned,'p-aurora') && SAVE.owns(SAVE.get().mapsOwned,'premium')"), 'las recompensas exclusivas llegan al inventario');

    // Mapas e inventario
    await evalJs("document.querySelector('[data-nav=maps]').click()");
    await sleep(600);
    const mapInfo = await evalJs("(function(){var b=document.getElementById('genBody');return {items:b.querySelectorAll('.map-preview').length, txt:b.textContent, excl:b.querySelectorAll('.exclusive-item').length}})()");
    ok(mapInfo.items >= 40, 'la pantalla de mapas pinta el catálogo completo', String(mapInfo.items));
    ok(mapInfo.excl >= 1, 'el mapa exclusivo se marca como prémium');
    ok(mapInfo.txt.indexOf('Cielo Prémium') !== -1, 'Cielo Prémium aparece en la lista de mapas');
    await evalJs("document.querySelector('[data-nav=inventory]').click()");
    await sleep(500);
    ok(await evalJs("SAVE.itemCount('legend') >= 1"), 'la Reliquia del Pase está en el inventario');
    ok(await evalJs("document.getElementById('genBody').textContent.length > 50"), 'el inventario se renderiza sin errores');

    // La Reliquia del Pase es permanente: no consume stock, pero se desgasta.
    await evalJs("UI.closeGeneric()");
    await evalJs("SAVE.setToolMode('legend','auto')");
    const relicBefore = await evalJs("({n:SAVE.itemCount('legend'), dur:SAVE.toolDur('legend')})");
    await evalJs("G.startPlay('free')");
    await sleep(900);
    const relicAfter = await evalJs("({n:SAVE.itemCount('legend'), dur:SAVE.toolDur('legend'), on:G.__test.getRt().legend})");
    ok(relicAfter.on === true, 'la Reliquia activa su efecto en una partida real');
    ok(relicAfter.n === relicBefore.n, 'la Reliquia no consume stock al usarse', relicBefore.n + ' → ' + relicAfter.n);
    ok(relicAfter.dur < relicBefore.dur, 'la Reliquia se desgasta de verdad', relicBefore.dur + ' → ' + relicAfter.dur);
    await evalJs("G.goMenu()");
    await sleep(300);

    // Ranking online real. Se puede omitir con SKIP_ONLINE=1 en entornos sin red.
    if (process.env.SKIP_ONLINE !== '1') {
      const cloudStatus = await evalJs("CLOUD.init().then(function(s){return {status:s.status, ready:s.ready, error:s.error, configured:s.configured}}).catch(function(e){return {status:'error', ready:false, error:String(e)}})");
      ok(cloudStatus && cloudStatus.configured, 'la nube de Firebase está configurada');
      ok(cloudStatus && cloudStatus.ready && cloudStatus.status === 'online', 'Firebase conecta con sesión anónima', cloudStatus && (cloudStatus.status + (cloudStatus.error ? ' · ' + cloudStatus.error : '')));
      await evalJs("UI.openGeneric('records')");
      await sleep(1500);
      const board = await evalJs("(function(){var s=document.querySelector('.lb-cloud');return s?{panel:true,state:s.querySelector('.lb-cloud-state').getAttribute('data-state'),text:s.querySelector('.lb-cloud-state').textContent,rows:s.querySelectorAll('.lb-row').length,hasMe:!!s.querySelector('.lb-me'),retry:!!s.querySelector('.lb-retry')}:{panel:false}})()");
      ok(board.panel, 'la pantalla de récords muestra el bloque online');
      ok(board.state === 'ok' || board.state === 'offline', 'el ranking online termina en un estado real', board.state + ' · ' + board.text);
      ok(board.retry, 'el ranking online tiene un botón de reintento/actualización real');
      await evalJs("UI.closeGeneric()");
      await sleep(300);

      // Corte de red REAL a nivel de navegador: el juego debe seguir vivo,
      // la pantalla debe avisar y el reintento debe recuperar el ranking.
      const cacheKey = 'piovuelo_cloud_board_v1';
      const cacheBackup = await evalJs("localStorage.getItem('" + cacheKey + "')");
      await evalJs("localStorage.setItem('" + cacheKey + "', JSON.stringify({board:'global',at:Date.now(),rows:[{uid:'cache-test',name:'Tabla guardada',best:99,last:12,games:3,level:2,updatedAt:Date.now(),me:false}]}))");
      await c.send('Network.enable');
      await c.send('Network.emulateNetworkConditions', {
        offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
      });
      await evalJs("window.dispatchEvent(new Event('offline'))");
      await sleep(300);
      await evalJs("UI.openGeneric('records')");
      await sleep(1500);
      const offBoard = await evalJs("(function(){var s=document.querySelector('.lb-cloud');if(!s)return{panel:false};var b=s.querySelector('.lb-retry');return{panel:true,state:s.querySelector('.lb-cloud-state').getAttribute('data-state'),text:s.querySelector('.lb-cloud-state').textContent,rows:s.querySelectorAll('.lb-row').length,retry:!!b,disabled:!!(b&&b.disabled)}})()");
      ok(offBoard.panel && offBoard.state === 'offline', 'sin red el ranking online avisa de que está offline', offBoard.state + ' · ' + offBoard.text);
      ok(offBoard.retry && !offBoard.disabled, 'sin red se puede pulsar Reintentar');
      ok(offBoard.rows > 0, 'sin red se conserva la última tabla guardada', String(offBoard.rows));

      await evalJs("document.querySelector('.lb-cloud .lb-retry').click()");
      await sleep(1200);
      const retryOff = await evalJs("(function(){var s=document.querySelector('.lb-cloud');if(!s)return{panel:false};return{panel:true,state:s.querySelector('.lb-cloud-state').getAttribute('data-state'),text:s.querySelector('.lb-cloud-state').textContent}})()");
      ok(retryOff.panel && retryOff.state === 'offline', 'Reintentar sin red no rompe la pantalla', retryOff.state + ' · ' + retryOff.text);

      await evalJs("UI.closeGeneric()");
      await sleep(200);
      await evalJs("G.startPlay('free')");
      await sleep(900);
      ok((await evalJs("G.getState()")) === 'play', 'sin red el juego sigue funcionando');
      await evalJs("G.goMenu()");
      await sleep(300);

      await c.send('Network.emulateNetworkConditions', {
        offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1
      });
      await evalJs("window.dispatchEvent(new Event('online')); UI.openGeneric('records')");
      await sleep(1500);
      await evalJs("(function(){var b=document.querySelector('.lb-cloud .lb-retry'); if(b && !b.disabled) b.click();})()");
      await sleep(3000);
      const backBoard = await evalJs("(function(){var s=document.querySelector('.lb-cloud');if(!s)return{panel:false};var b=s.querySelector('.lb-retry');return{panel:true,state:s.querySelector('.lb-cloud-state').getAttribute('data-state'),text:s.querySelector('.lb-cloud-state').textContent,disabled:!!(b&&b.disabled)}})()");
      ok(backBoard.panel && (backBoard.state === 'ok' || backBoard.state === 'offline'), 'al volver la red el ranking se recupera', backBoard.state + ' · ' + backBoard.text);
      await evalJs("UI.closeGeneric()");
      await sleep(300);

      // Se restaura la caché real del navegador tras la prueba.
      if (cacheBackup === null) {
        await evalJs("localStorage.removeItem('" + cacheKey + "')");
      } else {
        await evalJs("localStorage.setItem('" + cacheKey + "', " + JSON.stringify(cacheBackup) + ")");
      }
    }

    // Errores reales de la consola
    const errors = c.events.filter(e =>
      (e.method === 'Runtime.exceptionThrown') ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') ||
      (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    ).map(e => {
      if (e.method === 'Runtime.exceptionThrown') return e.params.exceptionDetails.text + ' ' + ((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || '');
      if (e.method === 'Log.entryAdded') return e.params.entry.text;
      return e.params.args.map(a => a.value || a.description).join(' ');
    }).filter(msg =>
      /* La prueba apaga la red a propósito: esos fallos de red no son errores
         de JavaScript del juego. Cualquier otra excepción sí se reporta. */
      !/net::ERR_INTERNET_DISCONNECTED|Error in connection establishment|net::ERR_NETWORK_CHANGED/i.test(msg)
    );
    ok(errors.length === 0, 'no hay errores de JavaScript en la sesión', errors.slice(0, 3).join(' | '));

    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(os.tmpdir(), 'piovuelo-smoke.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log('CAPTURA ' + shotPath);

    ws.close();
  } catch (err) {
    ok(false, 'la prueba de navegador terminó sin excepciones', err && err.message);
  } finally {
    chrome.kill();
    if (server && serverOwned) server.kill();
    await sleep(500);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { }
  }

  const fails = results.filter(r => !r.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' comprobaciones de navegador correctas');
  if (fails.length) process.exitCode = 1;
})();
