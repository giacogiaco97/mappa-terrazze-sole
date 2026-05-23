import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { chunkByGrid } from './lib/chunk-by-grid.js';
import { matchTerracesToPois } from './lib/match-pois.js';
import type { RawPoi } from './fetch-osm-pois.js';
import type { Building, Meta, Terrace } from '../src/types/index.js';

const TERRACES_IN = 'data-raw/terraces.raw.json';
const BUILDINGS_IN = 'data-raw/buildings.resolved.json';
const POIS_IN = 'data-raw/osm-pois.raw.json';
const OUT_DIR = 'public/data';
const BUILDINGS_DIR = `${OUT_DIR}/buildings`;
const GRID_STEP = 0.01; // ~1 km
const POI_MATCH_RADIUS_M = 50;

const BCN_BBOX: [number, number, number, number] = [2.07, 41.32, 2.23, 41.47];
const CITY = 'Barcelona';

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function truncCoords(coords: [number, number][]): [number, number][] {
  return coords.map(
    ([lng, lat]) =>
      [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] as [number, number],
  );
}

async function main(): Promise<void> {
  // Terrazze
  const tRaw = JSON.parse(await readFile(TERRACES_IN, 'utf-8')) as { terraces: Terrace[] };
  let terraces: Terrace[] = tRaw.terraces.map((t) => ({
    ...t,
    // 5 decimali = ~1 m di precisione, sufficiente per il calcolo del sole.
    lat: Math.round(t.lat * 1e5) / 1e5,
    lng: Math.round(t.lng * 1e5) / 1e5,
  }));

  // Arricchimento: nome commerciale dal POI OSM più vicino.
  // Il dataset BCN non contiene il nome del locale: arricchiamo con OSM (Fase 3 anticipata).
  if (await exists(POIS_IN)) {
    const pRaw = JSON.parse(await readFile(POIS_IN, 'utf-8')) as { pois: RawPoi[] };
    const before = terraces.filter((t) => t.name !== t.address).length;
    terraces = matchTerracesToPois(terraces, pRaw.pois, POI_MATCH_RADIUS_M);
    const after = terraces.filter((t) => t.name !== t.address).length;
    console.log(
      `Arricchimento POI: ${after - before} terrazze su ${terraces.length} (${((after / terraces.length) * 100).toFixed(1)}%) con nome OSM.`,
    );
  } else {
    console.warn(`!! ${POIS_IN} mancante: salto l'arricchimento OSM.`);
  }

  // Edifici
  const bRaw = JSON.parse(await readFile(BUILDINGS_IN, 'utf-8')) as { buildings: Building[] };
  const buildings = bRaw.buildings.map((b) => ({ ...b, footprint: truncCoords(b.footprint) }));

  // Pulisce e ricrea l'output
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(BUILDINGS_DIR, { recursive: true });

  // Scrive terraces.json: include chairs e surfaceSqM (mostrati nella TerraceCard).
  const runtime = terraces.map((tr) => ({
    id: tr.id,
    name: tr.name,
    address: tr.address,
    lat: tr.lat,
    lng: tr.lng,
    tables: tr.tables,
    chairs: tr.chairs ?? 0,
    surfaceSqM: tr.surfaceSqM ?? 0,
    neighborhood: tr.neighborhood,
  }));
  await writeFile(`${OUT_DIR}/terraces.json`, JSON.stringify(runtime));

  // Suddivide edifici in griglia
  const chunks = chunkByGrid(buildings, GRID_STEP);
  for (const [key, list] of Object.entries(chunks)) {
    await writeFile(`${BUILDINGS_DIR}/${key}.json`, JSON.stringify(list));
  }

  const meta: Meta = {
    city: CITY,
    bbox: BCN_BBOX,
    generatedAt: new Date().toISOString(),
    gridStep: GRID_STEP,
    buildingCount: buildings.length,
    terraceCount: terraces.length,
  };
  await writeFile(`${OUT_DIR}/meta.json`, JSON.stringify(meta, null, 2));

  // Sanity check: fail forte se la pipeline produce dati palesemente sbagliati.
  if (terraces.length < 1000) {
    throw new Error(`Pipeline output sospetto: solo ${terraces.length} terrazze (< 1000). Aborting.`);
  }
  if (buildings.length < 10_000) {
    throw new Error(`Pipeline output sospetto: solo ${buildings.length} edifici (< 10000). Aborting.`);
  }
  const noName = terraces.filter((tr) => tr.name === tr.address).length;
  const coverage = ((terraces.length - noName) / terraces.length) * 100;
  if (coverage < 40) {
    throw new Error(`Pipeline output sospetto: copertura nomi POI ${coverage.toFixed(1)}% (< 40%). Verifica fetch POI.`);
  }
  const outsideBbox = terraces.filter((tr) =>
    tr.lng < BCN_BBOX[0] || tr.lng > BCN_BBOX[2] ||
    tr.lat < BCN_BBOX[1] || tr.lat > BCN_BBOX[3]);
  if (outsideBbox.length > 0) {
    throw new Error(`Pipeline output sospetto: ${outsideBbox.length} terrazze fuori dal bbox BCN.`);
  }

  console.log(
    `Output scritto in ${OUT_DIR}: ${terraces.length} terrazze, ${buildings.length} edifici in ${Object.keys(chunks).length} celle. Copertura nomi: ${coverage.toFixed(1)}%.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
