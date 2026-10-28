/* Arranque: carga, entrada, botones y puente con Android */
window.APP = (function () {
  'use strict';

  const $ = id => document.getElementById(id);

  /* --- Carga con barra de progreso --- */
  const TIPS = [
    'Toca la pantalla para hacer volar a Pío.',
    'Cruza entre los tubos para sumar puntos.',
    'Recoge monedas 💰 para la tienda.',
    'Cada 8 puntos el juego se vuelve más rápido.',
    '¡Cuidado! Un solo choque acaba la partida.',
    'Esquiva tubos y enemigos: no hay segundas oportunidades.',
    'Atrapa poder: ✨ doble puntos, 💰 doble monedas, 🧲 imán y ⏳ cámara lenta.',
    'Modo DUELO 🆚: cruza 12 tubos antes que la IA.',
    'Desbloquea mapas alcanzando nuevos récords.',
    'El desafío del día 🌙 cambia cada día: ¡vuelve mañana!'
  ];

  function runLoading() {
    UI.showLoading();
    let p = 0;
    let tipIdx = 0;
    const tipEl = $('loadTip');
    const fill = $('loadFill');
    tipEl.textContent = TIPS[0];
    const iv = setInterval(() => {
      p += 4 + Math.random() * 9;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        finishLoading();
        return;
      }
      fill.style.width = Math.min(100, p) + '%';
      if (Math.random() < 0.18) {
        tipIdx = (tipIdx + 1) % TIPS.length;
        tipEl.textContent = TIPS[tipIdx];
      }
      // carga "real" del logo animado
      drawLoadBird(p / 100);
    }, 60);
  }

  function drawLoadBird(progress) {
    const c = $('loadBird').getContext('2d');
    c.clearRect(0, 0, 120, 100);
    const skin = DAT.getSkin('classic');
    const flap = 0.5 + 0.4 * Math.sin(Date.now() / 90);
    ENTS.drawBird(c, 60, 50, { skin, hat: null, t: Date.now() / 700, wingPhase: flap, squash: 1, rot: Math.sin(Date.now() / 200) * 0.08, r: 20 });
  }

  function finishLoading() {
    $('loadFill').style.width = '100%';
    SND.ensure();
    const first = SAVE.load();
    // Avisos de almacenamiento: nunca fallar en silencio
    let lastSaveWarn = 0;
    window.addEventListener('piovuelo:saveerror', () => {
      const now = Date.now();
      if (now - lastSaveWarn < 8000) return;
      lastSaveWarn = now;
      UI.toast('⚠️ No se pudo guardar el progreso (almacenamiento lleno o bloqueado).', 'warning');
    });
    if (SAVE.lastLoadError && SAVE.lastLoadError()) {
      setTimeout(() => UI.toast('⚠️ No se pudo leer el progreso guardado; se empieza de cero.', 'warning'), 1200);
    } else if (SAVE.lastSaveError && SAVE.lastSaveError()) {
      setTimeout(() => UI.toast('⚠️ El progreso no se está guardando en este dispositivo.', 'warning'), 1200);
    }
    const st = SAVE.get().set;
    SND.setSfx(st.sfx);
    SND.setMusic(st.music);
    SND.setVolumes(st.volS, st.volM);
    FX.setReduced(!!st.reduced);
    ENTS.setHC(!!st.hc);
    G.setMode(st.mode || 'free');
    G.resize();
    G.goMenu();
    if (first) {
      setTimeout(() => {
        UI.toast('¡Bienvenido! Tienes ' + SAVE.get().coins + ' monedas para empezar 🎁', 'good');
      }, 500);
    }
    requestAnimationFrame(G.loop);
    setTimeout(() => { $('screen-loading').classList.add('hidden'); }, 260);
  }

  /* --- Entrada --- */
  function bindInput() {
    const canvas = G.canvas;
    const down = e => {
      e.preventDefault();
      SND.unlock();
      if (!G.isPlay() || G.isPaused()) return;
      if (SAVE.get().set.lift !== true) G.flap();
    };
    const up = e => {
      SND.unlock();
      if (!G.isPlay() || G.isPaused()) return;
      if (SAVE.get().set.lift === true) G.flap();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
      }
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        SND.unlock();
        if (G.isPlay() && !G.isPaused()) G.flap();
        if (e.code === 'Space' && UI.current() === null &&
          $('adminModal').classList.contains('hidden') && G.getState() === 'menu') UI.showModePick();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (G.isPlay()) { SND.sfx.click(); G.togglePause(); }
      }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    // Solo bloquear el scroll del navegador sobre el canvas (durante el juego).
    // Las pantallas (tienda, mapas, progreso, ajustes) quedan libres para desplazarse.
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    // primer gesto desbloquea audio
    window.addEventListener('pointerdown', () => { SND.unlock(); }, { once: false });

    // Panel de administración: sostener 3 dedos en la pantalla
    const activeTouches = new Set();
    let threeTimer = null;
    window.addEventListener('touchstart', e => {
      for (let i = 0; i < e.changedTouches.length; i++) activeTouches.add(e.changedTouches[i].identifier);
      if (activeTouches.size >= 3 && !threeTimer && $('adminModal').classList.contains('hidden')) {
        threeTimer = setTimeout(() => {
          threeTimer = null;
          if (activeTouches.size >= 3) openAdmin();
        }, 450);
      }
    }, { passive: true });
    window.addEventListener('touchend', e => {
      for (let i = 0; i < e.changedTouches.length; i++) activeTouches.delete(e.changedTouches[i].identifier);
      if (activeTouches.size < 3 && threeTimer) { clearTimeout(threeTimer); threeTimer = null; }
    }, { passive: true });
    window.addEventListener('touchcancel', e => {
      for (let i = 0; i < e.changedTouches.length; i++) activeTouches.delete(e.changedTouches[i].identifier);
      if (threeTimer) { clearTimeout(threeTimer); threeTimer = null; }
    }, { passive: true });
  }

  /* --- Panel de administración (3 dedos + PIN) --- */
  const ADMIN_PIN = '5102';
  let adminUnlocked = false;
  let adminPausedGame = false;

  function openAdmin() {
    SND.unlock();
    if (G.isPlay()) {
      if (!G.isPaused()) G.togglePause();
      adminPausedGame = true;
    }
    if (!adminUnlocked) {
      $('adminLock').classList.remove('hidden');
      $('adminPerks').classList.add('hidden');
      $('adminPin').value = '';
    } else {
      $('adminLock').classList.add('hidden');
      $('adminPerks').classList.remove('hidden');
    }
    if (UI.isModePickOpen()) UI.closeModePick(); // fija la bandera si el menú de modos estaba abierto
    UI.hideAllScreens();
    $('adminModal').classList.remove('hidden');
    SND.sfx.click();
  }

  function closeAdmin() {
    $('adminModal').classList.add('hidden');
    if (adminPausedGame) {
      if (G.isPaused()) G.togglePause();
      adminPausedGame = false;
    }
    if (G.getState() === 'menu') UI.showHome();
  }

  function adminToast(msg, kind) {
    UI.toast('🛠 ' + msg, kind || 'good');
  }

  function bindAdmin() {
    $('adminUnlock').onclick = () => {
      const pin = ($('adminPin').value || '').trim();
      if (pin === ADMIN_PIN) {
        adminUnlocked = true;
        $('adminLock').classList.add('hidden');
        $('adminPerks').classList.remove('hidden');
        SND.sfx.level();
        adminToast('Acceso concedido 🔓');
        $('adminPin').value = '';
      } else {
        SND.sfx.deny();
        adminToast('Código incorrecto ✖', '');
      }
    };
    $('adminClose1').onclick = closeAdmin;
    $('adminClose2').onclick = closeAdmin;
    $('adminPin').addEventListener('keydown', e => {
      if (e.key === 'Enter') $('adminUnlock').onclick();
    });

    $('admCoins').onclick = () => {
      SAVE.addCoins(1000);
      adminToast('+1000 🪙 añadidas');
      UI.refreshHome();
    };
    $('admCoins10k').onclick = () => {
      SAVE.addCoins(10000);
      adminToast('+10.000 🪙 añadidas');
      UI.refreshHome();
    };
    $('admTools').onclick = () => {
      SAVE.giveTools(5);
      adminToast('+5 de cada herramienta 🎒');
      UI.refreshHome();
    };
    $('admTools20').onclick = () => {
      SAVE.giveTools(20);
      adminToast('+20 de cada herramienta 🎒');
      UI.refreshHome();
    };
    $('admUnlock').onclick = () => {
      SAVE.unlockAll();
      adminToast('Todo desbloqueado 🌟');
      UI.refreshHome();
    };
    $('admXp').onclick = () => {
      const ups = SAVE.addXp((SAVE.xpFor(SAVE.get().level)) * 4);
      adminToast('Subiste ' + ups + ' niveles ⬆');
      UI.refreshHome();
    };
    $('admXp5k').onclick = () => {
      SAVE.addXp(5000);
      adminToast('+5.000 XP ⚡');
      UI.refreshHome();
    };
    $('admLevel20').onclick = () => {
      SAVE.setLevel(20);
      adminToast('Nivel fijado en 20 🚀');
      UI.refreshHome();
    };
    $('admStreak').onclick = () => {
      SAVE.adminSetStreak();
      adminToast('Racha diaria = 7 🔥 (reclama tu regalo)');
      UI.refreshHome();
    };
    $('admReset').onclick = () => {
      SAVE.reset();
      adminUnlocked = false;
      closeAdmin();
      location.reload();
    };
    $('admMaxUpg').onclick = () => {
      SAVE.giveAllUpg();
      adminToast('Todas las herramientas al nivel 5 ⭐');
      UI.refreshHome();
    };
    $('admAchAll').onclick = () => {
      const rw = SAVE.achAll();
      adminToast('Logros desbloqueados (+' + rw + ' 🪙) 🏆');
      UI.refreshHome();
    };
    $('admSeasonAll').onclick = () => {
      const n = SAVE.claimPassAll() + SAVE.claimSeasonAll();
      adminToast('Pase y Temporada reclamados (' + n + ' recompensas) 🎫');
      SAVE.checkAch().forEach(a => UI.popAch(a));
      UI.refreshHome();
    };
    $('admChalReset').onclick = () => {
      SAVE.chalReset();
      adminToast('Desafío de hoy reiniciado 🌙');
      UI.refreshHome();
    };
  }

  function bindButtons() {
    const startMode = m => {
      SND.sfx.click();
      G.setMode(m);
      G.startPlay();
    };
    $('btnPlay').onclick = () => { SND.sfx.click(); UI.showModePick(); };
    $('mpFree').onclick = () => startMode('free');
    $('mpDuel').onclick = () => startMode('duel');
    $('mpDaily').onclick = () => {
      if (SAVE.challengePlayedToday()) {
        UI.toast('Ya jugaste el desafío de hoy 🌙 ¡Vuelve mañana!', 'info');
        return;
      }
      startMode('challenge');
    };
    $('mpZen').onclick = () => startMode('zen');
    $('mpBoss').onclick = () => startMode('boss');
    $('mpWind').onclick = () => startMode('wind');
    $('btnModeBack').onclick = () => { SND.sfx.click(); UI.closeModePick(); };
    const btnReplay = document.getElementById('btnReplay');
    if (btnReplay) btnReplay.onclick = () => { SND.sfx.click(); G.startPlay('replay'); };
    $('btnNextLevel').onclick = () => { SND.sfx.click(); G.startPlay(); };
    $('btnClearHome').onclick = () => { SND.sfx.click(); G.goMenu(); };
    $('btnPause').onclick = () => { SND.sfx.click(); G.togglePause(); };
    $('btnResume').onclick = () => { SND.sfx.click(); G.togglePause(); };
    $('btnRestart').onclick = () => { G.setPaused(false); SND.sfx.click(); G.startPlay(); };
    $('btnExit').onclick = () => { G.setPaused(false); SND.sfx.click(); G.goMenu(); };
    $('btnRetry').onclick = () => { SND.sfx.click(); G.startPlay(); };
    $('btnOverHome').onclick = () => { SND.sfx.click(); G.goMenu(); };
    $('btnShare').onclick = () => {
      SND.sfx.click();
      shareScore();
    };
    $('btnGenBack').onclick = () => { SND.sfx.click(); UI.closeGeneric(); };
    $('btnHomeSound').onclick = () => {
      SND.sfx.click();
      const cur = SAVE.get().set.sfx;
      const next = !cur;
      SAVE.setSetting('sfx', next);
      SND.setSfx(next);
      UI.refreshHome();
    };
    $('dailyPill').onclick = () => {
      const r = SAVE.claimDaily();
      if (!r) { UI.toast('Ya reclamaste tu recompensa de hoy 🎁', 'info'); return; }
      SND.sfx.level();
      UI.toast('🎁 Recompensa diaria: +' + r.reward + ' 🪙 (racha 🔥' + r.streak + ')', 'good');
      UI.refreshHome();
      SAVE.checkAch().forEach(a => UI.popAch(a));
    };
    $('dailyRunPill').onclick = () => {
      if (SAVE.challengePlayedToday()) {
        UI.toast('Ya jugaste el desafío de hoy 🌙 ¡Vuelve mañana!', 'info');
        return;
      }
      SND.sfx.click();
      G.startPlay('challenge');
    };
    document.querySelectorAll('[data-nav]').forEach(b => {
      b.onclick = () => { SND.sfx.click(); UI.openGeneric(b.getAttribute('data-nav'), b.getAttribute('data-tab')); };
    });

    // cerrar modal con click fuera
    $('modal').addEventListener('click', e => { if (e.target === $('modal')) $('modal').classList.add('hidden'); });

    // PWA
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { });
    }
  }

  function shareScore() {
    const s = SAVE.get();
    const msg = '🐤 Pío Vuelo: marqué ' + G.getScore() + ' pts 🏆 y volé ' + Math.floor(G.getDist()) + ' m. ¡Rétame!';
    const done = () => {
      if (!s.stats.shared) { s.stats.shared = 1; SAVE.save(); }
      SAVE.checkAch().forEach(a => UI.popAch(a));
    };
    if (navigator.share) {
      navigator.share({ title: 'Pío Vuelo', text: msg })
        .then(done)
        .catch(() => UI.toast('Compartir cancelado', 'info'));
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg)
        .then(() => { done(); UI.toast('📋 Marcador copiado al portapapeles', 'good'); })
        .catch(() => UI.toast('No se pudo compartir', ''));
    } else {
      UI.toast('Compartir no disponible en este dispositivo', '');
    }
  }

  /* --- Puente Android --- */
  window.__appBack = function () {
    const mp = document.getElementById('screen-modepick');
    if (mp && !mp.classList.contains('hidden')) { UI.closeModePick(); return 'handled'; }
    if (!$('adminModal').classList.contains('hidden')) { closeAdmin(); return 'handled'; }
    if (!$('modal').classList.contains('hidden')) { $('modal').classList.add('hidden'); return 'handled'; }
    if (G.getState() === 'cleared') { G.goMenu(); return 'handled'; }
    if (G.isPlay()) {
      G.togglePause();
      return 'handled';
    }
    if (UI.current()) { UI.closeGeneric(); return 'handled'; }
    const st = G.getState();
    if (st === 'menu') return 'exit';
    if (st === 'over') { G.goMenu(); return 'handled'; }
    return 'handled';
  };
  window.__appShouldExit = function () {
    const mp = document.getElementById('screen-modepick');
    return G.getState() === 'menu' && !UI.current() && (!mp || mp.classList.contains('hidden'));
  };

  function boot() {
    bindButtons();
    bindAdmin();
    bindInput();
    runLoading();
    window.addEventListener('resize', () => G.resize());

    // Pantalla apagada / app en segundo plano: paralizar bucle + música, y reanudar al volver
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) G.suspend();
      else G.resumeLoop();
    });
    window.addEventListener('pagehide', () => { G.suspend(); });
    window.addEventListener('pageshow', () => { G.resumeLoop(); });
  }

  return { boot };
})();

document.addEventListener('DOMContentLoaded', APP.boot);