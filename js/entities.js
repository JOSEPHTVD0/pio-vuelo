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

  return { drawBird, drawHat, drawPipe, drawEnemy, drawCoin, drawPower, lighten, setHC };
})();