// Genera tutte le icone PWA + favicon a partire da public/icons/source.png (1024×1024).
// - icon-192.png, icon-512.png: PNG diretti dalla sorgente per Android e PWA
// - icon-512-maskable.png: padding 10% + sfondo bianco (safe zone maskable 80%)
// - apple-touch-icon.png (180×180): iOS home screen (Apple arrotonda da sé)
// - favicon-32.png, favicon-16.png: favicon raster di backup
// - favicon.ico: 16/32/48 multi-size (Edge, Firefox legacy, bookmarks)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const SOURCE = 'public/icons/source.png';
const OUT_DIR = 'public/icons';
mkdirSync(OUT_DIR, { recursive: true });

async function plain(size, outName) {
  await sharp(SOURCE).resize(size, size, { fit: 'cover' }).png().toFile(`${OUT_DIR}/${outName}`);
}

async function maskable(size, outName) {
  // Safe zone maskable: diametro 80% del lato. Padding 10% per lato + sfondo bianco
  // (la cornice esterna dell'illustrazione è già bianca → continuità visiva).
  const inner = Math.round(size * 0.80);
  const pad = Math.round((size - inner) / 2);
  const resized = await sharp(SOURCE).resize(inner, inner, { fit: 'cover' }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([{ input: resized, top: pad, left: pad }])
    .png()
    .toFile(`${OUT_DIR}/${outName}`);
}

await plain(192, 'icon-192.png');
await plain(512, 'icon-512.png');
await maskable(512, 'icon-512-maskable.png');
await plain(180, 'apple-touch-icon.png');
await plain(32, 'favicon-32.png');
await plain(16, 'favicon-16.png');

// favicon.ico multi-size — genera buffer 16/32/48 e li impacchetta
const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map((s) => sharp(SOURCE).resize(s, s, { fit: 'cover' }).png().toBuffer()),
);
const icoBuf = await pngToIco(icoBuffers);
writeFileSync('public/favicon.ico', icoBuf);

console.log('Icone generate:');
console.log('  PWA       : icon-192.png, icon-512.png, icon-512-maskable.png');
console.log('  iOS       : apple-touch-icon.png (180×180)');
console.log('  Favicon   : favicon.ico (16/32/48), favicon-32.png, favicon-16.png');
