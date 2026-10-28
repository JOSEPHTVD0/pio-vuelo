/* Partículas, sacudida de pantalla y textos flotantes */
window.FX = (function () {
  'use strict';

  let parts = [];
  let texts = [];
  let shakeMag = 0;
  let shakeX = 0, shakeY = 0;
  let RED = false; // "reducir movimiento" (accesibilidad)

  function setReduced(v) { RED = !!v; }
  function isReduced() { return RED; }
  function fxN(n) { return RED ? Math.min(4, n / 3) : n; }

  function burst(x, y, color, n, speed, opts) {
    opts = opts || {};
    const q = (window.SAVE && SAVE.get().set.gfx) || 'high';
    n = fxN(Math.max(1, Math.round(n * (q === 'high' ? 1 : q === 'medium' ? 0.55 : 0.3))));
    for (let i = 0; i < n; i++) {
      const a = (Math.random() * Math.PI * 2);
      const v = speed * (0.4 + Math.random() * 0.9);
      parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.5 + Math.random() * 0.6,
        max: 1.1,
        size: 2 + Math.random() * (opts.big ? 5 : 3),
        color, grav: opts.grav !== undefined ? opts.grav : 600,
        shape: opts.shape || 'circle',
        rot: Math.random() * Math.PI
      });
    }
  }

  function puff(x, y, color, n) { burst(x, y, color, n, 90, { grav: 120, big: true }); }

  // Estela: partículas alargadas que quedan "pegadas" detrás del pájaro
  function trail(x, y, color, n, stars) {
    const q = (window.SAVE && SAVE.get().set.gfx) || 'high';
    n = fxN(Math.max(2, Math.round(n * (q === 'high' ? 1 : q === 'medium' ? 0.6 : 0.35))));
    for (let i = 0; i < n; i++) {
      parts.push({
        x: x - (4 + Math.random() * 22), y: y + (Math.random() - 0.5) * 16,
        vx: -(40 + Math.random() * 70), vy: -14 - Math.random() * 30,
        life: 0.24 + Math.random() * 0.42, max: 0.66,
        size: 2.2 + Math.random() * 3.2,
        color, grav: -26, shape: 'streamer'
      });
    }
    if (stars) {
      for (let i = 0; i < 2; i++) spark(x - Math.random() * 26, y + (Math.random() - 0.5) * 20, color);
    }
  }

  // Chispa en forma de estrella de 4 puntas
  function spark(x, y, color) {
    parts.push({
      x, y,
      vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40,
      life: 0.5 + Math.random() * 0.3, max: 0.8,
      size: 1.6 + Math.random() * 1.4,
      color, grav: -10, shape: 'star',
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 8
    });
  }

  function confetti(x, y) {
    if (RED) return;
    const colors = ['#ffd54f', '#ff7043', '#4fc3f7', '#69f0ae', '#f06292', '#b388ff'];
    const q = (window.SAVE && SAVE.get().set.gfx) || 'high';
    const n = Math.max(1, Math.round(18 * (q === 'high' ? 1 : q === 'medium' ? 0.55 : 0.3)));
    for (let i = 0; i < n; i++) {
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * 320,
        vy: -180 - Math.random() * 260,
        life: 0.8 + Math.random() * 0.7, max: 1.5,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        grav: 480, shape: 'rect', rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12
      });
    }
  }

  function text(x, y, str, size, color) {
    texts.push({ x, y, str, size: size || 18, color: color || '#fff', life: 1.1, max: 1.1 });
  }

  function shake(amount) {
    if (amount <= 0) { shakeMag = 0; shakeX = shakeY = 0; return; }
    if (RED) return;
    shakeMag = Math.max(shakeMag, amount);
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt;
      t.y -= 46 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
    if (shakeMag > 0.2) {
      shakeX = (Math.random() - 0.5) * shakeMag;
      shakeY = (Math.random() - 0.5) * shakeMag;
      shakeMag *= Math.pow(0.02, dt); // decae rápido
      if (shakeMag < 0.2) { shakeMag = 0; shakeX = shakeY = 0; }
    } else {
      shakeX = shakeY = 0;
    }
  }

  function draw(ctx, useShake) {
    ctx.save();
    if (useShake !== false) ctx.translate(shakeX, shakeY);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const alpha = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.shape === 'streamer') {
        const dx = p.vx * 0.28, dy = p.vy * 0.28;
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = p.size * 0.9;
        ctx.beginPath();
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x + dx, p.y + dy);
        ctx.stroke();
      } else if (p.shape === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = k * Math.PI / 4;
          const rad = k % 2 === 0 ? p.size * 2.4 : p.size * 0.9;
          const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - p.life / p.max * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life / (t.max * 0.6)));
      ctx.font = '900 ' + t.size + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return { x: shakeX, y: shakeY };
  }

  function getShake() { return { x: shakeX, y: shakeY }; }

  function clear() { parts.length = 0; texts.length = 0; }

  return { burst, puff, trail, spark, confetti, text, shake, update, draw, getShake, clear, setReduced, isReduced };
})();