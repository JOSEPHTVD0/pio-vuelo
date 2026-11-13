/* Radar / mapa táctico 2D.
 * Overlay DOM independiente del canvas principal: se actualiza a baja
 * frecuencia (unos 8 fps) para no robar frames al juego. Dibuja el progreso
 * de ambos jugadores en una sala 1v1 y el vuelo propio en los modos locales. */
window.RADAR = (function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const PAD = 14;
  let cfg = null;
  let active = false;      // la partida está en curso
  let data = null;
  let trail = [];          // estela propia [{x,y}]
  let raf = 0;
  let lastDraw = 0;

  function readCfg() {
    try {
      if (window.SAVE && SAVE.getRadar) return SAVE.getRadar();
    } catch (e) { }
    return {
      on: true, hidden: false, minimized: false, size: 'sm', pos: 'br', opacity: 0.86,
      style: 'tactical', me: '#4fc3f7', rival: '#ff7043', grid: '#90caf9',
      trail: true, pipes: true, coins: false, compass: true, labels: true
    };
  }

  function el() { return $('radar'); }
  function canvas() { return $('radarCanvas'); }

  function apply() {
    cfg = readCfg();
    const box = el();
    if (!box) return;
    const show = active && cfg.on;
    box.classList.toggle('hidden', !show || cfg.hidden);
    box.classList.toggle('radar-min', !!cfg.minimized);
    box.classList.remove('radar-pos-tl', 'radar-pos-tr', 'radar-pos-bl', 'radar-pos-br');
    box.classList.add('radar-pos-' + (cfg.pos || 'tr'));
    box.classList.remove('radar-size-sm', 'radar-size-md', 'radar-size-lg');
    box.classList.add('radar-size-' + (cfg.size || 'md'));
    box.classList.remove('radar-style-tactical', 'radar-style-minimal', 'radar-style-neon');
    box.classList.add('radar-style-' + (cfg.style || 'tactical'));
    box.style.setProperty('--rd-opacity', String(cfg.opacity));
    box.style.setProperty('--rd-me', cfg.me);
    box.style.setProperty('--rd-rival', cfg.rival);
    box.style.setProperty('--rd-grid', cfg.grid);
    const restore = $('radarRestore');
    if (restore) restore.classList.toggle('hidden', !show || !cfg.hidden);
    const mini = $('radarMin');
    if (mini) mini.textContent = cfg.minimized ? '▢' : '–';
    const title = $('radarTitle');
    if (title) title.textContent = cfg.minimized ? '🗺️' : 'MAPA TÁCTICO';
    const foot = $('radarFoot');
    if (foot) foot.classList.toggle('hidden', !!cfg.minimized || !cfg.labels);
  }

  function setActive(on) {
    active = !!on;
    if (!active) { trail = []; data = null; }
    apply();
  }

  function refresh() { apply(); if (active) draw(data); }

  function resetTrail() { trail = []; }

  function point(x, y) {
    // x/y ya vienen normalizados (0..1).
    const c = canvas();
    const w = c ? c.width : 240, h = c ? c.height : 140;
    return { x: PAD + Math.max(0, Math.min(1, x)) * (w - PAD * 2), y: PAD + (1 - Math.max(0, Math.min(1, y))) * (h - PAD * 2) };
  }

  function drawGrid(ctx, w, h, style) {
    const color = cfg.grid || '#90caf9';
    ctx.save();
    ctx.globalAlpha = style === 'minimal' ? 0.10 : 0.20;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    const cols = style === 'neon' ? 6 : 4;
    for (let i = 1; i < cols; i++) {
      const x = PAD + (w - PAD * 2) * i / cols;
      ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, h - PAD); ctx.stroke();
    }
    for (let i = 1; i < 3; i++) {
      const y = PAD + (h - PAD * 2) * i / 3;
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(w - PAD, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPipeMarks(ctx, w, h, marks, style) {
    if (!marks || !marks.length) return;
    ctx.save();
    ctx.globalAlpha = style === 'minimal' ? 0.18 : 0.4;
    ctx.strokeStyle = cfg.grid || '#90caf9';
    ctx.lineWidth = style === 'neon' ? 2 : 1.5;
    for (let i = 0; i < marks.length; i++) {
      const p = point(marks[i], 0.5);
      const half = (h - PAD * 2) * 0.22;
      ctx.globalAlpha = Math.max(0.08, (style === 'minimal' ? 0.18 : 0.42) - i * 0.05);
      ctx.beginPath(); ctx.moveTo(p.x, p.y - half); ctx.lineTo(p.x, p.y + half); ctx.stroke();
    }
    ctx.restore();
  }

  function marker(ctx, p, color, label, isMe, style, dead) {
    ctx.save();
    ctx.shadowColor = style === 'neon' ? color : 'transparent';
    ctx.shadowBlur = style === 'neon' ? 8 : 0;
    ctx.fillStyle = dead ? 'rgba(0,0,0,0.35)' : color;
    ctx.strokeStyle = dead ? color : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = dead ? 2 : 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, isMe ? 4.6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (dead) {
      // Cruz de caído: el estado se ve de un vistazo sin tapar el marcador.
      const r = isMe ? 5.6 : 5;
      ctx.beginPath();
      ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r);
      ctx.moveTo(p.x + r, p.y - r); ctx.lineTo(p.x - r, p.y + r);
      ctx.stroke();
    }
    if (label) {
      ctx.shadowBlur = 0;
      ctx.font = '700 9px "Segoe UI",sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.textAlign = p.x > (canvas() ? canvas().width * 0.72 : 200) ? 'right' : 'left';
      ctx.fillText(label, p.x + (p.x > (canvas() ? canvas().width * 0.72 : 200) ? -7 : 7), p.y - 6);
    }
    ctx.restore();
  }

  function draw(d) {
    const c = canvas();
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    if (!d) return;
    const style = (cfg && cfg.style) || 'tactical';
    drawGrid(ctx, w, h, style);
    if (cfg && cfg.pipes) drawPipeMarks(ctx, w, h, d.pipes, style);

    const meP = point(d.me ? d.me.x : 0, d.me ? d.me.y : 0.5);
    const riP = d.rival ? point(d.rival.x, d.rival.y) : null;

    // Estela del recorrido propio (máx. 18 puntos)
    if (cfg && cfg.trail && trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = cfg.me;
      ctx.lineWidth = style === 'neon' ? 2 : 1.4;
      for (let i = 1; i < trail.length; i++) {
        ctx.globalAlpha = 0.05 + (i / trail.length) * 0.35;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Línea de seguimiento entre ambos jugadores
    if (riP) {
      ctx.save();
      ctx.strokeStyle = cfg ? cfg.rival : '#ff7043';
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(meP.x, meP.y);
      ctx.lineTo(riP.x, riP.y);
      ctx.stroke();
      ctx.restore();
    }

    if (riP) marker(ctx, riP, (cfg && cfg.rival) || '#ff7043', cfg && cfg.labels ? pairLabel(d.rival, 'Rival') : '', false, style, !!(d.rival && d.rival.alive === false));
    marker(ctx, meP, (cfg && cfg.me) || '#4fc3f7', cfg && cfg.labels ? pairLabel(d.me, 'Tú') : '', true, style, !!(d.me && d.me.alive === false));

    // Brújula / progreso
    if (cfg && cfg.compass) {
      const pct = Math.round((d.me ? d.me.x : 0) * 100);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.font = '700 9px "Segoe UI",sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'right';
      ctx.fillText(pct + '%', w - 6, h - 5);
      ctx.restore();
    }
  }

  function pairLabel(o, fallback) {
    if (!o) return fallback;
    const n = String(o.name || fallback).slice(0, 9);
    const dead = o.alive === false;
    const pipes = (typeof o.pipes === 'number') ? ' ' + o.pipes : '';
    const t = (!pipes && typeof o.time === 'number' && o.time > 0) ? ' ' + o.time.toFixed(1) + 's' : '';
    return n + pipes + t + (dead ? ' 💀' : '');
  }

  // Actualiza los datos y redibuja como máximo cada 120 ms.
  function update(d) {
    if (!active || !cfg || !cfg.on || cfg.hidden) return;
    data = d;
    const now = Date.now();
    if (d && d.me) {
      const p = point(d.me.x, d.me.y);
      const last = trail[trail.length - 1];
      if (!last || Math.abs(last.x - p.x) > 1.2 || Math.abs(last.y - p.y) > 1.2) {
        trail.push(p);
        if (trail.length > 18) trail.shift();
      }
    }
    if (now - lastDraw < 120) return;
    lastDraw = now;
    draw(data);
  }

  function bind() {
    const mini = $('radarMin');
    if (mini && !mini.__bound) {
      mini.__bound = true;
      mini.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        const cur = readCfg();
        if (cur.minimized) SAVE.setRadar({ minimized: false, hidden: false });
        else SAVE.setRadar({ minimized: true });
        refresh();
        try { if (window.SND) SND.sfx.click(); } catch (err) { }
      };
    }
    const hide = $('radarHide');
    if (hide && !hide.__bound) {
      hide.__bound = true;
      hide.onclick = function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        SAVE.setRadar({ hidden: true });
        refresh();
        try { if (window.SND) SND.sfx.click(); } catch (err) { }
      };
    }
    const restore = $('radarRestore');
    if (restore && !restore.__bound) {
      restore.__bound = true;
      restore.onclick = function () {
        SAVE.setRadar({ hidden: false, minimized: false });
        refresh();
        try { if (window.SND) SND.sfx.click(); } catch (err) { }
      };
    }
    const box = el();
    if (box && !box.__bound) {
      box.__bound = true;
      box.onclick = function () {
        const cur = readCfg();
        if (cur.minimized) { SAVE.setRadar({ minimized: false }); refresh(); }
      };
    }
  }

  function init() {
    cfg = readCfg();
    bind();
    refresh();
  }

  return { init, refresh, setActive, update, resetTrail };
})();
