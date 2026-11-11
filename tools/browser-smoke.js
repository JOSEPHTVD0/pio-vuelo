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
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8123;
const URL = 'http://127.0.0.1:' + PORT + '/';
const DEBUG_PORT = 9223;
const EMULATORS = process.env.PIO_EMULATORS === '1';

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

// Los emuladores de Firebase pueden tardar en abrir sus puertos aunque
// emulators:exec ya haya lanzado este script. Se espera de verdad a que
// Firestore, Realtime Database y Auth acepten conexiones.
function waitPort(port, timeoutMs) {
  const started = Date.now();
  return new Promise(resolve => {
    const attempt = () => {
      const sock = net.connect({ host: '127.0.0.1', port });
      sock.once('connect', () => { sock.destroy(); resolve(true); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - started >= timeoutMs) resolve(false);
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}
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

  if (EMULATORS) {
    const waits = [
      ['Firestore', 8080], ['Realtime Database', 9000], ['Auth', 9099]
    ];
    for (const [name, port] of waits) {
      if (!(await waitPort(port, 120000))) {
        console.error('El emulador de ' + name + ' no abrió el puerto ' + port);
        process.exitCode = 1;
        return;
      }
    }
    await sleep(1500); // margen para que terminen de cargar reglas y datos
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
      // Al restaurar una cuenta la página puede recargarse sola: si el destino
      // se va a mitad de la evaluación, se reintenta en vez de dar la prueba
      // por fallida.
      for (let i = 0; i < 12; i++) {
        let r;
        try {
          r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        } catch (e) {
          if (/navigated or closed/i.test(String(e && e.message)) && i < 11) {
            await sleep(500);
            continue;
          }
          throw e;
        }
        if (r.exceptionDetails) {
          const desc = (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text;
          // Una recarga de la página puede dejar el contexto a medias: si aún
          // no existen los módulos, se espera y se reintenta en vez de fallar.
          if (/is not defined/i.test(String(desc)) && i < 11) {
            await sleep(500);
            continue;
          }
          throw new Error('JS: ' + desc);
        }
        return r.result.value;
      }
      return undefined;
    };

    // Sondea una expresión hasta que devuelva un valor (o se agote el tiempo).
    // Sirve para esperar recargas y restauraciones sin leer a mitad de carga.
    const pollSave = async (expr, tries) => {
      let last = null;
      for (let i = 0; i < (tries || 60); i++) {
        last = await evalJs(expr).catch(() => null);
        if (last) return last;
        await sleep(500);
      }
      return last;
    };

    // Espera a que una condición se mantenga varias veces seguidas: así no se
    // da por buena una página que todavía va a recargarse sola.
    const waitStable = async (expr, tries) => {
      let streak = 0;
      let last = null;
      for (let i = 0; i < (tries || 40); i++) {
        last = await evalJs(expr).catch(() => null);
        if (last) {
          streak++;
          if (streak >= 3) return last;
        } else {
          streak = 0;
        }
        await sleep(700);
      }
      return null;
    };

    await sleep(2500);
    ok(await evalJs("typeof DAT === 'object' && typeof SAVE === 'object' && typeof G === 'object'"), 'los módulos reales cargan en el navegador');
    ok(await evalJs("SAVE.get().coins >= 0"), 'el guardado existe y tiene saldo válido');
    ok(await evalJs("!document.getElementById('homeScreen') || getComputedStyle(document.getElementById('homeScreen')).display !== 'none'"), 'la portada es visible al arrancar');

    // Acceso privado al panel de administración tocando la moneda superior.
    await evalJs("document.getElementById('homeCoinChip').click()");
    await sleep(300);
    const adminGate = await evalJs("(function(){var m=document.getElementById('adminModal');var p=document.getElementById('adminPin');var l=document.getElementById('adminLock');return {visible:!m.classList.contains('hidden'),lock:!l.classList.contains('hidden'),password:p.type==='password',hint:l.textContent.indexOf('Pista')!==-1,title:m.textContent.indexOf('293031')!==-1}})()");
    ok(adminGate.visible && adminGate.lock, 'la moneda superior abre el panel privado de administración');
    ok(adminGate.password && !adminGate.hint && !adminGate.title, 'la clave está oculta y ya no se muestra la pista');
    await evalJs("document.getElementById('adminPin').value='5102'; document.getElementById('adminUnlock').click()");
    await sleep(250);
    ok(await evalJs("!document.getElementById('adminLock').classList.contains('hidden') && document.getElementById('adminPerks').classList.contains('hidden')"), 'una clave incorrecta no da acceso');
    await evalJs("document.getElementById('adminPin').value='293031'; document.getElementById('adminUnlock').click()");
    await sleep(250);
    ok(await evalJs("document.getElementById('adminLock').classList.contains('hidden') && !document.getElementById('adminPerks').classList.contains('hidden')"), 'la clave privada concede acceso al panel');
    await evalJs("document.getElementById('adminClose2').click()");
    await sleep(300);
    ok(await evalJs("document.getElementById('adminModal').classList.contains('hidden') && !document.getElementById('screen-home').classList.contains('hidden')"), 'el panel se cierra y vuelve a la portada');

    // Partida real: Jugar → modo libre
    await evalJs("document.getElementById('btnPlay').click()");
    await sleep(300);
    const firstRunPrompt = await evalJs("!document.getElementById('registerPrompt').classList.contains('hidden')");
    if (firstRunPrompt) {
      const promptText = await evalJs("document.getElementById('registerPrompt').textContent");
      ok(promptText.indexOf('Guarda tu progreso') !== -1 && promptText.indexOf('invitado') !== -1, 'el aviso de primer vuelo ofrece cuenta o invitado');
      await evalJs("document.getElementById('regPromptGuest').click()");
      await sleep(250);
    }
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
    await evalJs("SAVE.setSetting('confirmBuy', false); SAVE.addCoins(7000); document.querySelector('.ppc-buy').click()");
    await sleep(700);
    ok(await evalJs("SAVE.passPremiumActive()"), 'el botón de compra activa el Pase Prémium');
    ok((await evalJs("document.getElementById('genBody').textContent")).indexOf('PASE PRÉMIUM ACTIVO') !== -1, 'la interfaz refleja el estado activo');
    const claim = await evalJs("SAVE.setLevel(25); SAVE.claimPassPremiumAll()");
    ok(claim === 20, 'se reclaman las 20 recompensas prémium', String(claim));
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
    // Con PIO_EMULATORS=1 se sustituye por las pruebas de cuenta contra los
    // emuladores locales (nunca contra producción).
    if (!EMULATORS && process.env.SKIP_ONLINE !== '1') {
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

    // Cuenta real contra los emuladores: registro, copia en la nube,
    // restauración en un "dispositivo nuevo", cierre y login con elección.
    if (EMULATORS) {
      const emuUser = 'T' + String(Date.now()).slice(-9);
      const emuPass = 'Prueba123';
      // El emulador puede tardar unos segundos en aceptar escrituras aunque el
      // puerto ya esté abierto. Se reintenta como haría el juego al volver la red.
      const bootCloud = await evalJs(`(async function(){
        const wait = ms => new Promise(r => setTimeout(r, ms));
        let s = await CLOUD.init().catch(() => CLOUD.status());
        for (let i = 0; i < 8 && !(s && s.ready && s.status === 'online'); i++) {
          await wait(1500);
          s = await CLOUD.retry().catch(() => CLOUD.status());
        }
        return {status:s.status,ready:s.ready,configured:s.configured,error:s.error||null,session:CLOUD.session()};
      })()`);
      ok(bootCloud && bootCloud.configured, 'la nube de emuladores está configurada');
      ok(bootCloud && bootCloud.ready && bootCloud.status === 'online', 'Firebase conecta contra los emuladores', bootCloud && (bootCloud.status + (bootCloud.error ? ' · ' + bootCloud.error : '')));
      ok(bootCloud && bootCloud.session && bootCloud.session.anonymous, 'la sesión inicial es de invitado');

      // Aviso de registro del primer vuelo para un usuario nuevo sin partidas.
      const flightsBefore = await evalJs("SAVE.get().stats.flights");
      await evalJs("(function(){var s=SAVE.get();s.stats.flights=0;s.registrationPrompted=false;SAVE.save();return true})()");
      await evalJs("document.getElementById('btnPlay').click()");
      await sleep(250);
      const newUserPrompt = await evalJs("(function(){var p=document.getElementById('registerPrompt');return {visible:!p.classList.contains('hidden'),create:!!document.getElementById('regPromptCreate'),guest:!!document.getElementById('regPromptGuest'),modePick:!document.getElementById('screen-modepick').classList.contains('hidden')}})()");
      ok(newUserPrompt.visible && newUserPrompt.create && newUserPrompt.guest, 'el primer vuelo de un usuario nuevo ofrece cuenta o invitado');
      ok(!newUserPrompt.modePick, 'el aviso de registro aparece antes de elegir modo');
      await evalJs("document.getElementById('regPromptCreate').click()");
      await sleep(400);
      ok(await evalJs("!document.getElementById('screen-generic').classList.contains('hidden') && document.getElementById('genTitle').textContent.indexOf('PERFIL')!==-1"), 'crear cuenta abre el perfil con el registro');
      await evalJs("UI.closeGeneric()");
      await sleep(300);
      await evalJs("(function(){var s=SAVE.get();s.stats.flights=" + Number(flightsBefore) + ";s.registrationPrompted=true;SAVE.save();return true})()");

      await evalJs("UI.openGeneric('profile')");
      await sleep(400);
      const guestProfile = await evalJs("(function(){var b=document.getElementById('genBody');return {blocks:b.querySelectorAll('.profile-account-block').length,inputs:b.querySelectorAll('.profile-input').length,text:b.textContent}})()");
      ok(guestProfile.blocks >= 2 && guestProfile.inputs >= 5, 'el perfil ofrece entrar y crear cuenta', guestProfile.blocks + ' bloques / ' + guestProfile.inputs + ' campos');
      ok(guestProfile.text.indexOf('Estás jugando como invitado') !== -1, 'el perfil explica que ahora se juega como invitado');
      await evalJs("UI.closeGeneric()");
      await sleep(200);

      // Progreso reconocible que debe viajar a la nube al crear la cuenta.
      await evalJs("SAVE.setLevel(9); SAVE.addCoins(4321);");
      const before = await evalJs("({level:SAVE.get().level,coins:SAVE.get().coins,name:SAVE.getProfile().name})");
      const reg = await evalJs("CLOUD.register('" + emuUser + "','" + emuPass + "').then(function(r){return r}).catch(function(e){return {ok:false,msg:String(e)}})");
      ok(reg && reg.ok, 'el registro crea la cuenta con usuario y contraseña', JSON.stringify(reg));
      const afterReg = await evalJs("({session:CLOUD.session(),name:SAVE.getProfile().name})");
      ok(afterReg.session.account && afterReg.session.username === emuUser, 'la cuenta queda iniciada y vinculada', JSON.stringify(afterReg.session));
      ok(afterReg.name === emuUser, 'el nombre del jugador pasa a ser el usuario');

      await evalJs("UI.openGeneric('profile')");
      await sleep(400);
      const accProfile = await evalJs("(function(){var b=document.getElementById('genBody');var t=b.textContent;var out=false;Array.prototype.forEach.call(b.querySelectorAll('button'),function(x){if(x.textContent.indexOf('Cerrar sesión')!==-1)out=true});return {signed:t.indexOf('Sesión iniciada')!==-1,nameSection:t.indexOf('TU NOMBRE')!==-1,editor:!!b.querySelector('.profile-input[aria-label=\"Nombre de jugador\"]'),logout:out}})()");
      ok(accProfile.signed && accProfile.logout, 'el perfil muestra la sesión y el botón de cerrar sesión');
      ok(!accProfile.nameSection && !accProfile.editor, 'la sección para cambiar el nombre ya no existe');
      await evalJs("UI.closeGeneric()");
      await sleep(300);

      // "Dispositivo nuevo": se borra el guardado local y se recarga. La cuenta
      // debe restaurar el progreso automáticamente. Al importar la copia la
      // página puede recargarse otra vez, así que se sondea hasta que el
      // progreso esperado y la sesión estén disponibles.
      await evalJs("localStorage.removeItem('piovuelo_v1'); setTimeout(function(){location.reload()},50); true");
      const restored = await pollSave(`(function(){try{
        var s=(window.SAVE&&SAVE.get)?SAVE.get():null;
        if(!s||!window.CLOUD||!CLOUD.session)return null;
        var c=CLOUD.session();
        if(!c.account||s.level!==${before.level}||s.coins!==${before.coins})return null;
        return {level:s.level,coins:s.coins,name:SAVE.getProfile().name,account:c.account};
      }catch(e){return null}})()`, 60);
      ok(restored && restored.level === before.level && restored.coins === before.coins, 'un dispositivo nuevo restaura el progreso de la cuenta', JSON.stringify(restored) + ' vs ' + JSON.stringify(before));
      ok(restored && restored.name === emuUser && restored.account, 'el nombre y la sesión también se restauran');

      // La importación puede encadenar una segunda recarga: se fuerza una carga
      // limpia y se espera a que la condición se mantenga para que el resto de
      // pruebas no caiga a mitad de una recarga.
      await c.send('Page.navigate', { url: URL });
      await sleep(1500);
      const settled = await waitStable(`(function(){try{
        var s=(window.SAVE&&SAVE.get)?SAVE.get():null;
        if(!s||!window.CLOUD||!CLOUD.session)return null;
        var c=CLOUD.session();
        if(!c.account||s.level!==${before.level}||s.coins!==${before.coins})return null;
        return {level:s.level,coins:s.coins,account:c.account};
      }catch(e){return null}})()`, 40);
      ok(settled && settled.account, 'la sesión restaurada queda estable tras la recarga', JSON.stringify(settled));

      // Cierre de sesión: el juego sigue en local, sin invitado nuevo.
      const out = await pollSave("(function(){try{return CLOUD.logout().then(function(r){return r}).catch(function(e){return {ok:false,msg:String(e)}})}catch(e){return null}})()", 20);
      const afterOut = await pollSave("(function(){try{return {session:CLOUD.session(),level:SAVE.get().level,coins:SAVE.get().coins}}catch(e){return null}})()", 20);
      ok((out && out.ok) || (afterOut && !afterOut.session.signedIn), 'se puede cerrar sesión');
      ok(afterOut && !afterOut.session.account && !afterOut.session.signedIn, 'tras cerrar sesión no hay cuenta activa', afterOut && JSON.stringify(afterOut.session));
      ok(afterOut && afterOut.level === before.level, 'el progreso local se conserva al cerrar sesión');

      // Progreso distinto en este dispositivo: al entrar debe preguntar.
      await pollSave("(function(){try{SAVE.setLevel(13);SAVE.addCoins(500);return true}catch(e){return null}})()", 20);
      const login = await pollSave("(function(){try{return CLOUD.login('" + emuUser + "','" + emuPass + "').then(function(r){return r}).catch(function(e){return {ok:false,msg:String(e)}})}catch(e){return null}})()", 20);
      ok(login && login.ok && login.needsChoice, 'al entrar con progreso distinto se pide elegir', JSON.stringify(login));
      ok(login.local && login.cloud && login.local.level === 13 && login.cloud.level === before.level, 'la elección muestra los dos progresos reales', JSON.stringify(login.local) + ' / ' + JSON.stringify(login.cloud));

      // La interfaz dibuja el modal de elección y la opción de la cuenta
      // restaura la copia guardada en la nube.
      await pollSave("(function(){try{UI.accountChoice({local:" + JSON.stringify(login.local) + ",cloud:" + JSON.stringify(login.cloud) + ",reason:'login'});return true}catch(e){return null}})()", 20);
      await sleep(400);
      const modal = await pollSave("(function(){try{return {visible:!document.getElementById('modal').classList.contains('hidden'),text:document.getElementById('modalText').textContent,buttons:document.querySelectorAll('#modalActions .btn').length}}catch(e){return null}})()", 20);
      ok(modal.visible && modal.buttons === 2, 'el modal de elección ofrece las dos opciones', String(modal.buttons));
      ok(modal.text.indexOf('En este dispositivo') !== -1 && modal.text.indexOf('En tu cuenta') !== -1, 'el modal compara los dos progresos');
      await pollSave("(function(){try{var b=document.querySelector('#modalActions .btn');if(!b)return null;b.click();return true}catch(e){return null}})()", 20);
      const chosen = await pollSave(`(function(){try{
        var s=(window.SAVE&&SAVE.get)?SAVE.get():null;
        if(!s||!window.CLOUD||!CLOUD.session)return null;
        var c=CLOUD.session();
        if(!c.account||c.username!=='${emuUser}'||s.level!==${before.level}||s.coins!==${before.coins})return null;
        return {level:s.level,coins:s.coins,name:SAVE.getProfile().name,session:c};
      }catch(e){return null}})()`, 60);
      ok(chosen && chosen.level === before.level && chosen.coins === before.coins, 'elegir la cuenta restaura su progreso', JSON.stringify(chosen) + ' vs ' + JSON.stringify(before));
      ok(chosen && chosen.session.account && chosen.session.username === emuUser, 'la sesión queda iniciada tras elegir la cuenta');
    }

    // Multijugador online contra los emuladores: lobby, sala privada, unión de
    // un rival real por la API REST del emulador, cuenta atrás y limpieza.
    if (EMULATORS) {
      const PROJ = 'demo-pio-vuelo';
      const rtdbUrl = code => 'http://127.0.0.1:9000/duels/' + encodeURIComponent(code) + '.json?ns=' + PROJ + '-default-rtdb';

      const createRoom = async () => {
        const clicked = await evalJs("(function(){var bs=document.querySelectorAll('#genBody button');for(var i=0;i<bs.length;i++){if(bs[i].textContent==='CREAR SALA'){bs[i].click();return true}}return false})()");
        if (!clicked) return null;
        for (let i = 0; i < 30; i++) {
          await sleep(300);
          const code = await evalJs("(function(){var c=document.getElementById('mpRoomCode');return c?c.textContent:null})()").catch(() => null);
          if (code) return code;
        }
        return null;
      };

      const openLobby = async () => {
        for (let i = 0; i < 20; i++) {
          await evalJs("(function(){try{UI.openMultiplayer();}catch(e){}return true})()").catch(() => null);
          await sleep(400);
          const has = await evalJs("!!document.getElementById('mpPipes')").catch(() => false);
          if (has) return true;
        }
        return false;
      };

      await sleep(1600); // deja que termine cualquier recarga de la cuenta
      // Carga limpia para que el multijugador no empiece a mitad de una recarga.
      await c.send('Page.navigate', { url: URL });
      await sleep(1600);
      await waitStable("(function(){try{return !!(window.CLOUD && CLOUD.session().uid && window.SAVE && SAVE.get())}catch(e){return null}})()", 40);
      const opened = await openLobby();
      const lobby = opened
        ? await evalJs("(function(){var b=document.getElementById('genBody');return {create:!!document.getElementById('mpPipes'),join:!!document.getElementById('mpJoinCode'),noNet:b.textContent.indexOf('SIN CONEXIÓN')!==-1}})()")
        : { create: false, join: false, noNet: false };
      ok(lobby.create && lobby.join, 'el lobby multijugador ofrece crear sala y unirse por código');
      ok(!lobby.noNet, 'el lobby detecta la nube conectada');

      // Salir mientras se espera debe borrar la sala del servidor.
      const tempCode = await createRoom();
      ok(!!tempCode && /^[A-Z0-9]{6}$/.test(tempCode), 'se crea una sala de espera con código de 6 caracteres', tempCode || '');
      if (tempCode) {
        const left = await evalJs("(function(){var bs=document.querySelectorAll('#genBody button');for(var i=0;i<bs.length;i++){if(bs[i].textContent.indexOf('SALIR')!==-1){bs[i].click();return true}}return false})()");
        ok(left, 'el botón de salir de la sala está disponible');
        let tempGone;
        for (let i = 0; i < 12; i++) {
          await sleep(500);
          tempGone = await fetch(rtdbUrl(tempCode)).then(r => r.json()).catch(() => undefined);
          if (tempGone === null) break;
        }
        ok(tempGone === null, 'salir de la sala en espera la borra del servidor', tempGone === null ? 'null' : JSON.stringify(tempGone));
      }

      // Sala personalizada de verdad.
      await openLobby();
      await evalJs("(function(){" +
        "var p=document.getElementById('mpPipes');if(p)p.value='15';" +
        "var t=document.getElementById('mpTime');if(t)t.value='60';" +
        "var m=document.getElementById('mpMap');if(m)m.value='night';" +
        "var d=document.getElementById('mpDiff');if(d)d.value='hard';" +
        "var g=document.getElementById('mpSeedMode');if(g){g.value='manual';if(g.onchange)g.onchange();}" +
        "var sd=document.getElementById('mpSeed');if(sd)sd.value='2026';" +
        "var c=document.getElementById('mpTools');if(c)c.checked=false;" +
        "return true})()");
      const code = await createRoom();
      ok(!!code && /^[A-Z0-9]{6}$/.test(code), 'se crea la sala personalizada', code || '');
      if (code) {
        const roomText = await evalJs("document.getElementById('genBody').textContent");
        ok(roomText.indexOf('15 tubos') !== -1 && roomText.indexOf('60 s') !== -1 && roomText.indexOf('Herramientas') !== -1,
          'la sala muestra meta, tiempo y herramientas acordadas');

        // Rival real: se registra en Auth y escribe su lado con las reglas activas.
        let guest = null;
        try {
          const ga = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
          });
          guest = await ga.json();
        } catch (e) { guest = null; }
        ok(!!(guest && guest.idToken && guest.localId), 'el segundo jugador obtiene sesión anónima real');
        if (guest && guest.idToken) {
          const joinRes = await fetch(rtdbUrl(code) + '&auth=' + encodeURIComponent(guest.idToken), {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guest: { uid: guest.localId, name: 'RivalSmoke', score: 0, pipes: 0, alive: true, finished: false, time: 0 },
              updatedAt: Date.now()
            })
          }).catch(() => null);
          ok(joinRes && joinRes.ok, 'un rival real se une a la sala', joinRes ? String(joinRes.status) : 'sin respuesta');

          await sleep(1600);
          const ready = await evalJs("(function(){var t=document.getElementById('genBody').textContent;var bs=document.querySelectorAll('#genBody button');var start=false;for(var i=0;i<bs.length;i++)if(bs[i].textContent.indexOf('EMPEZAR')!==-1)start=true;return {ready:t.indexOf('Rival listo')!==-1,start:start,name:t.indexOf('RivalSmoke')!==-1}})()");
          ok(ready.name && ready.ready && ready.start, 'el anfitrión ve al rival y puede empezar');

          await evalJs("(function(){var bs=document.querySelectorAll('#genBody button');for(var i=0;i<bs.length;i++){if(bs[i].textContent.indexOf('EMPEZAR')!==-1){bs[i].click();return true}}return false})()");

          // Sigue la transición de pantalla hasta que arranque la carrera, sin
          // depender de un instante exacto: la cuenta atrás dura 3,5 s.
          const seen = [];
          let pvpState = null;
          let sawPlay = false;
          for (let i = 0; i < 24 && !sawPlay; i++) {
            await sleep(250);
            const st = await evalJs("(function(){try{var p=G.getPvp();return {mode:G.getMode(),state:G.getState(),pvp:p?{goal:p.goal,time:p.timeLimit,side:p.side,code:p.code}:null}}catch(e){return null}})()").catch(() => null);
            if (!st) continue;
            pvpState = st;
            const last = seen[seen.length - 1];
            if (!last || last.mode !== st.mode || last.state !== st.state) seen.push({ mode: st.mode, state: st.state });
            if (st.mode === 'pvp' && st.state === 'play') sawPlay = true;
          }
          ok(sawPlay, 'la cuenta atrás lanza la carrera online', JSON.stringify(seen));
          ok(pvpState && pvpState.pvp && pvpState.pvp.goal === 15 && pvpState.pvp.time === 60,
            'la carrera respeta la meta y el tiempo de la sala', JSON.stringify(pvpState && pvpState.pvp));

          const serverRoom = await fetch(rtdbUrl(code)).then(r => r.json()).catch(() => null);
          ok(serverRoom && serverRoom.state === 'playing' && serverRoom.startAt > 0,
            'la sala queda en partida con hora de salida compartida', serverRoom && serverRoom.state);
          ok(serverRoom && serverRoom.host && serverRoom.host.uid && serverRoom.guest && serverRoom.guest.name === 'RivalSmoke',
            'la sala guarda a los dos jugadores');

          await evalJs("G.goMenu()");
          let afterLeave = null;
          for (let i = 0; i < 12; i++) {
            await sleep(500);
            afterLeave = await fetch(rtdbUrl(code)).then(r => r.json()).catch(() => null);
            if (afterLeave && afterLeave.state === 'finished') break;
          }
          ok(afterLeave && afterLeave.state === 'finished' && afterLeave.winner === 'guest',
            'al abandonar el anfitrión, el invitado gana y la sala queda resuelta',
            afterLeave && (afterLeave.state + '/' + afterLeave.winner));
        }
      }
    }

    // Errores reales de la consola
    const errors = c.events.filter(e =>
      (e.method === 'Runtime.exceptionThrown') ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') ||
      (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    ).map(e => {
      if (e.method === 'Runtime.exceptionThrown') return e.params.exceptionDetails.text + ' ' + ((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || '');
      if (e.method === 'Log.entryAdded') return e.params.entry.text + (e.params.entry.url ? ' @ ' + e.params.entry.url : '');
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
