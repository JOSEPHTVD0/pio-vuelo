/* Genera iconos PNG (PWA + Android mipmaps) sin dependencias externas. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- PNG writer ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- tiny rasterizer (RGBA buffer, alpha premultiplied-ish flatten) ---------- */
function makeCanvas(size) {
  const w = size, h = size, buf = Buffer.alloc(w * h * 4); // transparent
  return {
    w, h, buf,
    set(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      const na = a / 255;
      const oa = buf[i + 3] / 255;
      const outa = na + oa * (1 - na);
      if (outa <= 0) return;
      buf[i] = Math.round((r * na + buf[i] * oa * (1 - na)) / outa);
      buf[i + 1] = Math.round((g * na + buf[i + 1] * oa * (1 - na)) / outa);
      buf[i + 2] = Math.round((b * na + buf[i + 2] * oa * (1 - na)) / outa);
      buf[i + 3] = Math.round(outa * 255);
    },
    fillRect(x, y, w2, h2, r, g, b, a) {
      for (let yy = Math.floor(y); yy < Math.ceil(y + h2); yy++)
        for (let xx = Math.floor(x); xx < Math.ceil(x + w2); xx++) this.set(xx, yy, r, g, b, a);
    },
    fillCircle(cx, cy, rad, r, g, b, a) {
      const r2 = rad * rad;
      for (let yy = Math.floor(cy - rad); yy <= Math.ceil(cy + rad); yy++)
        for (let xx = Math.floor(cx - rad); xx <= Math.ceil(cx + rad); xx++) {
          const dx = xx - cx, dy = yy - cy;
          if (dx * dx + dy * dy <= r2) this.set(xx, yy, r, g, b, a);
        }
    },
    fillEllipse(cx, cy, rx, ry, r, g, b, a) {
      for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++)
        for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
          const dx = (xx - cx) / rx, dy = (yy - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.set(xx, yy, r, g, b, a);
        }
    },
    maskOutsideCircle(cx, cy, rad) {
      const r2 = rad * rad;
      for (let yy = 0; yy < this.h; yy++)
        for (let xx = 0; xx < this.w; xx++) {
          const dx = xx - cx, dy = yy - cy;
          if (dx * dx + dy * dy > r2) { const i = (yy * this.w + xx) * 4; this.buf[i + 3] = 0; this.buf[i] = this.buf[i + 1] = this.buf[i + 2] = 0; }
        }
    },
    fillTriangle(ax, ay, bx, by, cx, cy, r, g, b, a) {
      const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
      const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
      const s = (p1, p2, p3) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
      for (let yy = minY; yy <= maxY; yy++)
        for (let xx = minX; xx <= maxX; xx++) {
          const p = [xx + 0.5, yy + 0.5];
          const d1 = s(p, [ax, ay], [bx, by]), d2 = s(p, [bx, by], [cx, cy]), d3 = s(p, [cx, cy], [ax, ay]);
          const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
          if (!(neg && pos)) this.set(xx, yy, r, g, b, a);
        }
    }
  };
}

/* ---------- dibujo del icono ---------- */
function renderIcon(S, supersample, full) {
  const ss = supersample || 2;
  const big = makeCanvas(S * ss);
  const pad = S * 0.02;
  // degradado de fondo (tiras) sobre todo el cuadrado
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const y0 = S * (0.10 + i * 0.05);
    const k = i / steps;
    big.fillRect(0, y0 * ss, S * ss, S * 0.05 * ss, Math.round(59 + k * 60), Math.round(160 + k * 40), Math.round(214 - k * 30), 255);
  }
  // recortar a forma redondeada (solo para favicon/Android; iOS y maskable van sin recorte)
  if (!full) { big.maskOutsideCircle(S / 2 + 1, S / 2 + 1, S / 2 - pad * 2); }

  // nubes
  big.fillEllipse(S * 0.24, S * 0.2, S * 0.09, S * 0.055, 255, 255, 255, 200);
  big.fillEllipse(S * 0.75, S * 0.26, S * 0.07, S * 0.045, 255, 255, 255, 170);

  // pajaro
  const cx = S * 0.5, cy = S * 0.54, r = S * 0.2;
  // cola
  big.fillTriangle(cx - r * 1.1, cy + r * 0.1, cx - r * 1.7, cy - r * 0.5, cx - r * 1.6, cy + r * 0.35, 244, 173, 0, 255);
  // cuerpo
  big.fillEllipse(cx, cy, r * 1.05, r * 0.92, 255, 214, 64, 255);
  big.fillEllipse(cx - r * 0.1, cy + r * 0.34, r * 0.62, r * 0.48, 255, 243, 192, 255);
  // ala
  big.fillEllipse(cx - r * 0.95, cy - r * 0.05, r * 0.55, r * 0.3, 244, 173, 0, 255);
  // ojo
  big.fillCircle(cx + r * 0.4, cy - r * 0.28, r * 0.3, 255, 255, 255, 255);
  big.fillCircle(cx + r * 0.5, cy - r * 0.28, r * 0.16, 32, 36, 44, 255);
  big.fillCircle(cx + r * 0.56, cy - r * 0.33, r * 0.06, 255, 255, 255, 255);
  // pico
  big.fillTriangle(cx + r * 0.6, cy - r * 0.05, cx + r * 1.15, cy + r * 0.1, cx + r * 0.6, cy + r * 0.25, 255, 123, 46, 255);
  // mejilla
  big.fillCircle(cx + r * 0.32, cy + r * 0.26, r * 0.13, 255, 138, 92, 160);

  // downsample
  const out = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let yy = 0; yy < ss; yy++)
        for (let xx = 0; xx < ss; xx++) {
          const i = ((y * ss + yy) * S * ss + (x * ss + xx)) * 4;
          const aa = big.buf[i + 3];
          r += big.buf[i] * aa; g += big.buf[i + 1] * aa; b += big.buf[i + 2] * aa; a += aa;
        }
      const n = ss * ss;
      const aa = a / n;
      const o = (y * S + x) * 4;
      if (aa > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round(aa);
      }
    }
  }
  return encodePNG(S, S, out);
}

function savePng(size, file, full) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderIcon(size, 2, full));
  console.log('OK', file, size + 'x' + size);
}

const root = path.join(__dirname, '..');
savePng(192, path.join(root, 'icons', 'pwa-192.png'));
savePng(512, path.join(root, 'icons', 'pwa-512.png'));
savePng(192, path.join(root, 'icons', 'pwa-maskable-192.png'), true);
savePng(512, path.join(root, 'icons', 'pwa-maskable-512.png'), true);
savePng(180, path.join(root, 'icons', 'apple-touch-icon.png'), true);
const mip = [
  ['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]
];
mip.forEach(m => savePng(m[1], path.join(root, 'android', 'res', 'mipmap-' + m[0], 'ic_launcher.png')));
console.log('Iconos generados.');