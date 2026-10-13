// Genera le icone dell'app (PNG) senza librerie esterne: una pagina di diario color crema
// su fondo terracotta. Uso: npm run icons

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const TERRACOTTA = [0xb5, 0x57, 0x3a];
const CREAM = [0xf6, 0xf1, 0xe7];
const OUT = new URL('../icons/', import.meta.url);

// ---------- forme (coordinate 0..1) ----------

function roundRectDist(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}
const inRoundRect = (x, y, cx, cy, hw, hh, r) => roundRectDist(x, y, cx, cy, hw, hh, r) <= 0;
const bar = (x, y, x0, x1, cy, thick) => inRoundRect(x, y, (x0 + x1) / 2, cy, (x1 - x0) / 2, thick / 2, thick / 2);

/** Colore del punto (x,y), oppure null se trasparente. */
function sample(x, y, { rounded }) {
  if (rounded && !inRoundRect(x, y, 0.5, 0.5, 0.5, 0.5, 0.22)) return null;
  if (inRoundRect(x, y, 0.5, 0.5, 0.19, 0.25, 0.03)) {
    const ink =
      bar(x, y, 0.39, 0.52, 0.37, 0.042) || // titolo
      bar(x, y, 0.39, 0.61, 0.47, 0.026) ||
      bar(x, y, 0.39, 0.61, 0.55, 0.026) ||
      bar(x, y, 0.39, 0.54, 0.63, 0.026);
    return ink ? TERRACOTTA : CREAM;
  }
  return TERRACOTTA;
}

// ---------- PNG ----------

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function render(size, opts) {
  const SS = 4; // 4x4 campioni per pixel: bordi morbidi
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filtro "nessuno"
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, opts);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      if (a) {
        raw[o] = Math.round(r / a);
        raw[o + 1] = Math.round(g / a);
        raw[o + 2] = Math.round(b / a);
        raw[o + 3] = Math.round((a / (SS * SS)) * 255);
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['icon-maskable-512.png', 512, { rounded: false }], // a tutto campo: lo ritaglia Android
  ['apple-touch-icon-180.png', 180, { rounded: false }],
];
for (const [name, size, opts] of icons) {
  writeFileSync(new URL(name, OUT), render(size, opts));
  console.log('creata', name);
}
