// Genera le icone dell'app e il disegno della schermata di blocco (PNG) senza librerie esterne,
// partendo dal disegno in bianco e nero tools/filosofo.png (1024×1024): il nero diventa l'inchiostro
// dell'app, il bianco il crema della carta. Uso: npm run icons

import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const INK = [0x24, 0x19, 0x13];
const CREAM = [0xf6, 0xf1, 0xe7];
const SOURCE = new URL('filosofo.png', import.meta.url);
const OUT = new URL('../icons/', import.meta.url);

// ---------- PNG: lettura (8 bit, RGB o RGBA, non interlacciato) ----------

function decodePng(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const [depth, type, , , interlace] = buf.subarray(24, 29);
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error('PNG non supportato');
  const bpp = type === 6 ? 4 : 3;
  const idat = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    const kind = buf.toString('ascii', at + 4, at + 8);
    if (kind === 'IDAT') idat.push(buf.subarray(at + 8, at + 8 + len));
    at += len + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = (line[x] + pred) & 0xff;
    }
  }
  // quanto inchiostro c'è in ogni pixel (0 = carta, 1 = nero pieno): le sfumature grigie del fondo spariscono
  const ink = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * bpp;
    const l = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
    ink[i] = Math.max(0, Math.min(1, (215 - l) / (215 - 60)));
  }
  return { width, height, ink };
}

// ---------- PNG: scrittura ----------

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

// ---------- forme ----------

function roundRectDist(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

/**
 * Ritaglia il quadrato [x, y, lato] del disegno e lo rimpicciolisce a size×size.
 * pad: margine di carta attorno (frazione del lato); rounded: angoli arrotondati trasparenti.
 */
function render(src, [cx0, cy0, side], size, { pad = 0, rounded = false } = {}) {
  const SS = 4; // 4x4 campioni per pixel: bordi morbidi
  const inkAt = (sx, sy) => {
    const x = Math.min(src.width - 1, Math.max(0, Math.floor(sx)));
    const y = Math.min(src.height - 1, Math.max(0, Math.floor(sy)));
    return src.ink[y * src.width + x];
  };
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filtro "nessuno"
    for (let px = 0; px < size; px++) {
      let ink = 0, inside = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          if (rounded && roundRectDist(u, v, 0.5, 0.5, 0.5, 0.5, 0.22) > 0) continue;
          inside++;
          const iu = (u - pad) / (1 - 2 * pad), iv = (v - pad) / (1 - 2 * pad);
          if (iu >= 0 && iu < 1 && iv >= 0 && iv < 1) ink += inkAt(cx0 + iu * side, cy0 + iv * side);
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      if (inside) {
        const a = ink / inside;
        for (let k = 0; k < 3; k++) raw[o + k] = Math.round(CREAM[k] * (1 - a) + INK[k] * a);
        raw[o + 3] = Math.round((inside / (SS * SS)) * 255);
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

const src = decodePng(readFileSync(SOURCE));
const SCENE = [120, 10, 900]; // filosofo, mani e diario: lascia fuori solo il bordo vuoto
const WHOLE = [0, 0, 1024];

mkdirSync(OUT, { recursive: true });
const images = [
  ['icon-192.png', SCENE, 192, { rounded: true }],
  ['icon-512.png', SCENE, 512, { rounded: true }],
  // a tutto campo: Android ne mostra solo il centro (circa l'80%), quindi il disegno sta dentro con un margine
  ['icon-maskable-512.png', SCENE, 512, { pad: 0.14 }],
  ['apple-touch-icon-180.png', SCENE, 180, {}],
  ['filosofo.png', WHOLE, 720, {}], // schermata di blocco
];
for (const [name, crop, size, opts] of images) {
  writeFileSync(new URL(name, OUT), render(src, crop, size, opts));
  console.log('creata', name);
}
