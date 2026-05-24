import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { chunkByGrid } from './lib/chunk-by-grid.js';
import { matchTerracesToPois } from './lib/match-pois.js';
import type { RawPoi } from './fetch-osm-pois.js';
import type { GooglePlaceMatch } from './fetch-google-places.js';
import type { Building, Meta, Terrace } from '../src/types/index.js';

const TERRACES_IN = 'data-raw/terraces.raw.json';
const BUILDINGS_IN = 'data-raw/buildings.resolved.json';
const POIS_IN = 'data-raw/osm-pois.raw.json';
const GOOGLE_IN = 'data-raw/google-places.raw.json';
const OUT_DIR = 'public/data';
const BUILDINGS_DIR = `${OUT_DIR}/buildings`;
const GRID_STEP = 0.01; // ~1 km
// Raggio match POI: con 50m perdiamo locali con ingresso "profondo" (interno cortile)
// o terrazze autorizzate su via diversa dalla facciata. 70m copre ~10% terrazze in più
// senza mismatch eccessivi grazie al vincolo greedy (1 POI = 1 terrazza più vicina).
const POI_MATCH_RADIUS_M = 70;

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

  // Arricchimento nome: prima OSM (gratuito, copre ~72%), poi Google Places per i buchi.
  // OSM ha vincolo greedy "1 POI = 1 terrazza più vicina"; Google viene applicato SOLO
  // alle terrazze ancora con name === address, quindi non sovrascrive mai un nome OSM.
  if (await exists(POIS_IN)) {
    const pRaw = JSON.parse(await readFile(POIS_IN, 'utf-8')) as { pois: RawPoi[] };
    const before = new Set(terraces.filter((t) => t.name !== t.address).map((t) => t.id));
    terraces = matchTerracesToPois(terraces, pRaw.pois, POI_MATCH_RADIUS_M);
    // Marca origine OSM per le terrazze appena nominate (non quelle che avevano già name).
    terraces = terraces.map((t) =>
      t.name !== t.address && !before.has(t.id) ? { ...t, nameSource: 'osm' as const } : t,
    );
    const after = terraces.filter((t) => t.name !== t.address).length;
    console.log(
      `Arricchimento OSM: ${after}/${terraces.length} terrazze (${((after / terraces.length) * 100).toFixed(1)}%) con nome.`,
    );
  } else {
    console.warn(`!! ${POIS_IN} mancante: salto l'arricchimento OSM.`);
  }

  if (await exists(GOOGLE_IN)) {
    const gRaw = JSON.parse(await readFile(GOOGLE_IN, 'utf-8')) as { matches: GooglePlaceMatch[] };
    const byId = new Map(gRaw.matches.map((m) => [m.terraceId, m] as const));
    let added = 0;
    terraces = terraces.map((t) => {
      if (t.name !== t.address) return t; // già nominata da OSM
      const g = byId.get(t.id);
      if (!g) return t;
      added++;
      return { ...t, name: g.name, placeId: g.placeId, nameSource: 'google' as const };
    });
    // Per le terrazze già nominate da OSM, allega comunque il placeId se esiste
    // (così il link Google Maps apre la scheda esatta anche per quelle). Lascia
    // nameSource='osm': il nome resta OSM, il placeId è solo per il link.
    terraces = terraces.map((t) => (t.placeId ? t : (byId.get(t.id)?.placeId ? { ...t, placeId: byId.get(t.id)!.placeId } : t)));
    const totalNamed = terraces.filter((t) => t.name !== t.address).length;
    const totalWithPlaceId = terraces.filter((t) => t.placeId).length;
    console.log(
      `Arricchimento Google Places: +${added} nomi nuovi → ${totalNamed}/${terraces.length} totali (${((totalNamed / terraces.length) * 100).toFixed(1)}%). place_id su ${totalWithPlaceId} terrazze.`,
    );
  } else {
    console.warn(`!! ${GOOGLE_IN} mancante: salto l'arricchimento Google Places (esegui prima 'npx tsx scripts/fetch-google-places.ts').`);
  }

  // Edifici
  const bRaw = JSON.parse(await readFile(BUILDINGS_IN, 'utf-8')) as { buildings: Building[] };
  const buildings = bRaw.buildings.map((b) => ({ ...b, footprint: truncCoords(b.footprint) }));

  // Pulisce e ricrea l'output
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(BUILDINGS_DIR, { recursive: true });

  // Scrive terraces.json: include chairs e surfaceSqM (mostrati nella TerraceCard).
  // placeId e nameSource sono opzionali: omessi se assenti per non sprecare bytes.
  const runtime = terraces.map((tr) => {
    const base: Record<string, unknown> = {
      id: tr.id,
      name: tr.name,
      address: tr.address,
      lat: tr.lat,
      lng: tr.lng,
      tables: tr.tables,
      chairs: tr.chairs ?? 0,
      surfaceSqM: tr.surfaceSqM ?? 0,
      neighborhood: tr.neighborhood,
    };
    if (tr.placeId) base.placeId = tr.placeId;
    if (tr.nameSource) base.nameSource = tr.nameSource;
    return base;
  });
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
