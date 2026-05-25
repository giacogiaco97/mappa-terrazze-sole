import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { chunkByGrid } from './lib/chunk-by-grid.js';
import { matchTerracesToPois } from './lib/match-pois.js';
import { haversineMeters } from '../src/lib/geometry.js';
import { discoveredToTerrace, type DiscoveredPlace } from './discover-places.js';
import type { RawPoi } from './fetch-osm-pois.js';
import type { GooglePlaceMatch } from './fetch-google-places.js';
import type { Building, Meta, Terrace } from '../src/types/index.js';

/**
 * Build dell'output runtime per una città. Configurabile via env var CITY.
 * Output finale in `public/data/{city}/`:
 *  - terraces.json
 *  - meta.json
 *  - buildings/{x}_{y}.json (grid sharding ~1km)
 *
 * Inoltre aggiorna `public/data/cities.json` con la lista delle città
 * disponibili (mantiene quelle già presenti, aggiunge/aggiorna quella corrente).
 */

type CityConfig = {
  code: string;
  name: string;
  /** Nome che appare nei testi i18n nei vari linguaggi */
  displayName: { es: string; en: string; ca: string };
  /** bbox finale runtime: [lngMin, latMin, lngMax, latMax] */
  bbox: [number, number, number, number];
  /** Centro mappa default + zoom iniziale */
  center: { lat: number; lng: number; zoom: number };
};

const CITIES: Record<string, CityConfig> = {
  bcn: {
    code: 'bcn',
    name: 'Barcelona',
    displayName: { es: 'Barcelona', en: 'Barcelona', ca: 'Barcelona' },
    bbox: [2.07, 41.32, 2.23, 41.47],
    center: { lat: 41.39, lng: 2.165, zoom: 14 },
  },
  mad: {
    code: 'mad',
    name: 'Madrid',
    displayName: { es: 'Madrid', en: 'Madrid', ca: 'Madrid' },
    // bbox finale generosa per accogliere anche distretti periferici N/S
    bbox: [-3.80, 40.33, -3.55, 40.54],
    center: { lat: 40.4168, lng: -3.7038, zoom: 14 },
  },
  sev: {
    code: 'sev',
    name: 'Sevilla',
    displayName: { es: 'Sevilla', en: 'Seville', ca: 'Sevilla' },
    bbox: [-6.05, 37.34, -5.92, 37.43],
    center: { lat: 37.3886, lng: -5.9823, zoom: 14 },
  },
};

const CITY = (process.env.CITY ?? 'bcn').toLowerCase();
const cityConf = CITIES[CITY];
if (!cityConf) {
  throw new Error(`CITY ignota: '${CITY}'. Valori validi: ${Object.keys(CITIES).join(', ')}`);
}

const TERRACES_IN = `data-raw/terraces-${CITY}.raw.json`;
const BUILDINGS_IN = `data-raw/buildings-${CITY}.resolved.json`;
const POIS_IN = `data-raw/osm-pois-${CITY}.raw.json`;
const GOOGLE_IN = `data-raw/google-places-${CITY}.raw.json`;
const DISCOVER_IN = `data-raw/discover-places-${CITY}.raw.json`;
const OUT_DIR = `public/data/${CITY}`;
const BUILDINGS_DIR = `${OUT_DIR}/buildings`;
const CITIES_INDEX = `public/data/cities.json`;
const GRID_STEP = 0.01; // ~1 km
const POI_MATCH_RADIUS_M = 70;
/** Soglia dedupe: una discovered è considerata duplicato se < 25m da una OSM */
const DISCOVER_DEDUPE_M = 25;

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function truncCoords(coords: [number, number][]): [number, number][] {
  return coords.map(
    ([lng, lat]) =>
      [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] as [number, number],
  );
}

async function readCitiesIndex(): Promise<{ cities: Record<string, CityConfig> }> {
  if (!(await exists(CITIES_INDEX))) return { cities: {} };
  try {
    const raw = JSON.parse(await readFile(CITIES_INDEX, 'utf-8')) as { cities?: Record<string, CityConfig> };
    return { cities: raw.cities ?? {} };
  } catch {
    return { cities: {} };
  }
}

async function main(): Promise<void> {
  console.log(`\n=== Build output per città: ${cityConf.name} (${CITY}) ===\n`);

  // Terrazze + meta source (per decidere se applicare arricchimento OSM o no)
  const tRaw = JSON.parse(await readFile(TERRACES_IN, 'utf-8')) as { terraces: Terrace[]; source?: string };
  const isOsmOnlyDataset = (tRaw.source ?? '').toLowerCase().includes('osm');
  let terraces: Terrace[] = tRaw.terraces.map((t) => ({
    ...t,
    lat: Math.round(t.lat * 1e5) / 1e5,
    lng: Math.round(t.lng * 1e5) / 1e5,
  }));

  // Arricchimento OSM. SOLO per dataset comunali (BCN dove il name è vuoto
  // nel raw, Madrid dove il name è già 100% ma il match aggiunge POI vicini).
  // Per dataset OSM-only (Sevilla/Valencia/Alicante via fetch-terraces-osm.ts)
  // il nome è già il name OSM autoritativo: NON applichiamo match per non corrompere.
  if (isOsmOnlyDataset) {
    terraces = terraces.map((t) => ({ ...t, nameSource: 'osm' as const }));
    const named = terraces.filter((t) => t.name).length;
    console.log(`Dataset OSM-only: skippo match POI (nomi già autoritativi). ${named}/${terraces.length} con nome.`);
  } else if (await exists(POIS_IN)) {
    const pRaw = JSON.parse(await readFile(POIS_IN, 'utf-8')) as { pois: RawPoi[] };
    const before = new Set(terraces.filter((t) => t.name !== t.address).map((t) => t.id));
    terraces = matchTerracesToPois(terraces, pRaw.pois, POI_MATCH_RADIUS_M);
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

  // Arricchimento Google Places (opzionale)
  if (await exists(GOOGLE_IN)) {
    const gRaw = JSON.parse(await readFile(GOOGLE_IN, 'utf-8')) as { matches: GooglePlaceMatch[] };
    const byId = new Map(gRaw.matches.map((m) => [m.terraceId, m] as const));
    let added = 0;
    terraces = terraces.map((t) => {
      if (t.name !== t.address) return t;
      const g = byId.get(t.id);
      if (!g) return t;
      added++;
      return { ...t, name: g.name, placeId: g.placeId, nameSource: 'google' as const };
    });
    terraces = terraces.map((t) => (t.placeId ? t : (byId.get(t.id)?.placeId ? { ...t, placeId: byId.get(t.id)!.placeId } : t)));
    const totalNamed = terraces.filter((t) => t.name !== t.address).length;
    const totalWithPlaceId = terraces.filter((t) => t.placeId).length;
    console.log(
      `Arricchimento Google Places: +${added} nomi nuovi → ${totalNamed}/${terraces.length} totali (${((totalNamed / terraces.length) * 100).toFixed(1)}%). place_id su ${totalWithPlaceId} terrazze.`,
    );
  } else {
    console.warn(`!! ${GOOGLE_IN} mancante: salto l'arricchimento Google Places.`);
  }

  // Discovery: nuove terrazze scoperte via Google Places con outdoorSeating=true
  // (per città dove OSM è sotto-coperto, es. Sevilla). Merge con dedupe per
  // distanza ravvicinata + placeId esistente.
  if (await exists(DISCOVER_IN)) {
    const dRaw = JSON.parse(await readFile(DISCOVER_IN, 'utf-8')) as { places: DiscoveredPlace[] };
    const [bLngMin, bLatMin, bLngMax, bLatMax] = cityConf.bbox;
    // Filtro: outdoorSeating + dentro bbox della città (Google searchNearby
    // può restituire luoghi entro radius anche fuori cella, e quindi fuori bbox)
    const candidates = dRaw.places.filter((p) =>
      p.outdoorSeating &&
      p.lng >= bLngMin && p.lng <= bLngMax &&
      p.lat >= bLatMin && p.lat <= bLatMax,
    );
    const skippedOutsideBbox = dRaw.places.filter((p) => p.outdoorSeating).length - candidates.length;
    const existingPlaceIds = new Set(terraces.filter((t) => t.placeId).map((t) => t.placeId!));
    let added = 0;
    let skippedDupePlaceId = 0;
    let skippedDupeNear = 0;
    for (const p of candidates) {
      // Dedupe per placeId già presente
      if (existingPlaceIds.has(p.placeId)) {
        skippedDupePlaceId++;
        continue;
      }
      // Dedupe per coordinate ravvicinate (< 25m da una OSM esistente)
      const near = terraces.find((t) => haversineMeters(t.lat, t.lng, p.lat, p.lng) < DISCOVER_DEDUPE_M);
      if (near) {
        // Se la near non ha placeId, glielo allego (link Google Maps pixel-perfect)
        if (!near.placeId) near.placeId = p.placeId;
        skippedDupeNear++;
        continue;
      }
      const newTerrace = discoveredToTerrace(p, CITY.toUpperCase());
      terraces.push(newTerrace);
      added++;
    }
    console.log(
      `Discovery Google: candidati ${candidates.length} (fuori bbox: ${skippedOutsideBbox}) → aggiunti ${added}, dedupe placeId ${skippedDupePlaceId}, dedupe coordinate ${skippedDupeNear}.`,
    );
  }

  // Edifici
  const bRaw = JSON.parse(await readFile(BUILDINGS_IN, 'utf-8')) as { buildings: Building[] };
  const buildings = bRaw.buildings.map((b) => ({ ...b, footprint: truncCoords(b.footprint) }));

  // Pulisce e ricrea l'output della città corrente
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(BUILDINGS_DIR, { recursive: true });

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

  // Sharding edifici per griglia
  const chunks = chunkByGrid(buildings, GRID_STEP);
  for (const [key, list] of Object.entries(chunks)) {
    await writeFile(`${BUILDINGS_DIR}/${key}.json`, JSON.stringify(list));
  }

  const meta: Meta = {
    city: cityConf.name,
    bbox: cityConf.bbox,
    generatedAt: new Date().toISOString(),
    gridStep: GRID_STEP,
    buildingCount: buildings.length,
    terraceCount: terraces.length,
  };
  await writeFile(`${OUT_DIR}/meta.json`, JSON.stringify(meta, null, 2));

  // Sanity checks (soglie rilassate: città come Siviglia su OSM hanno <500 entries)
  if (terraces.length < 100) {
    throw new Error(`Pipeline output sospetto: solo ${terraces.length} terrazze (< 100). Aborting.`);
  }
  if (buildings.length < 5_000) {
    throw new Error(`Pipeline output sospetto: solo ${buildings.length} edifici (< 5000). Aborting.`);
  }
  const noName = terraces.filter((tr) => tr.name === tr.address).length;
  const coverage = ((terraces.length - noName) / terraces.length) * 100;
  if (coverage < 30) {
    console.warn(`Pipeline warning: copertura nomi ${coverage.toFixed(1)}% (< 30%). Per ${CITY} accetto, ma verifica.`);
  }
  const [lngMin, latMin, lngMax, latMax] = cityConf.bbox;
  const outsideBbox = terraces.filter((tr) =>
    tr.lng < lngMin || tr.lng > lngMax ||
    tr.lat < latMin || tr.lat > latMax);
  if (outsideBbox.length > 0) {
    throw new Error(`Pipeline output sospetto: ${outsideBbox.length} terrazze fuori dal bbox ${cityConf.name}.`);
  }

  // Aggiorna indice cities.json (merge: mantiene altre città già pubblicate)
  await mkdir('public/data', { recursive: true });
  const idx = await readCitiesIndex();
  idx.cities[CITY] = cityConf;
  await writeFile(CITIES_INDEX, JSON.stringify(idx, null, 2));

  console.log(
    `\nOutput scritto in ${OUT_DIR}: ${terraces.length} terrazze, ${buildings.length} edifici in ${Object.keys(chunks).length} celle. Copertura nomi: ${coverage.toFixed(1)}%.`,
  );
  console.log(`Indice città aggiornato: ${CITIES_INDEX} (${Object.keys(idx.cities).join(', ')})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
