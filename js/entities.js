/* Entidades: pajarito, obstáculos (tubos) y monedas + dibujado de skins/sombreros */
window.ENTS = (function () {
  'use strict';

  let HC = false; // contraste alto (ajustes)
  function setHC(v) { HC = !!v; }

  /* ============ PAJARITO ============ */
  function drawBird(ctx, x, y, opts) {
    const skin = opts.skin;
    const t = opts.t;               // tiempo global
    const wing = opts.wingPhase;    // 0..1
    const squash = opts.squash || 1;
    const scale = opts.scale || 1;
    const rot = opts.rot || 0;
    const r = opts.r || 17;         // radio visual de referencia

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale / squash, scale * squash);
    if (opts.ghost) ctx.globalAlpha *= 0.68; // modo fantasma: semi-transparente

    // color body (especiales)
    let body = skin.body, belly = skin.belly, wingC = skin.wing;
    if (skin.rainbow) {
      const h = (t * 220) % 360;
      body = 'hsl(' + h + ',90%,62%)';
      belly = 'hsl(' + ((h + 40) % 360) + ',90%,80%)';
      wingC = 'hsl(' + ((h + 120) % 360) + ',90%,55%)';
    } else if (skin.nebula) {
      body = 'hsl(' + ((220 + t * 60) % 360) + ',70%,60%)';
      belly = '#ede7f6'; wingC = '#27166b';
    }

    if (skin.golden) { body = '#ffd54f'; belly = '#fff7cc'; wingC = '#ffab00'; } // variante dorada: paleta de oro

    if (skin.ghost) ctx.globalAlpha *= 0.82; // la skin fantasma resta opacidad sin pisar la del modo fantasma

    // cola
    ctx.fillStyle = wingC;
    ctx.save();
    ctx.translate(-r * 0.95, r * 0.15);
    ctx.rotate(-0.5 + Math.sin(t * 6) * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-r * 0.55, -r * 0.55); ctx.lineTo(-r * 0.5, r * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // cuerpo (elipse)
    const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.15);
    if (skin.rainbow) {
      const h = ((t * 220) + 40) % 360;
      bg.addColorStop(0, 'hsl(' + h + ',90%,74%)');
      bg.addColorStop(0.5, 'hsl(' + ((h + 90) % 360) + ',90%,66%)');
      bg.addColorStop(1, 'hsl(' + ((h + 200) % 360) + ',90%,74%)');
    } else {
      bg.addColorStop(0, lighten(body, 25));
      bg.addColorStop(1, body);
    }
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.98, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    // panza
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(-r * 0.12, r * 0.35, r * 0.62, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // ala (bate)
    ctx.fillStyle = wingC;
    ctx.save();
    ctx.translate(-r * 0.28, -r * 0.05);
    ctx.rotate(Math.sin(wing * Math.PI * 2) * 0.85 - 0.2);
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, 0, r * 0.6, r * 0.34, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ojo
    const eyeX = r * 0.45;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(eyeX, -r * 0.28, r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(eyeX + r * 0.1, -r * 0.28, r * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(eyeX + r * 0.14, -r * 0.33, r * 0.06, 0, Math.PI * 2); ctx.fill();

    // pico
    ctx.fillStyle = skin.beak;
    ctx.beginPath();
    ctx.moveTo(eyeX + r * 0.25, -r * 0.06);
    ctx.lineTo(eyeX + r * 0.85, r * 0.08);
    ctx.lineTo(eyeX + r * 0.25, r * 0.22);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = HC ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)'; ctx.lineWidth = HC ? 2.8 : 1.2;
    ctx.beginPath(); ctx.moveTo(eyeX + r * 0.3, r * 0.06); ctx.lineTo(eyeX + r * 0.72, r * 0.085); ctx.stroke();

    // mejilla
    if (skin.blush || skin.lindo) {
      ctx.fillStyle = 'rgba(240,80,120,0.5)';
      ctx.beginPath(); ctx.arc(r * 0.3, r * 0.3, r * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.28, r * 0.12, 0, Math.PI * 2); ctx.fill();
    } else if (skin.cheek) {
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = skin.cheek;
      ctx.beginPath(); ctx.arc(r * 0.3, r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= 1 / 0.55; // deshacer el velo de la mejilla sin pisar modo/skin fantasma
    }

    // brillo especiales
    if (skin.shine || skin.sparkle || skin.ice) {
      ctx.fillStyle = skin.shine ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.4, r * 0.12, 0, Math.PI * 2); ctx.fill();
    }

    // estrella Hada
    if (skin.sparkle) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 2; i++) {
        const ss = Math.sin(t * 4 + i * 2.4);
        ctx.globalAlpha *= 0.6 + 0.4 * ss;
        ctx.beginPath();
        ctx.arc(-r * (0.9 + i * 0.3), r * (0.6 - i * 0.3), 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha /= 0.6 + 0.4 * ss; // revertir sin pisar modo/skin fantasma
      }
    }

    // skate (gorrito visera) como detalle de skin
    if (skin.skate) {
      ctx.fillStyle = '#ff6e40';
      ctx.beginPath(); ctx.arc(0, -r * 0.78, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(eyeX - r * 0.1, -r * 0.95); ctx.lineTo(eyeX - r * 0.1 + r * 0.3, -r * 0.95 - r * 0.16); ctx.lineTo(eyeX - r * 0.1, -r * 0.95 - r * 0.32); ctx.closePath(); ctx.fill();
    }

    // Tigre: rayas oscuras
    if (skin.tiger) {
      ctx.strokeStyle = '#6d4c2a'; ctx.lineWidth = r * 0.09; ctx.globalAlpha = 0.6;
      for (let i = -1; i <= 1; i++) {
        const yy = r * 0.05 + i * r * 0.36;
        ctx.beginPath(); ctx.moveTo(-r * 0.92, yy); ctx.quadraticCurveTo(r * 0.1, yy - r * 0.1, r * 0.86, yy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Michi: orejas + bigotes
    if (skin.kitty) {
      ctx.fillStyle = wingC;
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.35); ctx.lineTo(-r * 0.3, -r * 1.0); ctx.lineTo(-r * 0.02, -r * 0.4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.35); ctx.lineTo(r * 0.6, -r * 1.0); ctx.lineTo(r * 0.85, -r * 0.35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f48fb1';
      ctx.beginPath(); ctx.moveTo(-r * 0.43, -r * 0.4); ctx.lineTo(-r * 0.3, -r * 0.78); ctx.lineTo(-r * 0.14, -r * 0.42); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.4); ctx.lineTo(r * 0.6, -r * 0.78); ctx.lineTo(r * 0.72, -r * 0.38); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6d7d8a'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(r * 0.5, r * 0.22); ctx.lineTo(r * 1.05, r * 0.18);
      ctx.moveTo(r * 0.52, r * 0.32); ctx.lineTo(r * 1.1, r * 0.36);
      ctx.stroke();
    }

    // Cacto: púas
    if (skin.cactus) {
      ctx.strokeStyle = '#d5f5d9'; ctx.lineWidth = 1.4;
      const spikes = [0.4, 1.1, 1.9, 2.6, 3.4, 4.4, 5.0];
      for (let i = 0; i < spikes.length; i++) {
        const a = spikes[i] - Math.PI / 2;
        const x1 = Math.cos(a) * r * 0.98, y1 = Math.sin(a) * r * 0.92;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(a) * r * 0.2, y1 + Math.sin(a) * r * 0.2); ctx.stroke();
      }
    }

    // Marciano: antena con esfera
    if (skin.alien) {
      ctx.strokeStyle = '#37474f'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(r * 0.28, -r * 0.4); ctx.lineTo(r * 0.28, -r * 0.95); ctx.stroke();
      ctx.fillStyle = '#ffb300';
      ctx.beginPath(); ctx.arc(r * 0.28, -r * 1.0, r * 0.13, 0, Math.PI * 2); ctx.fill();
    }

    // EVOLUCIÓN: etapa 2 añade un penacho dorado; etapa 3 (y toda dorada) añade aura y chispas
    if (opts.stage >= 2) {
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, r * 0.1);
      ctx.lineTo(-r * 0.05, -r * 0.75);
      ctx.quadraticCurveTo(-r * 0.42, -r * 0.62, -r * 0.42, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.moveTo(-r * 0.05, -r * 0.75);
      ctx.lineTo(-r * 0.24, -r * 1.02);
      ctx.quadraticCurveTo(-r * 0.55, -r * 1.0, -r * 0.52, -r * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    if (opts.golden || opts.stage >= 3) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 8);
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,224,102,0.95)';
      const gx = r * 0.72 + Math.sin(t * 6) * r * 0.12;
      ctx.beginPath(); ctx.arc(-gx, -r * 0.55, r * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(gx * 0.15, -r * 0.85, r * 0.06, 0, Math.PI * 2); ctx.fill();
    }

    // sombrero elegido
    if (opts.hat) drawHat(ctx, opts.hat, r, t);

    ctx.restore();
  }

  function drawHat(ctx, hat, r, t) {
    ctx.save();
    ctx.translate(0, -r * 0.78);
    const h = DAT.getHat(hat);
    if (!h) { ctx.restore(); return; }
    switch (h.type) {
      case 'crown': {
        ctx.fillStyle = '#ffca28';
        ctx.strokeStyle = '#c8910f'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, 0);
        ctx.lineTo(-r * 0.5, -r * 0.35);
        ctx.lineTo(-r * 0.28, -r * 0.12);
        ctx.lineTo(0, -r * 0.42);
        ctx.lineTo(r * 0.28, -r * 0.12);
        ctx.lineTo(r * 0.5, -r * 0.35);
        ctx.lineTo(r * 0.5, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e53935';
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * r * 0.2, -r * 0.1, 2.4, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'xmas': {
        ctx.fillStyle = '#ef5350';
        ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(0, -r * 0.85); ctx.lineTo(r * 0.55, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -r * 0.85, r * 0.11, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-r * 0.3, -r * 0.25, r * 0.18, 2.4);
        break;
      }
      case 'cowboy': {
        ctx.fillStyle = '#6d4c41';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.18, 0, 0, Math.PI * 2); ctx.fill(); // ala
        ctx.beginPath(); ctx.moveTo(-r * 0.38, 0); ctx.lineTo(0, -r * 0.55); ctx.lineTo(r * 0.38, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5d4037';
        ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 0.55); ctx.lineTo(r * 0.05, -r * 0.55); ctx.lineTo(r * 0.2, -r * 0.05); ctx.lineTo(-r * 0.2, -r * 0.05); ctx.closePath(); ctx.fill();
        break;
      }
      case 'headphones': {
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = r * 0.16;
        ctx.beginPath(); ctx.arc(0, -r * 0.06, r * 0.5, Math.PI * 0.95, Math.PI * 2.05); ctx.stroke();
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.05, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.5, r * 0.05, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#455a64';
        ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.05, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.5, r * 0.05, r * 0.08, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'halo': {
        ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.ellipse(0, -r * 0.16, r * 0.42, r * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'vr': {
        const gy = r * 0.2;
        ctx.fillStyle = '#141a24';
        ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2;
        ctx.fillRect(-r * 0.6, -gy, r * 0.4, r * 0.28);
        ctx.strokeRect(-r * 0.6, -gy, r * 0.4, r * 0.28);
        ctx.fillRect(r * 0.2, -gy, r * 0.4, r * 0.28);
        ctx.strokeRect(r * 0.2, -gy, r * 0.4, r * 0.28);
        ctx.beginPath(); ctx.moveTo(-r * 0.2, -gy + r * 0.05); ctx.lineTo(r * 0.2, -gy + r * 0.05); ctx.stroke();
        ctx.fillStyle = 'rgba(0,229,255,0.4)';
        ctx.beginPath(); ctx.arc(r * 0.4, -gy + r * 0.13, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.4, -gy + r * 0.13, r * 0.08, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'party': {
        ctx.fillStyle = '#ab47bc';
        ctx.beginPath(); ctx.moveTo(-r * 0.34, 0); ctx.lineTo(0, -r * 0.5); ctx.lineTo(r * 0.34, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.1, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'propeller': {
        ctx.fillStyle = '#78909c';
        ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 2.2;
        const a = t * 16;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5 * Math.cos(a), -r * 0.5 * Math.sin(a) - r * 0.12);
        ctx.lineTo(r * 0.5 * Math.cos(a), r * 0.5 * Math.sin(a) - r * 0.12);
        ctx.stroke();
        break;
      }
      case 'piracy': {
        ctx.fillStyle = '#37474f';
        ctx.beginPath(); ctx.moveTo(-r * 0.62, 0); ctx.lineTo(-r * 0.5, -r * 0.4); ctx.quadraticCurveTo(0, -r * 0.62, r * 0.5, -r * 0.4); ctx.lineTo(r * 0.62, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-r * 0.62, 0); ctx.lineTo(r * 0.62, 0); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -r * 0.26, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#455a64';
        ctx.beginPath(); ctx.fillRect(-r * 0.05, -r * 0.34, r * 0.1, r * 0.16); ctx.beginPath(); ctx.arc(0, -r * 0.34, r * 0.05, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#263238';
        ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.28, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.28, 1.6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'flower': {
        ctx.fillStyle = '#f06292';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.14, Math.sin(a) * r * 0.14 - r * 0.14, r * 0.16, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(0, -r * 0.14, r * 0.14, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bonnet': {
        ctx.fillStyle = '#7e57c2';
        ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.52, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b39ddb';
        ctx.beginPath(); ctx.arc(0, -r * 0.15 - r * 0.52 + r * 0.1, r * 0.26, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.52, Math.PI * 1.05, Math.PI * 1.1); ctx.stroke();
        // estrellitas
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-r * 0.24, -r * 0.42, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.56, 1.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
    case 'wizard': {
        ctx.fillStyle = '#5c6bc0';
        ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.quadraticCurveTo(0, -r * 1.02, r * 0.5, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7986cb';
        ctx.fillRect(-r * 0.5, -r * 0.08, r * 1.0, r * 0.2);
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath(); ctx.arc(0, -r * 0.68, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.42, r * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.2, -r * 0.2, r * 0.05, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ears': {
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.1); ctx.lineTo(-r * 0.28, -r * 0.8); ctx.lineTo(-r * 0.02, -r * 0.1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.1); ctx.lineTo(r * 0.6, -r * 0.8); ctx.lineTo(r * 0.85, -r * 0.1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.16); ctx.lineTo(-r * 0.3, -r * 0.58); ctx.lineTo(-r * 0.16, -r * 0.18); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.16); ctx.lineTo(r * 0.58, -r * 0.58); ctx.lineTo(r * 0.72, -r * 0.16); ctx.closePath(); ctx.fill();
        break;
      }
      case 'mushroom': {
        ctx.fillStyle = '#ab6e4d';
        ctx.beginPath(); ctx.moveTo(-r * 0.22, 0); ctx.lineTo(-r * 0.18, -r * 0.55); ctx.lineTo(r * 0.18, -r * 0.55); ctx.lineTo(r * 0.22, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(0, -r * 0.6, r * 0.55, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.62, r * 0.09, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.08, -r * 0.48, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.24, -r * 0.68, r * 0.06, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'star': {
        ctx.fillStyle = '#ffd54f';
        ctx.strokeStyle = '#f9a825'; ctx.lineWidth = 1.6;
        const sx = r * 0.48;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + k * Math.PI / 5;
          const rad = k % 2 === 0 ? sx : sx * 0.44;
          const px = Math.cos(a) * rad, py = Math.sin(a) * rad - r * 0.34;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, -r * 0.34 - r * 0.02, r * 0.08, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'band': {
        ctx.fillStyle = '#37474f';
        ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.05); ctx.quadraticCurveTo(0, -r * 0.62, r * 0.6, -r * 0.05); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1e88e5';
        ctx.beginPath(); ctx.arc(0, -r * 0.14, r * 0.34, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-r * 0.6, -r * 0.07, r * 1.2, r * 0.07);
        break;
      }
      case 'house': {
        ctx.fillStyle = '#ffcc80';
        ctx.beginPath(); ctx.moveTo(-r * 0.58, r * 0.02); ctx.lineTo(-r * 0.58, -r * 0.34); ctx.lineTo(0, -r * 0.78); ctx.lineTo(r * 0.58, -r * 0.34); ctx.lineTo(r * 0.58, r * 0.02); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-r * 0.58, -r * 0.34); ctx.lineTo(0, -r * 0.78); ctx.lineTo(r * 0.58, -r * 0.34); ctx.stroke();
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(-r * 0.13, -r * 0.28, r * 0.26, r * 0.3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-r * 0.02, -r * 0.18, r * 0.04, r * 0.2);
        break;
      }
      case 'antenna': {
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.9); ctx.stroke();
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(0, -r * 0.9 - r * 0.08, r * 0.14, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bow': {
        ctx.fillStyle = '#ec407a';
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.12);
        ctx.quadraticCurveTo(-r * 0.75, -r * 0.5, -r * 0.55, 0);
        ctx.quadraticCurveTo(-r * 0.75, r * 0.32, -r * 0.2, -r * 0.12);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(r * 0.2, -r * 0.12);
        ctx.quadraticCurveTo(r * 0.75, -r * 0.5, r * 0.55, 0);
        ctx.quadraticCurveTo(r * 0.75, r * 0.32, r * 0.2, -r * 0.12);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f48fb1';
        ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.14, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'horns': {
        ctx.fillStyle = '#f5e7c8';
        ctx.strokeStyle = '#c9b089'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-r * 0.42, 0); ctx.quadraticCurveTo(-r * 0.55, -r * 0.55, -r * 0.3, -r * 0.78); ctx.quadraticCurveTo(-r * 0.42, -r * 0.5, -r * 0.28, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.42, 0); ctx.quadraticCurveTo(r * 0.55, -r * 0.55, r * 0.3, -r * 0.78); ctx.quadraticCurveTo(r * 0.42, -r * 0.5, r * 0.28, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'mask': {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, -r * 0.08, r * 0.58, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 0.58, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.06, r * 0.12, r * 0.055, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.22, -r * 0.06, r * 0.12, r * 0.055, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-r * 0.12, -r * 0.22, r * 0.24, r * 0.1);
        ctx.fillStyle = '#455a64';
        ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.06, r * 0.045, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.22, -r * 0.06, r * 0.045, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.3, -r * 0.6); ctx.lineTo(-r * 0.12, -r * 0.18); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.2); ctx.lineTo(r * 0.3, -r * 0.6); ctx.lineTo(r * 0.12, -r * 0.18); ctx.closePath(); ctx.fill();
        break;
      }
      case 'helmet': {
        ctx.fillStyle = '#b0bec5';
        ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.55, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(-r * 0.62, -r * 0.08, r * 1.24, r * 0.16);
        ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.lineTo(0, -r * 0.6); ctx.stroke();
        ctx.fillStyle = '#ff7043';
        ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.1); ctx.lineTo(0, -r * 0.45); ctx.lineTo(r * 0.1, -r * 0.1); ctx.closePath(); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function lighten(hex, amt) {
    if (typeof hex !== 'string' || hex[0] !== '#') return hex;
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
    return 'rgb(' + Math.min(255, r + amt) + ',' + Math.min(255, g + amt) + ',' + Math.min(255, b + amt) + ')';
  }

  /* ============ OBSTÁCULOS (tubos) ============ */
  function drawPipe(ctx, pipe, map, groundH, W, H) {
    const pw = pipe.w;
    const col = map.pipe, rim = map.pipeRim;
    const topH = pipe.gap - pipe.gapHalf;
    const botY = pipe.gap + pipe.gapHalf;
    const botH = H - groundH - botY;

    ctx.fillStyle = col;
    // superior
    ctx.fillRect(pipe.x, 0, pw, topH);
    // inferior
    ctx.fillRect(pipe.x, botY, pw, botH);

    // franjas diagonales de advertencia
    ctx.save();
    ctx.beginPath();
    ctx.rect(pipe.x, 0, pw, topH);
    ctx.rect(pipe.x, botY, pw, botH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    for (let x = pipe.x - 60; x < pipe.x + pw + 60; x += 36) {
      ctx.moveTo(x, 0); ctx.lineTo(x - 140, H);
    }
    ctx.stroke();
    ctx.restore();

    // contorno oscuro fino
    ctx.strokeStyle = HC ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.28)';
    ctx.lineWidth = HC ? 5 : 3;
    ctx.strokeRect(pipe.x, 0, pw, topH);
    ctx.strokeRect(pipe.x, botY, pw, botH);

    // brillo vertical
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(pipe.x + pw * 0.12, 0, pw * 0.16, topH);
    ctx.fillRect(pipe.x + pw * 0.12, botY, pw * 0.16, botH);

    // borde / cap remarcado
    const cap = 28;
    ctx.fillStyle = rim;
    ctx.fillRect(pipe.x - 4, pipe.gap - pipe.gapHalf - cap, pw + 8, cap);
    ctx.fillRect(pipe.x - 4, pipe.gap + pipe.gapHalf, pw + 8, cap);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(pipe.x + pw * 0.12, pipe.gap - pipe.gapHalf - cap, pw * 0.16, cap);
    ctx.fillRect(pipe.x + pw * 0.12, pipe.gap + pipe.gapHalf, pw * 0.16, cap);
    ctx.strokeStyle = HC ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = HC ? 4.5 : 2.5;
    ctx.strokeRect(pipe.x - 4, pipe.gap - pipe.gapHalf - cap, pw + 8, cap);
    ctx.strokeRect(pipe.x - 4, pipe.gap + pipe.gapHalf, pw + 8, cap);
  }

  /* ============ ENEMIGOS (diablillos / murciélagos) ============ */
  function drawEnemy(ctx, e, t) {
    if (e.type === 'bat') { drawBat(ctx, e, t); return; }
    const r = e.r, x = e.x, y = e.y;
    const flap = Math.sin(t * e.wf + e.ph);
    const tier = e.tier;
    const body = tier >= 3 ? '#e53935' : tier === 2 ? '#37474f' : '#8e44ad';
    const belly = tier >= 3 ? '#ffcdd2' : tier === 2 ? '#90a4ae' : '#d7bde2';
    const wing = tier >= 3 ? '#b71c1c' : tier === 2 ? '#263238' : '#6c3483';

    ctx.save();
    ctx.translate(x, y);

    // alas (a ambos lados, batiendo)
    ctx.fillStyle = wing;
    ctx.save();
    ctx.rotate(-0.5 + flap * 0.75);
    ctx.beginPath();
    ctx.moveTo(r * 0.1, 0); ctx.lineTo(-r * 1.15, -r * 0.6); ctx.lineTo(-r * 0.8, r * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.5 - flap * 0.75);
    ctx.beginPath();
    ctx.moveTo(r * 0.1, 0); ctx.lineTo(-r * 1.15, r * 0.6); ctx.lineTo(-r * 0.8, -r * 0.15);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // cuerpo
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.02, r * 0.92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = belly;
    ctx.beginPath(); ctx.ellipse(-r * 0.12, r * 0.32, r * 0.58, r * 0.46, 0, 0, Math.PI * 2); ctx.fill();

    // cuerno / mechón (tier 3 = demonio)
    if (tier >= 3) {
      ctx.fillStyle = '#fbc531';
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.7); ctx.lineTo(-r * 0.18, -r * 1.35); ctx.lineTo(r * 0.05, -r * 0.7); ctx.closePath(); ctx.fill();
    }

    // ojo enojado
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(r * 0.4, -r * 0.32, r * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tier >= 3 ? '#ff1744' : '#e53935';
    ctx.beginPath(); ctx.arc(r * 0.47, -r * 0.32, r * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.32, r * 0.07, 0, Math.PI * 2); ctx.fill();

    // ceja enojada
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(r * 0.18, -r * 0.6); ctx.lineTo(r * 0.62, -r * 0.42); ctx.stroke();

    // pico
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.moveTo(r * 0.6, -r * 0.05); ctx.lineTo(r * 1.12, r * 0.12); ctx.lineTo(r * 0.6, r * 0.26);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(r * 0.68, r * 0.08); ctx.lineTo(r * 1.0, r * 0.1); ctx.stroke();

    // dientes (tier 2+)
    if (tier >= 2) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(r * 0.28, r * 0.3); ctx.lineTo(r * 0.38, r * 0.55); ctx.lineTo(r * 0.48, r * 0.3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.5, r * 0.3); ctx.lineTo(r * 0.6, r * 0.55); ctx.lineTo(r * 0.7, r * 0.3); ctx.closePath(); ctx.fill();
    }

    ctx.restore();
  }

  /* Murciélago 🦇: más rápido, alas enormes */
  function drawBat(ctx, e, t) {
    const r = e.r, x = e.x, y = e.y;
    const flap = Math.sin(t * e.wf * 1.6 + e.ph);
    ctx.save();
    ctx.translate(x, y + Math.sin(t * e.wf + e.ph) * e.amp * 0.15);
    ctx.fillStyle = '#5d3a85';
    ctx.save();
    ctx.rotate(-0.5 + flap * 0.9);
    ctx.beginPath();
    ctx.moveTo(r * 0.2, 0);
    ctx.quadraticCurveTo(-r * 1.3, -r * 0.9, -r * 1.5, -r * 0.25);
    ctx.quadraticCurveTo(-r * 1.0, -r * 0.15, -r * 1.1, r * 0.4);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.25, -r * 0.3, r * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.5 - flap * 0.9);
    ctx.beginPath();
    ctx.moveTo(r * 0.2, 0);
    ctx.quadraticCurveTo(-r * 1.3, r * 0.9, -r * 1.5, r * 0.25);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.15, -r * 1.1, -r * 0.4);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.25, -r * 0.3, -r * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2d1b4e';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.35); ctx.lineTo(-r * 0.45, -r * 1.05); ctx.lineTo(-r * 0.05, -r * 0.45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.35); ctx.lineTo(r * 0.45, -r * 1.05); ctx.lineTo(r * 0.05, -r * 0.45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.25, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.25, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7c0a02';
    ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.25, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.32, -r * 0.25, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-r * 0.15, r * 0.35); ctx.lineTo(-r * 0.08, r * 0.62); ctx.lineTo(0, r * 0.35); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.15, r * 0.35); ctx.lineTo(r * 0.08, r * 0.62); ctx.lineTo(0, r * 0.35); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ============ MONEDA ============ */
  function drawCoin(ctx, c, t) {
    if (c.big) { drawBigCoin(ctx, c, t); return; }
    const w = Math.abs(Math.cos(t * 5 + c.ph)) * 0.85 + 0.15;
    ctx.save();
    ctx.translate(c.x, c.y + Math.sin(t * 3 + c.ph) * 6);
    ctx.scale(w, 1);
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.arc(0, 0, c.r - 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(-1.5, -1.8, c.r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8910f'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, c.r - 5, 0, Math.PI * 2); ctx.stroke();
    if (w > 0.7) {
      ctx.fillStyle = '#c8910f';
      ctx.font = '900 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('¢', 0, 1);
    }
    ctx.restore();
  }

  function drawBigCoin(ctx, c, t) {
    const pul = 1 + 0.12 * Math.sin(t * 5 + c.ph);
    const r = c.r * pul;
    const bob = Math.sin(t * 3 + c.ph) * 7;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.globalAlpha = 0.32 + 0.15 * Math.sin(t * 5 + c.ph);
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const w = Math.abs(Math.cos(t * 4 + c.ph)) * 0.9 + 0.1;
    ctx.scale(w, 1);
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.arc(0, 0, r - 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.3, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8910f'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#6d4a00';
    ctx.font = '900 ' + (r * 0.95) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('10', 0, 1);
    ctx.restore();
  }

  /* ============ POWER-UP ============ */
  function drawPower(ctx, pw, t) {
    const bob = Math.sin(t * 4 + pw.ph) * 5;
    ctx.save();
    ctx.translate(pw.x, pw.y + bob);
    const r = pw.r || 16;
    const pul = 1 + 0.12 * Math.sin(t * 6 + pw.ph);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pw.color;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.4 * pul, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pw.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    ctx.font = (r * 0.62) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pw.icon, 0, 1);
    ctx.restore();
  }

  /* ============ MASCOTA (cosmética, arte vectorial animado) ============ */
  // Cada especie se dibuja con formas reales y se mueve con el tiempo: alas,
  // cola, orejas, parpadeo y respiración. Nada de PNG ni emoji estático.

  function petEye(ctx, ex, ey, r, open) {
    ctx.fillStyle = '#2b1b12';
    if (open < 0.35) {
      ctx.fillRect(ex - r, ey - r * 0.22, r * 2, Math.max(1.2, r * 0.44));
      return;
    }
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(ex - r * 0.32, ey - r * 0.36, r * 0.34, 0, Math.PI * 2); ctx.fill();
  }

  function petStar(ctx, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? inner : outer;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  function drawChickPet(ctx, t, ph, blink) {
    const flap = Math.sin(t * 12 + ph);
    // patitas
    ctx.strokeStyle = '#ef6c00'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(-6, 13); ctx.moveTo(4, 9); ctx.lineTo(6, 13); ctx.stroke();
    // alitas
    ctx.fillStyle = '#ffb300';
    ctx.save(); ctx.translate(-8, 1); ctx.rotate(-0.35 + flap * 0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(8, 1); ctx.rotate(0.35 - flap * 0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // cuerpo
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.ellipse(0, 2, 10, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.ellipse(0, 4.5, 6.2, 5.2, 0, 0, Math.PI * 2); ctx.fill();
    // cabeza
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(0, -6.5, 7.6, 0, Math.PI * 2); ctx.fill();
    // plumita
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, -13.5); ctx.quadraticCurveTo(2.5, -16, 0.5, -17.5); ctx.stroke();
    // pico
    ctx.fillStyle = '#ff8f00';
    ctx.beginPath(); ctx.moveTo(-2.2, -5.2); ctx.lineTo(2.2, -5.2); ctx.lineTo(0, -2.4); ctx.closePath(); ctx.fill();
    petEye(ctx, -3.1, -7.5, 1.55, blink);
    petEye(ctx, 3.1, -7.5, 1.55, blink);
    // mejillas
    ctx.fillStyle = 'rgba(255,112,67,.45)';
    ctx.beginPath(); ctx.arc(-5, -4.4, 1.7, 0, Math.PI * 2); ctx.arc(5, -4.4, 1.7, 0, Math.PI * 2); ctx.fill();
  }

  function drawCatPet(ctx, t, ph, blink) {
    const sway = Math.sin(t * 3.1 + ph);
    const twitch = Math.sin(t * 7.3 + ph) * 0.18;
    // cola
    ctx.strokeStyle = '#ffb74d'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(7, 5);
    ctx.quadraticCurveTo(17 + sway * 2, 6 + sway * 4, 14 + sway * 3, -7 + sway * 2); ctx.stroke();
    ctx.strokeStyle = '#ffa726'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14 + sway * 3, -7 + sway * 2); ctx.lineTo(15 + sway * 3, -10 + sway * 2); ctx.stroke();
    // cuerpo
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath(); ctx.ellipse(0, 3, 9.4, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe0b2';
    ctx.beginPath(); ctx.ellipse(0, 5, 5.6, 5.2, 0, 0, Math.PI * 2); ctx.fill();
    // cabeza
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath(); ctx.arc(0, -6, 7.4, 0, Math.PI * 2); ctx.fill();
    // orejas
    ctx.fillStyle = '#ffb74d';
    ctx.save(); ctx.translate(-5.2, -11.4); ctx.rotate(-0.18 + twitch);
    ctx.beginPath(); ctx.moveTo(-3.6, 2.4); ctx.lineTo(0, -5.4); ctx.lineTo(3.6, 2.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a80'; ctx.beginPath(); ctx.moveTo(-1.9, 1.2); ctx.lineTo(0, -2.9); ctx.lineTo(1.9, 1.2); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#ffb74d';
    ctx.save(); ctx.translate(5.2, -11.4); ctx.rotate(0.18 - twitch);
    ctx.beginPath(); ctx.moveTo(-3.6, 2.4); ctx.lineTo(0, -5.4); ctx.lineTo(3.6, 2.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a80'; ctx.beginPath(); ctx.moveTo(-1.9, 1.2); ctx.lineTo(0, -2.9); ctx.lineTo(1.9, 1.2); ctx.closePath(); ctx.fill(); ctx.restore();
    // ojos y hocico
    petEye(ctx, -2.9, -6.8, 1.65, blink);
    petEye(ctx, 2.9, -6.8, 1.65, blink);
    ctx.fillStyle = '#ef6c00';
    ctx.beginPath(); ctx.moveTo(-1.5, -3.9); ctx.lineTo(1.5, -3.9); ctx.lineTo(0, -2.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-1, -2.9); ctx.quadraticCurveTo(-3.4, -1.9, -4.6, -2.5);
    ctx.moveTo(1, -2.9); ctx.quadraticCurveTo(3.4, -1.9, 4.6, -2.5); ctx.stroke();
  }

  function drawFoxPet(ctx, t, ph, blink) {
    const sway = Math.sin(t * 2.4 + ph);
    // cola tupida
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.moveTo(6, 5);
    ctx.quadraticCurveTo(16, 4 + sway * 2, 17, -6 + sway * 3);
    ctx.quadraticCurveTo(20, -10 + sway * 3, 15, -11 + sway * 2);
    ctx.quadraticCurveTo(13, -5 + sway * 2, 9, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath(); ctx.moveTo(15, -11 + sway * 2); ctx.quadraticCurveTo(20, -10 + sway * 3, 17, -6 + sway * 3);
    ctx.quadraticCurveTo(16.5, -8.5 + sway * 2, 15, -11 + sway * 2); ctx.closePath(); ctx.fill();
    // cuerpo
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.ellipse(0, 3, 8.6, 7.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath(); ctx.ellipse(0, 5.2, 4.8, 4.4, 0, 0, Math.PI * 2); ctx.fill();
    // patas
    ctx.fillStyle = '#3e2723';
    ctx.beginPath(); ctx.ellipse(-4.5, 10, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.ellipse(4.5, 10, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    // cabeza + orejas
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.arc(0, -6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6.4, -9.5); ctx.lineTo(-4.2, -17); ctx.lineTo(-1.2, -11.4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6.4, -9.5); ctx.lineTo(4.2, -17); ctx.lineTo(1.2, -11.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3e2723';
    ctx.beginPath(); ctx.moveTo(-5.7, -10.2); ctx.lineTo(-4.4, -14.6); ctx.lineTo(-2.6, -11.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5.7, -10.2); ctx.lineTo(4.4, -14.6); ctx.lineTo(2.6, -11.2); ctx.closePath(); ctx.fill();
    // hocico blanco
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath(); ctx.ellipse(0, -3.4, 4.4, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    petEye(ctx, -2.6, -7, 1.5, blink);
    petEye(ctx, 2.6, -7, 1.5, blink);
    ctx.fillStyle = '#3e2723';
    ctx.beginPath(); ctx.arc(0, -3.2, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawTurtlePet(ctx, t, ph, blink) {
    const paddle = Math.sin(t * 5 + ph);
    const stretch = 0.5 + 0.5 * Math.sin(t * 2.1 + ph);
    // aletas
    ctx.fillStyle = '#81c784';
    ctx.save(); ctx.translate(-8, 3); ctx.rotate(-0.5 + paddle * 0.45);
    ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(8, 3); ctx.rotate(0.5 - paddle * 0.45);
    ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(-5.5, 9); ctx.rotate(0.3 - paddle * 0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 1.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(5.5, 9); ctx.rotate(-0.3 + paddle * 0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 1.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // caparazón
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.ellipse(0, 2, 9.6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#66bb6a';
    ctx.beginPath(); ctx.ellipse(0, 1, 7.6, 6.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(27,94,32,.75)'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(0, 1, 5.2, 4.4, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + 0.3;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 2.6, 1 + Math.sin(a) * 2.2);
      ctx.lineTo(Math.cos(a) * 7.2, 1 + Math.sin(a) * 6.1); ctx.stroke();
    }
    // cabeza asomando
    const hy = -6 - stretch * 2.4;
    ctx.fillStyle = '#a5d6a7';
    ctx.beginPath(); ctx.ellipse(0, hy, 4.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
    petEye(ctx, -1.6, hy - 0.6, 1.15, blink);
    petEye(ctx, 1.6, hy - 0.6, 1.15, blink);
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(0, hy + 1.2, 1.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  function drawBatPet(ctx, t, ph, blink) {
    const flap = Math.sin(t * 10 + ph);
    // alas
    ctx.fillStyle = '#7e57c2';
    ctx.save(); ctx.translate(-3, 0); ctx.rotate(flap * 0.35);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-9, -7 - flap * 4, -15, -1 - flap * 2);
    ctx.quadraticCurveTo(-11, 0, -12, 4 + flap * 2);
    ctx.quadraticCurveTo(-7, 2, 0, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(3, 0); ctx.rotate(-flap * 0.35);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(9, -7 - flap * 4, 15, -1 - flap * 2);
    ctx.quadraticCurveTo(11, 0, 12, 4 + flap * 2);
    ctx.quadraticCurveTo(7, 2, 0, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    // cuerpo
    ctx.fillStyle = '#5e35b1';
    ctx.beginPath(); ctx.ellipse(0, 2, 5.8, 7, 0, 0, Math.PI * 2); ctx.fill();
    // orejas
    ctx.fillStyle = '#5e35b1';
    ctx.beginPath(); ctx.moveTo(-4.6, -5); ctx.lineTo(-5.7, -12); ctx.lineTo(-1.2, -8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4.6, -5); ctx.lineTo(5.7, -12); ctx.lineTo(1.2, -8); ctx.closePath(); ctx.fill();
    // ojos
    ctx.fillStyle = '#ffe082';
    ctx.beginPath(); ctx.arc(-2.1, -4.4, 1.4, 0, Math.PI * 2); ctx.arc(2.1, -4.4, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1b12';
    ctx.beginPath(); ctx.arc(-2.1, -4.4, 0.62, 0, Math.PI * 2); ctx.arc(2.1, -4.4, 0.62, 0, Math.PI * 2); ctx.fill();
    // colmillos
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-1.7, 2.6); ctx.lineTo(-0.9, 4.3); ctx.lineTo(0, 2.6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.7, 2.6); ctx.lineTo(0.9, 4.3); ctx.lineTo(0, 2.6); ctx.closePath(); ctx.fill();
  }

  function drawDragonPet(ctx, t, ph, blink) {
    const flap = Math.sin(t * 6 + ph);
    const sway = Math.sin(t * 2.8 + ph);
    // cola
    ctx.strokeStyle = '#26a69a'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, 6);
    ctx.quadraticCurveTo(14, 9 + sway * 2, 17, 3 + sway * 3); ctx.stroke();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.moveTo(17, 3 + sway * 3); ctx.lineTo(21, 0 + sway * 3); ctx.lineTo(18, 6 + sway * 3); ctx.closePath(); ctx.fill();
    // alas
    ctx.fillStyle = 'rgba(0,150,136,.9)';
    ctx.save(); ctx.translate(-4, -2); ctx.rotate(-0.15 + flap * 0.28);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -8, -13, -2);
    ctx.quadraticCurveTo(-9, 1, -10, 5); ctx.quadraticCurveTo(-5, 3, 0, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(4, -2); ctx.rotate(0.15 - flap * 0.28);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -8, 13, -2);
    ctx.quadraticCurveTo(9, 1, 10, 5); ctx.quadraticCurveTo(5, 3, 0, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    // cuerpo
    ctx.fillStyle = '#26a69a';
    ctx.beginPath(); ctx.ellipse(0, 2, 8.2, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b2dfdb';
    ctx.beginPath(); ctx.ellipse(0, 4.4, 4.8, 4.8, 0, 0, Math.PI * 2); ctx.fill();
    // cabeza
    ctx.fillStyle = '#26a69a';
    ctx.beginPath(); ctx.arc(0, -7, 6.8, 0, Math.PI * 2); ctx.fill();
    // cuernos
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.moveTo(-4.6, -11.4); ctx.lineTo(-6.4, -16.4); ctx.lineTo(-2.2, -12.8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4.6, -11.4); ctx.lineTo(6.4, -16.4); ctx.lineTo(2.2, -12.8); ctx.closePath(); ctx.fill();
    // hocico
    ctx.fillStyle = '#80cbc4';
    ctx.beginPath(); ctx.ellipse(0, -3.4, 3.8, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#004d40';
    ctx.beginPath(); ctx.arc(-1, -4.1, 0.55, 0, Math.PI * 2); ctx.arc(1, -4.1, 0.55, 0, Math.PI * 2); ctx.fill();
    petEye(ctx, -2.5, -8, 1.35, blink);
    petEye(ctx, 2.5, -8, 1.35, blink);
    // llamita
    const flick = Math.sin(t * 9 + ph) * 1.2;
    ctx.fillStyle = 'rgba(255,112,67,.9)';
    ctx.beginPath(); ctx.moveTo(5.5, -2.5); ctx.quadraticCurveTo(8 + flick, -3.5, 8 + flick, -6.5);
    ctx.quadraticCurveTo(10, -3.2, 7, -1.4); ctx.closePath(); ctx.fill();
  }

  function drawStarPet(ctx, t, ph, blink) {
    const pulse = 1 + Math.sin(t * 4.2 + ph) * 0.08;
    ctx.save(); ctx.rotate(Math.sin(t * 1.4 + ph) * 0.16);
    ctx.scale(pulse, pulse);
    // halo
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ffe082';
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // estrella
    const grad = ctx.createLinearGradient(0, -13, 0, 13);
    grad.addColorStop(0, '#fff59d'); grad.addColorStop(1, '#ffb300');
    ctx.fillStyle = grad;
    petStar(ctx, 10.5, 4.8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,143,0,.55)'; ctx.lineWidth = 0.9; ctx.stroke();
    // carita
    petEye(ctx, -3, -1.4, 1.15, blink);
    petEye(ctx, 3, -1.4, 1.15, blink);
    ctx.strokeStyle = '#6d4c00'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0.6, 2.2, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    ctx.restore();
    // destellos girando
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + i * Math.PI * 2 / 3;
      const rr = 13 + Math.sin(t * 3 + i) * 1.8;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 5 + i);
      ctx.fillStyle = '#fff9c4';
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1.35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawGhostPet(ctx, t, ph, blink) {
    const float = Math.sin(t * 2.2 + ph);
    const wave = Math.sin(t * 3.4 + ph) * 1.2;
    ctx.globalAlpha = 0.82;
    const grad = ctx.createLinearGradient(0, -14, 0, 13);
    grad.addColorStop(0, '#ede7f6'); grad.addColorStop(1, '#b39ddb');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-8.5, 11);
    ctx.quadraticCurveTo(-8.5 + wave, 15, -4, 12);
    ctx.quadraticCurveTo(-1 + wave, 15.5, 2, 12);
    ctx.quadraticCurveTo(5 - wave, 15, 8.5, 11);
    ctx.lineTo(8.5, -3);
    ctx.arc(0, -3, 8.5, 0, Math.PI, true);
    ctx.closePath(); ctx.fill();
    // bracitos
    ctx.strokeStyle = '#d1c4e9'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, 1); ctx.quadraticCurveTo(-12, 2 + float, -11, 5 + float); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 1); ctx.quadraticCurveTo(12, 2 - float, 11, 5 - float); ctx.stroke();
    // ojos y boca
    petEye(ctx, -3, -4.6, 1.65, blink);
    petEye(ctx, 3, -4.6, 1.65, blink);
    ctx.fillStyle = '#5e35b1';
    ctx.beginPath(); ctx.ellipse(0, 0.6, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPhoenixPet(ctx, t, ph, blink) {
    const flap = Math.sin(t * 8 + ph);
    const flick = Math.sin(t * 11 + ph);
    // alas de fuego
    for (let side = -1; side <= 1; side += 2) {
      ctx.save(); ctx.translate(side * 5, -1); ctx.rotate(side * (0.2 + flap * 0.3));
      const g = ctx.createLinearGradient(0, -6, 0, 8);
      g.addColorStop(0, '#ffd54f'); g.addColorStop(0.55, '#ff7043'); g.addColorStop(1, 'rgba(255,87,34,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 9, -9 - flap * 3, side * 13, -2 - flick);
      ctx.quadraticCurveTo(side * 9, 2, side * 8, 7 + flick);
      ctx.quadraticCurveTo(side * 4, 4, 0, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // cola de fuego
    const g2 = ctx.createLinearGradient(0, 4, 0, 17);
    g2.addColorStop(0, '#ffb300'); g2.addColorStop(1, 'rgba(255,61,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.moveTo(-4, 6);
    ctx.quadraticCurveTo(-2 + flick, 14, 0, 18);
    ctx.quadraticCurveTo(2 - flick, 14, 4, 6); ctx.closePath(); ctx.fill();
    // cuerpo
    ctx.fillStyle = '#ff7043';
    ctx.beginPath(); ctx.ellipse(0, 2, 7.4, 7.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe082';
    ctx.beginPath(); ctx.ellipse(0, 4.2, 3.8, 4, 0, 0, Math.PI * 2); ctx.fill();
    // cabeza
    ctx.fillStyle = '#ff8a65';
    ctx.beginPath(); ctx.arc(0, -6.5, 6.4, 0, Math.PI * 2); ctx.fill();
    // cresta
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.moveTo(-2, -12); ctx.quadraticCurveTo(-1 + flick, -17, 2, -13.5);
    ctx.quadraticCurveTo(1.5, -15.5, 4, -12.5); ctx.closePath(); ctx.fill();
    // pico
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.moveTo(-1.8, -5.4); ctx.lineTo(1.8, -5.4); ctx.lineTo(0, -3); ctx.closePath(); ctx.fill();
    petEye(ctx, -2.6, -7.4, 1.35, blink);
    petEye(ctx, 2.6, -7.4, 1.35, blink);
    // chispas
    for (let i = 0; i < 4; i++) {
      const a = t * 2.2 + i * 1.57;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 7 + i);
      ctx.fillStyle = i % 2 ? '#ffd54f' : '#ff8a65';
      ctx.beginPath(); ctx.arc(Math.cos(a) * 12, Math.sin(a) * 10 - 2, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPet(ctx, pet, x, y, t, level, opts) {
    opts = opts || {};
    const lv = Math.max(1, Math.min(5, Math.floor(level || 1)));
    const phase = opts.phase || 0;
    const scale = (opts.scale || (0.92 + lv * 0.055)) * (opts.size || 1);
    const bob = opts.still ? 0 : Math.sin(t * 3.2 + phase) * (2.2 + lv * 0.25);
    const blink = (Math.sin(t * 1.55 + phase * 1.7) + 1) / 2 > 0.975 ? 0.12 : 1;
    const id = String(pet && pet.id || '');

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(scale, scale);

    // aura de nivel (se nota más a partir del nivel 2)
    if (!opts.noAura) {
      ctx.globalAlpha = (opts.menu ? 0.10 : 0.16) + lv * 0.035;
      ctx.fillStyle = (pet && pet.color) || '#ffd54f';
      ctx.beginPath();
      ctx.arc(0, 0, (16 + lv * 1.4) * (0.95 + 0.06 * Math.sin(t * 4 + phase)), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // sombra de contacto suave (solo en el juego)
    if (!opts.menu) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, 15, 10, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (id.indexOf('gato') !== -1) drawCatPet(ctx, t, phase, blink);
    else if (id.indexOf('zorro') !== -1) drawFoxPet(ctx, t, phase, blink);
    else if (id.indexOf('tortuga') !== -1) drawTurtlePet(ctx, t, phase, blink);
    else if (id.indexOf('murci') !== -1) drawBatPet(ctx, t, phase, blink);
    else if (id.indexOf('dragon') !== -1) drawDragonPet(ctx, t, phase, blink);
    else if (id.indexOf('estrella') !== -1) drawStarPet(ctx, t, phase, blink);
    else if (id.indexOf('fantasma') !== -1) drawGhostPet(ctx, t, phase, blink);
    else if (id.indexOf('fenix') !== -1) drawPhoenixPet(ctx, t, phase, blink);
    else drawChickPet(ctx, t, phase, blink);

    // destellos por nivel (2+)
    if (lv >= 2) {
      const n = Math.min(4, lv - 1);
      ctx.fillStyle = (pet && pet.color) || '#ffd54f';
      for (let i = 0; i < n; i++) {
        const a = t * 1.8 + i * (Math.PI * 2 / n) + phase;
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 5 + i);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (14 + lv), Math.sin(a) * (11 + lv * 0.6), 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /* ============ METEORO ============ */
  function drawMeteor(ctx, m, t) {
    const r = m.r;
    ctx.save();
    ctx.translate(m.x, m.y);
    // estela
    const grad = ctx.createLinearGradient(0, -r * 4.5, 0, 0);
    grad.addColorStop(0, 'rgba(255,120,40,0)');
    grad.addColorStop(1, 'rgba(255,160,60,0.55)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, 0);
    ctx.lineTo(0, -r * (4.2 + Math.sin(t * 7 + m.ph) * 0.7));
    ctx.lineTo(r * 0.75, 0);
    ctx.closePath();
    ctx.fill();
    // roca
    ctx.rotate(m.spin || 0);
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.2);
    ctx.lineTo(-r * 0.5, -r);
    ctx.lineTo(r * 0.45, -r * 0.85);
    ctx.lineTo(r, 0);
    ctx.lineTo(r * 0.35, r * 0.9);
    ctx.lineTo(-r * 0.6, r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffb74d';
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ============ PUERTA SECRETA / ZONA DE BONIFICACIÓN ============ */
  function drawPortal(ctx, p, t) {
    const r = p.r;
    const pul = 1 + 0.1 * Math.sin(t * 4 + p.ph);
    const col = p.type === 'power' ? '#e040fb' : '#ffd54f';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.55 * pul, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.68, t * 2, t * 2 + Math.PI * 1.4); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = '900 ' + Math.round(r * 0.95) + 'px "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type === 'power' ? '🎁' : '🚪', 0, 1);
    ctx.restore();
  }

  return { drawBird, drawHat, drawPipe, drawEnemy, drawCoin, drawPower, drawPet, drawMeteor, drawPortal, lighten, setHC };
})();