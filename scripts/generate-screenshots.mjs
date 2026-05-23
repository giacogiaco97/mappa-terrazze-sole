// Genera screenshot placeholder PWA per il manifest (richiesto da Chrome per
// l'install prompt enhanced). Senza dipendenze: scrittura PNG RGB manuale.
// Per uno screenshot 'reale' bisognerebbe usare Playwright sul sito live —
// qui creiamo un placeholder brandato compatibile con i requisiti del manifest.
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

// Schermata stilizzata: sfondo grigio chiaro (mappa) + bottom sheet bianco
// + due punti arancio (terrazze al sole) + un punto blu (ombra).
function appScreenshot(w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // RGB
  const MAP_BG = [220, 220, 215];
  const SHEET_BG = [255, 255, 255];
  const SUN = [245, 166, 35];
  const SHADE = [58, 110, 165];
  const NAV = [29, 29, 29];

  const sheetY = Math.floor(h * 0.65); // bottom sheet inizia al 65%
  const navY = Math.floor(h * 0.07);   // bar in alto
  // alcuni "punti" sulla mappa
  const dots = [
    [w*0.30, h*0.18, SUN, 12],
    [w*0.55, h*0.22, SUN, 12],
    [w*0.70, h*0.30, SHADE, 10],
    [w*0.40, h*0.38, SUN, 12],
    [w*0.18, h*0.45, SHADE, 10],
    [w*0.62, h*0.50, SUN, 12],
    [w*0.85, h*0.42, SUN, 12],
  ];

  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 3);
    raw[off] = 0;
    for (let x = 0; x < w; x++) {
      const p = off + 1 + x * 3;
      let r, g, b;
      if (y < navY) { r = NAV[0]; g = NAV[1]; b = NAV[2]; }
      else if (y >= sheetY) { r = SHEET_BG[0]; g = SHEET_BG[1]; b = SHEET_BG[2]; }
      else { r = MAP_BG[0]; g = MAP_BG[1]; b = MAP_BG[2]; }
      // dots
      for (const [dx, dy, color, radius] of dots) {
        const distSq = (x - dx) ** 2 + (y - dy) ** 2;
        if (distSq < radius * radius && y < sheetY) {
          r = color[0]; g = color[1]; b = color[2];
          break;
        }
      }
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/screenshots', { recursive: true });
writeFileSync('public/screenshots/mobile-1.png', appScreenshot(414, 896));
writeFileSync('public/screenshots/desktop-1.png', appScreenshot(1280, 720));
console.log('Generati: public/screenshots/mobile-1.png (414x896), desktop-1.png (1280x720)');
