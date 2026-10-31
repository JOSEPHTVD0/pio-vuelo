/* Interfaz: pantallas, tienda, mapas, progreso, ajustes, modales, toasts */
window.UI = (function () {
  'use strict';

  const $ = id => document.getElementById(id);

  let currentGeneric = null;

  function hideAllScreens() {
    ['screen-loading', 'screen-home', 'screen-pause', 'screen-over', 'screen-cleared', 'screen-generic', 'screen-modepick'].forEach(id => {
      $(id).classList.add('hidden');
    });
  }

  // Animación del ave + nido en la pantalla de inicio
  let homeRaF = null;
  function startHomeAnim() {
    const cv = document.getElementById('homeBird');
    if (!cv || homeRaF) return;
    const c = cv.getContext('2d');
    const frame = ms => {
      const home = document.getElementById('screen-home');
      if (!home || home.classList.contains('hidden') || !document.getElementById('homeBird')) { homeRaF = null; return; }
      drawNestScene(c, cv.width, cv.height, ms);
      homeRaF = requestAnimationFrame(frame);
    };
    homeRaF = requestAnimationFrame(frame);
  }

  // Escena del hogar: fondo decorado, póster, suelo, alfombra, nido en crecimiento,
  // huevos incubando y el ave posada. Nido y huevos usan tiempo real (Date.now).
  let nestStatic = null; // capa estática (decoración + nido) pre-renderizada cada frame
  function roundRectP(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function renderStaticLayer(w, h, bg, fl, po, rg, ni) {
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const c = off.getContext('2d');
    // fondo (decoración)
    const bgG = c.createLinearGradient(0, 0, 0, h);
    bgG.addColorStop(0, bg.bg1); bgG.addColorStop(1, bg.bg2);
    c.fillStyle = bgG;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.28;
    c.font = '26px sans-serif';
    c.textAlign = 'center';
    c.fillText(bg.art, w * 0.87, 28);
    c.globalAlpha = 1;
    // póster enmarcado
    if (po.art) {
      c.fillStyle = 'rgba(255,255,255,.16)';
      roundRectP(c, 13, 13, 48, 42, 9); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.4)';
      c.lineWidth = 2;
      roundRectP(c, 13, 13, 48, 42, 9); c.stroke();
      c.font = '24px sans-serif';
      c.fillText(po.art, 37, 44);
    }
    // suelo (decoración)
    const fy = h - 48;
    const fG = c.createLinearGradient(0, fy, 0, h);
    fG.addColorStop(0, fl.bg1); fG.addColorStop(1, fl.bg2);
    c.fillStyle = fG;
    c.fillRect(0, fy, w, h - fy);
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.fillRect(0, fy, w, 2.5);
    // alfombra (decoración)
    if (rg.art) {
      c.save();
      c.translate(w / 2, h - 14);
      c.fillStyle = rg.bg1;
      c.beginPath(); c.ellipse(0, 0, 64, 13, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)';
      c.beginPath(); c.ellipse(0, -2, 54, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = rg.bg2;
      c.beginPath(); c.ellipse(0, -4, 42, 7, 0, 0, Math.PI * 2); c.fill();
      c.font = '13px sans-serif';
      c.textAlign = 'center';
      c.fillText(rg.art, -32, 4);
      c.fillText(rg.art, 32, 4);
      c.restore();
    }
    // nido en crecimiento (la base crece con el nivel + va ganando objetos decorativos)
    const nx = w / 2;
    const ny = fy - 30;
    c.save();
    c.translate(nx, ny);
    const base = 20 + Math.min(9, ni.level) * 4;
    const ry = base * 0.42;
    // sombra
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.beginPath(); c.ellipse(0, 8, base + 6, 7, 0, 0, Math.PI * 2); c.fill();
    // ramas exteriores
    c.strokeStyle = '#7a4a22';
    c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, base, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.strokeStyle = '#8d5a2a';
    c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, base - 2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    // interior
    c.fillStyle = '#a06a30';
    c.beginPath(); c.ellipse(0, 0, base - 4, ry, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b57939';
    c.beginPath(); c.ellipse(0, 0, base - 7, ry - 2, 0, 0, Math.PI * 2); c.fill();
    // objetos decorativos: 1 por moneda ganada en vuelo (máx. NEST_MAX_OBJ)
    c.font = '11px sans-serif';
    c.textAlign = 'center';
    const OBJ_ART = ['🌼', '🪨', '🪶', '🍒', '⭐', '🌿', '🫐', '🍀'];
    for (let i = 0; i < ni.objCount; i++) {
      const p2 = DAT.nestObjPos(i);
      c.globalAlpha = 0.95;
      c.fillText(OBJ_ART[p2.t], p2.x + (i % 3) * 3, p2.y + 4);
    }
    c.globalAlpha = 1;
    c.restore();
    return off;
  }

  function drawNestScene(c, w, h, ms) {
    const s = SAVE.get();
    const bg = DAT.getDecor(s.nest.decor.bg);
    const fl = DAT.getDecor(s.nest.decor.floor);
    const po = DAT.getDecor(s.nest.decor.poster);
    const rg = DAT.getDecor(s.nest.decor.rug);
    const ni = DAT.nestInfo(s.stats.coinsGot || 0);
    // solo se re-pinta la capa estática cuando cambia decoración/nivel/objetos
    const k = bg.id + '|' + fl.id + '|' + po.id + '|' + rg.id + '|' + ni.level + '|' + ni.objCount + '|' + w + 'x' + h;
    if (!nestStatic || nestStatic.k !== k) {
      nestStatic = { k: k, off: renderStaticLayer(w, h, bg, fl, po, rg, ni) };
    }
    c.clearRect(0, 0, w, h);
    c.drawImage(nestStatic.off, 0, 0);
    const nx = w / 2;
    const ny = h - 48 - 30;
    const base = 20 + Math.min(9, ni.level) * 4;

    // huevos incubando junto al nido (tiempo real)
    c.save();
    c.translate(nx, ny);
    SAVE.eggIncubating().forEach((e, i) => {
      const ex = -base - 2 - i * 16;
      const busy = Math.sin(ms / 300 + i) * 2;
      c.font = '13px sans-serif';
      c.textAlign = 'center';
      c.fillText(e.done ? '🐣' : '🥚', ex, -6 - i * 4 + busy);
      c.globalAlpha = e.done ? 1 : 0.55;
      c.fillStyle = '#cdefff';
      c.fillRect(ex - 7, 6 - i * 4 + busy, 14, 3);
      c.fillStyle = '#ffd54f';
      c.fillRect(ex - 7, 6 - i * 4 + busy, 14 * (e.pct / 100), 3);
      c.globalAlpha = 1;
    });
    c.restore();

    // estela del ave equipada (FX) detrás del ave
    const skin = DAT.getSkin(s.skin);
    const hat = s.hat ? DAT.getHat(s.hat) : null;
    const fx = DAT.getFx(s.fx);
    const bob = Math.sin(ms / 240) * 4;
    if (fx && fx.color) {
      c.globalAlpha = 0.2;
      for (let i = 1; i <= 5; i++) {
        c.fillStyle = fx.color;
        c.beginPath();
        c.arc(nx - 8 - i * 10, ny + bob * 0.4 + (i % 2 ? -4 : 5), 11 - i * 1.7, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    const flap = 0.62 + 0.38 * Math.sin(ms / 95);
    ENTS.drawBird(c, nx, ny - 6 + bob, {
      skin: skin, hat: hat, t: ms / 600,
      wingPhase: flap, squash: 1, rot: Math.sin(ms / 420) * 0.05, r: 20,
      stage: SAVE.skinStage(s.skin),
      golden: !!skin.golden, ghost: false
    });
  }

  function showLoading() {
    hideAllScreens();
    $('screen-loading').classList.remove('hidden');
  }

  function showHome() {
    hideAllScreens();
    $('screen-home').classList.remove('hidden');
    refreshHome();
    startHomeAnim();
    $('screen-generic').classList.add('hidden');
  }

  function refreshHome() {
    const s = SAVE.get();
    $('homeCoins').textContent = s.coins;
    $('homeBest').textContent = s.stats.best;
    $('homeLevel').textContent = 'Nv. ' + s.level;
    const cur = SAVE.xpFor(s.level);
    $('homeXp').style.width = Math.min(100, Math.round(s.xp / cur * 100)) + '%';
    const partsEl = document.getElementById('homeParts');
    if (partsEl) partsEl.textContent = SAVE.partsCount();
    const nmEl = document.getElementById('homeName');
    if (nmEl) nmEl.textContent = SAVE.getProfile().name || 'Jugador';
    const shEl = document.getElementById('homeShields');
    if (shEl) {
      const stock = SAVE.shieldCount();
      shEl.textContent = '🛡️ ' + stock;
      shEl.title = 'Escudos guardados: ' + stock +
        '. Se acumulan entre compras, pero cada partida solo puede gastar 1 al bloquear un choque. Los 🛡️ que recoges en vuelo son aparte y solo duran esa partida.';
    }
    const stop = document.getElementById('homeSoundIco');
    stop.textContent = s.set.sfx ? '🔊' : '🔇';
    const btnReplay = document.getElementById('btnReplay');
    if (btnReplay) {
      const rp = s.replay;
      if (rp) {
        btnReplay.classList.remove('hidden');
        btnReplay.textContent = '🎬 Replay · ' + rp.score + ' pts';
      } else {
        btnReplay.classList.add('hidden');
      }
    }
    // Continuar: retoma el último modo guardado (el progreso meta ya está a salvo)
    const cont = document.getElementById('btnContinue');
    if (cont) {
      const label = { free: 'Vuelo libre', zen: 'Zen', boss: 'Jefe', wind: 'Viento' }[s.set.mode] || 'Vuelo libre';
      cont.querySelector('.bc-title').textContent = 'Continuar · ' + label;
      cont.querySelector('.bc-sub').textContent = s.stats.flights ? 'Récord ' + s.stats.best + ' pts · Nv. ' + s.level : 'Tu primer vuelo te espera';
    }
    // Avisos importantes (recompensas, misiones, herramientas rotas)
    const notice = document.getElementById('homeNotice');
    if (notice) {
      const alerts = homeAlerts(s);
      if (alerts.length) {
        notice.classList.remove('hidden');
        notice.innerHTML = alerts.slice(0, 2).map(a => '<button class="home-alert ' + a.kind + '" data-alert="' + a.action + '"><span>' + a.icon + '</span><b>' + a.text + '</b></button>').join('');
        notice.querySelectorAll('[data-alert]').forEach(b => {
          b.onclick = () => { SND.sfx.click(); handleAlert(b.getAttribute('data-alert')); };
        });
      } else {
        notice.classList.add('hidden');
        notice.innerHTML = '';
      }
    }
    // Tutorial de bienvenida (solo hasta que el jugador lo cierra)
    const tut = document.getElementById('homeTutorial');
    if (tut) tut.classList.toggle('hidden', s.tutorialDone === true);
    updateHomeBadges(s);
    drawDaily();
    drawDailyRun();
    drawHomeTools();
    drawNestStatus();
    startEggTick();
  }

  // Avisos de la portada, ordenados por importancia.
  function homeAlerts(s) {
    const out = [];
    const daily = SAVE.dailyInfo();
    if (daily.ready) out.push({ icon: '🎁', text: 'Recompensa diaria disponible', kind: 'good', action: 'daily' });
    const claim = DAT.MISSIONS.filter(m => SAVE.missionProgress(m) >= m.target && !SAVE.missionDoneToday(m)).length;
    if (claim) out.push({ icon: '📋', text: claim + ' misión' + (claim === 1 ? '' : 'es') + ' por reclamar', kind: 'info', action: 'missions' });
    const broken = DAT.TOOLS.filter(t => SAVE.itemCount(t.key) > 0 && !SAVE.toolUsable(t.key));
    if (broken.length) out.push({ icon: '🔧', text: broken.length + ' herramienta' + (broken.length === 1 ? '' : 's') + ' sin durabilidad', kind: 'warn', action: 'tools' });
    if (!SAVE.challengePlayedToday()) out.push({ icon: '🌱', text: 'Desafío diario sin jugar · hasta 150 🪙', kind: 'info', action: 'dailyrun' });
    return out;
  }

  function handleAlert(action) {
    if (action === 'daily') {
      const r = SAVE.claimDaily();
      if (r) { SND.sfx.achieve(); FX.confetti(400, 150); toast('🎁 +' + r.reward + ' 🪙 · racha ' + r.streak + ' 🔥', 'good'); }
      refreshHome();
    } else if (action === 'missions') openGeneric('missions');
    else if (action === 'tools') openGeneric('shop', 'tools');
    else if (action === 'dailyrun') {
      if (SAVE.challengePlayedToday()) { toast('Ya jugaste el desafío de hoy 🌙', 'info'); return; }
      G.setMode('challenge');
      G.startPlay();
    }
    else if (action === 'inventory') openGeneric('inventory');
  }

  // Pequeños contadores de novedad en los accesos rápidos.
  function updateHomeBadges(s) {
    const set = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.toggle('hidden', !n);
    };
    const claim = DAT.MISSIONS.filter(m => SAVE.missionProgress(m) >= m.target && !SAVE.missionDoneToday(m)).length;
    set('badgeMissions', claim);
    let passN = (SAVE.passReached ? SAVE.passReached() - SAVE.passClaimedCount() : 0) || 0;
    if (SAVE.passPremiumActive && SAVE.passPremiumActive()) {
      passN += Math.max(0, SAVE.passPremiumReached() - SAVE.passPremiumClaimedCount());
    }
    set('badgePass', Math.max(0, passN));
    const readyEggs = SAVE.eggIncubating().filter(e => e.done).length;
    set('badgeHome', readyEggs);
    const lowTools = DAT.TOOLS.filter(t => SAVE.itemCount(t.key) > 0 && SAVE.toolDurInfo(t.key).pct <= 25).length;
    set('badgeTools', lowTools);
  }

  // Resumen del nido + incubadora con tiempo real en la pantalla de inicio
  let eggTick = null;
  function startEggTick() {
    if (eggTick) return;
    eggTick = setInterval(() => {
      if (!$('screen-home') || !$('homeNest')) return;
      if ($('screen-home').classList.contains('hidden')) return;
      const eggs = SAVE.eggIncubating();
      const el = $('homeNest');
      if (!el) return;
      el.querySelectorAll('.eggpill').forEach((pill, i) => {
        const e = eggs[i];
        if (!e) return;
        const bar = pill.querySelector('.eggbar.sm i');
        if (bar) bar.style.width = e.pct + '%';
        const time = pill.querySelector('.eggpill-time');
        if (time) time.textContent = fmtLeft(e.leftMs);
        if (e.done && !pill.classList.contains('ready')) {
          pill.classList.add('ready');
          const ico = pill.querySelector('.eggpill-ico');
          if (ico) ico.textContent = '🐣';
          if (time) {
            time.remove();
            const btn = document.createElement('button');
            btn.className = 'eggpill-btn';
            btn.setAttribute('data-hatch', String(i));
            btn.textContent = 'Eclosionar';
            btn.onclick = () => { SND.sfx.click(); hatchEggAction(i); };
            pill.appendChild(btn);
          }
        }
      });
    }, 1000);
  }
  function drawNestStatus() {
    const el = $('homeNest');
    if (!el) return;
    const s = SAVE.get();
    const ni = DAT.nestInfo(s.stats.coinsGot || 0);
    const html = [];
    html.push('<div class="nest-line"><span class="nest-ico">🪺</span><span class="nest-lvl">' + ni.name + '</span><span class="nest-pct">' + ni.objCount + ' objetos</span></div>');
    html.push('<div class="eggbar"><i style="width:' + ni.pct + '%"></i></div>');
    if (ni.next) html.push('<div class="nest-sub">Nivel ' + (ni.level + 2) + ': ' + ni.next.name + ' con ' + ni.next.coins + ' monedas en vuelo</div>');
    else html.push('<div class="nest-sub">¡Nido legendario! 🎉</div>');
    const eggs = SAVE.eggIncubating();
    if (eggs.length) {
      eggs.forEach((e, i) => {
        const d = DAT.getEgg(e.id);
        html.push('<div class="eggpill' + (e.done ? ' ready' : '') + '">' +
          '<span class="eggpill-ico">' + (e.done ? '🐣' : '🥚') + '</span>' +
          '<span class="eggpill-name">' + (d ? d.name : 'Huevo') + '</span>' +
          '<span class="eggbar sm"><i style="width:' + e.pct + '%"></i></span>' +
          (e.done
            ? '<button class="eggpill-btn" data-hatch="' + i + '">Eclosionar</button>'
            : '<span class="eggpill-time">' + fmtLeft(e.leftMs) + '</span>') +
          '</div>');
      });
    } else {
      const slots = SAVE.eggSlotsFree();
      html.push('<div class="nest-sub">Sin huevos incubando · ' + slots + ' hueco' + (slots === 1 ? '' : 's') + ' libre' + (slots === 1 ? '' : 's') + ' en la incubadora</div>');
    }
    el.innerHTML = html.join('');
    el.querySelectorAll('[data-hatch]').forEach(b => {
      b.onclick = () => {
        SND.sfx.click();
        hatchEggAction(parseInt(b.getAttribute('data-hatch'), 10));
      };
    });
  }

  function fmtLeft(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return '≤ 1 min';
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' h ' + (m % 60) + ' min';
    return Math.floor(h / 24) + ' d ' + (h % 24) + ' h';
  }

  // Eclosiona el huevo ya listo: da un ave o una estela
  function hatchEggAction(idx) {
    const r = SAVE.hatchEgg(idx);
    if (!r) return;
    if (r.kind === 'coins') {
      toast('Eclosionó en monedas (+' + r.amount + ' 🪙) — ¡ya lo tienes todo!', 'good');
    } else if (r.kind === 'skin') {
      toast('🐣 ¡Eclosionó ' + r.item.name + '! Pío la usa', 'good');
    } else {
      toast('🐣 ¡Eclosionó ' + r.item.name + '! Estela equipada', 'good');
    }
    SND.sfx.achieve();
    refreshHome();
    SAVE.checkAch().forEach(a => popAch(a));
  }

  /* Popup de elección de modo: JUGAR en la pantalla principal */
  let modePickOpen = false;
  function showModePick() {
    modePickOpen = true;
    refreshModePick();
    hideAllScreens();
    $('screen-modepick').classList.remove('hidden');
  }
  function closeModePick() {
    modePickOpen = false;
    $('screen-modepick').classList.add('hidden');
    showHome();
  }
  function isModePickOpen() { return modePickOpen; }
  function refreshModePick() {
    const setTag = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    const s = SAVE.get();
    setTag('mpFreeSub', s.stats.best ? '· Récord ' + s.stats.best + ' pts' : '');
    setTag('mpDuelSub', (s.stats.duelWins || 0) ? '· 🏆 ' + s.stats.duelWins : '');
    setTag('mpDailySub', SAVE.challengePlayedToday() ? '🌙 Ya jugaste hoy' : '');
    setTag('mpZenSub', (s.stats.zenBest || 0) ? '· Mejor ' + s.stats.zenBest + ' m' : '');
    setTag('mpBossSub', (s.stats.bossDefeated || 0) ? '· 👹 ' + s.stats.bossDefeated + ' derrotados' : '');
    setTag('mpWindSub', (s.stats.windZones || 0) ? '· 💨 ' + s.stats.windZones + ' tramos' : '');
    const m = G.getMode();
    [['mpFree', 'free'], ['mpDuel', 'duel'], ['mpDaily', 'challenge'], ['mpZen', 'zen'], ['mpBoss', 'boss'], ['mpWind', 'wind']].forEach(pair => {
      const el = document.getElementById(pair[0]);
      if (el) el.classList.toggle('active', m === pair[1]);
    });
  }

  function drawDailyRun() {
    const el = document.getElementById('dailyRunPill');
    if (!el) return;
    if (SAVE.challengePlayedToday()) {
      el.textContent = '🌱 Semilla ' + SAVE.seedToday() + ' · Récord: ' + SAVE.get().dailyC.best + ' pts';
      el.classList.add('done');
    } else {
      el.textContent = '🌱 Semilla del día · +hasta 150 🪙';
      el.classList.remove('done');
    }
  }

  function drawHomeTools() {
    const el = document.getElementById('homeTools');
    if (!el) return;
    const it = SAVE.get().items || {};
    const parts = [];
    let warn = 0;
    DAT.TOOLS.forEach(t => {
      if ((it[t.key] || 0) > 0) {
        const d = SAVE.toolDurInfo(t.key);
        const icon = d.broken ? '🔧' : t.icon;
        if (!d.broken && d.pct <= 25) warn++;
        parts.push(icon + ' x' + it[t.key] + (d.broken ? '(rota)' : d.pct <= 25 ? '(' + d.pct + '%)' : ''));
      }
    });
    if (parts.length) {
      el.innerHTML = '<span class="ht-label">🎒 Bolsa</span><span class="ht-list">' + parts.join(' · ') + '</span>' +
        (warn ? '<button class="ht-warn" id="htWarn">⚠️ ' + warn + ' al desgaste · revisar</button>' : '');
      el.classList.remove('hidden');
      const w = document.getElementById('htWarn');
      if (w) w.onclick = () => { SND.sfx.click(); openGeneric('inventory'); };
    } else {
      el.innerHTML = '';
      el.classList.add('hidden');
    }
  }

  function drawDaily() {
    const el = $('dailyPill');
    if (!el) return;
    const info = SAVE.dailyInfo();
    if (info.ready) {
      const bonus = info.streak % 7 === 0 ? 50 : 0;
      el.classList.remove('hidden');
      el.textContent = '🎁 Recompensa diaria: +' + (20 + info.streak * 10 + bonus) + ' 🪙' + (bonus ? ' (+' + bonus + ' bono)' : '') + ' · 🔥 ' + info.streak + ' día' + (info.streak === 1 ? '' : 's');
    } else {
      el.classList.add('hidden');
    }
  }

  /* ---------- HUD ---------- */
  function setHudVisible(v) { $('hud').classList.toggle('hidden', !v); }
  function showStartHint(v) { $('start-hint').classList.toggle('hidden', !v); }

  /* Barra de herramientas manuales en vuelo (un botón por herramienta armada).
   Solo se reconstruye cuando cambia la lista o su cantidad (no en cada frame). */
  function refreshHudTools() {
    const bar = document.getElementById('hudTools');
    if (!bar) return;
    const list = G && G.manualToolList ? G.manualToolList() : [];
    if (G && G.isPlay() && list.length) {
      const sig = list.map(t => {
        const d = SAVE.toolDurInfo(t.key);
        return t.key + ':' + SAVE.itemCount(t.key) + ':' + d.pct + ':' + (d.broken ? 1 : 0);
      }).join('|');
      bar.classList.remove('hidden');
      if (bar._sig === sig) return;
      bar._sig = sig;
      bar.innerHTML = '';
      list.forEach(t => {
        const d = SAVE.toolDurInfo(t.key);
        const b = document.createElement('button');
        b.className = 'hud-btn hud-tb' + (d.broken ? ' broken' : '') + (d.pct <= 25 && !d.broken ? ' low' : '');
        b.setAttribute('aria-label', t.name + ' · durabilidad ' + d.pct + '%');
        b.innerHTML = t.icon + '<span class="t-cnt">' + SAVE.itemCount(t.key) + '</span>' +
          '<span class="t-dur"><i style="width:' + d.pct + '%"></i></span>';
        b.onclick = () => {
          SND.sfx.click();
          G.useBagTool(t.key);
        };
        bar.appendChild(b);
      });
    } else {
      bar._sig = '';
      bar.classList.add('hidden');
    }
  }

  /* Cronómetros de habilidades: una ficha por efecto activo, sin duplicados.
   Solo se reconstruye el DOM cuando cambia la lista; el texto/anchura solo
   cuando cambia el valor mostrado (una décima de segundo). */
  let effSig = '';
  function updateEffectTimers(timers) {
    const bar = document.getElementById('hudEffects');
    if (!bar) return;
    const list = Array.isArray(timers) ? timers : [];
    if (!list.length) {
      if (effSig !== '') { bar.innerHTML = ''; bar.classList.add('hidden'); effSig = ''; }
      return;
    }
    bar.classList.remove('hidden');
    // Se coloca justo debajo de la fila superior real (pausa, puntos, monedas,
    // escudos y racha). Así nunca se solapa aunque aparezcan más datos o cambie
    // el tamaño de pantalla, en lugar de depender de una altura fija.
    const topRow = document.querySelector('#hud .hud-top');
    if (topRow) {
      const r = topRow.getBoundingClientRect();
      if (r.height > 0) {
        const top = Math.round(r.bottom + 6);
        if (bar._top !== top) { bar.style.top = top + 'px'; bar._top = top; }
      }
    }
    const sig = list.map(e => e.key).join('|');
    if (sig !== effSig) {
      bar.innerHTML = '';
      list.forEach(e => {
        const chip = document.createElement('div');
        chip.className = 'eff-chip';
        chip.dataset.key = e.key;
        chip.innerHTML = '<span class="eff-ico">' + e.icon + '</span>' +
          '<span class="eff-lbl">' + e.label + '</span>' +
          '<span class="eff-time">0.0s</span>' +
          '<span class="eff-bar"><i></i></span>';
        bar.appendChild(chip);
      });
      effSig = sig;
    }
    const chips = bar.children;
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      const e = list[i];
      if (!e) continue;
      const left = Math.max(0, e.left);
      const shown = left >= 10 ? Math.ceil(left) + 's' : left.toFixed(1) + 's';
      if (chip._shown !== shown) {
        const tm = chip.querySelector('.eff-time');
        if (tm) tm.textContent = shown;
        chip._shown = shown;
      }
      const pct = Math.round(Math.max(0, Math.min(1, e.pct)) * 100);
      if (chip._pct !== pct) {
        const fill = chip.querySelector('.eff-bar i');
        if (fill) fill.style.width = pct + '%';
        chip._pct = pct;
      }
      const state = left <= 2 ? 'expiring' : 'active';
      if (chip._state !== state) {
        chip.classList.toggle('expiring', state === 'expiring');
        chip.classList.toggle('active', state === 'active');
        chip._state = state;
      }
    }
  }

  /* ---------- Cuenta atrás al reanudar ---------- */
  function setResumeCountdown(n) {
    const el = document.getElementById('resumeCountdown');
    if (!el) return;
    const num = Math.max(0, Math.floor(n) || 0);
    if (num <= 0) {
      if (el._n !== 0) { el.classList.add('hidden'); el._n = 0; }
      return;
    }
    if (el._n === num && !el.classList.contains('hidden')) return;
    el.classList.remove('hidden');
    const span = document.getElementById('resumeCountNum');
    if (span) span.textContent = num;
    el._n = num;
    // Reinicia la animación solo cuando cambia el número (3 → 2 → 1).
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /* ---------- Pausa ---------- */
  function setPaused(p) {
    $('screen-pause').classList.toggle('hidden', !p);
    showStartHint(p ? false : !!(G.waitingFly && G.waitingFly()));
    if (p) {
      const ps = $('pauseStats');
      if (ps) ps.textContent = '🪙 ' + G.getScore() + ' pts · ' + G.getDist() + ' m';
    }
  }

  /* ---------- Game over ---------- */
  function showGameOver(score, best, coinsGot, pipesPassed, dist, isRecord, ach, levelUps) {
    $('overScore').textContent = score;
    $('overBest').textContent = best;
    $('overCoins').textContent = coinsGot;
    $('overDist').textContent = dist + ' m';
    const msgEl = document.getElementById('overMsg');
    const titleEl = $('screen-over').querySelector('h2');
    titleEl.textContent = 'GAME OVER';
    if (score >= 50) msgEl.textContent = '¡Leyenda del cielo! 🌟';
    else if (score >= 30) msgEl.textContent = '¡Vuelo dominado! 🏆';
    else if (score >= 15) msgEl.textContent = '¡Buen vuelo! 👏';
    else if (score >= 5) msgEl.textContent = '¡Buen comienzo! 🌱';
    else msgEl.textContent = '¡Sigue practicando! 💪';
    const medal = document.getElementById('overMedal');
    if (isRecord) { medal.textContent = '👑'; SND.sfx.medal(); }
    else if (score >= 50) medal.textContent = '🥇';
    else if (score >= 30) medal.textContent = '🥈';
    else if (score >= 15) medal.textContent = '🥉';
    else medal.textContent = '';
    const lu = document.getElementById('overLevelup');
    lu.classList.toggle('hidden', !(levelUps > 0));
    $('screen-over').classList.remove('hidden');
    ach.forEach(a => popAch(a));
  }

  /* Pantalla de victoria genérica (Duelo) */
  function showModeClear(o) { buildClear(o); }

  function buildClear(o) {
    $('clearTitle').textContent = o.title;
    $('clearStars').textContent = o.stars;
    const lvL = document.getElementById('clearLbl');
    const tgL = document.getElementById('clearTgtLbl');
    if (lvL) lvL.textContent = o.lvLbl;
    if (tgL) tgL.textContent = o.tgtLbl;
    $('clearLevel').textContent = o.lv;
    $('clearTarget').textContent = o.tgt;
    $('clearReward').textContent = '+' + o.reward + ' 🪙';
    $('clearXp').textContent = '+' + o.xp + ' XP';
    const lu = document.getElementById('clearLevelup');
    lu.classList.toggle('hidden', !(o.lvUps > 0));
    const next = $('btnNextLevel');
    next.textContent = o.btn || '🔄 VOLVER A VOLAR';
    SND.sfx.achieve();
    hideAllScreens();
    $('screen-cleared').classList.remove('hidden');
    (o.ach || []).forEach(a => popAch(a));
  }

  /* ---------- Popup de logros: encima de todo, uno a uno ---------- */
  const achQueue = [];
  let achBusy = false;

  function popAch(ach) {
    achQueue.push(ach);
    if (!achBusy) nextAch();
  }

  function nextAch() {
    if (!achQueue.length) { achBusy = false; return; }
    achBusy = true;
    const a = achQueue.shift();
    const el = $('achPopup');
    const nm = el.querySelector('.ach-name');
    const sb = el.querySelector('.ach-sub');
    if (nm) nm.textContent = a.name;
    if (sb) sb.textContent = (a.desc ? a.desc + ' · ' : '') + '+' + a.reward + ' 🪙';
    SND.sfx.achieve();
    el.classList.remove('hidden');
    el.classList.remove('pop-in');
    void el.offsetWidth;
    el.classList.add('pop-in');
    setTimeout(() => {
      el.classList.add('hidden');
      setTimeout(nextAch, 300);
    }, 2800);
  }

  /* ---------- Toast ---------- */
  const MAX_TOASTS = 3; // máx. visibles para no llenar la pantalla
  function toast(msg, type) {
    // Notificaciones desactivadas: se silencian los avisos informativos,
    // pero nunca los errores/avisos críticos (good/warning/'').
    try {
      if (window.SAVE && SAVE.get && SAVE.get().set.notif === false && (!type || type === 'info')) return;
    } catch (e) { }
    const wrap = $('toastWrap');
    // quitar los más antiguos sobrantes de golpe (sin acumular cosas viejas)
    while (wrap.childElementCount >= MAX_TOASTS) {
      const old = wrap.firstElementChild;
      if (old) old.remove();
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0'; el.style.transform = 'translateY(-14px)';
      setTimeout(() => el.remove(), 400);
    }, 2400);
  }

  /* ---------- Modal ---------- */
  function confirmAction(title, text, cb) {
    confirm(title, text, [
      { label: 'Cancelar', cb: () => { } },
      { label: 'Confirmar', style: 'btn-play', cb: cb }
    ]);
  }
  function confirmIfNeeded(title, text, cb) {
    if (SAVE.get().set.confirmBuy === true) confirmAction(title, text, cb);
    else cb();
  }

  function confirm(title, text, actions) {
    $('modalTitle').textContent = title;
    $('modalText').textContent = text;
    const box = $('modalActions');
    box.innerHTML = '';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.style || '');
      b.textContent = a.label;
      b.onclick = () => { $('modal').classList.add('hidden'); if (a.cb) a.cb(); };
      box.appendChild(b);
    });
    $('modal').classList.remove('hidden');
  }

  /* ---------- Navegación genérica ---------- */
  function openGeneric(kind, tab) {
    if (currentGeneric === 'records') {
      const oldCloud = $('genBody').querySelector('.lb-cloud');
      if (oldCloud && oldCloud.__stopCloud) oldCloud.__stopCloud();
    }
    currentGeneric = kind;
    $('screen-generic').classList.remove('hidden');
    $('genBody').innerHTML = '';
    const titles = { shop: 'TIENDA', maps: 'MAPAS', progress: 'PROGRESO', settings: 'AJUSTES', ach: 'LOGROS', missions: 'MISIONES 📋', pass: 'PASE DE VUELO 🎫', home: 'HOGAR 🏡', records: 'RÉCORDS 🏆', profile: 'PERFIL 🐤', inventory: 'INVENTARIO 📦', stats: 'ESTADÍSTICAS 📊', help: 'AYUDA ❓' };
    $('genTitle').textContent = titles[kind] || '';
    $('genCoins').textContent = SAVE.get().coins;
    switch (kind) {
      case 'shop': renderShop(tab); break;
      case 'maps': renderMaps(); break;
      case 'progress': renderProgress(); break;
      case 'settings': renderSettings(); break;
      case 'missions': renderMissions(); break;
      case 'pass': renderPass(); break;
      case 'home': renderHome(tab); break;
      case 'records': renderRecords(); break;
      case 'profile': renderProfile(); break;
      case 'inventory': renderInventory(tab); break;
      case 'stats': renderStats(); break;
      case 'help': renderHelp(); break;
      default: break;
    }
    $('genBody').scrollTop = 0;
  }

  function closeGeneric() {
    const inGame = G.getState() === 'play';
    if (currentGeneric === 'records') {
      const oldCloud = $('genBody').querySelector('.lb-cloud');
      if (oldCloud && oldCloud.__stopCloud) oldCloud.__stopCloud();
    }
    currentGeneric = null;
    hideAllScreens();
    if (inGame) {
      // Se entró a ajustes desde la pausa: el juego queda donde estaba, sin reiniciarse
      if (G.isPaused()) $('screen-pause').classList.remove('hidden');
    } else {
      showHome();
    }
  }

  /* ---------- TIENDA ---------- */
  function nextWeekPreview() {
    const wk = DAT.curWeek() + 1;
    const acc = [];
    DAT.SKINS.forEach(o => { if (o.week === wk) acc.push({ i: '🐤', n: o.name }); });
    DAT.HATS.forEach(o => { if (o.week === wk) acc.push({ i: '👒', n: o.name }); });
    DAT.EFFECTS.forEach(o => { if (o.week === wk) acc.push({ i: '✨', n: o.name }); });
    DAT.TOOLS.forEach(o => { if (o.week === wk) acc.push({ i: o.icon, n: o.name }); });
    DAT.MAPS.forEach(o => { if (o.week === wk) acc.push({ i: o.icon, n: o.name }); });
    if (!acc.length) return null;
    return '📅 Próxima semana (Semana ' + wk + '): ' + acc.map(x => x.i + ' ' + x.n).join(' · ');
  }

  function renderShop(initialCat) {
    const body = $('genBody');
    const tabs = document.createElement('div');
    tabs.className = 'tabs shop-tabs';
    const cats = [['skins', '🐤', 'Aves'], ['hats', '🎩', 'Sombreros'], ['fx', '💫', 'Estelas'], ['tools', '🎒', 'Herramientas'], ['box', '🥚', 'Cajas']];
    let activeCat = (initialCat && cats.some(c => c[0] === initialCat)) ? initialCat : 'skins';
    const tabEls = [];
    cats.forEach(c => {
      const b = document.createElement('button');
      b.className = 'tab' + (c[0] === activeCat ? ' active' : '');
      const ownedCount = c[0] === 'skins' ? SAVE.get().skinsOwned.length
        : c[0] === 'hats' ? SAVE.get().hatsOwned.length
        : c[0] === 'fx' ? SAVE.get().fxOwned.length
        : c[0] === 'box' ? (SAVE.get().stats.boxesBought || 0)
        : itemTotal();
      b.innerHTML = '<span class="tab-ico">' + c[1] + '</span><span class="tab-t">' + c[2] + '</span><span class="tab-cnt">' + ownedCount + '</span>';
      b.dataset.cat = c[0];
      b.onclick = () => {
        activeCat = c[0];
        tabEls.forEach(x => x.classList.toggle('active', x === b));
        drawShopPrev(activeCat, equippedFor(activeCat));
        drawShopItems(activeCat);
        $('genBody').scrollTop = 0;
        SND.sfx.click();
      };
      tabEls.push(b);
      tabs.appendChild(b);
    });
    body.appendChild(tabs);

    // Mi equipo: acceso rápido a lo equipado (avisar ya / cambiarlo)
    const s = SAVE.get();
    const load = document.createElement('div');
    load.className = 'shop-load';
    const mkChip = (cat, ico, name) => {
      const c = document.createElement('button');
      c.className = 'sl-chip';
      c.innerHTML = '<span class="sl-ico">' + ico + '</span><span class="sl-name"></span>';
      c.dataset.cat = cat;
      c.onclick = () => {
        activeCat = cat;
        tabEls.forEach(x => x.classList.toggle('active', x.dataset.cat === cat));
        drawShopPrev(activeCat, equippedFor(activeCat));
        drawShopItems(activeCat);
        $('genBody').scrollTop = 0;
        SND.sfx.click();
      };
      c.querySelector('.sl-name').textContent = name;
      load.appendChild(c);
      return c;
    };
    mkChip('skins', '🐤', DAT.getSkin(s.skin).name);
    mkChip('hats', '🎩', s.hat ? DAT.getHat(s.hat).name : 'Sin sombrero');
    mkChip('fx', '💫', DAT.getFx(s.fx).name);
    body.appendChild(load);

    const info = document.createElement('div');
    info.className = 'panel-note week-note';
    info.textContent = nextWeekPreview() || '📅 Hoy es la Semana ' + DAT.curWeek() + ' · cada semana se habilitan 2 ítems nuevos.';
    body.appendChild(info);

    const panel = document.createElement('div');
    panel.className = 'shop-prev';
    panel.innerHTML =
      '<canvas id="shopPrevCv" width="150" height="112"></canvas>' +
      '<div class="shop-prev-i"><div id="shopPrevName" class="shop-prev-name"></div>' +
      '<div id="shopPrevSub" class="shop-prev-sub"></div></div>';
    body.appendChild(panel);
    drawShopPrev(activeCat, equippedFor(activeCat));

    const grid = document.createElement('div');
    grid.className = 'items';
    grid.id = 'shopGrid';
    body.appendChild(grid);
    drawShopItems(activeCat);
  }

  // ítem equipado para previsualizar al cambiar de pestaña
  function equippedFor(cat) {
    const s = SAVE.get();
    if (cat === 'skins') return DAT.getSkin(s.skin);
    if (cat === 'hats') return s.hat ? DAT.getHat(s.hat) : null;
    if (cat === 'fx') return DAT.getFx(s.fx);
    return null;
  }

  // actualiza la barra "Mi equipo" tras equipar/comprar
  function updateShopLoad() {
    const s = SAVE.get();
    document.querySelectorAll('.sl-chip').forEach(ch => {
      const c = ch.dataset.cat;
      const nm = c === 'skins' ? DAT.getSkin(s.skin).name
        : c === 'hats' ? (s.hat ? DAT.getHat(s.hat).name : 'Sin sombrero')
        : DAT.getFx(s.fx).name;
      const e = ch.querySelector('.sl-name');
      if (e) e.textContent = nm;
    });
  }

  function drawShopPrev(cat, item) {
    const s = SAVE.get();
    const cv = $('shopPrevCv');
    const c = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    if (cat === 'box') {
      const def = DAT.boxDef();
      ENTS.drawBird(c, w / 2, h / 2 + 2, { skin: DAT.getSkin(s.skin), hat: 'hat-huevo', t: 1.2, wingPhase: 1.1, squash: 1, rot: 0, r: 17 });
      $('shopPrevName').textContent = '🥚 ' + def.name;
      $('shopPrevSub').textContent = def.desc;
      return;
    }
    const skin = cat === 'skins' ? (item || DAT.getSkin(s.skin)) : DAT.getSkin(s.skin);
    const hatId = cat === 'hats' ? (item ? item.id : s.hat) : s.hat;
    const hat = hatId ? DAT.getHat(hatId) : null;
    const fx = cat === 'fx' ? (item || DAT.getFx(s.fx)) : DAT.getFx(s.fx);
    if (fx && fx.color) {
      c.globalAlpha = 0.16;
      c.fillStyle = fx.color;
      for (let i = 1; i <= 5; i++) {
        c.beginPath();
        c.arc(w / 2 - 7 - i * 10, h / 2 + (i % 2 === 0 ? -3 : 5), 15 - i * 2.4, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      if (fx.stars) {
        c.globalAlpha = 0.95;
        c.fillStyle = '#fff';
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.arc(w / 2 - 56 + i * 40, 10 + (i % 2) * 12, 1.7, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
    }
    ENTS.drawBird(c, w / 2, h / 2 + 2, { skin, hat: hatId, t: 1.2, wingPhase: 1.1, squash: 1, rot: 0, r: 17, stage: SAVE.skinStage(skin.id), golden: !!skin.golden });
    const equals = cat === 'skins' ? s.skin : cat === 'hats' ? s.hat : s.fx;
    const isEquipped = item ? equals === item.id : true;
    let name;
    if (cat === 'tools') name = item ? item.name : 'Bolsa de herramientas';
    else if (item) name = item.name;
    else if (cat === 'skins') name = skin.name;
    else if (cat === 'hats') name = hat ? hat.name : 'Sin sombrero';
    else name = fx.name;
    $('shopPrevName').textContent = (item && isEquipped ? '✔ ' : '') + name;
    let sub;
    if (cat === 'tools') {
      sub = item ? item.desc + ' · 🎒 x' + SAVE.itemCount(item.key)
        : DAT.TOOLS.map(tn => tn.icon + ' x' + SAVE.itemCount(tn.key)).join('  ');
    } else if (item) {
      sub = cat === 'skins' ? (item.desc || '') : cat === 'fx' ? (fx.color ? 'Deja un rastro de color al volar.' : 'Vuela sin dejar estela.') : 'El toque perfecto para Pío.';
      if (item.week && !DAT.isUnlocked(item) &&
        !SAVE.owns(cat === 'skins' ? s.skinsOwned : cat === 'hats' ? s.hatsOwned : s.fxOwned, item.id)) {
        sub += ' · 🔒 Se habilita en la ' + DAT.weekLabel(item);
      } else if (!isEquipped) sub += ' · 👆 Toca la figura para probarla gratis';
    } else {
      sub = 'En uso: ' + skin.name + ' · ' + (hat ? hat.name : 'Sin sombrero') + ' · ' + fx.name;
    }
    if (cat === 'skins') {
      const cur = item || skin;
      const badges = statBadges(cur.id);
      if (badges) sub += (sub ? ' · ' : '') + badges;
      if (SAVE.owns(s.skinsOwned, cur.id)) sub += (sub ? ' · ' : '') + '⭐ Etapa ' + SAVE.skinStage(cur.id) + ' (XP ' + SAVE.skinXp(cur.id) + ')';
      if (cur.golden) sub += (sub ? ' · ' : '') + '✨ Dorada';
    }
    $('shopPrevSub').textContent = sub;
  }

  // Insignias de atributos del ave (data.js SKIN_STATS)
  function statBadges(id) {
    const st = DAT.skinStats[id];
    if (!st) return '';
    const MET = { spd: '⚡ Vel', flap: '🪶 Aleteo', grav: '🪂 Caída', gap: '⭕ Huecos' };
    const parts = [];
    Object.keys(st).forEach(k => {
      const v = st[k] || 1;
      if (v !== 1) {
        const pct = Math.round(Math.abs(v - 1) * 100);
        parts.push(MET[k] + ' ' + (v > 1 ? '+' : '-') + pct + '%');
      }
    });
    return parts.join(' · ');
  }

  function drawShopItems(cat) {
    const grid = $('shopGrid');
    grid.innerHTML = '';
    if (cat === 'tools') { drawToolsItems(); return; }
    if (cat === 'box') { drawBoxItems(); return; }
    const s = SAVE.get();
    const fullList = cat === 'skins' ? DAT.SKINS : cat === 'hats' ? DAT.HATS : DAT.EFFECTS;
    const ownedList = cat === 'skins' ? s.skinsOwned : cat === 'hats' ? s.hatsOwned : s.fxOwned;
    // Los exclusivos del Pase Prémium no se venden: solo aparecen si ya se poseen.
    const list = fullList.filter(i => !DAT.isExclusive(i) || SAVE.owns(ownedList, i.id));
    const equals = cat === 'skins' ? s.skin : cat === 'hats' ? s.hat : s.fx;

    // Organización: colección (en uso primero) · disponibles para comprar · bloqueadas por semana
    const owned = [], avail = [], lockedByWeek = {};
    list.forEach(item => {
      if (SAVE.owns(ownedList, item.id)) owned.push(item);
      else if (item.week && !DAT.isUnlocked(item)) (lockedByWeek[item.week] = lockedByWeek[item.week] || []).push(item);
      else avail.push(item);
    });
    owned.sort((a, b) => (a.id === equals ? -1 : b.id === equals ? 1 : 0));
    avail.sort((a, b) => a.price - b.price);
    const weekKeys = Object.keys(lockedByWeek).sort((a, b) => +a - +b);

    function addHeader(text, cls) {
      const h = document.createElement('div');
      h.className = 'shop-sec' + (cls ? ' ' + cls : '');
      h.textContent = text;
      grid.appendChild(h);
    }

    function addItem(item) {
      const isEquipped = equals === item.id;
      const locked = lockedByWeek[item.week];
      const div = document.createElement('div');
      div.className = 'item' + (isEquipped ? ' equipped' : '') + (locked ? ' locked-week' : '') + (DAT.isExclusive(item) ? ' exclusive-item' : '') + ((!SAVE.owns(ownedList, item.id) && s.coins < item.price) ? ' cant-afford' : '');
      const art = document.createElement('div');
      art.className = 'i-art';
      const cv = document.createElement('canvas');
      cv.width = 104; cv.height = 68;
      const c = cv.getContext('2d');
      const skin = cat === 'skins' ? item : DAT.getSkin(s.skin);
      const hat = cat === 'hats' ? item.id : (cat === 'skins' && s.hat ? s.hat : null);
      ENTS.drawBird(c, 52, 40, { skin, hat: hat, t: 1, wingPhase: 0.5, squash: 1, rot: 0, r: 19, stage: cat === 'skins' ? SAVE.skinStage(item.id) : 0, golden: !!skin.golden });
      art.appendChild(cv);
      art.onclick = (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        drawShopPrev(cat, item);
        SND.sfx.click();
      };
      div.appendChild(art);
      const nm = document.createElement('div');
      nm.className = 'i-name'; nm.textContent = item.name + (cat === 'skins' && SAVE.owns(ownedList, item.id) && !item.golden && SAVE.skinStage(item.id) >= 2 ? ' ⭐' + SAVE.skinStage(item.id) : '');
      div.appendChild(nm);
      const rar = document.createElement('div');
      rar.className = 'i-rarity' + (DAT.isExclusive(item) ? ' excl' : '');
      rar.textContent = DAT.rarityOf(item) + (DAT.isExclusive(item) ? ' · 🎫 Prémium' : '');
      div.appendChild(rar);
      const pr = document.createElement('div');
      pr.className = 'i-price';
      if (locked) {
        pr.innerHTML = '🔒 Semana ' + item.week;
        pr.style.color = '#8aa0cc';
        div.appendChild(pr);
        div.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); toast('Se habilitará en la Semana ' + item.week, 'info'); };
      } else if (!SAVE.owns(ownedList, item.id)) {
        pr.innerHTML = '<div class="coin-ico"></div> ' + item.price + ' · Comprar';
        if (s.coins < item.price) pr.style.color = '#ff8a80';
        div.appendChild(pr);
        div.onclick = () => buyItem(cat, item, ownedList);
      } else if (isEquipped) {
        pr.innerHTML = '✔ En uso';
        pr.style.color = '#69f0ae';
        div.appendChild(pr);
      } else {
        pr.innerHTML = '👆 Usar';
        pr.style.color = '#cdefff';
        div.appendChild(pr);
        div.onclick = () => {
          SAVE.equip(cat === 'hats' ? 'hat' : cat === 'fx' ? 'fx' : 'skin', item.id);
          SND.sfx.click();
          drawShopItems(cat);
          drawShopPrev(cat, item);
          updateShopLoad();
          refreshHome();
          toast('✓ ' + item.name + ' equipado', 'good');
        };
      }
      grid.appendChild(div);
    }

    function drawGroup(group, header, cls) {
      if (!group || !group.length) return;
      addHeader((header || '') + ' · ' + group.length, cls);
      group.forEach(addItem);
    }

    if (owned.length) drawGroup(owned, '⭐ Colección', 'shop-sec-own');
    drawGroup(avail, '🛒 Comprar');
    weekKeys.forEach(w => drawGroup(lockedByWeek[w], '🔒 Semana ' + w, 'shop-sec-lock'));

    // Variantes doradas conseguidas (año de oro)
    if (cat === 'skins') {
      const golds = (s.skinsOwned || []).filter(e => /-gold$/.test(e.id));
      if (golds.length) {
        addHeader('✨ Doradas · ' + golds.length, 'shop-sec-gold');
        golds.forEach(e => {
          const g = DAT.getSkin(e.id);
          if (!g) return;
          const isEq = s.skin === g.id;
          const dv = document.createElement('div');
          dv.className = 'item gold-item' + (isEq ? ' equipped' : '');
          const art2 = document.createElement('div');
          art2.className = 'i-art';
          const cv2 = document.createElement('canvas');
          cv2.width = 104; cv2.height = 68;
          const c2 = cv2.getContext('2d');
          const goldStage = SAVE.skinStage(g.id);
          ENTS.drawBird(c2, 52, 40, { skin: g, hat: s.hat || null, t: 1, wingPhase: 0.5, squash: 1, rot: 0, r: 19, stage: goldStage, golden: true });
          art2.appendChild(cv2);
          art2.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); drawShopPrev('skins', g); SND.sfx.click(); };
          dv.appendChild(art2);
          const nm2 = document.createElement('div');
          nm2.className = 'i-name'; nm2.textContent = g.name + (goldStage >= 2 ? ' ⭐' + goldStage : '');
          dv.appendChild(nm2);
          const pr2 = document.createElement('div');
          pr2.className = 'i-price';
          if (isEq) { pr2.innerHTML = '✔ En uso'; pr2.style.color = '#69f0ae'; }
          else {
            pr2.innerHTML = '👆 Usar'; pr2.style.color = '#ffe066';
            dv.onclick = () => {
              SAVE.equip('skin', g.id);
              SND.sfx.click();
              drawShopItems(cat); drawShopPrev('skins', g); updateShopLoad(); refreshHome();
              toast('✓ ' + g.name + ' equipada', 'good');
            };
          }
          dv.appendChild(pr2);
          grid.appendChild(dv);
        });
      }
    }
  }

  function drawBoxItems() {
    const grid = $('shopGrid');
    grid.innerHTML = '';
    const def = DAT.boxDef();
    const s = SAVE.get();
    const nGold = (s.skinsOwned || []).filter(e => /-gold$/.test(e.id)).length;
    const pool = DAT.SKINS.length + DAT.HATS.length + DAT.EFFECTS.length;
    const owned = s.skinsOwned.length + s.hatsOwned.length + s.fxOwned.length;
    const falta = Math.max(0, pool - owned);
    const dv = document.createElement('div');
    dv.className = 'item item-tool gold-item shop-box';
    const art = document.createElement('div');
    art.className = 'i-art i-art-tool box-ico';
    art.textContent = '🥚';
    dv.appendChild(art);
    const nm = document.createElement('div');
    nm.className = 'i-name'; nm.textContent = def.name;
    dv.appendChild(nm);
    const ds = document.createElement('div');
    ds.className = 'i-desc'; ds.textContent = def.desc;
    dv.appendChild(ds);
    const stats = document.createElement('div');
    stats.className = 'shop-box-stats';
    stats.innerHTML =
      '<span class="bs b1">🎁 Abiertas <b>' + (s.stats.boxesBought || 0) + '</b></span>' +
      '<span class="bs b2">✨ Doradas <b>' + nGold + '</b></span>' +
      '<span class="bs b3">💤 Faltan <b>' + falta + '</b></span>';
    dv.appendChild(stats);
    const bb = document.createElement('button');
    bb.className = 'btn btn-small btn-buy box-buy';
    bb.innerHTML = '<div class="coin-ico"></div> ' + def.price + ' · 🎁 Abrir';
    bb.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); buyBox(); };
    dv.appendChild(bb);
    grid.appendChild(dv);
  }

  function buyBox(confirmed) {
    const def = DAT.boxDef();
    const s = SAVE.get();
    if (s.coins < def.price) { SND.sfx.deny(); toast('No te alcanzan las monedas para la ' + def.name + ' (' + def.price + ' 🪙)', 'info'); return; }
    if (!confirmed && s.set.confirmBuy) {
      confirmAction('Abrir ' + def.name, 'Precio: ' + def.price + ' 🪙 · Saldo: ' + s.coins + ' 🪙\nEl contenido es aleatorio.', () => buyBox(true));
      return;
    }
    const r = SAVE.openBox();
    if (!r || !r.ok) { toast('Algo salió mal abriendo la caja', ''); return; }
    SND.sfx.buy();
    FX.confetti(400, 150);
    if (r.kind === 'gold') {
      SAVE.equip('skin', r.item.id);
      toast('🏆 ¡' + r.item.name + '! Variante dorada ✨ (equipada)', 'good');
      updateShopLoad();
      refreshHome();
    } else if (r.kind === 'coins') {
      toast('🎁 Consolación: +' + r.amount + ' 🪙 (ya lo tienes todo)', 'good');
    } else {
      const pfx = r.kind === 'skin' ? '🐤 ' : r.kind === 'hat' ? '🎩 ' : '💫 ';
      toast('🥚 ¡Conseguiste ' + pfx + r.item.name + '!', 'good');
    }
    drawShopItems('box');
    drawShopPrev('box', null);
    refreshHome();
    SAVE.checkAch().forEach(a => popAch(a));
  }

  function itemTotal() {
    const it = SAVE.get().items || {};
    let n = 0;
    DAT.TOOLS.forEach(t => { n += (it[t.key] || 0); });
    return n;
  }

  function drawToolsItems() {
    const grid = $('shopGrid');
    grid.innerHTML = ''; // la grilla se rellena de cero (compra/mejora re-invocan esto)
    const s = SAVE.get();
    // Las herramientas exclusivas del Pase no se venden: solo se ven en el inventario.
    DAT.TOOLS.filter(t => !DAT.isExclusive(t)).forEach(tool => {
      const div = document.createElement('div');
      div.className = 'item item-tool';
      const art = document.createElement('div');
      art.className = 'i-art i-art-tool';
      art.textContent = tool.icon;
      art.onclick = (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        drawShopPrev('tools', tool);
        SND.sfx.click();
      };
      div.appendChild(art);
      const nm = document.createElement('div');
      nm.className = 'i-name'; nm.textContent = tool.name + levelStars(tool.key);
      div.appendChild(nm);
      const ds = document.createElement('div');
      ds.className = 'i-desc'; ds.textContent = tool.desc + upgradeHint(tool.key);
      div.appendChild(ds);

      // Durabilidad: barra, estado y resistencia al desgaste
      const dur = SAVE.toolDurInfo(tool.key);
      const durBox = document.createElement('div');
      durBox.className = 'tool-dur' + (dur.broken ? ' broken' : dur.pct <= 25 ? ' low' : '');
      durBox.innerHTML =
        '<div class="td-top"><span>🔧 ' + (dur.broken ? 'Rota' : Math.round(dur.cur) + '/' + dur.max) + '</span>' +
        '<span class="td-pct">' + dur.pct + '% · desgaste -' + Math.round((1 - dur.wear) * 100) + '%</span></div>' +
        '<div class="td-bar"><i style="width:' + dur.pct + '%"></i></div>';
      div.appendChild(durBox);

      if (tool.week && !DAT.isUnlocked(tool)) {
        const lk = document.createElement('div');
        lk.className = 'i-price';
        lk.innerHTML = '🔒 Semana ' + tool.week;
        lk.style.color = '#8aa0cc';
        div.appendChild(lk);
        grid.appendChild(div);
        return;
      }

      const buyBtn = document.createElement('button');
      buyBtn.className = 'btn btn-small btn-buy';
      const pos = SAVE.itemCount(tool.key);
      buyBtn.innerHTML = '<div class="coin-ico"></div> ' + tool.price + ' · +1 🎒x' + pos;
      buyBtn.onclick = (ev) => { if (ev.stopPropagation) ev.stopPropagation(); buyToolItem(tool); };
      div.appendChild(buyBtn);

      const modeRow = document.createElement('div');
      modeRow.className = 'tool-row';
      const autoB = document.createElement('button');
      const manB = document.createElement('button');
      autoB.className = 'chip' + (SAVE.toolModeVal(tool.key) === 'auto' ? ' on' : '');
      manB.className = 'chip' + (SAVE.toolModeVal(tool.key) === 'manual' ? ' on' : '');
      autoB.textContent = '🅰 Auto (al inicio)';
      manB.textContent = '👆 Manual (en vuelo)';
      autoB.onclick = (ev) => { if (ev.stopPropagation) ev.stopPropagation(); SAVE.setToolMode(tool.key, 'auto'); drawToolsItems(); refreshHome(); SND.sfx.click(); toast(tool.name + ': se activa sola al empezar', 'info'); };
      manB.onclick = (ev) => { if (ev.stopPropagation) ev.stopPropagation(); SAVE.setToolMode(tool.key, 'manual'); drawToolsItems(); refreshHome(); SND.sfx.click(); toast(tool.name + ': la activas tú con el botón 🛠', 'info'); };
      modeRow.appendChild(autoB);
      modeRow.appendChild(manB);
      div.appendChild(modeRow);

      if (dur.missing > 0) {
        const repRow = document.createElement('div');
        repRow.className = 'tool-row';
        const rep = document.createElement('button');
        rep.className = 'chip chip-repair';
        rep.innerHTML = '🔧 Reparar · <div class="coin-ico"></div> ' + SAVE.toolRepairCost(tool.key);
        rep.onclick = (ev) => {
          if (ev.stopPropagation) ev.stopPropagation();
          confirmAction('Reparar ' + tool.name,
            'Recuperará ' + dur.max + ' de durabilidad (' + Math.round(dur.missing) + ' puntos) por ' + SAVE.toolRepairCost(tool.key) + ' 🪙.',
            () => {
              const r = SAVE.repairTool(tool.key);
              if (!r.ok) {
                SND.sfx.deny();
                toast(r.msg === 'no_money' ? 'No tienes suficientes monedas 💤' : 'No necesita reparación', '');
                return;
              }
              SND.sfx.buy();
              FX.confetti(400, 150);
              drawToolsItems(); refreshHome();
              const gc = $('genCoins'); if (gc) gc.textContent = SAVE.get().coins;
              toast('🔧 ' + tool.name + ' reparada al 100% · -' + r.price + ' 🪙', 'good');
            });
        };
        repRow.appendChild(rep);
        div.appendChild(repRow);
      }

      const upRow = document.createElement('div');
      upRow.className = 'tool-row';
      const lv = SAVE.toolLevel(tool.key);
      const upBtn = document.createElement('button');
      if (lv >= 5) {
        upBtn.className = 'chip chip-max';
        upBtn.textContent = '⭐ Nivel MAX';
      } else {
        upBtn.className = 'chip chip-up';
        const parts = SAVE.toolUpParts(tool.key);
        upBtn.innerHTML = '⬆ Nv ' + lv + ' → ' + (lv + 1) + ' · <div class="coin-ico"></div> ' + SAVE.toolUpPrice(tool.key) +
          (parts ? ' · 🔩 ' + parts : '');
      }
      upBtn.onclick = (ev) => {
        if (ev.stopPropagation) ev.stopPropagation();
        const st = SAVE.toolStats(tool.key);
        if (!st.next) { toast(tool.name + ' ya está al máximo ⭐', 'info'); return; }
        confirmAction('Mejorar ' + tool.name,
          'Nivel ' + st.now.level + ' → ' + st.next.level + '\n' +
          'Durabilidad máx: ' + st.now.max + ' → ' + st.next.max + '\n' +
          'Desgaste por uso: ' + st.now.wear.toFixed(2) + ' → ' + st.next.wear.toFixed(2) + '\n' +
          'Coste: ' + st.price + ' 🪙' + (st.parts ? ' + ' + st.parts + ' 🔩' : '') + '\n' +
          'Tienes: ' + SAVE.get().coins + ' 🪙 · ' + SAVE.partsCount() + ' 🔩',
          () => {
            const res = SAVE.upToolLevel(tool.key);
            if (!res.ok) {
              SND.sfx.deny();
              if (res.msg === 'max') toast(tool.name + ' ya está al máximo ⭐', 'info');
              else if (res.msg === 'no_parts') toast('Faltan piezas 🔩 (' + res.parts + ' necesarias)', '');
              else toast('No tienes suficientes monedas 💤', '');
              return;
            }
            SND.sfx.buy();
            FX.confetti(400, 150);
            drawToolsItems(); refreshHome();
            const gc = $('genCoins');
            if (gc) gc.textContent = SAVE.get().coins;
            toast('⬆ ' + tool.name + ' nivel ' + res.level + ' · durabilidad ' + res.max, 'good');
            SAVE.checkAch().forEach(a => popAch(a));
          });
      };
      upRow.appendChild(upBtn);
      div.appendChild(upRow);

      grid.appendChild(div);
    });
  }

  function levelStars(key) {
    const lv = SAVE.toolLevel(key);
    return lv > 0 ? ' ' + '⭐'.repeat(lv) : '';
  }
  function upgradeHint(key) {
    const lv = SAVE.toolLevel(key);
    if (lv <= 0) return '';
    const lvTxt = {
      magnet: ' · Más duración y atracción',
      slow: ' · Más duración',
      coins: ' · Más duración y +monedas',
      luck: ' · +más monedas',
      boost: ' · +más puntos',
      start: ' · +más puntos',
      score: ' · +más puntos',
      sprint: ' · Caída aún más ligera',
      treasure: ' · +más monedas',
      clock: ' · Más duración',
      turbo: ' · Más duración y velocidad',
      combo: ' · Más duración y +puntos',
      shield: ' · (siempre igual)',
      ghost: ' · Más duración',
      frenzy: ' · Más duración',
      eco: ' · +más monedas',
      hype: ' · (siempre igual)',
      bomb: ' · Más duración',
      aura: ' · Más duración',
      twin: ' · +más puntos',
      oasis: ' · (siempre igual)',
      doble: ' · (siempre igual)',
      runa: ' · +más XP',
      titan: ' · (siempre igual)',
      fenix: ' · (sin cambios)',
      bateria: ' · +más puntos',
      cris: ' · +más monedas'
    }[key] || '';
    return lvTxt;
  }

  function buyToolItem(tool, confirmed) {
    const s = SAVE.get();
    if (s.coins < tool.price) {
      SND.sfx.deny();
      toast('No tienes suficientes monedas 💤', '');
      return;
    }
    if (!confirmed && s.set.confirmBuy) {
      confirmAction('Comprar ' + tool.name, 'Precio: ' + tool.price + ' 🪙 · Saldo: ' + s.coins + ' 🪙\nRecibirás 1 uso adicional.', () => buyToolItem(tool, true));
      return;
    }
    const res = SAVE.buyTool(tool.id);
    if (res.ok) {
      SND.sfx.buy();
      FX.confetti(400, 150);
      drawToolsItems();
      drawShopPrev('tools', tool);
      refreshHome();
      const gc = $('genCoins');
      if (gc) gc.textContent = SAVE.get().coins;
      toast('🛠 +1 ' + tool.name + ' (🎒 x' + res.owned + ')', 'good');
      SAVE.checkAch().forEach(a => popAch(a));
    }
  }

  function buyItem(cat, item, ownedList, confirmed) {
    const s = SAVE.get();
    const vt = cat === 'hats' ? 'hat' : cat === 'fx' ? 'fx' : 'skin';
    if (s.coins < item.price) {
      SND.sfx.deny();
      toast('No tienes suficientes monedas 💤', '');
      return;
    }
    if (!confirmed && s.set.confirmBuy) {
      confirmAction('Comprar ' + item.name, 'Precio: ' + item.price + ' 🪙 · Saldo: ' + s.coins + ' 🪙\nSe equipará automáticamente.', () => buyItem(cat, item, ownedList, true));
      return;
    }
    const res = SAVE.buy(vt, item.id);
    if (res.ok) {
      SAVE.equip(vt, item.id);
      SND.sfx.buy();
      FX.confetti(400, 150);
      drawShopItems(cat);
      updateShopLoad();
      refreshHome();
      $('genCoins').textContent = SAVE.get().coins;
      toast('¡Compraste ' + item.name + '!', 'good');
      SAVE.checkAch().forEach(a => popAch(a));
    }
  }

  /* ---------- MAPAS ---------- */
  function renderMaps() {
    const body = $('genBody');
    body.innerHTML = ''; // re-entradas (comprar/usar) reconstruyen desde cero
    const info = document.createElement('div');
    info.className = 'panel-note week-note';
    info.textContent = nextWeekPreview() || '📅 Hoy es la Semana ' + DAT.curWeek() + ' · en su semana, los mapas se desbloquean solos aquí.';
    body.appendChild(info);
    const grid = document.createElement('div');
    grid.className = 'items';
    const s = SAVE.get();
    DAT.MAPS.forEach(m => {
      const div = document.createElement('div');
      div.className = 'item' + (DAT.isExclusive(m) ? ' exclusive-item' : '');
      const prev = document.createElement('div');
      prev.className = 'map-preview';
      prev.style.background = 'linear-gradient(180deg,' + m.sky[0] + ',' + m.sky[1] + ')';
      const nm = document.createElement('div');
      nm.className = 'm-name';
      nm.textContent = m.icon + ' ' + m.name + (s.map === m.id ? '  ✔' : '');
      prev.appendChild(nm);
      div.appendChild(prev);
      const owned = SAVE.owns(s.mapsOwned, m.id);
      const exclusiveLocked = !owned && DAT.isExclusive(m);
      const locked = !owned && m.week && !DAT.isUnlocked(m);
      if (exclusiveLocked) {
        const lock = document.createElement('div');
        lock.className = 'map-lock';
        lock.innerHTML = '<div class="lock-ico">🎫</div><div class="ml-t">Pase Prémium</div>';
        prev.appendChild(lock);
        div.onclick = () => {
          SND.sfx.deny();
          toast(m.name + ' es exclusivo del Pase Prémium de esta temporada', 'info');
          openGeneric('pass');
        };
      } else if (locked) {
        const lock = document.createElement('div');
        lock.className = 'map-lock';
        lock.innerHTML = '<div class="lock-ico">📅</div><div class="ml-t">Semana ' + m.week + '</div>';
        prev.appendChild(lock);
        div.onclick = () => { SND.sfx.click(); toast('Se habilitará en la Semana ' + m.week, 'info'); };
      } else if (owned && s.map === m.id) {
        const pr = document.createElement('div');
        pr.className = 'i-price'; pr.innerHTML = 'En uso';
        pr.style.color = '#69f0ae';
        div.appendChild(pr);
      } else if (owned) {
        const pr = document.createElement('div');
        pr.className = 'i-price'; pr.innerHTML = 'Toque para usar';
        pr.style.color = '#cdefff';
        div.appendChild(pr);
        div.onclick = () => {
          SAVE.equip('map', m.id);
          BG.init(m.id); BG.reset();
          if (SND.setMapTheme) SND.setMapTheme(m.id);
          SND.sfx.click();
          renderMaps();
          toast('Mapa: ' + m.name, 'info');
        };
      } else {
        const canBuy = s.stats.best >= m.minScore;
        if (!canBuy) {
          const lock = document.createElement('div');
          lock.className = 'map-lock';
          lock.innerHTML = '<div class="lock-ico">🔒</div><div class="ml-t">Alcanza ' + m.minScore + ' pts</div>';
          prev.appendChild(lock);
          div.onclick = () => { SND.sfx.deny(); toast('Desbloquea ' + m.name + ' con ' + m.minScore + ' pts', ''); };
        } else {
          const pr = document.createElement('div');
          pr.className = 'i-price';
          pr.innerHTML = '<div class="coin-ico"></div> ' + m.price;
          div.appendChild(pr);
          div.onclick = () => {
            if (s.coins < m.price) { SND.sfx.deny(); toast('Necesitas más monedas para ' + m.name, ''); return; }
            const doBuy = () => {
              const res = SAVE.buy('map', m.id);
              if (res.ok) {
                SAVE.equip('map', m.id);
                BG.init(m.id); BG.reset();
                if (SND.setMapTheme) SND.setMapTheme(m.id);
                SND.sfx.buy();
                renderMaps();
                $('genCoins').textContent = SAVE.get().coins;
                toast('¡Mapa desbloqueado: ' + m.name + '!', 'good');
              } else {
                SND.sfx.deny();
                toast('No se pudo comprar el mapa', '');
              }
            };
            if (s.set.confirmBuy) {
              confirmAction('Comprar mapa ' + m.name,
                'Precio: ' + m.price + ' 🪙 · Saldo: ' + s.coins + ' 🪙\nSe equipará al comprarlo.', doBuy);
            } else doBuy();
          };
        }
      }
      grid.appendChild(div);
    });
    body.appendChild(grid);
  }

  /* ---------- PROGRESO ---------- */
  function renderProgress() {
    const body = $('genBody');
    body.innerHTML = ''; // re-entradas (reclamar caja) no duplican
    const s = SAVE.get();
    const html = [];
    const top3 = s.best3 || [];
    html.push('<div class="prog-card prog-lv"><h3>NIVEL DE JUGADOR</h3><div class="big">' + s.level + '</div>' +
      '<div class="player-level" style="width:100%;margin-top:10px"><span>' + rankName(s.level) + '</span>' +
      '<div class="xpbar"><div id="pxp" style="height:100%;width:' + Math.min(100, s.xp / SAVE.xpFor(s.level) * 100) + '%;background:linear-gradient(90deg,#69f0ae,#00c853);border-radius:6px"></div></div></div></div>');
    html.push('<div class="prog-card"><h3>🏆 MEJORES VUELOS</h3>' +
      (top3.length
        ? top3.map((e, i) => '<div class="stat-row"><span>' + (i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉') + ' ' + (i + 1) + '.º</span><span><b>' + e.s + ' pts</b></span></div>').join('')
        : '<div class="stat-row"><span>Sin vuelos aún…</span><span>💭</span></div>') +
      '</div>');
    html.push(seedCard(s));
    html.push(replayCard(s));
    html.push('<div class="prog-card"><h3>ESTADÍSTICAS</h3>' +
      statRow('Partidas jugadas', s.stats.flights) +
      statRow('Récord de puntos', s.stats.best) +
      statRow('Obstáculos superados', s.stats.pipes) +
      statRow('Distancia volada', s.stats.dist + ' m') +
      statRow('Power-ups recogidos', s.stats.powersGot || 0) +
      statRow('Monedas de oro 🪙', s.stats.megaGot || 0) +
      statRow('Doble monedas 💰', s.stats.xcGot || 0) +
      statRow('Enemigos esquivados', s.stats.enemiesGot || 0) +
      statRow('Murciélagos 🦇', s.stats.batsGot || 0) +
      statRow('Diamantes 💎', s.stats.gemsGot || 0) +
      statRow('Monedas de cadena 🍒', s.stats.chainGot || 0) +
      statRow('Choques absorbidos 🛡️', s.stats.shieldAbsorbed || 0) +
      statRow('Obstáculos fantasma 👻', s.stats.ghostPassed || 0) +
      statRow('Tubos gigantes pasados 🏗️', s.stats.giantPassed || 0) +
      statRow('Zonas de viento 🌬️', s.stats.windZones || 0) +
      statRow('Duelos ganados 🆚', s.stats.duelWins || 0) +
      statRow('Vuelos de fin de semana ⚡', s.stats.weekendRuns || 0) +
      statRow('Mejor semilla 🌱', (s.dailyC && s.dailyC.best) || 0) +
      statRow('Semillas jugadas', s.stats.seedDays || 0) +
      statRow('Vuelo más largo sin chocar 🛩️', s.stats.maxDistNoHit ? s.stats.maxDistNoHit + ' m' : '—') +
      statRow('Vuelos sin monedas 🚫', s.stats.zeroCoinRuns || 0) +
      statRow('Replays grabados 🎬', s.stats.replaysWatched || 0) +
      statRow('Herramientas usadas 🎒', s.stats.toolsUsed || 0) +
      statRow('Herramientas compradas', s.stats.toolsBought || 0) +
      statRow('Recompensas diarias', s.stats.dailyClaimed || 0) +
      statRow('Monedas recolectadas', s.stats.coinsGot) +
      statRow('Monedas gastadas', s.stats.spent || 0) +
      statRow('Tiempo de vuelo', fmtTime(s.stats.timePlayed)) +
      '</div>');
    body.innerHTML = html.join('');
    renderSeason(body);
    const achTitle = document.createElement('h3');
    achTitle.style.cssText = 'color:#ffe066;font-size:15px;margin:6px 0 10px;letter-spacing:1px';
    achTitle.textContent = '🏅 LOGROS (' + s.achieved.length + '/' + DAT.ACH.length + ')';
    body.appendChild(achTitle);
    DAT.ACH.forEach(a => {
      const got = s.achieved.indexOf(a.id) !== -1;
      const d = document.createElement('div');
      d.className = 'achv' + (got ? ' unlocked' : '');
      d.innerHTML = '<div class="a-ico">' + (got ? '🏅' : '🎯') + '</div>' +
        '<div class="a-t"><div class="a-name">' + a.name + '</div><div class="a-desc">' + a.desc + '</div>' +
        '<div class="a-reward">+' + a.reward + ' monedas</div></div>' +
        '<div>' + (got ? '✔' : '🔒') + '</div>';
      body.appendChild(d);
    });
  }

  function statRow(k, v) { return '<div class="stat-row"><span>' + k + '</span><span><b>' + v + '</b></span></div>'; }

  /* Tarjeta líder de la Semilla diaria (récords locales por día) */
  function seedCard(s) {
    const h = SAVE.dailyHistory();
    let rows = '<div class="stat-row"><span>No has jugado ninguna semilla aún</span><span>🌱</span></div>';
    if (h.length) {
      rows = h.map(e =>
        '<div class="stat-row"><span>🌱 ' + e.key + '</span><span><b>' + e.best + ' pts</b></span></div>').join('') +
        '<div style="font-size:11px;color:#8aa0cc;margin-top:4px">Últimos 7 días</div>';
    }
    return '<div class="prog-card"><h3>🌱 LÍDER DE SEMILLA</h3>' +
      '<div style="font-size:12px;color:#dbe7ff;margin-bottom:8px">Todos juegan la misma partida cada día. Tu mejor marca queda registrada aquí.</div>' +
      rows + '</div>';
  }

  /* Tarjeta del mejor vuelo guardado (Replay) */
  function replayCard(s) {
    const rp = s.replay;
    if (!rp) return '';
    return '<div class="prog-card"><h3>🎬 TU MEJOR VUELO</h3>' +
      '<div class="stat-row"><span>Puntos</span><span><b>' + rp.score + ' pts</b></span></div>' +
      '<div class="stat-row"><span>Fecha</span><span><b>' + rp.date + '</b></span></div>' +
      '<div class="stat-row"><span>Toques grabados</span><span><b>' + (rp.taps ? rp.taps.length : 0) + '</b></span></div>' +
      '<div style="font-size:12px;color:#8aa0cc;margin-top:6px">Pulsa «Replay» en el menú para volver a verlo y exportarlo como video.</div></div>';
  }

  /* Texto de recompensa (el Pase también regala cosméticos: sombrero/estela/mapa/ave) */
  function rewardText(t) {
    if (t.reward.item) {
      const tk = DAT.TOOLS.find(x => x.key === t.reward.item);
      return '🎒 ' + t.reward.n + ' × ' + (tk ? tk.name : t.reward.item);
    }
    if (t.reward.hat) { const h = DAT.getHat(t.reward.hat); return '👒 ' + h.name; }
    if (t.reward.fx) { const f = DAT.getFx(t.reward.fx); return '✨ ' + f.name; }
    if (t.reward.map) { const m = DAT.getMap(t.reward.map); return '🗺 ' + m.name; }
    if (t.reward.skin) { const sk = DAT.getSkin(t.reward.skin); return '🐤 ' + sk.name; }
    return (t.reward.coins || 0) + ' 🪙';
  }

  /* ---------- TEMPORADA 2026 🗓 ---------- */
  function renderSeason(body) {
    const sx = SAVE.totalXp();
    const srl = SAVE.seasonReached();
    const card = document.createElement('div');
    card.className = 'prog-card';
    card.innerHTML =
      '<h3>🗓 TEMPORADA 2026</h3>' +
      '<div style="font-size:13px;color:#dbe7ff">Cada vuelo suma XP (×1,5 los fines de semana ⚡). Reclama tu caja de temporada.</div>' +
      '<div style="font-size:22px;font-weight:900;color:#7ee0ff;margin:6px 0">' + sx + ' XP</div>' +
      '<div style="font-size:12px;color:#bcd0ff">Nivel de temporada: ' + srl + ' / ' + DAT.SEASON_TIERS.length + '</div>';
    body.appendChild(card);
    DAT.SEASON_TIERS.forEach((t, idx) => {
      const claimed = SAVE.get().seasonClaimed.indexOf(idx) !== -1;
      const can = !claimed && srl > idx;
      const c2 = document.createElement('div');
      c2.className = 'prog-card';
      const rw = rewardText(t);
      const st = claimed ? '<span style="color:#7dffa0">✓ Reclamada</span>' : (can ? '<span style="color:#ffd54f">Disponible</span>' : '<span style="color:#8aa0cc">Bloqueada</span>');
      c2.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<b>🗓 ' + t.xp + ' XP</b>' + st + '</div>' +
        '<div style="font-size:13px;color:#dbe7ff">Recompensa: <b style="color:#7ee0ff">' + rw + '</b></div>';
      const btn = document.createElement('button');
      btn.className = 'btn ' + (claimed ? 'btn-ghost' : '');
      btn.disabled = claimed || !can;
      btn.textContent = claimed ? 'Reclamada' : (can ? 'Reclamar' : 'Necesitas ' + t.xp + ' XP');
      btn.onclick = () => {
        const r = SAVE.claimSeasonTier(idx);
        if (r) { toast('🎁 ¡Caja de Temporada 2026!', 'good'); SND.sfx.level(); renderProgress(); }
        SAVE.checkAch().forEach(a => popAch(a));
      };
      c2.appendChild(btn);
      body.appendChild(c2);
    });
  }

  function rankName(lv) {
    if (lv >= 20) return '🌌 Leyenda del Cielo';
    if (lv >= 12) return '👑 As del Vuelo';
    if (lv >= 8) return '⚡ Veloz';
    if (lv >= 5) return '🪽 Explorador';
    if (lv >= 3) return '🐣 Aprendiz';
    return '🐤 Novato';
  }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + 'm ' + s + 's';
  }

  /* ---------- AJUSTES ---------- */
  /* ---------- Récords locales ---------- */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function fmtDate(ts) {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return '—'; }
  }
  const MODE_LABEL = {
    free: 'Vuelo libre', zen: 'Zen 🧘', boss: 'Boss 👹', wind: 'Viento 💨',
    challenge: 'Semilla 🌱', duel: 'Duelo 🆚', replay: 'Replay 🎬'
  };

  function renderRecords() {
    const body = $('genBody');
    body.innerHTML = '';
    const lb = SAVE.leaderboard();
    const prof = SAVE.getProfile();
    const players = lb.players || [];
    const runs = lb.runs || [];
    const cloudOn = !!(window.CLOUD && typeof CLOUD.configured === 'function' && CLOUD.configured());

    /* El ranking online va primero: es la respuesta a "quién tiene la mejor
       marca". Si Firebase falla, la parte local sigue funcionando igual. */
    if (cloudOn) renderCloudBoard(body, prof);

    const head = document.createElement('div');
    head.className = 'lb-banner' + (cloudOn ? ' lb-banner-local' : '');
    head.innerHTML = '<div class="lb-banner-ico">🏆</div><div class="lb-banner-txt">' +
      '<div class="lb-banner-title">' + (cloudOn ? 'TU TABLA LOCAL' : 'RÉCORDS LOCALES') + '</div>' +
      '<div class="lb-banner-sub">Se guardan <b>solo en este dispositivo</b>. Tu nombre: <b>' + esc(prof.name) + '</b></div>' +
      '</div>';
    body.appendChild(head);

    if (lb.error) {
      const err = document.createElement('div');
      err.className = 'lb-empty lb-error';
      err.innerHTML = '<div class="lb-empty-ico">⚠️</div><div>No se pudo leer la tabla de récords.<br><span class="lb-empty-sub">Los datos locales no se han modificado. Vuelve a abrir esta pantalla o revisa el espacio de almacenamiento.</span></div>';
      body.appendChild(err);
      return;
    }

    const hasData = runs.length > 0 || players.some(p => (p.games || 0) > 0 || (p.best || 0) > 0);
    if (!hasData) {
      const empty = document.createElement('div');
      empty.className = 'lb-empty';
      empty.innerHTML = '<div class="lb-empty-ico">🪁</div><div>Aún no hay récords en este dispositivo.<br><span class="lb-empty-sub">Termina tu primer vuelo y aparecerá aquí automáticamente.</span></div>';
      body.appendChild(empty);
    } else {
      const title = document.createElement('h3');
      title.className = 'lb-title';
      title.textContent = '🏅 CLASIFICACIÓN LOCAL';
      body.appendChild(title);

      const list = document.createElement('div');
      list.className = 'lb-list';
      players.forEach((p, i) => {
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        const row = document.createElement('div');
        row.className = 'lb-row' + (i < 3 ? ' lb-top lb-top' + (i + 1) : '') + (p.me ? ' lb-me' : '');
        row.innerHTML =
          '<div class="lb-rank">' + rank + '</div>' +
          '<div class="lb-who">' +
            '<div class="lb-name">' + esc(p.name) + (p.me ? ' <span class="lb-you">TÚ</span>' : '') + '</div>' +
            '<div class="lb-meta">' + (p.games || 0) + ' vuelo' + ((p.games || 0) === 1 ? '' : 's') +
              ' · récord ' + fmtDate(p.bestDate) + '</div>' +
          '</div>' +
          '<div class="lb-nums">' +
            '<div class="lb-best">' + (p.best || 0) + '<small>pts</small></div>' +
            '<div class="lb-last">último ' + (p.last || 0) + '</div>' +
          '</div>';
        list.appendChild(row);
      });
      body.appendChild(list);

      if (runs.length) {
        const h2 = document.createElement('h3');
        h2.className = 'lb-title';
        h2.textContent = '✈️ MEJORES VUELOS';
        body.appendChild(h2);
        const rl = document.createElement('div');
        rl.className = 'lb-runs';
        runs.forEach((r, i) => {
          const row = document.createElement('div');
          row.className = 'lb-run' + (i === 0 ? ' lb-top1' : '');
          row.innerHTML =
            '<div class="lb-rank sm">' + (i + 1) + '</div>' +
            '<div class="lb-run-mid"><b>' + (r.score || 0) + ' pts</b>' +
              '<span>' + esc(MODE_LABEL[r.mode] || r.mode || 'Vuelo libre') + ' · ' + (r.pipes || 0) + ' tubos · ' + (r.dist || 0) + ' m</span></div>' +
            '<div class="lb-run-date">' + fmtDate(r.date) + '</div>';
          rl.appendChild(row);
        });
        body.appendChild(rl);
      }
    }

    const note = document.createElement('div');
    note.className = 'panel-note lb-note';
    note.innerHTML = cloudOn
      ? '☁️ Solo se publica tu nombre, nivel y mejor marca. El progreso completo sigue guardado en este dispositivo y se sincroniza cuando hay conexión.'
      : 'ℹ️ Sin servidor ni cuentas: el ranking es de este navegador. Si borras los datos del sitio o usas otro dispositivo, la tabla no se comparte.';
    body.appendChild(note);
  }

  /* Ranking global opcional (Firebase Firestore). Si la nube está apagada,
     esta sección no se dibuja y la pantalla sigue siendo 100 % local. */
  function renderCloudBoard(body, prof) {
    const s = SAVE.get();
    const localBest = (s.stats && s.stats.best) || 0;
    const section = document.createElement('section');
    section.className = 'lb-cloud';
    section.innerHTML =
      '<div class="lb-cloud-head">' +
        '<div class="lb-cloud-title"><span aria-hidden="true">🌍</span><div><b>RÉCORDS ONLINE</b><small>Quién tiene la mejor marca</small></div></div>' +
        '<span class="lb-cloud-state" data-state="loading">Conectando…</span>' +
      '</div>' +
      '<div class="lb-cloud-me">Tu mejor marca: <b>' + localBest + ' pts</b><span>' + esc(prof.name) + '</span></div>' +
      '<div class="lb-list lb-cloud-list" aria-live="polite"></div>' +
      '<div class="lb-cloud-actions"><button class="btn btn-small lb-retry" type="button">Actualizar</button></div>';
    body.appendChild(section);

    const stateEl = section.querySelector('.lb-cloud-state');
    const list = section.querySelector('.lb-cloud-list');
    const retryBtn = section.querySelector('.lb-retry');
    let stopped = false;

    function setState(kind, text) {
      stateEl.setAttribute('data-state', kind);
      stateEl.textContent = text;
    }

    function empty(text, sub) {
      list.innerHTML = '<div class="lb-empty"><div class="lb-empty-ico">☁️</div><div>' + text +
        '<br><span class="lb-empty-sub">' + sub + '</span></div></div>';
    }

    function paint(rows, cached) {
      if (stopped) return;
      const noNet = (typeof navigator !== 'undefined' && navigator.onLine === false);
      const stale = cached || noNet;
      list.innerHTML = '';
      if (!rows || !rows.length) {
        empty('Aún no hay marcas online.', noNet ? 'Recupera la conexión y pulsa Reintentar.' : 'Termina un vuelo con puntos y aparecerás aquí.');
        setState(stale ? 'offline' : 'ok', noNet ? 'Sin conexión' : (cached ? 'Sin conexión · caché' : 'En vivo'));
        return;
      }
      rows.forEach(function (p, i) {
        const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        const row = document.createElement('div');
        row.className = 'lb-row' + (i < 3 ? ' lb-top lb-top' + (i + 1) : '') + (p.me ? ' lb-me' : '');
        row.innerHTML =
          '<div class="lb-rank">' + rank + '</div>' +
          '<div class="lb-who">' +
            '<div class="lb-name">' + esc(p.name || 'Jugador') + (p.me ? ' <span class="lb-you">TÚ</span>' : '') + '</div>' +
            '<div class="lb-meta">Nivel ' + (p.level || 1) + ' · ' + (p.games || 0) + ' vuelo' + ((p.games || 0) === 1 ? '' : 's') + '</div>' +
          '</div>' +
          '<div class="lb-nums">' +
            '<div class="lb-best">' + (p.best || 0) + '<small>pts</small></div>' +
            '<div class="lb-last">último ' + (p.last || 0) + '</div>' +
          '</div>';
        list.appendChild(row);
      });
      setState(stale ? 'offline' : 'ok', noNet ? 'Sin conexión · última tabla' : (cached ? 'Sin conexión · última tabla' : 'En vivo'));
    }

    function onError(err, cachedRows) {
      if (stopped) return;
      const rows = cachedRows || (window.CLOUD && CLOUD.cachedLeaderboard ? CLOUD.cachedLeaderboard('global') : []);
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
      retryBtn.textContent = 'Reintentar';
      retryBtn.disabled = false;
      if (rows.length) {
        paint(rows, true);
        setState('offline', offline ? 'Sin conexión' : 'Error de red · caché');
      } else {
        list.innerHTML = '';
        empty(
          offline ? 'No hay conexión.' : 'No se pudo cargar el ranking.',
          offline ? 'Puedes seguir jugando; tu marca se subirá al recuperar la red.' : 'Revisa tu conexión y pulsa Reintentar.'
        );
        setState(offline ? 'offline' : 'error', offline ? 'Sin conexión' : 'Error');
      }
    }

    function load() {
      if (stopped) return;
      retryBtn.disabled = true;
      retryBtn.textContent = 'Actualizando…';
      setState('loading', 'Conectando…');
      /* Si el navegador ya sabe que no hay red, no se lanza una consulta
         condenada a esperar: se muestra la última tabla y se deja reintentar. */
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        onError(new Error('Sin conexión'),
          (window.CLOUD && CLOUD.cachedLeaderboard) ? CLOUD.cachedLeaderboard('global') : []);
        return;
      }
      try {
        if (typeof CLOUD.watchLeaderboard === 'function') {
          CLOUD.watchLeaderboard('global', function (rows) {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Actualizar';
            paint(rows, false);
          }, 25, onError);
        } else {
          CLOUD.leaderboard('global', 25).then(function (rows) {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Actualizar';
            paint(rows, false);
          }).catch(onError);
        }
      } catch (e) {
        onError(e);
      }
    }

    retryBtn.onclick = function () {
      SND.sfx.click();
      retryBtn.disabled = true;
      retryBtn.textContent = 'Reintentando…';
      const done = function () { if (!stopped) load(); };
      try {
        if (window.CLOUD && typeof CLOUD.retry === 'function') CLOUD.retry().then(done).catch(function (e) { onError(e); });
        else done();
      } catch (e) {
        onError(e);
      }
    };

    /* Muestra de inmediato la última tabla guardada, luego intenta la red. */
    let cachedRows = [];
    try {
      if (window.CLOUD && typeof CLOUD.cachedLeaderboard === 'function') cachedRows = CLOUD.cachedLeaderboard('global') || [];
    } catch (e) { cachedRows = []; }
    if (cachedRows.length) paint(cachedRows, true);
    load();

    /* Se detiene al salir de la pantalla para no dejar listeners vivos. */
    section.__stopCloud = function () {
      stopped = true;
      try { if (window.CLOUD && CLOUD.stopWatchLeaderboard) CLOUD.stopWatchLeaderboard(); } catch (e) { }
    };
  }

  /* ---------- Perfil / identidad local ---------- */
  function renderProfile() {
    const body = $('genBody');
    body.innerHTML = '';
    const s = SAVE.get();
    const prof = SAVE.getProfile();

    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML =
      '<div class="profile-avatar">🐤</div>' +
      '<div class="profile-id">' +
        '<div class="profile-name">' + esc(prof.name) + '</div>' +
        '<div class="profile-sub">ID ' + esc(String(prof.id).slice(-8)) + ' · desde ' + fmtDate(prof.created) + '</div>' +
      '</div>';
    body.appendChild(card);

    const stats = document.createElement('div');
    stats.className = 'profile-stats';
    stats.innerHTML =
      '<div class="profile-stat"><b>' + (s.stats.best || 0) + '</b><span>🏆 Récord</span></div>' +
      '<div class="profile-stat"><b>' + (s.stats.flights || 0) + '</b><span>✈️ Vuelos</span></div>' +
      '<div class="profile-stat"><b>' + SAVE.shieldCount() + '</b><span>🛡️ Guardados</span></div>' +
      '<div class="profile-stat"><b>' + s.coins + '</b><span>🪙 Monedas</span></div>';
    body.appendChild(stats);

    const panel = document.createElement('div');
    panel.className = 'profile-panel';
    const h = document.createElement('h3');
    h.textContent = '✏️ TU NOMBRE';
    panel.appendChild(h);
    const hint = document.createElement('div');
    hint.className = 'profile-hint';
    hint.textContent = 'De 2 a 16 caracteres. Letras, números, espacio, punto, guion y guion bajo.';
    panel.appendChild(hint);

    const input = document.createElement('input');
    input.className = 'profile-input';
    input.type = 'text';
    input.maxLength = 16;
    input.value = prof.name;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-label', 'Nombre de jugador');
    panel.appendChild(input);

    const msg = document.createElement('div');
    msg.className = 'profile-msg';
    panel.appendChild(msg);

    const actions = document.createElement('div');
    actions.className = 'profile-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = '💾 Guardar nombre';
    const rndBtn = document.createElement('button');
    rndBtn.className = 'btn btn-ghost';
    rndBtn.textContent = '🎲 Nombre aleatorio';
    actions.appendChild(saveBtn);
    actions.appendChild(rndBtn);
    panel.appendChild(actions);

    const commit = (candidate) => {
      const r = SAVE.rename(candidate);
      if (!r.ok) {
        msg.textContent = '⚠️ ' + r.msg;
        msg.className = 'profile-msg bad';
        SND.sfx.deny();
        return;
      }
      input.value = r.name;
      refreshHome();
      if (r.unchanged) {
        msg.textContent = 'ℹ️ Ese ya es tu nombre.';
        msg.className = 'profile-msg';
        SND.sfx.click();
      } else {
        msg.textContent = '✅ Nombre guardado. Tus récords se mantienen.';
        msg.className = 'profile-msg good';
        SND.sfx.level();
        toast('✏️ Ahora eres ' + r.name, 'good');
        renderProfile();
      }
      if (r.saved === false) toast('⚠️ No se pudo guardar en este dispositivo', 'warning');
    };

    saveBtn.onclick = () => { SND.sfx.click(); commit(input.value); };
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { SND.sfx.click(); commit(input.value); } });
    rndBtn.onclick = () => {
      input.value = SAVE.randomName();
      msg.textContent = '🎲 Nombre propuesto. Pulsa «Guardar nombre» para usarlo.';
      msg.className = 'profile-msg';
      SND.sfx.click();
    };
    body.appendChild(panel);

    const sh = document.createElement('div');
    sh.className = 'profile-panel';
    sh.innerHTML = '<h3>🛡️ INVENTARIO DE ESCUDOS</h3>' +
      '<div class="profile-shield-line"><span class="profile-shield-ico">🛡️</span><b>' + SAVE.shieldCount() + '</b><span>guardado' + (SAVE.shieldCount() === 1 ? '' : 's') + '</span></div>' +
      '<div class="profile-hint">Los escudos comprados se acumulan aquí y no tienen tope, pero cada partida solo puede gastar <b>1</b> al bloquear un choque (tubo, enemigo o suelo). Si no lo usas, sigue guardado para otro vuelo. Los 🛡️ que recoges durante la partida son aparte: se acumulan solo en ese vuelo, se gastan antes que los guardados y desaparecen al terminar.</div>';
    body.appendChild(sh);

    const note = document.createElement('div');
    note.className = 'panel-note';
    const cloudProfile = !!(window.CLOUD && typeof CLOUD.configured === 'function' && CLOUD.configured());
    note.innerHTML = cloudProfile
      ? '☁️ Perfil con Firebase opcional: se usa una sesión anónima (sin correo ni contraseña). El progreso local sigue guardándose en este dispositivo y se sincroniza cuando hay conexión.'
      : '🔒 Perfil local sin cuentas ni contraseñas. El nombre y el récord viven en este navegador; si borras los datos del sitio, se pierden. No se envía nada a ningún servidor.';
    body.appendChild(note);
  }

  /* ---------- INVENTARIO ---------- */
  function renderInventory(initialCat) {
    const body = $('genBody');
    body.innerHTML = '';
    const s = SAVE.get();

    const head = document.createElement('div');
    head.className = 'inv-head';
    head.innerHTML =
      '<div class="inv-wallet"><span class="coin-ico"></span><b>' + s.coins + '</b><span>monedas</span></div>' +
      '<div class="inv-wallet"><span class="parts-ico">🔩</span><b>' + SAVE.partsCount() + '</b><span>piezas</span></div>' +
      '<div class="inv-wallet"><span>🛡️</span><b>' + SAVE.shieldCount() + '</b><span>escudos</span></div>';
    body.appendChild(head);

    const cats = [['all', '📦', 'Todo'], ['skins', '🐤', 'Aves'], ['hats', '🎩', 'Sombreros'], ['fx', '💫', 'Estelas'], ['maps', '🗺', 'Mapas'], ['tools', '🛠', 'Herramientas']];
    let active = (initialCat && cats.some(c => c[0] === initialCat)) ? initialCat : 'all';
    const tabs = document.createElement('div');
    tabs.className = 'tabs shop-tabs';
    const tabEls = [];
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    const history = document.createElement('div');
    history.className = 'inv-history';

    function drawTabs() {
      tabs.innerHTML = '';
      tabEls.length = 0;
      cats.forEach(c => {
        const b = document.createElement('button');
        b.className = 'tab' + (c[0] === active ? ' active' : '');
        b.innerHTML = '<span class="tab-ico">' + c[1] + '</span><span class="tab-t">' + c[2] + '</span>';
        b.onclick = () => {
          active = c[0];
          SND.sfx.click();
          drawTabs();
          drawGrid();
        };
        tabEls.push(b);
        tabs.appendChild(b);
      });
    }

    function card(emoji, name, sub, equipped, actions) {
      const d = document.createElement('div');
      d.className = 'inv-card' + (equipped ? ' equipped' : '');
      d.innerHTML = '<div class="inv-ico">' + emoji + '</div>' +
        '<div class="inv-txt"><b>' + esc(name) + '</b><span>' + sub + '</span></div>' +
        (equipped ? '<span class="inv-eq">✔ En uso</span>' : '');
      if (actions && actions.length) {
        const row = document.createElement('div');
        row.className = 'inv-actions';
        actions.forEach(a => {
          const b = document.createElement('button');
          b.className = 'chip ' + (a.style || '');
          b.innerHTML = a.label;
          b.onclick = () => { SND.sfx.click(); a.cb(); };
          row.appendChild(b);
        });
        d.appendChild(row);
      }
      return d;
    }

    function drawGrid() {
      grid.innerHTML = '';
      let shown = 0;
      if (active === 'all' || active === 'skins') {
        const list = s.skinsOwned.map(o => DAT.getSkin(o.id)).filter(Boolean);
        list.forEach(it => {
          shown++;
          grid.appendChild(card('🐤', it.name, it.desc + (it.golden ? ' ✨' : ''),
            s.skin === it.id,
            s.skin === it.id ? [] : [{ label: 'Usar', cb: () => { SAVE.equip('skin', it.id); SND.sfx.click(); drawTabs(); drawGrid(); refreshHome(); } }]));
        });
      }
      if (active === 'all' || active === 'hats') {
        const list = s.hatsOwned.map(o => DAT.getHat(o.id)).filter(Boolean);
        if (!list.length) grid.appendChild(emptyNote('Aún no tienes sombreros. Se compran en la tienda.'));
        list.forEach(it => {
          shown++;
          grid.appendChild(card('🎩', it.name, 'Sombrero',
            s.hat === it.id,
            s.hat === it.id
              ? [{ label: 'Quitar', cb: () => { s.hat = null; SAVE.save(); drawGrid(); refreshHome(); } }]
              : [{ label: 'Usar', cb: () => { SAVE.equip('hat', it.id); drawGrid(); refreshHome(); } }]));
        });
      }
      if (active === 'all' || active === 'fx') {
        const list = s.fxOwned.map(o => DAT.getFx(o.id)).filter(Boolean);
        list.forEach(it => {
          shown++;
          grid.appendChild(card('💫', it.name, 'Estela',
            s.fx === it.id,
            s.fx === it.id ? [] : [{ label: 'Usar', cb: () => { SAVE.equip('fx', it.id); drawGrid(); refreshHome(); } }]));
        });
      }
      if (active === 'all' || active === 'maps') {
        const list = s.mapsOwned.map(o => DAT.getMap(o.id)).filter(Boolean);
        list.forEach(it => {
          shown++;
          grid.appendChild(card(it.icon || '🗺', it.name, 'Escenario',
            s.map === it.id,
            s.map === it.id ? [] : [{ label: 'Usar', cb: () => { SAVE.equip('map', it.id); drawGrid(); refreshHome(); } }]));
        });
      }
      if (active === 'all' || active === 'tools') {
        const repairables = DAT.TOOLS.filter(t => SAVE.itemCount(t.key) > 0 && SAVE.toolDurInfo(t.key).missing > 0);
        if (repairables.length) {
          const total = repairables.reduce((acc, t) => acc + SAVE.toolRepairCost(t.key), 0);
          const box = document.createElement('div');
          box.className = 'inv-repair-all';
          const allBtn = document.createElement('button');
          allBtn.className = 'chip chip-repair';
          allBtn.textContent = '🔧 Reparar todas (' + repairables.length + ') · ' + total + ' 🪙';
          allBtn.onclick = () => {
            SND.sfx.click();
            confirmAction('Reparar herramientas',
              'Se intentarán reparar ' + repairables.length + ' herramienta' + (repairables.length === 1 ? '' : 's') +
              ' por ' + total + ' 🪙 en total.\nSaldo actual: ' + SAVE.get().coins + ' 🪙. Si no alcanza, se repararán solo las que puedas pagar.',
              () => {
                let spent = 0, done = 0;
                repairables.forEach(t => {
                  const r = SAVE.repairTool(t.key);
                  if (r.ok) { spent += r.price; done++; }
                });
                if (!done) { SND.sfx.deny(); toast('No tienes monedas suficientes para reparar 💤', ''); return; }
                SND.sfx.buy();
                toast('🔧 ' + done + ' herramienta' + (done === 1 ? '' : 's') + ' reparada' + (done === 1 ? '' : 's') + ' · -' + spent + ' 🪙', 'good');
                renderInventory(active);
                refreshHome();
              });
          };
          box.appendChild(allBtn);
          grid.appendChild(box);
        }
        DAT.TOOLS.forEach(t => {
          const count = SAVE.itemCount(t.key);
          if (!count) return;
          shown++;
          const d = SAVE.toolDurInfo(t.key);
          const lv = SAVE.toolLevel(t.key);
          const sub = (d.broken ? '🔧 Rota · ' : '🔧 ' + Math.round(d.cur) + '/' + d.max + ' · ') +
            (t.permanent ? '♾ permanente' : 'x' + count) + (lv ? ' · ⭐' + lv : '') + ' · ' + (SAVE.toolModeVal(t.key) === 'manual' ? 'manual' : 'auto');
          const acts = [];
          if (d.missing > 0) {
            acts.push({
              label: '🔧 Reparar · ' + SAVE.toolRepairCost(t.key), style: 'chip-repair',
              cb: () => confirmAction('Reparar ' + t.name,
                'Coste: ' + SAVE.toolRepairCost(t.key) + ' 🪙 · Saldo: ' + SAVE.get().coins + ' 🪙\nRecuperará ' + Math.round(d.missing) + ' puntos de durabilidad.',
                () => {
                  const r = SAVE.repairTool(t.key);
                  if (!r.ok) { SND.sfx.deny(); toast(r.msg === 'no_money' ? 'No tienes suficientes monedas 💤' : 'No necesita reparación', ''); return; }
                  SND.sfx.buy(); toast('🔧 ' + t.name + ' reparada · -' + r.price + ' 🪙', 'good');
                  renderInventory(active); refreshHome();
                })
            });
          }
          if (t.exclusive) {
            // La Reliquia no se vende en la tienda: su mejora se gestiona aquí.
            const tlv = SAVE.toolLevel(t.key);
            if (tlv < 5) {
              acts.push({
                label: '⬆ Nv ' + tlv + '→' + (tlv + 1) + ' · ' + SAVE.toolUpPrice(t.key) + ' 🪙' +
                  (SAVE.toolUpParts(t.key) ? ' + ' + SAVE.toolUpParts(t.key) + ' 🔩' : ''),
                cb: () => {
                  const st = SAVE.toolStats(t.key);
                  confirmAction('Mejorar ' + t.name,
                    'Nivel ' + st.now.level + ' → ' + st.next.level + '\n' +
                    'Durabilidad máx: ' + st.now.max + ' → ' + st.next.max + '\n' +
                    'Coste: ' + st.price + ' 🪙' + (st.parts ? ' + ' + st.parts + ' 🔩' : '') + '\n' +
                    'Tienes: ' + SAVE.get().coins + ' 🪙 · ' + SAVE.partsCount() + ' 🔩',
                    () => {
                      const res = SAVE.upToolLevel(t.key);
                      if (!res.ok) {
                        SND.sfx.deny();
                        if (res.msg === 'no_parts') toast('Faltan piezas 🔩 (' + res.parts + ' necesarias)', '');
                        else toast('No tienes suficientes monedas 💤', '');
                        return;
                      }
                      SND.sfx.buy();
                      FX.confetti(400, 150);
                      toast('⬆ ' + t.name + ' nivel ' + res.level + ' · durabilidad ' + res.max, 'good');
                      renderInventory(active); refreshHome();
                    });
                }
              });
            }
          } else {
            acts.push({ label: '⬆ Mejorar', cb: () => openGeneric('shop', 'tools') });
          }
          const c = card(t.icon, t.name, sub, false, acts);          const bar = document.createElement('div');
          bar.className = 'td-bar inv-dur' + (d.broken ? ' broken' : d.pct <= 25 ? ' low' : '');
          bar.innerHTML = '<i style="width:' + d.pct + '%"></i>';
          c.appendChild(bar);
          grid.appendChild(c);
        });
        if (!shown) grid.appendChild(emptyNote('No tienes herramientas. Cómpralas en Tienda → Herramientas.'));
      }
      if (active === 'all') {
        const eggs = SAVE.eggIncubating();
        if (eggs.length) {
          const box = document.createElement('div');
          box.className = 'inv-sub';
          box.innerHTML = '<h3>🥚 INCUBADORA</h3>';
          eggs.forEach(e => {
            const line = document.createElement('div');
            line.className = 'inv-line';
            line.innerHTML = '<span>🥚 ' + esc((DAT.getEgg(e.id) || {}).name || 'Huevo') + '</span><span>' + (e.done ? '🐣 listo' : fmtLeft(e.leftMs)) + '</span>';
            box.appendChild(line);
          });
          grid.appendChild(box);
        }
        const dec = s.nest.decorOwned || [];
        if (dec.length) {
          const box = document.createElement('div');
          box.className = 'inv-sub';
          box.innerHTML = '<h3>🪺 DECORACIÓN</h3>';
          dec.forEach(id => {
            const d = DAT.getDecor(id);
            if (!d) return;
            const line = document.createElement('div');
            line.className = 'inv-line';
            line.innerHTML = '<span>' + esc(d.name) + '</span><span>' + esc(d.cat) + '</span>';
            box.appendChild(line);
          });
          grid.appendChild(box);
        }
      }
      if (!shown && active !== 'all') grid.appendChild(emptyNote('Nada por aquí todavía.'));
    }

    function emptyNote(txt) {
      const d = document.createElement('div');
      d.className = 'panel-note';
      d.textContent = txt;
      return d;
    }

    function drawHistory() {
      const list = SAVE.getHistory();
      history.innerHTML = '<h3>🧾 HISTORIAL RECIENTE</h3>';
      if (!list.length) {
        history.innerHTML += '<div class="panel-note">Sin compras ni mejoras todavía.</div>';
        return;
      }
      list.slice(0, 12).forEach(h => {
        const row = document.createElement('div');
        row.className = 'hist-row h-' + (h.k || 'otros');
        const ico = h.k === 'mejora' ? '⬆' : h.k === 'reparacion' ? '🔧' : h.k === 'rotura' ? '💥' : '🛒';
        row.innerHTML = '<span class="hist-ico">' + ico + '</span><span class="hist-name">' + esc(h.n) + '</span>' +
          '<span class="hist-d">' + esc(h.d || '') + '</span><span class="hist-t">' + fmtDate(h.t) + '</span>';
        history.appendChild(row);
      });
    }

    drawTabs();
    body.appendChild(tabs);
    body.appendChild(grid);
    body.appendChild(history);
    drawGrid();
    drawHistory();

    const note = document.createElement('div');
    note.className = 'panel-note';
    note.textContent = 'Las herramientas rotas no se consumen ni se pierden: sigue en tu bolsa hasta que la repares. El desgaste baja con cada uso y la mejora aumenta la durabilidad máxima.';
    body.appendChild(note);
  }

  /* ---------- ESTADÍSTICAS ---------- */
  function renderStats() {
    const body = $('genBody');
    body.innerHTML = '';
    const s = SAVE.get();
    const st = s.stats || {};
    const numOr = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
    const mins = Math.floor(numOr(st.timePlayed) / 60);
    const timeTxt = mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min' : mins + ' min';
    const rows = [
      ['🏆 Mejor puntuación', numOr(st.best)],
      ['✈️ Vuelos', numOr(st.flights)],
      ['🎯 Tubos superados', numOr(st.pipes)],
      ['📏 Distancia total', Math.floor(numOr(st.dist)) + ' m'],
      ['🪙 Monedas recogidas', numOr(st.coinsGot)],
      ['💸 Monedas gastadas', numOr(st.spent)],
      ['🛠 Herramientas usadas', numOr(st.toolsUsed)],
      ['👆 Herramientas manuales', numOr(st.manualUses)],
      ['⬆ Mejoras compradas', numOr(st.upgs)],
      ['🔧 Reparaciones', numOr(st.toolsRepaired)],
      ['🔩 Piezas ganadas', numOr(st.partsEarned)],
      ['🛡 Escudos absorbidos', numOr(st.shieldAbsorbed)],
      ['👾 Enemigos esquivados', numOr(st.enemiesGot)],
      ['🌟 Poderes recogidos', numOr(st.powersGot)],
      ['🏅 Logros', (s.achieved || []).length],
      ['📋 Misiones completadas', numOr(st.missionsDone)],
      ['🌙 Desafíos jugados', numOr(st.challengePlayed)],
      ['⚔️ Duelos ganados', numOr(st.duelWins)],
      ['👹 Jefes derrotados', numOr(st.bossDefeated)],
      ['💨 Tramos de viento', numOr(st.windZones)],
      ['🧘 Mejor marca Zen', numOr(st.zenBest) + ' m'],
      ['⏱ Tiempo de vuelo', timeTxt]
    ];

    const grid = document.createElement('div');
    grid.className = 'stats-cards';
    rows.forEach(r => {
      const d = document.createElement('div');
      d.className = 'stat-card';
      d.innerHTML = '<span class="sc-l">' + r[0] + '</span><b class="sc-v">' + r[1] + '</b>';
      grid.appendChild(d);
    });
    body.appendChild(grid);

    const top = document.createElement('div');
    top.className = 'inv-sub';
    top.innerHTML = '<h3>🏅 TUS MEJORES VUELOS</h3>';
    const best3 = (s.best3 || []).slice(0, 3);
    if (!best3.length) top.innerHTML += '<div class="panel-note">Juega tu primer vuelo para ver marcas aquí.</div>';
    best3.forEach((r, i) => {
      const line = document.createElement('div');
      line.className = 'inv-line';
      line.innerHTML = '<span>' + (i + 1) + '. ' + r.score + ' pts</span><span>' + fmtDate(r.t) + '</span>';
      top.appendChild(line);
    });
    body.appendChild(top);

    const note = document.createElement('div');
    note.className = 'panel-note';
    note.textContent = 'Estas cifras salen directamente del progreso guardado en este navegador. Se actualizan al terminar cada vuelo.';
    body.appendChild(note);
  }

  /* ---------- AYUDA ---------- */
  function renderHelp() {
    const body = $('genBody');
    body.innerHTML = '';
    const sec = (title, html) => {
      const d = document.createElement('div');
      d.className = 'help-sec';
      d.innerHTML = '<h3>' + title + '</h3>' + html;
      body.appendChild(d);
    };
    sec('🐤 Cómo jugar', '<ul>' +
      '<li>Toca la pantalla o pulsa <kbd>Espacio</kbd> / <kbd>↑</kbd> para aletear.</li>' +
      '<li>Pasa entre los tubos: cada uno suma puntos y distancia.</li>' +
      '<li>Recoge monedas 🪙 y poderes; esquiva enemigos y obstáculos.</li>' +
      '<li>Al chocar termina el vuelo y se guardan monedas, XP, piezas y récord.</li>' +
      '</ul>');
    sec('🎮 Modos', '<ul>' +
      '<li><b>Libre</b>: el clásico sin límite de tiempo.</li>' +
      '<li><b>Duelo</b>: compite contra la marca de otro jugador.</li>' +
      '<li><b>Desafío diario</b>: una partida especial al día.</li>' +
      '<li><b>Zen</b>: sin monedas, solo tu mejor distancia.</li>' +
      '<li><b>Jefe</b> y <b>Viento</b>: variantes con enemigos y corrientes.</li>' +
      '</ul>');
    sec('🛠 Herramientas y durabilidad', '<ul>' +
      '<li>Se compran en la tienda y se activan en <b>auto</b> al empezar o en <b>manual</b> desde la barra del HUD.</li>' +
      '<li>Cada uso consume 1 unidad y desgasta la herramienta.</li>' +
      '<li>Si llega a 0 queda <b>rota</b>: no se gasta ni se pierde, pero no funciona hasta repararla.</li>' +
      '<li><b>Mejorar</b> sube la durabilidad máxima y reduce el desgaste; los niveles altos piden piezas 🔩.</li>' +
      '</ul>');
    sec('🔩 Piezas y economía', '<ul>' +
      '<li>Ganas 1 pieza por vuelo, +1 al llegar a 20 puntos y +1 si bates tu récord.</li>' +
      '<li>Los precios de la tienda ya incluyen el reequilibrio de la Temporada 2026.</li>' +
      '<li>Nunca puedes gastar más de lo que tienes: las compras se validan antes de cobrar.</li>' +
      '</ul>');
    sec('⚙️ Ajustes', '<ul>' +
      '<li>Volumen general, efectos y música; sensibilidad, límite de FPS y pantalla completa.</li>' +
      '<li>Notificaciones, animaciones de interfaz y confirmación de compras.</li>' +
      '<li>Todo se guarda al instante en este dispositivo.</li>' +
      '</ul>');
    sec('💾 Guardado', '<p>El progreso se guarda en <b>localStorage</b> de este navegador. Si borras los datos del sitio o usas modo incógnito, se pierde. No hay cuentas ni servidores.</p>');

    const actions = document.createElement('div');
    actions.className = 'help-actions';
    const b1 = document.createElement('button');
    b1.className = 'btn'; b1.textContent = '📦 Abrir inventario';
    b1.onclick = () => { SND.sfx.click(); openGeneric('inventory'); };
    const b2 = document.createElement('button');
    b2.className = 'btn'; b2.textContent = '⚙️ Ajustes';
    b2.onclick = () => { SND.sfx.click(); openGeneric('settings'); };
    actions.appendChild(b1); actions.appendChild(b2);
    body.appendChild(actions);
  }

  function renderSettings() {
    const body = $('genBody');
    const s = SAVE.get();
    body.innerHTML = '';
    const groupTitle = (t) => {
      const g = document.createElement('div');
      g.className = 'set-group';
      g.innerHTML = '<div class="set-group-title">' + t + '</div>';
      return g;
    };

    const gSound = groupTitle('🎧 Sonido');
    gSound.appendChild(switchRow('🔊 Sonido', 'sfx', s.set.sfx, v => {
      SND.setSfx(v);
      if (v) SND.sfx.click();
      else toast('Sonido desactivado', 'info');
    }));
    gSound.appendChild(switchRow('🎵 Música', 'music', s.set.music, v => {
      if (v) { SND.setMusic(true); SND.sfx.level(); }
      else { SND.setMusic(false); toast('Música desactivada', 'info'); }
    }));
    gSound.appendChild(sliderRow('🔊 Volumen efectos', 'volS', s.set.volS, v => {
      SND.setSfxVol(v);
      if (v > 0.05) SND.sfx.click();
    }));
    gSound.appendChild(sliderRow('🎵 Volumen música', 'volM', s.set.volM, v => {
      SND.setMusicVol(v);
    }));
    gSound.appendChild(sliderRow('🔉 Volumen general', 'volG', s.set.volG, v => {
      if (SND.setMasterVol) SND.setMasterVol(v);
      if (v > 0.05) SND.sfx.click();
    }));
    body.appendChild(gSound);

    const gCom = groupTitle('🛋 Comodidad');
    gCom.appendChild(switchRow('📳 Vibración', 'vib', s.set.vib, v => {
      if (v && navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { } }
      else toast('Vibración desactivada', 'info');
    }));
    gCom.appendChild(switchRow('💥 Sacudida de pantalla', 'shake', s.set.shake !== false, v => {
      if (!v) FX.shake(0);
      toast(v ? 'Sacudida activada' : 'Sacudida desactivada', 'info');
    }));
    gCom.appendChild(switchRow('♿ Reducir movimiento', 'reduced', s.set.reduced === true, v => {
      FX.setReduced(v);
      toast(v ? 'Movimiento reducido (accesibilidad)' : 'Movimiento completo', 'info');
    }));
    gCom.appendChild(switchRow('🔔 Notificaciones', 'notif', s.set.notif !== false, v => {
      toast(v ? 'Avisos informativos activados' : 'Avisos informativos silenciados (los errores siguen apareciendo)', 'info');
    }));
    gCom.appendChild(switchRow('🎞 Animaciones de interfaz', 'uiAnim', s.set.uiAnim !== false, v => {
      document.body.classList.toggle('no-ui-anim', !v);
      toast(v ? 'Animaciones de interfaz activadas' : 'Animaciones de interfaz desactivadas', 'info');
    }));
    gCom.appendChild(switchRow('🛒 Confirmar compras', 'confirmBuy', s.set.confirmBuy === true, v => {
      toast(v ? 'Se pedirá confirmación antes de comprar' : 'Compras directas (sin confirmación)', 'info');
    }));
    body.appendChild(gCom);

    const gCtrl = groupTitle('🐤 Control');
    gCtrl.appendChild(sliderRow('👆 Sensibilidad de aleteo', 'sens', s.set.sens, v => {
      toast('Sensibilidad: ' + Math.round(v * 100) + '%', 'info');
    }, { min: 0.5, max: 1.5, step: 0.05, format: v => Math.round(v * 100) + '%' }));
    gCtrl.appendChild(switchRow('👆 Flap al soltar', 'lift', s.set.lift === true, v => {
      toast(v ? 'Flap también al soltar el dedo' : 'Flap solo al tocar', 'info');
    }));
    gCtrl.appendChild(switchRow('🌙 Gravedad lunar', 'moon', s.set.moon === true, v => {
      toast(v ? 'Caes más suave: ¡modo luna! 🌙' : 'Gravedad normal', 'info');
    }));
    gCtrl.appendChild(switchRow('🗿 Contraste alto', 'hc', s.set.hc === true, v => {
      ENTS.setHC(v);
      toast(v ? 'Bordes más definidos' : 'Contraste normal', 'info');
    }));
    body.appendChild(gCtrl);

    const gGame = groupTitle('🎯 Juego');
    const difRow = document.createElement('div');
    difRow.className = 'set-row';
    difRow.innerHTML = '<span>🎯 Dificultad</span>';
    const pick = document.createElement('div');
    pick.className = 'set-pick';
    DAT.DIFFS.forEach(d => {
      const b = document.createElement('button');
      b.textContent = d.name;
      b.className = s.set.diff === d.id ? 'active' : '';
      b.onclick = () => {
        SAVE.setSetting('diff', d.id);
        renderSettings();
        SND.sfx.click();
        toast('Dificultad: ' + d.name + ' (para tu próximo vuelo)', 'info');
      };
      pick.appendChild(b);
    });
    difRow.appendChild(pick);
    gGame.appendChild(difRow);

    const gfxRow = document.createElement('div');
    gfxRow.className = 'set-row';
    gfxRow.innerHTML = '<span>✨ Efectos visuales</span>';
    const pick2 = document.createElement('div');
    pick2.className = 'set-pick';
    [['low', 'Bajo'], ['medium', 'Medio'], ['high', 'Alto']].forEach(g => {
      const b = document.createElement('button');
      b.textContent = g[1];
      b.className = s.set.gfx === g[0] ? 'active' : '';
      b.onclick = () => {
        SAVE.setSetting('gfx', g[0]);
        renderSettings();
        SND.sfx.click();
        toast('Efectos visuales: ' + g[1], 'info');
      };
      pick2.appendChild(b);
    });
    gfxRow.appendChild(pick2);
    gGame.appendChild(gfxRow);

    // Límite de FPS (0 = automático). Se aplica en el bucle real del juego.
    const fpsRow = document.createElement('div');
    fpsRow.className = 'set-row';
    fpsRow.innerHTML = '<span>🖥 Límite de FPS</span>';
    const fpsPick = document.createElement('div');
    fpsPick.className = 'set-pick';
    [0, 30, 60, 120].forEach(f => {
      const b = document.createElement('button');
      b.textContent = f ? String(f) : 'Auto';
      b.className = ((s.set.fps | 0) === f) ? 'active' : '';
      b.onclick = () => {
        SAVE.setSetting('fps', f);
        renderSettings();
        SND.sfx.click();
        toast(f ? 'FPS limitados a ' + f : 'FPS automáticos (sin límite artificial)', 'info');
      };
      fpsPick.appendChild(b);
    });
    fpsRow.appendChild(fpsPick);
    gGame.appendChild(fpsRow);
    const fpsNote = document.createElement('div');
    fpsNote.className = 'set-note';
    fpsNote.textContent = 'La sincronización vertical y la resolución dependen del navegador o del dispositivo. El límite de FPS sí se aplica; no se muestran controles que no se puedan cumplir.';
    gGame.appendChild(fpsNote);

    // Pantalla completa real (si el navegador la permite)
    const fsRow = document.createElement('div');
    fsRow.className = 'set-row';
    fsRow.appendChild(Object.assign(document.createElement('span'), { textContent: '🖵 Pantalla completa' }));
    const fsWrap = document.createElement('div');
    fsWrap.className = 'set-pick';
    const fsBtn = document.createElement('button');
    const fsSupported = !!(document.documentElement && document.documentElement.requestFullscreen);
    fsBtn.textContent = (!fsSupported) ? 'No disponible' : (document.fullscreenElement ? 'Salir' : 'Activar');
    fsBtn.disabled = !fsSupported;
    fsBtn.onclick = () => {
      if (!fsSupported) return;
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => toast('El navegador bloqueó la pantalla completa', 'warning'));
      } catch (e) {
        toast('Pantalla completa no disponible aquí', 'warning');
      }
      setTimeout(() => { try { renderSettings(); } catch (e) { } }, 350);
    };
    fsWrap.appendChild(fsBtn);
    fsRow.appendChild(fsWrap);
    gGame.appendChild(fsRow);

    // Idioma: solo español por ahora (se muestra deshabilitado, sin simularlo)
    const langRow = document.createElement('div');
    langRow.className = 'set-row disabled';
    langRow.innerHTML = '<span>🌐 Idioma</span>';
    const langWrap = document.createElement('div');
    langWrap.className = 'set-pick';
    const langBtn = document.createElement('button');
    langBtn.textContent = 'Español (único)';
    langBtn.disabled = true;
    langBtn.className = 'active';
    langWrap.appendChild(langBtn);
    langRow.appendChild(langWrap);
    gGame.appendChild(langRow);
    const langNote = document.createElement('div');
    langNote.className = 'set-note';
    langNote.textContent = 'Este juego solo incluye textos en español. No se muestra un selector falso de idiomas.';
    gGame.appendChild(langNote);
    body.appendChild(gGame);

    const gData = groupTitle('💾 Datos');
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-danger';
    resetBtn.style.marginTop = '2px';
    resetBtn.textContent = '🗑 Reiniciar todo el progreso';
    resetBtn.onclick = () => {
      SND.sfx.click();
      confirm('¿Reiniciar progreso?', 'Se borrarán monedas, aves, mapas y logros. Esta acción no se puede deshacer.',
        [
          { label: 'Cancelar', cb: () => { } },
          { label: 'Sí, borrar', style: 'btn-danger', cb: () => { SAVE.reset(); SND.stopMusic(); location.reload(); } }
        ]);
    };
    gData.appendChild(resetBtn);
    const defSet = document.createElement('button');
    defSet.className = 'btn btn-ghost';
    defSet.style.marginTop = '8px';
    defSet.textContent = '↩ Restaurar ajustes predeterminados';
    defSet.onclick = () => {
      SND.sfx.click();
      confirmAction('Restaurar ajustes', 'Volverán el volumen, control, efectos y accesibilidad a sus valores de fábrica. El progreso NO se borra.', () => {
        const st = SAVE.resetSettings();
        SND.setSfx(st.sfx); SND.setMusic(st.music);
        SND.setVolumes(st.volS, st.volM);
        if (SND.setMasterVol) SND.setMasterVol(st.volG);
        FX.setReduced(!!st.reduced); ENTS.setHC(!!st.hc);
        document.body.classList.toggle('no-ui-anim', st.uiAnim === false);
        renderSettings();
        toast('↩ Ajustes restaurados', 'good');
      });
    };
    gData.appendChild(defSet);

    // Copia de seguridad manual del progreso (exportar / importar JSON local)
    const expBtn = document.createElement('button');
    expBtn.className = 'btn btn-ghost';
    expBtn.style.marginTop = '8px';
    expBtn.textContent = '📤 Exportar copia del progreso';
    expBtn.onclick = () => {
      SND.sfx.click();
      try {
        const blob = new Blob([SAVE.exportData()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pio-vuelo-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } }, 2000);
        toast('📤 Copia exportada al dispositivo', 'good');
      } catch (e) {
        toast('No se pudo exportar el progreso en este navegador', 'warning');
      }
    };
    gData.appendChild(expBtn);

    const impBtn = document.createElement('button');
    impBtn.className = 'btn btn-ghost';
    impBtn.style.marginTop = '8px';
    impBtn.textContent = '📥 Importar copia del progreso';
    impBtn.onclick = () => {
      SND.sfx.click();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          confirm('Importar progreso', 'Se reemplazará el progreso actual por el de la copia. Se guarda una copia de seguridad antes de importar y la página se recargará.', [
            { label: 'Cancelar', cb: () => { } },
            {
              label: 'Importar', style: 'btn-play', cb: () => {
                const r = SAVE.importData(reader.result);
                if (!r.ok) {
                  SND.sfx.deny();
                  toast(r.msg === 'storage' ? 'No se pudo escribir en el almacenamiento' : 'El archivo no es una copia válida de Pío Vuelo', 'warning');
                  return;
                }
                toast('📥 Progreso importado · recargando…', 'good');
                setTimeout(() => { try { location.reload(); } catch (e) { } }, 600);
              }
            }
          ]);
        };
        reader.onerror = () => toast('No se pudo leer el archivo', 'warning');
        reader.readAsText(f);
      };
      document.body.appendChild(input);
      input.click();
    };
    gData.appendChild(impBtn);

    const saveInfo = document.createElement('div');
    saveInfo.className = 'set-note';
    saveInfo.textContent = (SAVE.lastSaveError() ? '⚠️ El último guardado falló. Revisa el almacenamiento del navegador. ' : '💾 Guardado local activo (localStorage) · se guarda al cambiar cualquier ajuste y al terminar cada vuelo. ') +
      'Usa Exportar para conservar una copia fuera del navegador.';
    gData.appendChild(saveInfo);
    body.appendChild(gData);

    const about = document.createElement('div');
    about.className = 'prog-card';
    about.style.textAlign = 'center';
    about.innerHTML = '<h3>ACERCA DE</h3><div style="font-size:13px;color:#dbe7ff">Pío Vuelo v3.1 · Temporada ' + DAT.seasonInfo().name + ' 🌍<br>Toca la pantalla para volar y esquivar obstáculos.<br><b style="color:#ffe066">Creado por Joseph Games</b> 🐤</div>';
    body.appendChild(about);
  }

  function switchRow(label, key, initVal, onChange) {
    const row = document.createElement('div');
    row.className = 'set-row';
    row.innerHTML = '<span>' + label + '</span><div class="switch' + (initVal ? ' on' : '') + '" id="sw-' + key + '"></div>';
    const sw = row.querySelector('.switch');
    sw.onclick = () => {
      const on = !sw.classList.contains('on');
      sw.classList.toggle('on', on);
      SAVE.setSetting(key, on);
      onChange(on);
      SND.sfx.click();
    };
    return row;
  }

  function sliderRow(label, key, initVal, onChange, opts) {
    opts = opts || {};
    const row = document.createElement('div');
    row.className = 'set-row';
    row.innerHTML = '<span>' + label + '</span>';
    const wrap = document.createElement('div');
    wrap.className = 'set-slider';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(opts.min === undefined ? 0 : opts.min);
    input.max = String(opts.max === undefined ? 1 : opts.max);
    input.step = String(opts.step === undefined ? 0.05 : opts.step);
    input.value = String(initVal);
    const val = document.createElement('span');
    val.className = 'set-val';
    const fmt = v => opts.format ? opts.format(v) : Math.round(v * 100) + '%';
    val.textContent = fmt(initVal);
    input.oninput = () => {
      const v = parseFloat(input.value);
      val.textContent = fmt(v);
      SAVE.setSetting(key, v);
      onChange(v);
    };
    wrap.appendChild(input);
    wrap.appendChild(val);
    row.appendChild(wrap);
    return row;
  }

  /* ---------- MISIONES 📋 ---------- */
  function renderMissions() {
    const body = $('genBody');
    body.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'prog-card';
    head.style.textAlign = 'center';
    const done = (SAVE.get().stats.missionsDone || 0);
    head.innerHTML = '<h3>MISIONES DIARIAS Y SEMANALES</h3><div style="font-size:13px;color:#dbe7ff">Completa misiones y reclama monedas 🪙. <b>Hechas: ' + done + '</b></div>';
    body.appendChild(head);

    DAT.MISSIONS.forEach(m => {
      const isW = !!m.weekly;
      const cur = SAVE.missionProgress(m);
      const target = m.target;
      const pct = Math.min(100, Math.round(cur / target * 100));
      const claimed = SAVE.missionDoneToday(m);
      const card = document.createElement('div');
      card.className = 'prog-card';
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<b style="color:#ffe066">' + (isW ? '🎖 ' : '📌 ') + m.name + '</b>' +
        '<span style="font-size:13px;color:#dbe7ff">' + cur + ' / ' + target + '</span></div>' +
        '<div style="font-size:12px;color:#bcd0ff">' + m.desc + '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>';
      const btn = document.createElement('button');
      btn.className = 'btn ' + (claimed ? 'btn-ghost' : pct >= 100 ? '' : 'btn-ghost');
      btn.disabled = claimed || pct < 100;
      btn.textContent = claimed ? '✓ Reclamada' : (pct >= 100 ? 'Reclamar +' + m.reward + ' 🪙' : 'Faltan ' + (target - cur));
      btn.onclick = () => {
        const r = SAVE.claimMission(m);
        if (r) { toast('¡Misión completada! +' + r.reward + ' 🪙', 'good'); SND.sfx.level(); renderMissions(); refreshHome(); }
        SAVE.checkAch().forEach(a => popAch(a));
      };
      card.appendChild(btn);
      body.appendChild(card);
    });
  }

  /* ---------- PASE DE VUELO 🎫 ---------- */
  function passRewardIco(t) {
    if (t.reward.item) {
      const tk = DAT.TOOLS.find(x => x.key === t.reward.item);
      return { icon: tk ? tk.icon : '🎒', name: tk ? tk.name : t.reward.item, n: t.reward.n };
    }
    if (t.reward.hat) { const h = DAT.getHat(t.reward.hat); return { icon: '👒', name: h ? h.name : 'Sombrero', n: 1 }; }
    if (t.reward.fx) { const f = DAT.getFx(t.reward.fx); return { icon: '✨', name: f ? f.name : 'Estela', n: 1 }; }
    if (t.reward.map) { const m = DAT.getMap(t.reward.map); return { icon: '🗺', name: m ? m.name : 'Mapa', n: 1 }; }
    if (t.reward.skin) { const sk = DAT.getSkin(t.reward.skin); return { icon: '🐤', name: sk ? sk.name : 'Ave', n: 1 }; }
    if (t.reward.parts) return { icon: '🔩', name: t.reward.parts + ' piezas', n: 1 };
    if (t.reward.shields) return { icon: '🛡️', name: t.reward.shields + ' escudos', n: 1 };
    return { icon: '🪙', name: (t.reward.coins || 0) + ' monedas', n: 1 };
  }

  function passTrack(title, tiers, reached, claimedList, claimFn, premium, active) {
    const wrap = document.createElement('div');
    wrap.className = 'pass-block' + (premium ? ' premium' : '');
    const head = document.createElement('div');
    head.className = 'pass-block-head';
    const claimable = tiers.reduce((n, t, idx) => n + (reached > idx && claimedList.indexOf(idx) === -1 ? 1 : 0), 0);
    head.innerHTML = '<span class="pass-block-t">' + (premium ? '💎 ' : '🎫 ') + title + '</span>' +
      '<span class="pass-block-sub">' + reached + '/' + tiers.length + (premium && !active ? ' · bloqueada' : '') + '</span>';
    if (claimable > 0) {
      const all = document.createElement('button');
      all.className = 'btn btn-small pass-all';
      all.textContent = 'Reclamar todo (' + claimable + ')';
      all.onclick = () => {
        let n = 0;
        for (let idx = 0; idx < tiers.length; idx++) {
          if (reached > idx && claimedList.indexOf(idx) === -1 && claimFn(idx)) n++;
        }
        if (n) { SND.sfx.level(); toast('+' + n + ' recompensas reclamadas', 'good'); renderPass(); refreshHome(); }
        SAVE.checkAch().forEach(a => popAch(a));
      };
      head.appendChild(all);
    }
    wrap.appendChild(head);

    const track = document.createElement('div');
    track.className = 'pass-track';
    const scroll = document.createElement('div');
    scroll.className = 'pass-track-scroll';
    const curI = reached - 1;
    tiers.forEach((t, idx) => {
      const claimed = claimedList.indexOf(idx) !== -1;
      const can = active && !claimed && reached > idx;
      const rw = passRewardIco(t);
      const isExcl = !!(t.reward.skin || t.reward.hat || t.reward.fx || t.reward.map || t.reward.item === 'legend');
      const cell = document.createElement('button');
      cell.className = 'pass-cell' + (claimed ? ' claimed' : '') + (can ? ' avail' : '') + (idx === curI ? ' cur' : '') +
        (premium ? ' prem' : '') + (isExcl ? ' excl' : '');
      cell.disabled = claimed || !can;
      cell.innerHTML =
        '<div class="pass-cell-ico">' + rw.icon + (rw.n > 1 ? '<b>×' + rw.n + '</b>' : '') + '</div>' +
        '<div class="pass-cell-xp">' + t.xp + ' XP</div>' +
        '<div class="pass-cell-name">' + rw.name + '</div>' +
        (claimed ? '<div class="pass-cell-st ok">✓</div>'
          : (can ? '<div class="pass-cell-st">Reclamar</div>'
            : (premium && !active ? '<div class="pass-cell-st lock">🎫</div>' : '<div class="pass-cell-st lock">🔒</div>')));
      cell.onclick = () => {
        if (premium && !active) { toast('Desbloquea el Pase Prémium para reclamar esta línea', 'info'); return; }
        if (idx >= reached) { toast('Necesitas ' + t.xp + ' XP (te faltan ' + (t.xp - SAVE.totalXp()) + ')', 'info'); return; }
        const r = claimFn(idx);
        if (r) {
          toast(r.converted ? 'Ya tenías esa recompensa: +250 🪙' : '¡Recompensa ' + (premium ? 'prémium' : 'del Pase') + '! 🎫', 'good');
          SND.sfx.level();
          renderPass();
          refreshHome();
        }
        SAVE.checkAch().forEach(a => popAch(a));
      };
      scroll.appendChild(cell);
    });
    track.appendChild(scroll);
    wrap.appendChild(track);
    return wrap;
  }

  function renderPass() {
    const body = $('genBody');
    body.innerHTML = '';
    const se = DAT.seasonInfo();
    const tiers = DAT.passTiers();
    const ptiers = DAT.passPremiumTiers();
    const xp = SAVE.totalXp();
    const tier = SAVE.passReached();
    const pc = SAVE.passClaimedCount();
    const active = SAVE.passPremiumActive();
    const ptier = SAVE.passPremiumReached();
    const ppc = SAVE.passPremiumClaimedCount();

    const head = document.createElement('div');
    head.className = 'prog-card';
    head.style.border = '2px solid ' + se.accent;
    head.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<span style="font-size:28px">' + se.pass.icon + ' ' + se.icon + '</span>' +
      '<div><h3 style="margin:0;color:' + se.accent + '">' + se.pass.name.toUpperCase() + '</h3>' +
      '<div style="font-size:12px;color:#dbe7ff">' + se.name + ' ' + DAT.seasonKey() + ' · ' + se.months + '</div></div></div>' +
      '<div style="font-size:20px;font-weight:900;color:#ffe066;margin:8px 0 4px">' + xp + ' XP' +
      '<span style="font-size:12px;color:#8aa0cc"> · Gratis nv ' + tier + '/' + tiers.length + ' · ' + pc + ' reclamadas</span></div>' +
      '<div class="pass-prog-bar"><div class="pass-prog-fill" style="width:' + Math.min(100, Math.round(tier / tiers.length * 100)) + '%"></div></div>' +
      '<div style="font-size:11px;color:#8aa0cc;margin-top:6px">⚡ El Pase y el Prémium rotan cada temporada real.</div>';
    body.appendChild(head);

    /* Tarjeta de compra / estado del Pase Prémium */
    const prem = document.createElement('div');
    prem.className = 'pass-premium-card' + (active ? ' active' : '');
    if (active) {
      prem.innerHTML =
        '<div class="ppc-top"><span class="ppc-ico">💎</span><div>' +
        '<div class="ppc-title">PASE PRÉMIUM ACTIVO</div>' +
        '<div class="ppc-sub">' + ptier + '/' + ptiers.length + ' niveles · ' + ppc + ' recompensas exclusivas reclamadas</div></div></div>' +
        '<div class="ppc-note">Las recompensas 💎 solo se consiguen aquí: no se venden en la tienda ni salen en cajas.</div>';
    } else {
      prem.innerHTML =
        '<div class="ppc-top"><span class="ppc-ico">💎</span><div>' +
        '<div class="ppc-title">PASE PRÉMIUM · ' + se.name + '</div>' +
        '<div class="ppc-sub">Desbloquea ' + ptiers.length + ' recompensas exclusivas de esta temporada.</div></div></div>' +
        '<div class="ppc-price"><span class="coin-ico"></span> ' + DAT.PASS_PREMIUM_PRICE + ' 🪙 · dura toda la temporada</div>' +
        '<div class="ppc-note">Aves, sombreros, estelas, herramientas y un mapa exclusivos. Al cambiar de temporada se vuelve a comprar.</div>';
      const buy = document.createElement('button');
      buy.className = 'btn ppc-buy';
      buy.textContent = '💎 DESBLOQUEAR PASE PRÉMIUM';
      buy.onclick = () => {
        const doBuy = () => {
          const res = SAVE.buyPassPremium();
          if (res.ok) {
            SND.sfx.buy();
            toast('¡Pase Prémium desbloqueado! 💎', 'good');
            renderPass();
            refreshHome();
            $('genCoins').textContent = SAVE.get().coins;
          } else if (res.msg === 'no_money') {
            SND.sfx.deny();
            toast('Necesitas ' + DAT.PASS_PREMIUM_PRICE + ' 🪙 (tienes ' + SAVE.get().coins + ')', '');
          } else if (res.msg === 'active') {
            toast('El Pase Prémium ya está activo esta temporada', 'info');
          }
        };
        if (SAVE.get().set.confirmBuy) {
          confirmAction('Pase Prémium ' + DAT.seasonKey(),
            'Precio: ' + DAT.PASS_PREMIUM_PRICE + ' 🪙 · Saldo: ' + SAVE.get().coins + ' 🪙\nSe activa para toda la temporada actual.', doBuy);
        } else doBuy();
      };
      prem.appendChild(buy);
    }
    body.appendChild(prem);

    body.appendChild(passTrack('Línea Gratuita', tiers, tier, SAVE.get().passClaimed, SAVE.claimPassTier, false, true));
    body.appendChild(passTrack('Línea Prémium', ptiers, ptier, SAVE.get().passPremiumClaimed, SAVE.claimPassPremiumTier, true, active));

    const note = document.createElement('div');
    note.className = 'panel-note';
    note.textContent = '🎫 Sube de nivel jugador para avanzar en ambas líneas. El Prémium no caduca a mitad de temporada, pero sí al cambiar de estación.';
    body.appendChild(note);
  }

  /* ---------- HOGAR: nido, incubadora y decoración ---------- */
  function renderHome(initialTab) {
    const body = $('genBody');
    const tabs = document.createElement('div');
    tabs.className = 'tabs shop-tabs';
    const cats = [['nest', '🪺', 'Nido'], ['eggs', '🥚', 'Huevos'], ['decor', '🎨', 'Decoración']];
    let activeTab = (initialTab && cats.some(c => c[0] === initialTab)) ? initialTab : 'nest';
    const mkTabs = () => {
      tabs.innerHTML = '';
      cats.forEach(c => {
        const b = document.createElement('button');
        b.className = 'tab' + (c[0] === activeTab ? ' active' : '');
        b.innerHTML = '<span class="tab-ico">' + c[1] + '</span><span class="tab-t">' + c[2] + '</span>';
        b.onclick = () => { activeTab = c[0]; SND.sfx.click(); mkTabs(); drawTab(); };
        tabs.appendChild(b);
      });
    };
    const drawTab = () => {
      body.querySelectorAll('.home-tab-body').forEach(x => x.remove());
      const tb = document.createElement('div');
      tb.className = 'home-tab-body';
      if (activeTab === 'nest') drawNestTab(tb);
      else if (activeTab === 'eggs') drawEggsTab(tb);
      else drawDecorTab(tb);
      body.appendChild(tb);
      $('genBody').scrollTop = 0;
    };
    body.appendChild(tabs);
    mkTabs();
    drawTab();
  }

  function drawNestTab(tb) {
    const s = SAVE.get();
    const ni = DAT.nestInfo(s.stats.coinsGot || 0);
    const cv = document.createElement('canvas');
    cv.width = 360; cv.height = 240;
    cv.style.cssText = 'width:100%;max-width:360px;margin:0 auto;display:block;border-radius:16px;';
    const c = cv.getContext('2d');
    drawNestScene(c, cv.width, cv.height, Date.now());
    tb.appendChild(cv);

    const info = document.createElement('div');
    info.className = 'panel-note';
    info.innerHTML =
      '<div class="nest-line"><span class="nest-ico">🪺</span><span class="nest-lvl">Nivel ' + (ni.level + 1) + ': ' + ni.name + '</span></div>' +
      '<div class="eggbar"><i style="width:' + ni.pct + '%"></i></div>' +
      '<div style="margin-top:6px;font-size:12px;color:#dbe7ff">' +
      'Cada moneda recogida en vuelo añade un objeto al nido (llevas <b>' + ni.objCount + '</b> de ' + DAT.NEST_MAX_OBJ + ').' +
      (ni.next ? '<br>Próximo nivel: <b>' + ni.next.name + '</b> con ' + ni.next.coins + ' monedas en vuelo.' : '<br>¡Nido legendario! 🎉') +
      '</div>';
    tb.appendChild(info);

    const note = document.createElement('div');
    note.className = 'panel-note';
    note.innerHTML = '🪺 El nido crece con tus vuelos y la incubadora funciona con tiempo real: los huevos eclosionan aunque no juegues.';
    tb.appendChild(note);
  }

  function drawEggsTab(tb) {
    const eggs = DAT.EGGS;
    const s = SAVE.get();
    // incubadora actual
    const incub = document.createElement('div');
    incub.className = 'panel-note';
    let html = '<div style="font-weight:900;color:#ffe066">🥚 INCUBADORA · ' + SAVE.eggSlotsFree() + ' hueco' + (SAVE.eggSlotsFree() === 1 ? '' : 's') + ' libre' + (SAVE.eggSlotsFree() === 1 ? '' : 's') + '</div>';
    const inc = SAVE.eggIncubating();
    if (!inc.length) {
      html += '<div style="font-size:12px;color:#dbe7ff;margin-top:4px">Sin huevos incubando. Compra uno abajo y vuelve cuando eclosione.</div>';
    } else {
      inc.forEach((e, i) => {
        const d = DAT.getEgg(e.id);
        html += '<div class="eggpill' + (e.done ? ' ready' : '') + '">' +
          '<span class="eggpill-ico">' + (e.done ? '🐣' : '🥚') + '</span>' +
          '<span class="eggpill-name">' + (d ? d.name : 'Huevo') + '</span>' +
          '<span class="eggbar sm"><i style="width:' + e.pct + '%"></i></span>' +
          (e.done
            ? '<button class="eggpill-btn" data-hatch="' + i + '">Eclosionar</button>'
            : '<span class="eggpill-time">' + fmtLeft(e.leftMs) + '</span>') +
          '</div>';
      });
    }
    incub.innerHTML = html;
    incub.querySelectorAll('[data-hatch]').forEach(b => {
      b.onclick = () => {
        SND.sfx.click();
        hatchEggAction(parseInt(b.getAttribute('data-hatch'), 10));
        renderHome('eggs');
      };
    });
    tb.appendChild(incub);

    // huevos a comprar
    const grid = document.createElement('div');
    grid.className = 'items';
    eggs.forEach(e => {
      const card = document.createElement('div');
      card.className = 'item';
      const can = s.coins >= e.price && SAVE.eggSlotsFree() > 0;
      card.innerHTML =
        '<div class="i-art" style="font-size:40px">' + e.icon + '</div>' +
        '<div class="i-name">' + e.name + '</div>' +
        '<div class="i-desc">' + e.desc + '</div>' +
        '<button class="i-price" style="' + (can ? '' : 'opacity:.5') + '">🥚 ' + e.price + ' 🪙</button>';
      card.querySelector('.i-price').onclick = () => {
        SND.sfx.click();
        if (SAVE.eggSlotsFree() <= 0) { SND.sfx.deny(); toast('Incubadora llena: eclosiona un huevo antes de comprar otro 🥚', 'info'); return; }
        if (s.coins < e.price) { SND.sfx.deny(); toast('No tienes suficientes monedas 💤', ''); return; }
        const doBuy = () => {
          const r = SAVE.buyEgg(e.id);
          if (r.ok) {
            toast('🥚 ' + e.name + ' incubando (' + e.mins + ' min) — vuelve luego para eclosionarlo', 'good');
            renderHome('eggs');
          } else {
            SND.sfx.deny();
            toast(r.msg === 'no_money' ? 'No tienes suficientes monedas 💤' : r.msg, '');
          }
        };
        if (s.set.confirmBuy) {
          confirmAction('Comprar ' + e.name,
            'Precio: ' + e.price + ' 🪙 · Saldo: ' + s.coins + ' 🪙\nIncubará durante ' + e.mins + ' min.', doBuy);
        } else doBuy();
      };
      grid.appendChild(card);
    });
    tb.appendChild(grid);
    const note = document.createElement('div');
    note.className = 'panel-note';
    note.textContent = 'Los huevos eclosionan en un ave o una estela que aún no tengas. Cuanto mejor sea el huevo, más tiempo incuba.';
    tb.appendChild(note);
  }

  function drawDecorTab(tb) {
    const s = SAVE.get();
    const cats = [['bg', '🖼️ Fondo'], ['floor', '🧺 Suelo'], ['poster', '🪧 Póster'], ['rug', '🧵 Alfombra']];
    cats.forEach(cat => {
      const sec = document.createElement('div');
      sec.className = 'shop-sec';
      sec.textContent = cat[1];
      tb.appendChild(sec);
      const grid = document.createElement('div');
      grid.className = 'items';
      DAT.decorsByCat(cat[0]).forEach(d => {
        const owned = SAVE.isDecorOwned(d.id);
        const equipped = s.nest.decor[cat[0]] === d.id;
        const card = document.createElement('div');
        card.className = 'item';
        card.innerHTML =
          '<div class="i-art" style="background:linear-gradient(165deg,' + d.bg1 + ', ' + d.bg2 + ')">' +
          '<span style="font-size:30px">' + (d.art || '⬜') + '</span></div>' +
          '<div class="i-name">' + d.name + '</div>' +
          '<button class="i-price" style="' + (owned ? '' : 'opacity:.85') + '">' +
          (equipped ? '✔ En uso' : owned ? 'Equipar' : d.price === 0 ? 'Gratis' : d.price + ' 🪙') +
          '</button>';
        card.querySelector('.i-price').onclick = () => {
          SND.sfx.click();
          const doBuy = () => {
            if (!owned) {
              if (s.coins < d.price) { SND.sfx.deny(); toast('No tienes suficientes monedas 💤', ''); return; }
              const r = SAVE.buyDecor(d.id);
              if (!r.ok) { SND.sfx.deny(); toast(r.msg === 'no_money' ? 'No tienes suficientes monedas 💤' : r.msg, ''); return; }
              toast('🎨 ¡Decoración comprada!', 'good');
            }
            SAVE.equipDecor(cat[0], d.id);
            refreshHome();
            renderHome('decor');
          };
          if (!owned && d.price > 0 && s.set.confirmBuy) {
            confirmAction('Comprar ' + d.name,
              'Precio: ' + d.price + ' 🪙 · Saldo: ' + s.coins + ' 🪙\nSe equipará en el nido.', doBuy);
          } else doBuy();
        };
        grid.appendChild(card);
      });
      tb.appendChild(grid);
    });
  }

  return {
    hideAllScreens, showLoading, showHome, refreshHome,
    setHudVisible, showStartHint, setPaused, setResumeCountdown, refreshHudTools, updateEffectTimers,
    showGameOver, showModeClear, toast, confirm, openGeneric, closeGeneric,
    showModePick, closeModePick, isModePickOpen,
    popAch,
    current: () => currentGeneric
  };
})();