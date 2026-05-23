// Genera icone PWA brandate (sole bianco su sfondo arancio).
// Senza dipendenze: builtin zlib + scrittura manuale di un PNG RGB.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const T = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  T[n] = c >>> 0;
}
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};

// Disegna sole stilizzato: cerchio bianco al centro + 8 raggi rettangolari.
// `safeRatio` = quanto del lato l'icona occupa (1.0 = pieno, 0.7 = maskable safe zone).
function sunPng(size, bgRgb, fgRgb, safeRatio = 1.0) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 3));
  const cx = size / 2;
  const cy = size / 2;
  const drawArea = size * safeRatio;
  const coreR = drawArea * 0.22;
  const rayInner = drawArea * 0.30;
  const rayOuter = drawArea * 0.45;
  const rayHalfWidth = drawArea * 0.045;

  for (let y = 0; y < size; y++) {
    const off = y * (1 + size * 3);
    raw[off] = 0; // filter byte = None
    for (let x = 0; x < size; x++) {
      const p = off + 1 + x * 3;
      // default: sfondo
      let r = bgRgb[0], g = bgRgb[1], b = bgRgb[2];

      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);

      // disco centrale
      if (dist <= coreR) {
        r = fgRgb[0]; g = fgRgb[1]; b = fgRgb[2];
      } else if (dist >= rayInner && dist <= rayOuter) {
        // raggi: ogni 45°
        const ang = Math.atan2(dy, dx); // [-π, π]
        for (let k = 0; k < 8; k++) {
          const rayAng = -Math.PI + (k * Math.PI) / 4;
          // distanza perpendicolare dal centro del raggio
          let dAng = ang - rayAng;
          // normalizza tra -π e π
          while (dAng > Math.PI) dAng -= 2 * Math.PI;
          while (dAng < -Math.PI) dAng += 2 * Math.PI;
          // larghezza in pixel sull'arco
          const perp = Math.abs(Math.sin(dAng)) * dist;
          if (perp <= rayHalfWidth) {
            r = fgRgb[0]; g = fgRgb[1]; b = fgRgb[2];
            break;
          }
        }
      }

      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [0xf5, 0xa6, 0x23]; // arancio brand
const FG = [0xff, 0xff, 0xff]; // bianco

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', sunPng(192, BG, FG, 1.0));
writeFileSync('public/icons/icon-512.png', sunPng(512, BG, FG, 1.0));
// Maskable: safe zone al 70% (richiesto dalle linee guida per maschere arrotondate).
writeFileSync('public/icons/icon-512-maskable.png', sunPng(512, BG, FG, 0.70));
console.log('Icone generate: icon-192.png, icon-512.png, icon-512-maskable.png');
