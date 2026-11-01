/* PÍO VUELO · EXPANSIÓN v3.2 — INTERFAZ
 * Pantallas reales para personajes, mascotas, habilidades, eventos,
 * insignias/títulos/colecciones/maestría, herramientas legendarias,
 * personalización, liga semanal y selector de modos.
 *
 * Consume los catálogos de EXP y la API de SAVE. No simula datos:
 * todo lo que muestra sale del guardado local o de la fecha real.
 */
window.EXPUI = (function () {
  'use strict';

  const $ = id => document.getElementById(id);
  let currentKind = '';
  let badgeTab = 'badges';
  let inited = false;

  /* ---------------- utilidades ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
  function st() { return SAVE.get(); }
  function coins() { const el = $('genCoins'); if (el) el.textContent = st().coins; }
  function rarity(id) {
    const r = EXP.rarityOf(id);
    return '<span class="exp-rar" style="--rc:' + r.color + '">' + r.name + '</span>';
  }
  function perkText(perk) {
    const map = {
      coins: v => '+' + Math.round(v * 100) + ' % monedas',
      score: v => '+' + Math.round(v * 100) + ' % puntos',
      xp: v => '+' + Math.round(v * 100) + ' % XP',
      magnet: v => '+' + Math.round(v * 100) + ' % imán',
      duration: v => '+' + Math.round(v * 100) + ' % duración',
      startShield: v => '+1 escudo inicial',
      slowStart: v => v + ' s de arranque lento',
      revive: () => '1 resurrección por vuelo',
      bossScore: v => '+' + v + ' pts por golpe de jefe'
    };
    const out = [];
    Object.keys(perk || {}).forEach(k => { if (perk[k] && map[k]) out.push(map[k](perk[k])); });
    return out.join(' · ') || 'Sin ventajas (100 % estético)';
  }
  function rewardText(r) {
    if (!r) return '';
    if (typeof r === 'number') return '+' + r + ' 🪙';
    const out = [];
    if (r.coins) out.push('+' + r.coins + ' 🪙');
    if (r.parts) out.push('+' + r.parts + ' 🔩');
    if (r.skill) out.push('+' + r.skill + ' punto' + (r.skill > 1 ? 's' : '') + ' de habilidad');
    if (r.petXp) out.push('+' + r.petXp + ' XP mascota');
    if (r.item) out.push('herramienta');
    if (r.char) out.push('personaje');
    if (r.pet) out.push('mascota');
    if (r.hat) out.push('sombrero');
    if (r.map) out.push('mapa');
    if (r.skin) out.push('ave');
    return out.join(' · ') || 'Recompensa';
  }
  function body(html) { const b = $('genBody'); if (b) b.innerHTML = html; }
  function on(sel, fn) {
    document.querySelectorAll('#genBody ' + sel).forEach(el => { el.onclick = () => fn(el); });
  }
  function toast(m, k) { UI.toast(m, k || 'good'); }
  function refresh() { render(currentKind); coins(); }
  function header(icon, title, sub) {
    return '<div class="exp-hero"><span class="exp-hero-ico">' + icon + '</span>' +
      '<div><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></div></div>';
  }
  function xpBar(pct, col) {
    return '<div class="exp-bar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + (col || '#69f0ae') + '"></i></div>';
  }

  /* ---------------- PERSONAJES + ACCESORIOS ---------------- */
  function renderCharacters() {
    const s = st();
    let html = header('🧑‍🚀', 'Personajes y accesorios', 'Cada personaje tiene identidad visual y una ventaja pequeña. Los accesorios son cosméticos.');
    html += '<div class="exp-grid">';
    EXP.CHARACTERS.forEach(c => {
      const owned = EXP.charOwned(s, c.id);
      const unlocked = EXP.charUnlocked(s, c.id);
      const eq = s.char === c.id;
      const price = Math.max(0, Math.floor(c.price || 0));
      let btn;
      if (eq) btn = '<button class="exp-btn ok" disabled>Equipado</button>';
      else if (owned) btn = '<button class="exp-btn" data-char="' + c.id + '">Equipar</button>';
      else if (!unlocked) btn = '<button class="exp-btn locked" data-locked="' + esc(EXP.reqText(c.req)) + '">🔒 ' + esc(EXP.reqText(c.req)) + '</button>';
      else if (price > 0) btn = '<button class="exp-btn buy' + (s.coins < price ? ' poor' : '') + '" data-char="' + c.id + '">Comprar · ' + price + ' 🪙</button>';
      else btn = '<button class="exp-btn buy" data-char="' + c.id + '">Reclamar</button>';
      html += '<article class="exp-card' + (eq ? ' eq' : '') + (owned ? '' : ' locked') + '">' +
        '<div class="exp-ico" style="--pc:' + (c.colors && c.colors.wing || '#888') + '">' + c.icon + '</div>' +
        '<div class="exp-name">' + esc(c.name) + '</div>' + rarity(c.rarity) +
        '<p class="exp-desc">' + esc(c.desc) + '</p>' +
        '<p class="exp-perk">✨ ' + esc(perkText(c.perk)) + '</p>' + btn + '</article>';
    });
    html += '</div>';

    html += '<h3 class="exp-h3">🎒 Accesorios de perfil</h3><p class="exp-note">Se muestran en tu perfil. No cambian el vuelo.</p>';
    EXP.ACCESSORY_SLOTS.forEach(slot => {
      html += '<div class="exp-slot"><b>' + slot.icon + ' ' + esc(slot.name) + '</b><div class="exp-chips">';
      EXP.accessoriesBySlot(slot.id).forEach(a => {
        const owned = s.accessoryOwned.indexOf(a.id) !== -1;
        const eq = (s.accessories || {})[slot.id] === a.id;
        const label = eq ? '✓ ' : owned ? '' : (a.price > 0 ? a.price + ' 🪙' : 'Gratis');
        html += '<button class="exp-chip' + (eq ? ' on' : '') + (owned ? '' : ' buy') + '" data-acc="' + a.id + '" data-slot="' + slot.id + '" title="' + esc(a.desc) + '">' +
          a.icon + ' ' + esc(a.name) + (label ? ' <small>' + label + '</small>' : '') + '</button>';
      });
      html += '</div></div>';
    });

    body(html);
    on('[data-char]', el => {
      const id = el.getAttribute('data-char');
      const c = EXP.getChar(id);
      if (EXP.charOwned(st(), id)) {
        if (SAVE.equipChar(id)) { SND.sfx.click(); toast('Personaje equipado: ' + c.name); refresh(); }
        return;
      }
      const r = SAVE.buyChar(id);
      if (r.ok) { SND.sfx.level(); toast('¡' + c.name + ' desbloqueado!'); refresh(); if (UI.refreshHome) UI.refreshHome(); }
      else if (r.msg === 'no_money') { SND.sfx.deny(); toast('Te faltan ' + (c.price - st().coins) + ' 🪙', 'warning'); }
      else { SND.sfx.deny(); toast(r.msg, 'warning'); }
    });
    on('[data-locked]', el => toast('Bloqueado: ' + el.getAttribute('data-locked'), 'warning'));
    on('[data-acc]', el => {
      const id = el.getAttribute('data-acc'), slot = el.getAttribute('data-slot');
      const a = EXP.getAccessory(id);
      if (st().accessoryOwned.indexOf(id) !== -1) {
        if (SAVE.equipAccessory(slot, id)) { SND.sfx.click(); toast('Equipado: ' + a.name); refresh(); }
        return;
      }
      if (!a || !a.price) { SND.sfx.deny(); return; }
      const r = SAVE.buyAccessory(id);
      if (r.ok) { SND.sfx.level(); toast('¡' + a.name + ' desbloqueado!'); refresh(); }
      else if (r.msg === 'no_money') { SND.sfx.deny(); toast('Te faltan ' + (a.price - st().coins) + ' 🪙', 'warning'); }
      else { SND.sfx.deny(); toast(r.msg, 'warning'); }
    });
  }

  /* ---------------- MASCOTAS ---------------- */
  function renderPets() {
    const s = st();
    let html = header('🐾', 'Mascotas', 'Acompañan tu vuelo y suben de nivel con cada partida. Son 100 % cosméticas: no dan ventajas.');
    html += '<div class="exp-grid">';
    EXP.PETS.forEach(p => {
      const owned = EXP.petOwned(s, p.id);
      const unlocked = EXP.petUnlocked(s, p.id);
      const eq = s.pet === p.id;
      const xp = SAVE.petXpOf(p.id);
      const lv = SAVE.petLevelOf(p.id);
      const next = EXP.petNextXp(xp);
      const prev = EXP.PET_LEVEL_XP[lv - 1] || 0;
      const pct = next ? Math.max(0, Math.min(100, (xp - prev) / Math.max(1, next - prev) * 100)) : 100;
      const price = Math.max(0, Math.floor(p.price || 0));
      let btn;
      if (eq) btn = '<button class="exp-btn ok" data-pet="">Quitar</button>';
      else if (owned) btn = '<button class="exp-btn" data-pet="' + p.id + '">Equipar</button>';
      else if (!unlocked) btn = '<button class="exp-btn locked" data-locked="' + esc(EXP.reqText(p.req)) + '">🔒 ' + esc(EXP.reqText(p.req)) + '</button>';
      else if (price > 0) btn = '<button class="exp-btn buy' + (s.coins < price ? ' poor' : '') + '" data-pet="' + p.id + '">Comprar · ' + price + ' 🪙</button>';
      else btn = '<button class="exp-btn buy" data-pet="' + p.id + '">Reclamar</button>';
      html += '<article class="exp-card' + (eq ? ' eq' : '') + (owned ? '' : ' locked') + '">' +
        '<div class="exp-ico" style="--pc:' + (p.color || '#888') + '">' + p.icon + '</div>' +
        '<div class="exp-name">' + esc(p.name) + '</div>' + rarity(p.rarity) +
        '<p class="exp-desc">' + esc(p.desc) + '</p>' +
        '<div class="exp-lvl">Nv. ' + lv + (next ? ' · ' + xp + '/' + next + ' XP' : ' · MÁX') + '</div>' +
        xpBar(pct, p.color || '#69f0ae') + btn + '</article>';
    });
    html += '</div>';
    body(html);
    on('[data-pet]', el => {
      const id = el.getAttribute('data-pet');
      if (!id) { SAVE.equipPet(''); SND.sfx.click(); toast('Mascota guardada'); refresh(); return; }
      const p = EXP.getPet(id);
      if (EXP.petOwned(st(), id)) {
        if (SAVE.equipPet(id)) { SND.sfx.click(); toast('Mascota equipada: ' + p.name); refresh(); }
        return;
      }
      const r = SAVE.buyPet(id);
      if (r.ok) { SND.sfx.level(); toast('¡' + p.name + ' se une al vuelo!'); refresh(); }
      else if (r.msg === 'no_money') { SND.sfx.deny(); toast('Te faltan ' + (p.price - st().coins) + ' 🪙', 'warning'); }
      else { SND.sfx.deny(); toast(r.msg, 'warning'); }
    });
    on('[data-locked]', el => toast('Bloqueado: ' + el.getAttribute('data-locked'), 'warning'));
  }

  /* ---------------- HABILIDADES ---------------- */
  function renderSkills() {
    const s = st();
    let html = header('🌳', 'Árbol de habilidades', 'Puntos reales: ganas 1 por nivel de jugador. Cada mejora se aplica en el vuelo.');
    html += '<div class="exp-points">🔷 Puntos disponibles: <b>' + (s.skillPoints || 0) + '</b>' +
      ' <button class="exp-btn mini" id="expSkillReset">↺ Reiniciar árbol</button></div>';
    html += '<div class="exp-list">';
    EXP.SKILLS.forEach(sk => {
      const lv = EXP.skillLv(s, sk.id);
      const reqOk = EXP.skillReqMet(s, sk.id);
      const maxed = lv >= sk.max;
      const can = reqOk && !maxed && (s.skillPoints || 0) > 0;
      let pips = '';
      for (let i = 0; i < sk.max; i++) pips += '<i class="' + (i < lv ? 'on' : '') + '"></i>';
      let btn;
      if (maxed) btn = '<button class="exp-btn ok" disabled>MÁX</button>';
      else if (!reqOk) btn = '<button class="exp-btn locked" disabled>🔒 Requiere ' + esc(sk.req.skill ? EXP.getSkill(sk.req.skill).name : '') + ' ' + (sk.req.level || 1) + '</button>';
      else btn = '<button class="exp-btn' + (can ? ' buy' : '') + '" data-skill="' + sk.id + '"' + (can ? '' : ' disabled') + '>Mejorar · 1 punto</button>';
      html += '<article class="exp-row' + (maxed ? ' eq' : '') + '">' +
        '<div class="exp-row-ico">' + sk.icon + '</div>' +
        '<div class="exp-row-main"><b>' + esc(sk.name) + '</b><small>' + esc(sk.desc) + '</small>' +
        '<div class="exp-pips">' + pips + '</div></div>' + btn + '</article>';
    });
    html += '</div>';
    body(html);
    on('[data-skill]', el => {
      const id = el.getAttribute('data-skill');
      const r = SAVE.learnSkill(id);
      if (r && r.ok) { SND.sfx.level(); toast('¡' + EXP.getSkill(id).name + ' mejorada!'); refresh(); }
      else if (r && r.msg) { SND.sfx.deny(); toast(r.msg, 'warning'); }
    });
    const reset = $('expSkillReset');
    if (reset) reset.onclick = () => {
      UI.confirm('Reiniciar habilidades', 'Se devolverán todos los puntos gastados. ¿Continuar?', [
        { label: 'Sí, reiniciar', cb: () => { const n = SAVE.resetSkills(); SND.sfx.click(); toast('+' + n + ' puntos devueltos'); refresh(); } },
        { label: 'Cancelar', style: 'btn-ghost' }
      ]);
    };
  }

  /* ---------------- EVENTOS ---------------- */
  function eventDates(ev) {
    return (ev.start[1] < 10 ? '0' : '') + ev.start[1] + '/' + (ev.start[0] < 10 ? '0' : '') + ev.start[0] +
      ' → ' + (ev.end[1] < 10 ? '0' : '') + ev.end[1] + '/' + (ev.end[0] < 10 ? '0' : '') + ev.end[0];
  }
  function nextEvent(now) {
    now = now || new Date();
    let best = null;
    EXP.EVENTS.forEach(ev => {
      let y = now.getFullYear();
      let d = new Date(y, ev.start[0] - 1, ev.start[1]);
      if (d.getTime() < now.getTime() && !EXP.activeEvents(now).some(a => a.id === ev.id)) {
        d = new Date(y + 1, ev.start[0] - 1, ev.start[1]);
      }
      if (!best || d < best.date) best = { ev: ev, date: d };
    });
    return best;
  }
  function metricLabel(ev) {
    return {
      runs: 'vuelos durante el evento',
      coins: 'monedas recogidas',
      pipes: 'tubos cruzados',
      score: 'puntos sumados',
      boss: 'jefes derrotados'
    }[ev.metric] || 'progreso';
  }
  function renderEvents() {
    const now = new Date();
    const active = EXP.activeEvents(now);
    let html = header('🎉', 'Eventos y temporadas', 'Los eventos usan la fecha real del dispositivo. Sus recompensas se reclaman una sola vez.');
    if (active.length) {
      active.forEach(ev => {
        const es = SAVE.eventState(ev.id) || { progress: 0, claimed: [] };
        html += '<div class="exp-event"><div class="exp-event-head">' + ev.icon + ' <b>' + esc(ev.name) + '</b>' +
          '<span class="exp-badge-live">EN CURSO</span></div>' +
          '<p class="exp-desc">' + esc(ev.desc) + '</p>' +
          '<div class="exp-meta">🗺️ ' + esc(ev.map) + ' · 🎨 tema ' + esc(ev.theme) + ' · ' + eventDates(ev) + '</div>' +
          '<div class="exp-lvl">' + esc(metricLabel(ev)) + ': <b>' + es.progress + '</b></div>';
        (ev.rewards || []).forEach(r => {
          const claimed = es.claimed.indexOf(r.id) !== -1;
          const can = !claimed && es.progress >= r.need;
          html += '<div class="exp-row"><div class="exp-row-ico">' + r.icon + '</div><div class="exp-row-main">' +
            '<b>' + esc(r.name) + '</b><small>Meta: ' + r.need + ' · ' + esc(rewardText(r)) + '</small></div>' +
            (claimed ? '<span class="exp-tag ok">Reclamado</span>' :
              '<button class="exp-btn' + (can ? ' buy' : '') + '" data-ev="' + ev.id + '" data-rid="' + r.id + '"' + (can ? '' : ' disabled') + '>' + (can ? 'Reclamar' : (r.need - es.progress) + ' restan') + '</button>') +
            '</div>';
        });
        html += '<button class="exp-btn big" id="expEventPlay">' + ev.icon + ' Jugar el evento</button></div>';
      });
    } else {
      const nx = nextEvent(now);
      html += '<div class="exp-event"><div class="exp-event-head">📅 <b>Sin evento activo</b></div>' +
        '<p class="exp-desc">El próximo evento es <b>' + esc(nx.ev.name) + '</b> (' + eventDates(nx.ev) + '). ' + esc(nx.ev.desc) + '</p>' +
        '<div class="exp-meta">Comienza en ' + Math.max(1, Math.ceil((nx.date - now) / 86400000)) + ' días.</div></div>';
    }
    html += '<h3 class="exp-h3">🗓️ Calendario anual</h3><div class="exp-list">';
    EXP.EVENTS.forEach(ev => {
      const live = active.some(a => a.id === ev.id);
      html += '<div class="exp-row' + (live ? ' eq' : '') + '"><div class="exp-row-ico">' + ev.icon + '</div>' +
        '<div class="exp-row-main"><b>' + esc(ev.name) + '</b><small>' + eventDates(ev) + ' · ' + esc(ev.desc) + '</small></div>' +
        '<span class="exp-tag' + (live ? ' ok' : '') + '">' + (live ? 'Activo' : 'Cerrado') + '</span></div>';
    });
    html += '</div>';
    body(html);
    on('[data-ev]', el => {
      const r = SAVE.claimEventReward(el.getAttribute('data-ev'), el.getAttribute('data-rid'));
      if (r) { SND.sfx.level(); toast('Recompensa reclamada: ' + r.name); refresh(); if (UI.refreshHome) UI.refreshHome(); }
      else { SND.sfx.deny(); toast('Todavía no puedes reclamarla', 'warning'); }
    });
    const play = $('expEventPlay');
    if (play) play.onclick = () => startMode('event');
  }

  /* ---------------- INSIGNIAS / TÍTULOS / COLECCIONES / MAESTRÍA ---------------- */
  function renderBadges() {
    const s = st();
    const tabs = [['badges', '🏅 Insignias'], ['titles', '🎖️ Títulos'], ['collections', '📚 Colecciones'], ['mastery', '🗺️ Maestría']];
    let html = header('🏆', 'Recompensas de progreso', 'Insignias, títulos, colecciones y maestría por mapa. Todo se registra en el guardado.');
    html += '<div class="exp-tabs">' + tabs.map(t => '<button class="exp-tab' + (badgeTab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';

    if (badgeTab === 'badges') {
      html += '<div class="exp-list">';
      EXP.BADGES.forEach(b => {
        const claimed = EXP.badgeClaimed(s, b.id);
        const ready = !claimed && EXP.badgeReady(s, b);
        html += '<div class="exp-row' + (claimed ? ' eq' : '') + '"><div class="exp-row-ico">' + b.icon + '</div>' +
          '<div class="exp-row-main"><b>' + esc(b.name) + '</b><small>' + esc(b.desc) + ' · ' + esc(rewardText(b.reward)) + '</small></div>' +
          (claimed ? '<span class="exp-tag ok">Conseguida</span>' :
            '<button class="exp-btn' + (ready ? ' buy' : '') + '" data-badge="' + b.id + '"' + (ready ? '' : ' disabled') + '>' + (ready ? 'Reclamar' : 'Pendiente') + '</button>') +
          '</div>';
      });
      html += '</div>';
    } else if (badgeTab === 'titles') {
      html += '<div class="exp-list">';
      EXP.TITLES.forEach(t => {
        const unlocked = EXP.titleUnlocked(s, t);
        const eq = s.title === t.id;
        html += '<div class="exp-row' + (eq ? ' eq' : '') + '"><div class="exp-row-ico">' + t.icon + '</div>' +
          '<div class="exp-row-main"><b>' + esc(t.name) + '</b><small>' + esc(t.desc) + '</small></div>' +
          (eq ? '<button class="exp-btn ok" data-title="">Quitar</button>' :
            '<button class="exp-btn' + (unlocked ? ' buy' : '') + '" data-title="' + t.id + '"' + (unlocked ? '' : ' disabled') + '>' + (unlocked ? 'Equipar' : '🔒') + '</button>') +
          '</div>';
      });
      html += '</div>';
    } else if (badgeTab === 'collections') {
      html += '<div class="exp-list">';
      EXP.COLLECTIONS.forEach(c => {
        const claimed = EXP.collectionClaimed(s, c.id);
        const met = EXP.collectionMet(s, c);
        html += '<div class="exp-row' + (claimed ? ' eq' : '') + '"><div class="exp-row-ico">' + c.icon + '</div>' +
          '<div class="exp-row-main"><b>' + esc(c.name) + '</b><small>' + esc(c.desc) + ' · ' + esc(rewardText(c.reward)) + '</small></div>' +
          (claimed ? '<span class="exp-tag ok">Completada</span>' :
            '<button class="exp-btn' + (met ? ' buy' : '') + '" data-col="' + c.id + '"' + (met ? '' : ' disabled') + '>' + (met ? 'Reclamar' : 'Incompleta') + '</button>') +
          '</div>';
      });
      html += '</div>';
    } else {
      html += '<p class="exp-note">La maestría usa tu mejor marca real en cada mapa. Se guarda al terminar cada vuelo.</p><div class="exp-list">';
      const owned = (s.mapsOwned || []).map(m => (m && m.id) || m).filter(id => DAT.getMap(id));
      owned.forEach(id => {
        const m = DAT.getMap(id);
        const best = s.mapBest[id] || 0;
        const tier = EXP.masteryTier(best);
        let btns = '';
        EXP.MASTERY_TIERS.forEach((t, i) => {
          const claimed = EXP.masteryClaimed(s, id, t.id);
          const can = !claimed && best >= t.need;
          btns += '<button class="exp-mini' + (claimed ? ' ok' : can ? ' buy' : '') + '" data-map="' + id + '" data-tier="' + t.id + '"' + (can ? '' : ' disabled') + '>' +
            t.icon + ' ' + (claimed ? '✓' : t.need) + '</button>';
        });
        html += '<div class="exp-row"><div class="exp-row-ico">' + (m.icon || '🗺️') + '</div>' +
          '<div class="exp-row-main"><b>' + esc(m.name || id) + '</b><small>Récord ' + best + ' pts · ' + (tier ? EXP.MASTERY_TIERS[tier - 1].name : 'Sin medalla') + '</small></div>' +
          '<div class="exp-tierbtns">' + btns + '</div></div>';
      });
      html += '</div>';
    }
    body(html);
    on('[data-tab]', el => { badgeTab = el.getAttribute('data-tab'); SND.sfx.click(); refresh(); });
    on('[data-badge]', el => {
      const b = SAVE.claimBadge(el.getAttribute('data-badge'));
      if (b) { SND.sfx.level(); toast('Insignia: ' + b.name + ' · ' + rewardText(b.reward)); refresh(); }
    });
    on('[data-title]', el => {
      const id = el.getAttribute('data-title');
      if (SAVE.equipTitle(id)) { SND.sfx.click(); toast(id ? 'Título equipado' : 'Título quitado'); refresh(); }
    });
    on('[data-col]', el => {
      const c = SAVE.claimCollection(el.getAttribute('data-col'));
      if (c) { SND.sfx.level(); toast('Colección completada: ' + c.name); refresh(); }
    });
    on('[data-map]', el => {
      const t = SAVE.claimMastery(el.getAttribute('data-map'), el.getAttribute('data-tier'));
      if (t) { SND.sfx.level(); toast('Maestría ' + t.name + ' · ' + rewardText(t.reward)); refresh(); }
    });
  }

  /* ---------------- HERRAMIENTAS LEGENDARIAS ---------------- */
  function renderLegendary() {
    const s = st();
    let html = header('🗡️', 'Herramientas legendarias', 'Se compran una vez y se equipan. Cada una tiene un uso manual por partida (botón del HUD).');
    html += '<div class="exp-grid">';
    EXP.LEGENDARY_TOOLS.forEach(t => {
      const owned = EXP.legendaryOwned(s, t.key);
      const unlocked = EXP.legendaryUnlocked(s, t);
      const eq = s.legendary === t.key;
      let btn;
      if (eq) btn = '<button class="exp-btn ok" data-lg="">Desequipar</button>';
      else if (owned) btn = '<button class="exp-btn" data-lg="' + t.key + '">Equipar</button>';
      else if (!unlocked) btn = '<button class="exp-btn locked" data-locked="' + esc(EXP.reqText(t.req)) + '">🔒 ' + esc(EXP.reqText(t.req)) + '</button>';
      else btn = '<button class="exp-btn buy' + (s.coins < t.price ? ' poor' : '') + '" data-lg="' + t.key + '">Comprar · ' + t.price + ' 🪙</button>';
      html += '<article class="exp-card' + (eq ? ' eq' : '') + (owned ? '' : ' locked') + '">' +
        '<div class="exp-ico" style="--pc:' + t.color + '">' + t.icon + '</div>' +
        '<div class="exp-name">' + esc(t.name) + '</div>' + rarity('legendary') +
        '<p class="exp-desc">' + esc(t.desc) + '</p>' +
        '<p class="exp-perk">🎮 1 uso manual por vuelo</p>' + btn + '</article>';
    });
    html += '</div>';
    body(html);
    on('[data-lg]', el => {
      const key = el.getAttribute('data-lg');
      if (!key) { SAVE.equipLegendary(''); SND.sfx.click(); toast('Herramienta guardada'); refresh(); return; }
      const t = EXP.getLegendary(key);
      if (EXP.legendaryOwned(st(), key)) {
        if (SAVE.equipLegendary(key)) { SND.sfx.click(); toast('Equipada: ' + t.name); refresh(); }
        return;
      }
      const r = SAVE.buyLegendary(key);
      if (r.ok) { SND.sfx.level(); toast('¡' + t.name + ' desbloqueada!'); refresh(); if (UI.refreshHome) UI.refreshHome(); }
      else if (r.msg === 'no_money') { SND.sfx.deny(); toast('Te faltan ' + (t.price - st().coins) + ' 🪙', 'warning'); }
      else { SND.sfx.deny(); toast(r.msg, 'warning'); }
    });
    on('[data-locked]', el => toast('Bloqueado: ' + el.getAttribute('data-locked'), 'warning'));
  }

  /* ---------------- PERSONALIZACIÓN ---------------- */
  function renderCustom() {
    const s = st();
    const set = s.set || {};
    let html = header('🎨', 'Personalización', 'Temas, rendimiento, cinemáticas y conjuntos guardados. Todo se aplica al instante.');
    html += '<h3 class="exp-h3">🎨 Temas de interfaz</h3><div class="exp-grid small">';
    EXP.THEMES.forEach(t => {
      const unlocked = EXP.themeUnlocked(s, t);
      const eq = set.theme === t.id;
      html += '<button class="exp-theme' + (eq ? ' eq' : '') + '" data-theme="' + t.id + '"' + (unlocked ? '' : ' disabled') + '>' +
        '<span>' + t.icon + '</span><b>' + esc(t.name) + '</b><small>' + (unlocked ? (eq ? 'Activo' : 'Aplicar') : esc(EXP.reqText(t.req))) + '</small></button>';
    });
    html += '</div>';

    html += '<h3 class="exp-h3">⚙️ Conjuntos de rendimiento</h3><div class="exp-grid small">';
    EXP.PRESETS.forEach(p => {
      html += '<button class="exp-theme" data-preset="' + p.id + '"><span>' + p.icon + '</span><b>' + esc(p.name) + '</b><small>' + esc(p.desc) + '</small></button>';
    });
    html += '</div>';

    html += '<h3 class="exp-h3">🎬 Presentación</h3><div class="exp-form">' +
      '<label>Cinemáticas<select id="expCine"><option value="full"' + (set.cine === 'full' ? ' selected' : '') + '>Completas</option><option value="reduced"' + (set.cine === 'reduced' ? ' selected' : '') + '>Reducidas</option><option value="off"' + (set.cine === 'off' ? ' selected' : '') + '>Desactivadas</option></select></label>' +
      '<label>Calidad de efectos<select id="expGfx"><option value="high"' + (set.gfx === 'high' ? ' selected' : '') + '>Alta</option><option value="medium"' + (set.gfx === 'medium' ? ' selected' : '') + '>Media</option><option value="low"' + (set.gfx === 'low' ? ' selected' : '') + '>Baja</option></select></label>' +
      '<label class="exp-check"><input type="checkbox" id="expReduced"' + (set.reduced ? ' checked' : '') + '> Modo rendimiento (menos luz y partículas)</label>' +
      '<label class="exp-check"><input type="checkbox" id="expShake"' + (set.shake !== false ? ' checked' : '') + '> Vibración de cámara</label>' +
      '<label class="exp-check"><input type="checkbox" id="expAnim"' + (set.uiAnim !== false ? ' checked' : '') + '> Animaciones de interfaz</label>' +
      '<label>Límite de FPS<select id="expFps"><option value="0"' + ((set.fps | 0) === 0 ? ' selected' : '') + '>Sin límite</option><option value="30"' + ((set.fps | 0) === 30 ? ' selected' : '') + '>30 FPS</option><option value="45"' + ((set.fps | 0) === 45 ? ' selected' : '') + '>45 FPS</option><option value="60"' + ((set.fps | 0) === 60 ? ' selected' : '') + '>60 FPS</option></select></label>' +
      '<label>Sensibilidad de aleteo <output id="expSensVal">' + Number(set.sens || 1).toFixed(1) + '</output><input type="range" id="expSens" min="0.6" max="1.6" step="0.1" value="' + Number(set.sens || 1) + '"></label>' +
      '<label>Volumen efectos <output id="expVolSVal">' + Math.round((set.volS == null ? 1 : set.volS) * 100) + '%</output><input type="range" id="expVolS" min="0" max="1" step="0.05" value="' + (set.volS == null ? 1 : set.volS) + '"></label>' +
      '<label>Volumen música <output id="expVolMVal">' + Math.round((set.volM == null ? 1 : set.volM) * 100) + '%</output><input type="range" id="expVolM" min="0" max="1" step="0.05" value="' + (set.volM == null ? 1 : set.volM) + '"></label>' +
      '<button class="exp-btn" id="expOpenSettings">⚙️ Abrir todos los ajustes</button></div>';

    html += '<h3 class="exp-h3">💾 Conjuntos guardados</h3><p class="exp-note">Guarda tu personaje, mascota, accesorios, tema, ave, sombrero y estela actuales.</p><div class="exp-form">' +
      '<div class="exp-save-row"><input id="expLoadName" maxlength="16" placeholder="Nombre del conjunto"><button class="exp-btn buy" id="expSaveLoad">Guardar</button></div></div>';
    if (!(s.loadouts || []).length) {
      html += '<p class="exp-note">Todavía no has guardado ningún conjunto.</p>';
    } else {
      html += '<div class="exp-list">';
      s.loadouts.forEach(l => {
        html += '<div class="exp-row"><div class="exp-row-ico">💾</div><div class="exp-row-main"><b>' + esc(l.name) + '</b>' +
          '<small>' + esc(EXP.getChar(l.char).name) + ' · ' + esc(l.pet ? EXP.getPet(l.pet).name : 'sin mascota') + ' · ' + esc(EXP.getTheme(l.theme).name) + '</small></div>' +
          '<button class="exp-mini buy" data-load="' + esc(l.id) + '">Aplicar</button>' +
          '<button class="exp-mini" data-del="' + esc(l.id) + '">🗑</button></div>';
      });
      html += '</div>';
    }

    body(html);

    on('[data-theme]', el => {
      if (SAVE.setTheme(el.getAttribute('data-theme'))) { SND.sfx.click(); toast('Tema aplicado'); refresh(); }
    });
    on('[data-preset]', el => {
      const p = EXP.getPreset(el.getAttribute('data-preset'));
      UI.confirm('Conjunto: ' + p.name, p.desc + ' Se cambiarán tus ajustes de vídeo y sonido.', [
        { label: 'Aplicar', cb: () => { SAVE.applyPreset(p.id); applyAudio(); SND.sfx.click(); toast('Conjunto ' + p.name + ' aplicado'); refresh(); } },
        { label: 'Cancelar', style: 'btn-ghost' }
      ]);
    });
    on('[data-load]', el => {
      if (SAVE.applyLoadout(el.getAttribute('data-load'))) { SND.sfx.click(); toast('Conjunto aplicado'); refresh(); }
    });
    on('[data-del]', el => {
      const id = el.getAttribute('data-del');
      UI.confirm('Borrar conjunto', '¿Eliminar este conjunto guardado? No se pierde ningún objeto.', [
        { label: 'Borrar', cb: () => { SAVE.deleteLoadout(id); toast('Conjunto borrado', 'info'); refresh(); } },
        { label: 'Cancelar', style: 'btn-ghost' }
      ]);
    });

    const cine = $('expCine');
    if (cine) cine.onchange = () => { SAVE.setSetting('cine', cine.value); toast('Cinemáticas: ' + cine.options[cine.selectedIndex].text, 'info'); };
    const gfx = $('expGfx'); if (gfx) gfx.onchange = () => SAVE.setSetting('gfx', gfx.value);
    const red = $('expReduced'); if (red) red.onchange = () => SAVE.setSetting('reduced', red.checked);
    const shake = $('expShake'); if (shake) shake.onchange = () => SAVE.setSetting('shake', shake.checked);
    const anim = $('expAnim'); if (anim) anim.onchange = () => SAVE.setSetting('uiAnim', anim.checked);
    const fps = $('expFps'); if (fps) fps.onchange = () => SAVE.setSetting('fps', parseInt(fps.value, 10) || 0);
    const sens = $('expSens');
    if (sens) sens.oninput = () => { $('expSensVal').textContent = Number(sens.value).toFixed(1); SAVE.setSetting('sens', Number(sens.value)); };
    const volS = $('expVolS');
    if (volS) volS.oninput = () => { $('expVolSVal').textContent = Math.round(volS.value * 100) + '%'; SAVE.setSetting('volS', Number(volS.value)); applyAudio(); };
    const volM = $('expVolM');
    if (volM) volM.oninput = () => { $('expVolMVal').textContent = Math.round(volM.value * 100) + '%'; SAVE.setSetting('volM', Number(volM.value)); applyAudio(); };
    const openSet = $('expOpenSettings'); if (openSet) openSet.onclick = () => UI.openGeneric('settings');
    const saveL = $('expSaveLoad');
    if (saveL) saveL.onclick = () => {
      const nameEl = $('expLoadName');
      const l = SAVE.saveLoadout(nameEl ? nameEl.value : '');
      SND.sfx.level(); toast('Conjunto guardado: ' + l.name); refresh();
    };
  }
  function applyAudio() {
    const set = st().set || {};
    if (SND && SND.setVolumes) SND.setVolumes(set.volS == null ? 1 : set.volS, set.volM == null ? 1 : set.volM, set.volG == null ? 1 : set.volG);
  }

  /* ---------------- LIGA SEMANAL LOCAL ---------------- */
  function renderLeague() {
    const s = st();
    const lg = SAVE.leagueState();
    const next = lg.next;
    const pct = next ? Math.max(0, Math.min(100, (lg.points - lg.tier.need) / Math.max(1, next.need - lg.tier.need) * 100)) : 100;
    let html = header('🏆', 'Liga semanal', 'Clasificación real de este dispositivo. Los rivales son tus propios vuelos y perfiles locales: no hay jugadores inventados.');
    html += '<div class="exp-event"><div class="exp-event-head">' + lg.tier.icon + ' <b>Liga ' + esc(lg.tier.name) + '</b><span class="exp-badge-live">SEMANA ' + esc(lg.week) + '</span></div>' +
      '<div class="exp-lvl">Puntos de la semana: <b>' + lg.points + '</b>' + (next ? ' · siguiente: ' + next.icon + ' ' + esc(next.name) + ' (' + next.need + ')' : ' · nivel máximo') + '</div>' +
      xpBar(pct, '#ffca28') +
      '<div class="exp-row"><div class="exp-row-ico">🎁</div><div class="exp-row-main"><b>Recompensa de la liga</b><small>' + esc(rewardText(lg.tier.reward)) + '</small></div>' +
      (lg.claimed ? '<span class="exp-tag ok">Reclamada</span>' : '<button class="exp-btn buy" id="expLeagueClaim">Reclamar</button>') + '</div>' +
      '</div>';
    html += '<h3 class="exp-h3">👥 Rivales locales</h3><div class="exp-list">';
    const rivals = EXP.ghostRivals(s, 5);
    rivals.forEach((r, i) => {
      html += '<div class="exp-row"><div class="exp-row-ico">' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•') + '</div>' +
        '<div class="exp-row-main"><b>' + esc(r.name) + (r.me ? ' (tú)' : '') + '</b><small>' + esc(r.source) + '</small></div>' +
        '<span class="exp-tag">' + r.score + ' pts</span></div>';
    });
    html += '</div>';
    html += '<p class="exp-note">La liga se reinicia cada lunes. Para sumar puntos, juega cualquier modo: cada vuelo añade su puntuación real.</p>';
    html += '<button class="exp-btn big" id="expLeaguePlay">✈️ Jugar y sumar puntos</button>';
    body(html);
    const claim = $('expLeagueClaim');
    if (claim) claim.onclick = () => {
      const tier = SAVE.claimLeague();
      if (tier) { SND.sfx.level(); toast('Liga ' + tier.name + ': ' + rewardText(tier.reward)); refresh(); if (UI.refreshHome) UI.refreshHome(); }
    };
    const play = $('expLeaguePlay');
    if (play) play.onclick = () => startMode('free');
  }

  /* ---------------- SELECTOR DE MODOS (pantalla completa) ---------------- */
  function renderModes() {
    const s = st();
    let html = header('🎮', 'Modos de juego', 'Cada modo cambia las reglas, el objetivo y la recompensa. Los récords se guardan por modo.');
    html += '<div class="exp-list">';
    EXP.MODES.forEach(m => {
      const unlocked = EXP.modeUnlocked(s, m.id);
      const best = (s.bestByMode || {})[m.id] || 0;
      html += '<div class="exp-row' + (unlocked ? '' : ' locked') + '"><div class="exp-row-ico">' + m.icon + '</div>' +
        '<div class="exp-row-main"><b>' + esc(m.name) + ' <small>· ' + esc(m.tag) + '</small></b><small>' + esc(m.desc) +
        (best ? ' · Récord ' + best + ' pts' : '') + '</small></div>' +
        (unlocked ? '<button class="exp-btn buy" data-mode="' + m.id + '">Jugar</button>' :
          '<span class="exp-tag">🔒 ' + esc(EXP.reqText(m.req)) + '</span>') + '</div>';
    });
    html += '</div>';
    body(html);
    on('[data-mode]', el => startMode(el.getAttribute('data-mode')));
  }

  /* ---------------- ARRANQUE DE MODOS ---------------- */
  function startMode(id) {
    const s = st();
    if (!EXP.modeUnlocked(s, id)) {
      const m = EXP.getMode(id);
      SND.sfx.deny();
      toast('Modo bloqueado: ' + EXP.reqText(m && m.req), 'warning');
      return;
    }
    SND.sfx.click();
    if (typeof UI !== 'undefined' && UI.closeGeneric) UI.closeGeneric();
    G.setMode(id);
    G.startPlay();
  }

  /* ---------------- SELECTOR DE MODOS DEL MENÚ JUGAR ---------------- */
  function buildModePicker() {
    const host = $('mpExpModes');
    if (!host) return;
    host.innerHTML = '';
    EXP.MODES.forEach(m => {
      const b = document.createElement('button');
      b.className = 'mode-btn exp-mode-btn';
      b.id = 'mpExp_' + m.id;
      b.dataset.mode = m.id;
      b.innerHTML = '<span class="mb-ico">' + m.icon + '</span><span class="mb-txt">' + esc(m.name) + '</span><span class="md-tag" data-tag></span>';
      b.onclick = () => {
        if (!EXP.modeUnlocked(st(), m.id)) {
          SND.sfx.deny();
          UI.toast('Modo bloqueado: ' + EXP.reqText(m.req), 'warning');
          return;
        }
        startMode(m.id);
      };
      host.appendChild(b);
    });
    refreshModePicker();
  }
  function refreshModePicker() {
    if (typeof EXP === 'undefined' || !EXP) return;
    const s = st();
    if (!s) return;
    EXP.MODES.forEach(m => {
      const b = $('mpExp_' + m.id);
      if (!b) return;
      const unlocked = EXP.modeUnlocked(s, m.id);
      const tag = b.querySelector('[data-tag]');
      if (tag) tag.textContent = unlocked ? m.tag : '🔒 ' + EXP.reqText(m.req);
      b.classList.toggle('locked', !unlocked);
      b.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
    });
    // El modo evento solo aparece cuando hay evento activo.
    const ev = EXP.activeEvent();
    const eb = $('mpExp_event');
    if (eb) eb.classList.toggle('hidden', !ev);
  }

  /* ---------------- PRESENTACIÓN CINEMATOGRÁFICA ---------------- */
  function cinematic(modeId) {
    const set = st().set || {};
    if (set.cine === 'off') return;
    const el = $('cineOverlay');
    if (!el) return;
    const s = st();
    const ch = EXP.getChar(s.char);
    const pet = s.pet ? EXP.getPet(s.pet) : null;
    const mode = EXP.getMode(modeId);
    const ev = EXP.activeEvent();
    const title = mode ? mode.icon + ' ' + mode.name : (modeId === 'free' ? '🎯 Vuelo libre' : modeId === 'boss' ? '👹 Modo jefe' : modeId === 'zen' ? '🧘 Zen' : modeId === 'challenge' ? '🌱 Desafío diario' : modeId === 'duel' ? '🆚 Duelo' : modeId === 'wind' ? '💨 Viento' : '✈️ Pío Vuelo');
    const sub = mode ? mode.desc : (ev ? ev.name : '¡A volar!');
    el.innerHTML = '<div class="cine-card' + (set.cine === 'reduced' ? ' reduced' : '') + '">' +
      '<div class="cine-char">' + ch.icon + '</div>' +
      '<div class="cine-name">' + esc(ch.name) + (pet ? ' <small>' + pet.icon + '</small>' : '') + '</div>' +
      '<div class="cine-mode">' + esc(title) + '</div>' +
      '<div class="cine-sub">' + esc(sub) + '</div></div>';
    el.classList.remove('hidden');
    el.classList.remove('in');
    // reinicio de animación
    void el.offsetWidth;
    el.classList.add('in');
    clearTimeout(cinematic._tm);
    cinematic._tm = setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.classList.add('hidden'), 320); }, set.cine === 'reduced' ? 850 : 1300);
  }

  /* ---------------- HUD: botón de legendaria ---------------- */
  function setLegendary(has, ready, icon, name) {
    const b = $('hudLegend');
    if (!b) return;
    b.classList.toggle('hidden', !has);
    b.classList.toggle('spent', has && !ready);
    if (icon && b.textContent !== icon) b.textContent = icon;
    if (name && b.title !== name) b.title = name + ' · 1 uso por partida';
  }

  /* ---------------- RENDER PRINCIPAL ---------------- */
  function render(kind) {
    currentKind = kind;
    const bodyEl = $('genBody');
    if (!bodyEl) return;
    coins();
    switch (kind) {
      case 'characters': renderCharacters(); break;
      case 'pets': renderPets(); break;
      case 'skills': renderSkills(); break;
      case 'events': renderEvents(); break;
      case 'badges': renderBadges(); break;
      case 'legendary': renderLegendary(); break;
      case 'custom': renderCustom(); break;
      case 'league': renderLeague(); break;
      case 'modes': renderModes(); break;
      default: break;
    }
    coins();
  }

  function init() {
    if (inited) { refreshModePicker(); return; }
    if (!st()) return; // SAVE todavía no ha cargado: main.js vuelve a llamar
    inited = true;
    buildModePicker();
    const lg = $('hudLegend');
    if (lg) lg.onclick = () => {
      SND.sfx.click();
      const ok = G.useLegendary && G.useLegendary();
      if (!ok) UI.toast('La herramienta legendaria ya se usó en este vuelo', 'info');
    };
    applyAudio();
    // Aplica el tema guardado al arrancar.
    try { EXP.applyTheme(st(), document); } catch (e) { }
  }

  // No se auto-inicia antes de que SAVE.load() termine: main.js llama a init().
  return {
    init, render, refresh, cinematic, setLegendary,
    buildModePicker, refreshModePicker, startMode,
    currentKind: () => currentKind
  };
})();
