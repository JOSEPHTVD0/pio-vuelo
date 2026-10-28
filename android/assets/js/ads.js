/* ads.js - anuncios intersticiales
 *
 * En la web los sirve el tag de Ad Placement API (AdSense).
 * En el APK los sirve AdMob: el mismo tag es interceptado por el SDK de Google
 * Mobile Ads (WebView API for Ads) porque MainActivity llama a
 * MobileAds.registerWebView() y usa H5AdsWebViewClient.
 *
 * Si el tag no carga (sin red, bloqueado, sin ID de AdSense) el juego sigue
 * funcionando con normalidad: todas las llamadas son "a prueba de fallos".
 */
(function () {
  'use strict';

  var MIN_RUNS_TO_FIRST = 2;   // sin anuncios en la primera partida
  var MIN_RUNS_BETWEEN = 2;    // como maximo un anuncio cada 2 partidas
  var MIN_MS_BETWEEN = 120000; // y con al menos 2 minutos entre anuncios
  var LOCK_MS = 20000;         // si afterAd no llega, no bloqueamos el juego

  var runs = 0;      // partidas terminadas
  var lastRun = 0;   // partida en la que se pidio el ultimo anuncio
  var lastAt = 0;    // timestamp del ultimo anuncio
  var locked = false;

  // el tag declara `const adBreak` en el ambito global; typeof evita ReferenceError
  function getAdBreak() {
    if (typeof adBreak === 'function') return adBreak;
    if (typeof window.adConfig === 'function') return window.adConfig;
    return null;
  }

  function pauseGame() {
    if (window.SND && typeof SND.stopMusic === 'function') SND.stopMusic();
  }

  function unlock() { locked = false; }

  function canShow() {
    if (locked) return false;
    if (runs < MIN_RUNS_TO_FIRST) return false;
    if (lastRun && runs - lastRun < MIN_RUNS_BETWEEN) return false;
    if (lastAt && Date.now() - lastAt < MIN_MS_BETWEEN) return false;
    return true;
  }

  function show(reason) {
    var fn = getAdBreak();
    if (!fn) return false;
    if (!canShow()) return false;
    locked = true;
    lastRun = runs;
    lastAt = Date.now();
    try {
      fn({
        beforeAd: pauseGame,
        afterAd: unlock
      });
    } catch (e) {
      unlock();
      return false;
    }
    // sin inventario de anuncios afterAd puede no llegar nunca
    setTimeout(unlock, LOCK_MS);
    return true;
  }

  window.ADS = {
    // lo llama el juego al terminar una partida
    onRunEnd: function (reason) {
      runs++;
      return show(reason || 'gameover');
    },
    // util para depurar en la consola
    available: function () { return !!getAdBreak(); },
    stats: function () { return { runs: runs, lastRun: lastRun, lastAt: lastAt }; }
  };
})();
