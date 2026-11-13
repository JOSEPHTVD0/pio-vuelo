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

  /* --- Avisos reales de la nube (récords superados y panel admin) --- */
  let notificationStop = null;
  const seenNotifications = new Set();
  function startNotifications() {
    if (!window.CLOUD || typeof CLOUD.watchNotifications !== 'function') return;
    if (notificationStop) {
      try { notificationStop(); } catch (e) { }
      notificationStop = null;
    }
    notificationStop = CLOUD.watchNotifications(function (list) {
      let shown = 0;
      (list || []).slice().reverse().forEach(function (n) {
        if (!n || !n.id || n.read === true || seenNotifications.has(n.id) || shown >= 3) return;
        shown++;
        seenNotifications.add(n.id);
        const title = String(n.title || 'Pío Vuelo').slice(0, 64);
        const body = String(n.body || '').slice(0, 160);
        const icon = n.type === 'record' ? '🏆 ' : '🔔 ';
        UI.toast(icon + title + (body ? ' · ' + body : ''), n.type === 'record' ? 'good' : 'info');
        if (typeof CLOUD.markNotificationRead === 'function') {
          CLOUD.markNotificationRead(n.id);
        }
      });
    });
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
    // La nube avisa si el nombre de la cuenta ya estaba reservado.
    window.addEventListener('piovuelo:nameconflict', (ev) => {
      const d = (ev && ev.detail) || {};
      setTimeout(() => {
        UI.toast('⚠️ El nombre «' + (d.name || SAVE.getProfile().name) +
          '» ya lo usa otro jugador.', 'warning');
      }, 1400);
    });
    // Hay dos progresos distintos (dispositivo y cuenta): se pregunta cuál usar.
    window.addEventListener('piovuelo:accountchoice', (ev) => {
      UI.accountChoice((ev && ev.detail) || {});
    });
    // La sesión cambió (registro o cierre): refresca el perfil si está abierto
    // y vuelve a escuchar el buzón de la cuenta activa.
    window.addEventListener('piovuelo:accountchanged', () => {
      if (UI.current() === 'profile') UI.openGeneric('profile');
      startNotifications();
    });
    // Escucha el buzón privado: el backend entrega ahí los avisos de récord
    // y los mensajes del panel. Sin nube configurada no se hace ninguna red.
    startNotifications();
    const st = SAVE.get().set;
    SND.setSfx(st.sfx);
    SND.setMusic(st.music);
    SND.setVolumes(st.volS, st.volM, st.volG);
    FX.setReduced(!!st.reduced);
    ENTS.setHC(!!st.hc);
    document.body.classList.toggle('no-ui-anim', st.uiAnim === false);
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
      // Ratón: clic derecho dispara igual que F/J y el botón de disparo.
      if (e.pointerType === 'mouse' && e.button === 2) { G.shoot(); return; }
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
      if (e.code === 'KeyF' || e.code === 'KeyJ') {
        if (G.isPlay() && !G.isPaused()) { e.preventDefault(); SND.unlock(); G.shoot(); }
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (G.isPlay()) { SND.sfx.click(); G.togglePause(); }
      }
    });
    const shootBtn = document.getElementById('btnShoot');
    if (shootBtn) {
      shootBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        SND.unlock();
        if (G.isPlay() && !G.isPaused()) G.shoot();
      });
    }
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

  /* --- Panel de administración (moneda superior o 3 dedos + PIN) --- */
  const ADMIN_PIN = '293031';
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
      renderAdminExtras();
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

  /* --- Extensiones del panel admin v3.5.0 (roles, tuning, historial, etc.) --- */
  function adminEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function adminTime(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(); } catch (e) { return '—'; }
  }
  function renderAdminLog() {
    const box = $('admLog');
    if (!box || !SAVE.getAdminLog) return;
    const list = SAVE.getAdminLog(12);
    box.innerHTML = list.length
      ? list.map(e => '<b>' + adminEsc(e.action) + '</b> · ' + adminEsc(adminTime(e.at)) + '\n' + adminEsc(e.detail)).join('\n\n')
      : 'Sin acciones registradas.';
  }
  function renderAdminEvents() {
    const box = $('admEventList');
    if (!box || !SAVE.getEvents) return;
    const list = SAVE.getEvents();
    box.innerHTML = list.length
      ? list.map(e => '📅 <b>' + adminEsc(e.name) + '</b> · ' + adminEsc(e.kind) + '\n' + adminEsc(e.desc || 'Sin descripción')).join('\n\n')
      : 'Sin eventos.';
  }
  function renderAdminSanctions() {
    const box = $('admSanctionList');
    if (!box || !SAVE.getSanctions) return;
    const list = SAVE.getSanctions();
    box.innerHTML = list.length
      ? list.map(s => '🚨 <b>' + adminEsc(s.name) + '</b> · ' + adminEsc(s.type) + ' · ' + adminEsc(adminTime(s.at)) + '\n' + adminEsc(s.reason || 'Sin motivo')).join('\n\n')
      : 'Sin sanciones.';
  }
  function renderAdminTuning() {
    const t = SAVE.getTuning ? SAVE.getTuning() : null;
    if (!t) return;
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    set('admXpBase', t.xpBase);
    set('admXpCurve', t.xpCurve);
    set('admXpFlat', t.xpFlat);
    set('admXpMul', t.xpMul);
    set('admCoinMul', t.coinMul);
    set('admRewardMul', t.rewardMul);
    set('admPlayBonus', t.playBonus);
    const role = $('admRole');
    if (role && SAVE.getAdmin) role.value = SAVE.getAdmin().role;
  }
  function showAdminSeason() {
    const box = $('admSeasonOut');
    if (!box) return;
    const xp = SAVE.totalXp ? SAVE.totalXp() : 0;
    const reached = SAVE.passReached ? SAVE.passReached() : 0;
    const claimed = SAVE.passClaimedCount ? SAVE.passClaimedCount() : 0;
    const premium = SAVE.passPremiumActive ? SAVE.passPremiumActive() : false;
    const premClaimed = SAVE.passPremiumClaimedCount ? SAVE.passPremiumClaimedCount() : 0;
    const seasonReached = SAVE.seasonReached ? SAVE.seasonReached() : 0;
    const seasonClaimed = SAVE.seasonClaimCount ? SAVE.seasonClaimCount() : 0;
    const passTiers = (window.DAT && DAT.passTiers) ? DAT.passTiers().length : 0;
    const seasonTiers = (window.DAT && DAT.SEASON_TIERS) ? DAT.SEASON_TIERS.length : 0;
    box.innerHTML = '<b>' + adminEsc(SAVE.passSeasonName ? SAVE.passSeasonName() : 'Temporada') + '</b>' +
      '\nXP total: ' + xp +
      '\nPase: ' + reached + '/' + passTiers + ' niveles · ' + claimed + ' reclamados' +
      '\nPase prémium: ' + (premium ? 'activo' : 'no activo') + ' · ' + premClaimed + '/' + passTiers + ' reclamados' +
      '\nTemporada: ' + seasonReached + '/' + seasonTiers + ' niveles · ' + seasonClaimed + ' reclamados';
  }
  function renderAdminPlayers() {
    const sel = $('admPlayer');
    if (!sel || !SAVE.leaderboard) return;
    const lb = SAVE.leaderboard();
    const players = (lb && lb.players) || [];
    const keep = sel.value;
    sel.innerHTML = '';
    players.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + (p.me ? ' (tú)' : ' · ' + p.best + ' pts');
      sel.appendChild(opt);
    });
    const mine = players.find(p => p.me);
    if (keep && players.some(p => p.id === keep)) sel.value = keep;
    else if (mine) sel.value = mine.id;
  }
  function showAdminPlayer() {
    const sel = $('admPlayer');
    const box = $('admPlayerOut');
    if (!sel || !box) return;
    const lb = SAVE.leaderboard();
    const p = ((lb && lb.players) || []).find(x => x.id === sel.value);
    if (!p) { box.textContent = 'Sin jugadores locales todavía.'; return; }
    const matches = SAVE.getMatches().filter(m =>
      (m.participants || []).some(x => String(x.name || '') === p.name));
    let out = '<b>' + adminEsc(p.name) + '</b>' + (p.me ? ' · tú' : '') +
      '\nMejor: ' + p.best + ' · Última: ' + p.last +
      '\nPartidas: ' + p.games + ' · Partidas con historial: ' + matches.length +
      '\nRécord: ' + adminEsc(adminTime(p.bestDate)) +
      '\nÚltima vez: ' + adminEsc(adminTime(p.lastDate));
    if (p.me) {
      const st = SAVE.get().stats || {};
      out += '\nOnline: ' + (st.mpWins || 0) + ' victorias / ' + (st.mpMatches || 0) + ' partidas' +
        '\nSupervivencia online: ' + (st.mpSurvivalBest || 0) + ' s' +
        '\nRécord de eliminaciones: ' + (st.recordBest || 0) +
        '\nEliminaciones totales: ' + (st.recordKills || 0);
    }
    box.innerHTML = out;
  }
  let adminNotifStatus = null;
  function renderAdminNotifHint() {
    const box = $('admNotifOut');
    if (!box) return;
    const sess = window.CLOUD && CLOUD.session ? CLOUD.session() : {};
    if (!sess.uid) {
      box.textContent = 'Conecta la nube para enviar avisos reales a otras cuentas.';
      return;
    }
    const uid = adminEsc(sess.uid);
    if (!window.CLOUD || typeof CLOUD.getAdminStatus !== 'function') {
      box.innerHTML = 'Tu UID: <b>' + uid + '</b>\nBackend dedicado no disponible en este cliente.';
      return;
    }
    const st = adminNotifStatus;
    if (st && st.admin) {
      box.innerHTML = 'Backend conectado ✅\nTu UID: <b>' + uid + '</b>\nPuedes enviar avisos a cualquier cuenta.';
    } else if (st && st.backend) {
      box.innerHTML = 'Backend conectado, pero sin permisos de administrador.\nTu UID: <b>' + uid +
        '</b>\nCrea el documento Firestore admins/' + uid + ' para autorizar esta cuenta.';
    } else if (st) {
      box.innerHTML = 'Backend no disponible (' + adminEsc(st.reason || 'sin conexión') +
        ').\nTu UID: <b>' + uid + '</b>';
    } else {
      box.innerHTML = 'Tu UID: <b>' + uid + '</b>\nPulsa «Comprobar backend» para verificar los permisos.';
    }
  }
  async function checkAdminBackend() {
    if (!window.CLOUD || typeof CLOUD.getAdminStatus !== 'function') {
      adminToast('Backend dedicado no disponible en este cliente', '');
      return;
    }
    const box = $('admNotifOut');
    if (box) box.textContent = 'Comprobando permisos del backend…';
    adminNotifStatus = await CLOUD.getAdminStatus();
    renderAdminNotifHint();
  }
  function adminNotifError(reason) {
    if (reason === 'permission-denied') return 'Tu cuenta no es administradora del backend';
    if (reason === 'unauthenticated') return 'Inicia sesión con tu cuenta de administrador';
    if (reason === 'resource-exhausted') return 'Demasiados avisos: espera un minuto';
    if (reason === 'invalid-argument') return 'Revisa el UID, el título y el mensaje';
    if (reason === 'not-found' || reason === 'unimplemented') return 'Backend no desplegado todavía';
    if (reason === 'offline' || reason === 'unavailable') return 'Sin conexión con el backend';
    return 'No se pudo enviar el aviso';
  }
  function renderAdminExtras() {
    renderAdminTuning();
    renderAdminLog();
    renderAdminEvents();
    renderAdminSanctions();
    renderAdminPlayers();
    renderAdminNotifHint();
  }
  function adminNum(id, fallback) {
    const el = $(id);
    const v = el ? parseFloat(el.value) : NaN;
    return isFinite(v) ? v : fallback;
  }
  async function loadAdminMatches() {
    const box = $('admMatchOut');
    if (!box) return;
    const filter = $('admMatchFilter') ? $('admMatchFilter').value : 'all';
    const list = SAVE.getMatches ? SAVE.getMatches(filter) : [];
    if (!list.length) { box.textContent = 'No hay partidas para este filtro.'; return; }
    box.innerHTML = list.slice(0, 12).map(m => {
      const parts = (m.participants || []).map(p =>
        adminEsc(p.name) + ' · ' + (p.score || 0) + ' pts · ' + (p.pipes || 0) + ' tubos' +
        (p.kills ? ' · ' + p.kills + ' kills' : '') + (p.alive === false ? ' · 💀' : '')
      ).join(' | ');
      return '<b>' + adminEsc(m.mode || 'partida') + '</b> · ' + adminEsc(adminTime(m.date)) +
        (m.result ? ' · ' + adminEsc(m.result) : '') + '\n' + (parts || 'Sin participantes');
    }).join('\n\n');
  }
  async function loadAdminRecord() {
    const box = $('admRecordOut');
    if (!box) return;
    const s = SAVE.get();
    const local = 'Récord local de eliminaciones: <b>' + (s.stats.recordBest || 0) + '</b> · carreras: ' + (s.stats.recordRuns || 0);
    box.innerHTML = local + '\nRécord global: consultando…';
    let global = 'Récord global: sin conexión.';
    if (window.CLOUD && CLOUD.getKillRecord) {
      try {
        const g = await CLOUD.getKillRecord();
        if (g) global = 'Récord global: <b>' + (g.kills || 0) + '</b> kills · ' + adminEsc(g.name || 'Jugador') + ' · ' + adminEsc(adminTime(g.at));
      } catch (e) { }
    }
    box.innerHTML = local + '\n' + global;
  }

  function bindAdmin() {
    const coinChip = document.getElementById('homeCoinChip');
    if (coinChip) {
      coinChip.addEventListener('click', e => {
        e.preventDefault();
        openAdmin();
      });
    }
    $('adminUnlock').onclick = () => {
      const pin = ($('adminPin').value || '').trim();
      if (pin === ADMIN_PIN) {
        adminUnlocked = true;
        $('adminLock').classList.add('hidden');
        $('adminPerks').classList.remove('hidden');
        SND.sfx.level();
        renderAdminExtras();
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
      adminToast('Todas las herramientas al nivel 8 ⭐');
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

    /* --- v3.5.0: roles, auditoría, tuning, historial, récords, avisos --- */
    $('admRoleSave').onclick = () => {
      const role = $('admRole').value;
      SAVE.setAdminRole(role);
      adminToast('Rol guardado: ' + role + ' 👑');
      renderAdminExtras();
    };
    $('admTuneSave').onclick = () => {
      const t = SAVE.setTuning({
        xpBase: adminNum('admXpBase', 70),
        xpCurve: adminNum('admXpCurve', 1.45),
        xpFlat: adminNum('admXpFlat', 40),
        xpMul: adminNum('admXpMul', 1),
        coinMul: adminNum('admCoinMul', 1),
        rewardMul: adminNum('admRewardMul', 1),
        playBonus: adminNum('admPlayBonus', 1)
      });
      SAVE.adminAudit('tuning', 'XP base ' + t.xpBase + ' · curva ' + t.xpCurve + ' · monedas ×' + t.coinMul);
      adminToast('Ajustes de progresión guardados ⚙️');
      renderAdminExtras();
    };
    $('admTuneReset').onclick = () => {
      SAVE.setTuning({ xpBase: 70, xpCurve: 1.45, xpFlat: 40, xpMul: 1, coinMul: 1, rewardMul: 1, playBonus: 1 });
      SAVE.adminAudit('tuning', 'Ajustes restaurados por defecto');
      adminToast('Ajustes restaurados ↺');
      renderAdminExtras();
    };
    $('admMatchLoad').onclick = () => { loadAdminMatches(); };
    $('admSeasonLoad').onclick = () => { showAdminSeason(); SAVE.adminAudit('temporada', 'Consulta de temporada y pase'); renderAdminLog(); };
    $('admPlayerLoad').onclick = () => { showAdminPlayer(); SAVE.adminAudit('jugador', 'Consulta de estadísticas de ' + (($('admPlayer') && $('admPlayer').selectedOptions[0] || {}).textContent || 'jugador')); renderAdminLog(); };
    $('admRecordLoad').onclick = () => { loadAdminRecord(); };
    $('admEventAdd').onclick = () => {
      const name = ($('admEventName').value || '').trim();
      if (!name) { adminToast('Escribe un nombre de evento', ''); return; }
      SAVE.addEvent({ name: name, desc: ($('admEventDesc').value || '').trim() });
      $('admEventName').value = '';
      $('admEventDesc').value = '';
      adminToast('Evento creado 📅');
      renderAdminExtras();
    };
    $('admSanctionAdd').onclick = () => {
      const name = ($('admSanctionName').value || '').trim();
      if (!name) { adminToast('Escribe el jugador a sancionar', ''); return; }
      SAVE.addSanction({
        name: name,
        type: $('admSanctionType').value,
        reason: ($('admSanctionReason').value || '').trim()
      });
      $('admSanctionName').value = '';
      $('admSanctionReason').value = '';
      adminToast('Sanción registrada 🚨');
      renderAdminExtras();
    };
    $('admNotifCheck').onclick = () => { checkAdminBackend(); };
    $('admNotifSend').onclick = async () => {
      const title = ($('admNotifTitle').value || '').trim();
      const body = ($('admNotifBody').value || '').trim();
      if (!title) { adminToast('Escribe un título para el aviso', ''); return; }
      const typed = ($('admNotifUid').value || '').trim();
      const sess = window.CLOUD && CLOUD.session ? CLOUD.session() : {};
      const target = typed || sess.uid;
      if (!target) { adminToast('Sin UID destino ni sesión activa', ''); return; }
      if (!window.CLOUD) { adminToast('Firebase no está disponible', ''); return; }

      const payload = { type: 'admin', title: title, body: body || 'Aviso del equipo' };

      // Camino real: Cloud Function autenticada + Admin SDK. Puede escribir
      // en el buzón de cualquier cuenta y comprueba los permisos del operador.
      if (typeof CLOUD.sendAdminNotification === 'function') {
        const res = await CLOUD.sendAdminNotification(target, payload);
        if (res && res.ok) {
          SAVE.adminAudit('notificacion', 'Aviso a ' + target + ': ' + title);
          adminToast(typed ? 'Notificación enviada 🔔' : 'Aviso enviado a tu cuenta 🔔');
          renderAdminExtras();
          return;
        }
        const reason = String((res && res.reason) || 'error');
        // Si el backend aún no está desplegado, el buzón propio sigue
        // funcionando con la escritura directa que permiten las reglas.
        if (target === sess.uid && (reason === 'not-found' || reason === 'unimplemented') &&
          typeof CLOUD.sendNotification === 'function') {
          const okLocal = await CLOUD.sendNotification(target, payload);
          if (okLocal) {
            SAVE.adminAudit('notificacion', 'Aviso a tu cuenta: ' + title);
            adminToast('Aviso enviado a tu cuenta 🔔');
            renderAdminExtras();
            return;
          }
        }
        adminToast(adminNotifError(reason), '');
        return;
      }

      // Cliente antiguo sin soporte de Functions: solo puede escribir en el
      // propio buzón. Nunca simulamos un envío a otra cuenta.
      if (target !== sess.uid) {
        adminToast('Este cliente no incluye el backend de avisos', '');
        return;
      }
      const okSend = await CLOUD.sendNotification(target, payload);
      if (okSend) {
        SAVE.adminAudit('notificacion', 'Aviso a tu cuenta: ' + title);
        adminToast('Aviso enviado a tu cuenta 🔔');
        renderAdminExtras();
      } else {
        adminToast('No se pudo enviar el aviso', '');
      }
    };
  }

  /* --- Aviso de registro en el primer vuelo --- */
  let pendingFirstRun = null;

  // Solo para usuarios nuevos de verdad: sin cuenta, sin vuelos y sin haber
  // visto ya el aviso. No exige que la sesión de invitado esté lista todavía,
  // para que el aviso no se pierda si el jugador pulsa Jugar muy rápido.
  function firstRunNeedsAccount() {
    if (!window.CLOUD || typeof CLOUD.session !== 'function') return false;
    if (typeof CLOUD.configured === 'function' && !CLOUD.configured()) return false;
    const sess = CLOUD.session();
    if (sess.account) return false;
    const s = SAVE.get();
    if (s.registrationPrompted === true) return false;
    return (s.stats.flights || 0) === 0;
  }

  // Si es su primer vuelo, muestra el aviso y guarda la acción pendiente.
  function guardFirstRun(next) {
    if (!firstRunNeedsAccount()) { next(); return false; }
    pendingFirstRun = next;
    $('registerPrompt').classList.remove('hidden');
    SND.sfx.click();
    return true;
  }

  function closeRegisterPrompt() {
    $('registerPrompt').classList.add('hidden');
  }

  function bindRegistrationPrompt() {
    const goAccount = () => {
      SND.sfx.click();
      SAVE.markRegistrationPrompted();
      pendingFirstRun = null;
      closeRegisterPrompt();
      UI.openGeneric('profile');
    };
    $('regPromptCreate').onclick = goAccount;
    $('regPromptLogin').onclick = goAccount;
    $('regPromptGuest').onclick = () => {
      SND.sfx.click();
      SAVE.markRegistrationPrompted();
      closeRegisterPrompt();
      const next = pendingFirstRun;
      pendingFirstRun = null;
      if (typeof next === 'function') next();
      else UI.showModePick();
    };
  }

  function bindButtons() {
    const startMode = m => {
      SND.sfx.click();
      G.setMode(m);
      G.startPlay();
    };
    $('btnPlay').onclick = () => { SND.sfx.click(); guardFirstRun(() => UI.showModePick()); };
    $('mpFree').onclick = () => startMode('free');
    $('mpGoal').onclick = () => {
      SND.sfx.click();
      guardFirstRun(() => UI.openGoalMode());
    };
    const recBtn = document.getElementById('mpRecord');
    if (recBtn) recBtn.onclick = () => startMode('record');
    $('mpDuel').onclick = () => startMode('duel');
    $('mpPvp').onclick = () => {
      SND.sfx.click();
      guardFirstRun(() => UI.openMultiplayer());
    };
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
    const btnContinue = document.getElementById('btnContinue');
    if (btnContinue) btnContinue.onclick = () => {
      SND.sfx.click();
      const m = SAVE.get().set.mode || 'free';
      const safeMode = ['free', 'goal', 'duel', 'challenge', 'zen', 'boss', 'wind'].indexOf(m) !== -1 ? m : 'free';
      if (safeMode === 'challenge' && SAVE.challengePlayedToday()) {
        UI.toast('Ya jugaste el desafío de hoy 🌙 Elige otro modo', 'info');
        UI.showModePick();
        return;
      }
      guardFirstRun(() => {
        G.setMode(safeMode);
        G.startPlay();
      });
    };
    const tutGuide = document.getElementById('btnTutorialGuide');
    if (tutGuide) tutGuide.onclick = () => { SND.sfx.click(); UI.openGeneric('help'); };
    const tutDone = document.getElementById('btnTutorialDone');
    if (tutDone) tutDone.onclick = () => {
      SND.sfx.click();
      SAVE.finishTutorial();
      UI.refreshHome();
      UI.toast('¡Listo! Pulsa JUGAR para empezar 🐤', 'good');
    };
    $('btnNextLevel').onclick = () => {
      SND.sfx.click();
      if (G.getMode() === 'pvp') { G.goMenu(); UI.openMultiplayer(); return; }
      G.startPlay();
    };
    $('btnClearHome').onclick = () => { SND.sfx.click(); G.goMenu(); };
    $('btnPause').onclick = () => { SND.sfx.click(); G.togglePause(); };
    $('btnResume').onclick = () => { SND.sfx.click(); G.togglePause(); };
    $('btnRestart').onclick = () => {
      G.setPaused(false);
      SND.sfx.click();
      if (G.getMode() === 'pvp') { G.goMenu(); UI.openMultiplayer(); return; }
      G.startPlay();
    };
    $('btnExit').onclick = () => { G.setPaused(false); SND.sfx.click(); G.goMenu(); };
    $('btnRetry').onclick = () => {
      SND.sfx.click();
      if (G.getMode() === 'pvp') { G.goMenu(); UI.openMultiplayer(); return; }
      G.startPlay();
    };
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
      guardFirstRun(() => G.startPlay('challenge'));
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
    if (!$('registerPrompt').classList.contains('hidden')) { closeRegisterPrompt(); return 'handled'; }
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
    bindRegistrationPrompt();
    bindInput();
    if (window.RADAR && RADAR.init) RADAR.init();
    // La portada también puede iniciar el desafío diario desde un aviso.
    window.__pioFirstRunGuard = guardFirstRun;
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