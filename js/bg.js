/* Fondos por mapa con parallax y pre-render del cielo */
window.BG = (function () {
  'use strict';

  let map = null;
  let W = 0, H = 0;
  let skyCanvas = null;
  let scroll = 0;
  let clouds = [];
  let stars = [];
  let bubbles = [];
  let amb = [];
  let ambT = 0;
  let flash = 0;      // relámpago (tormenta): 0..1
  const baseSpeed = 60;

  // Efectos ambientales por mapa: lluvia, nieve, brasas, pétalos, motas de luz
  function ambStyle(id) {
    switch (id) {
      case 'tundra': case 'nevadoM': return { type: 'snow', n: 16, col: '#ffffff' };
      case 'aurora': return { type: 'snow', n: 10, col: '#d0f8ff' };
      case 'volcano': return { type: 'embers', n: 14, col: '#ffb300', col2: '#ff6e40' };
      case 'primavera': case 'candy': return { type: 'petals', n: 12, col: '#ff80ab', col2: '#ffd54f' };
      case 'forest': case 'selva': return { type: 'petals', n: 10, col: '#a5d6a7', col2: '#66bb6a' };
      case 'water': case 'esmeralda': return { type: 'motes', n: 12, col: '#80deea' };
      case 'space': case 'night': case 'magia': return { type: 'motes', n: 14, col: '#c5a8ff' };
      case 'desierto': case 'playa': return { type: 'motes', n: 10, col: '#ffe0a0' };
      case 'cyber': case 'arcade': case 'volt': case 'ciudad': return { type: 'rain', n: 16, col: 'rgba(170,215,255,0.65)' };
      case 'tormenta': return { type: 'rain', n: 22, col: 'rgba(210,230,255,0.8)' };
      case 'rubi': return { type: 'motes', n: 12, col: '#ff80ab' };
      case 'luna': return { type: 'motes', n: 12, col: '#c9a8ff' };
      case 'cafe': return { type: 'motes', n: 8, col: '#d7a86e' };
      case 'oceano': return { type: 'motes', n: 12, col: '#80deea' };
      case 'ruinas': return { type: 'motes', n: 10, col: '#d4a017' };
      case 'pantano': return { type: 'motes', n: 10, col: '#9ccc65' };
      case 'cometa': return { type: 'motes', n: 14, col: '#b388ff' };
      default: return null;
    }
  }

  function spawnAmb(st) {
    amb = [];
    if (!st) return;
    for (let i = 0; i < st.n; i++) {
      amb.push({
        x: Math.random() * W, y: Math.random() * H,
        size: 1.6 + Math.random() * 2.6,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 3,
        col: Math.random() < 0.5 ? st.col : (st.col2 || st.col),
        ph: Math.random() * Math.PI * 2
      });
    }
  }

  function reset() {
    clouds = [];
    stars = [];
    bubbles = [];
    scroll = 0;
    const n = Math.ceil(W / 260) + 1;
    for (let i = 0; i < n; i++) {
      clouds.push({ x: i * 260 + Math.random() * 150, y: 40 + Math.random() * (H * 0.3), s: 0.7 + Math.random() * 0.9, v: 8 + Math.random() * 14 });
    }
    const ns = Math.floor(W / 40);
    for (let i = 0; i < ns; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H * 0.8, r: 0.5 + Math.random() * 1.6, ph: Math.random() * Math.PI * 2, sp: 1 + Math.random() * 3 });
    }
    if (map.bubbles) {
      const nb = Math.max(8, Math.floor(W / 60));
      for (let i = 0; i < nb; i++) {
        bubbles.push({ x: Math.random() * W, y: Math.random() * H, r: 3 + Math.random() * 8, v: 14 + Math.random() * 26 });
      }
    }
    ambT = 0; flash = 0;
    spawnAmb(ambStyle(map.id));
  }

  function init(mapId) {
    map = DAT.getMap(mapId);
    skyCanvas = null;
    reset();
  }

  function resize(w, h) {
    const changed = w !== W || h !== H;
    W = w; H = h;
    if (changed) skyCanvas = null;
  }

  function buildSky() {
    if (skyCanvas) return;
    skyCanvas = document.createElement('canvas');
    skyCanvas.width = Math.max(16, Math.floor(W / 3));
    skyCanvas.height = Math.max(16, Math.floor(H / 2));
    const c = skyCanvas.getContext('2d');
    const grad = c.createLinearGradient(0, 0, 0, skyCanvas.height);
    grad.addColorStop(0, map.sky[0]);
    grad.addColorStop(1, map.sky[1]);
    c.fillStyle = grad;
    c.fillRect(0, 0, skyCanvas.width, skyCanvas.height);

    // Sol / luna
    const hideH = skyCanvas.height;
    const r = hideH * 0.16;
    const sx = skyCanvas.width * 0.78, sy = hideH * 0.34;
    if (map.stars) {
      const g = c.createRadialGradient(sx, sy, 2, sx, sy, r * 2);
      g.addColorStop(0, '#f5f7ff'); g.addColorStop(1, 'rgba(245,247,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r * 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f5f7ff'; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
      // cráteres
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.beginPath(); c.arc(sx - r * 0.3, sy - r * 0.2, r * 0.18, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + r * 0.25, sy + r * 0.15, r * 0.13, 0, Math.PI * 2); c.fill();
    } else {
      const g = c.createRadialGradient(sx, sy, 2, sx, sy, r * 2.4);
      g.addColorStop(0, 'rgba(255,236,170,0.95)');
      g.addColorStop(0.35, 'rgba(255,230,180,0.55)');
      g.addColorStop(1, 'rgba(255,230,180,0)');
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r * 2.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(sx, sy, r * 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(sx - r * 0.2, sy - r * 0.25, r * 0.4, 0, Math.PI * 2); c.fill();
    }

    // Nebulosa para el espacio/mapa nebula
    if (map.id === 'space' || map.id === 'neon') {
      for (let i = 0; i < 3; i++) {
        const nx = Math.random() * skyCanvas.width, ny = Math.random() * skyCanvas.height;
        const gr = c.createRadialGradient(nx, ny, 4, nx, ny, skyCanvas.height * 0.28);
        const cols = ['rgba(180,120,255,0.16)', 'rgba(0,200,255,0.12)', 'rgba(255,90,180,0.12)'];
        gr.addColorStop(0, cols[i]); gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; c.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
      }
    }
    // Grid synthwave horizonte
    if (map.grid) {
      c.strokeStyle = 'rgba(255,80,180,0.25)';
      c.lineWidth = 1.5;
      const horizon = skyCanvas.height * 0.62;
      for (let x = 0; x < skyCanvas.width; x += 24) {
        c.beginPath(); c.moveTo(x, horizon); c.lineTo(x, skyCanvas.height); c.stroke();
      }
      for (let y = horizon; y < skyCanvas.height; y += 18) {
        c.beginPath(); c.moveTo(0, y);
        c.lineTo(skyCanvas.width, y);
        c.stroke();
      }
    }
  }

  function update(dt, worldSpeed) {
    // scroll se controla con la velocidad del juego o lento en menú
    const sp = worldSpeed !== undefined ? worldSpeed : baseSpeed * 0.5;
    const f = sp * dt;
    // scroll crece libremente (ciclo largo): las capas se desplazan con parallax real
    scroll = (scroll + f) % 2048;
    for (let i = 0; i < clouds.length; i++) {
      const cl = clouds[i];
      cl.x -= cl.v * dt * (sp / 140);
      if (cl.x < -200) { cl.x += W + 420; cl.y = 30 + Math.random() * H * 0.35; }
    }
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      st.ph += st.sp * dt;
    }
    if (map && map.bubbles) {
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.y -= b.v * dt;
        b.x += Math.sin((b.y + i) * 0.03) * 6 * dt;
        if (b.y < -20) { b.y = H + 12; b.x = Math.random() * W; }
      }
    }
    const st = ambStyle(map.id);
    if (st) {
      ambT += dt;
      for (let i = 0; i < amb.length; i++) {
        const a = amb[i];
        const sway = Math.sin(ambT * 2 + a.ph) * 18 * dt;
        const sl = Math.sin(ambT * 1.4 + a.ph * 1.7) * 12 * dt;
        a.rot += a.vr * dt;
        if (st.type === 'rain') {
          a.y += 540 * dt; a.x -= 170 * dt; a.ph += 30 * dt;
          if (a.y > H + 16) { a.y = -16; a.x = Math.random() * W; }
        } else if (st.type === 'snow') {
          a.y += 55 * dt; a.x += sway;
          if (a.y > H + 12) { a.y = -12; a.x = Math.random() * W; }
        } else if (st.type === 'embers') {
          a.y -= 45 * dt; a.x += sl;
          if (a.y < -14) { a.y = H + 10; a.x = Math.random() * W; }
        } else if (st.type === 'petals') {
          a.y += 45 * dt; a.x += sway * 0.8;
          if (a.y > H + 12) { a.y = -12; a.x = Math.random() * W; }
        } else { // motes: flotan y titilan
          a.y -= 16 * dt; a.x += Math.sin(ambT * 1.1 + a.ph) * 8 * dt;
          if (a.y < -10) { a.y = H + 8; a.x = Math.random() * W; }
        }
      }
    }
    if (map.id === 'tormenta') {
      if (Math.random() < dt * 0.4) flash = Math.max(flash, 0.65 + Math.random() * 0.35);
      flash = Math.max(0, flash - dt * 2.4);
    }
  }

  function draw(ctx) {
    buildSky();
    // Cielo (estirar, con ligero parallax vertical 0)
    ctx.drawImage(skyCanvas, 0, 0, W, H);

    // Auroras boreales (Noche Polar / Aurora)
    if (map.id === 'aurora' || map.id === 'nevadoM') drawAurora(ctx);

    // Estrellas
    if (map.stars) {
      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(st.ph));
        ctx.globalAlpha = Math.max(0.1, tw);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Nubes
    ctx.fillStyle = map.cloud;
    for (let i = 0; i < clouds.length; i++) {
      const cl = clouds[i];
      ctx.globalAlpha = 0.7;
      drawCloud(ctx, cl.x, cl.y, cl.s);
    }
    ctx.globalAlpha = 1;

    // Colinas lejanas
    drawHills(ctx, 1, map.hill1, 0.4);
    drawHills(ctx, 0.65, map.hill2, 0.7);

    // Partículas ambientales del mapa (lluvia, nieve, brasas, pétalos, motas)
    const st = ambStyle(map.id);
    if (st && amb.length) {
      ctx.save();
      if (st.type === 'motes' || st.type === 'embers') ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < amb.length; i++) {
        drawAmb(ctx, i, st);
      }
      ctx.restore();
    }

    // Destello de relámpago (tormenta)
    if (flash > 0) {
      ctx.fillStyle = 'rgba(235,245,255,' + Math.min(0.55, flash * 0.55).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // Burbujas (submarino)
    if (map.bubbles) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x + b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Suelo
    drawGround(ctx);
  }

  function drawCloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 24 * s, y - 12 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 46 * s, y, 20 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cortina de aurora boreal (ondas de luz verde/violeta)
  function drawAurora(ctx) {
    const cols = ['rgba(70,220,160,0.16)', 'rgba(140,110,255,0.14)', 'rgba(0,220,255,0.12)'];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      const baseY = H * (0.12 + b * 0.07);
      ctx.moveTo(-20, baseY + 12);
      for (let x = 0; x <= W + 40; x += 40) {
        const wob = Math.sin((scroll * 60 + x * 0.02) + b * 2.1) * 26
          + Math.sin(x * 0.045 + ambT * 1.3 + b) * 14;
        ctx.lineTo(x, baseY + wob);
      }
      ctx.lineTo(W + 20, baseY + 46);
      ctx.lineTo(-20, baseY + 46);
      ctx.closePath();
      ctx.fillStyle = cols[b];
      ctx.fill();
    }
    ctx.restore();
  }

  // Dibuja una partícula ambiental según el tipo del mapa
  function drawAmb(ctx, i, st) {
    const a = amb[i];
    if (st.type === 'rain') {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = a.col;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + 8, a.y + 18);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (st.type === 'snow') {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = a.col;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (st.type === 'petals') {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = a.col;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, a.size, a.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else { // motes / brasas: gloria luminosa que titila
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(ambT * 3 + a.ph));
      ctx.globalAlpha = tw * 0.9;
      ctx.fillStyle = a.col;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = tw * 0.28;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.size * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawHills(ctx, amp, color, layer) {
    const off = (scroll * 300 * layer) % (W + 120);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-off - 120, H);
    const step = 120;
    for (let x = -off - 120; x <= W + 220; x += step) {
      ctx.quadraticCurveTo(x + step / 2, H - amp * 90, x + step, H);
    }
    ctx.lineTo(W + 120, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround(ctx) {
    const gh = Math.max(64, H * 0.11);
    const o = (scroll * 380) % 48;
    ctx.fillStyle = map.ground;
    ctx.fillRect(0, H - gh, W, gh + 2);
    // franja superior de tierra
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, H - gh, W, 6);
    // patrón rayas
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const y1 = H - gh / 2;
    for (let x = -o - 48; x < W + 48; x += 48) {
      ctx.moveTo(x, y1); ctx.lineTo(x + 24, y1 - 18); ctx.lineTo(x + 48, y1);
    }
    ctx.stroke();
  }

  function getMap() { return map; }

  return { init, resize, update, draw, getMap, reset };
})();