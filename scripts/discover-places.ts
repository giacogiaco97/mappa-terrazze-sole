// Discovery di NUOVE terrazze via Google Places API per città dove OSM
// è sotto-coperto (es. Sevilla, Valencia, Alicante).
//
// Strategia: scansiona la bbox della città a griglia di ~500m. Per ogni cella
// chiama `searchNearby` con includedPrimaryTypes ristoranti/bar/cafe, FieldMask
// che include `places.outdoorSeating`. Tiene SOLO i luoghi con `outdoorSeating=true`.
// Dedup per placeId.
//
// Output: data-raw/discover-places-{city}.raw.json con lista terrazze "scoperte"
// da fondere con le OSM in build-output (priorità OSM se conflitto, dedupe per
// distanza ravvicinata).
//
// Costo stimato:
//   - bbox 10x10km, grid 500m = 400 chiamate × $32/1000 = ~$13 (Essentials)
//   - copertura attesa: 1000-3000 luoghi unici, di cui 200-800 con outdoor_seating
//
// Cache su disco per resume (stesso pattern di fetch-google-places.ts).
//
// API key: GOOGLE_PLACES_API_KEY (auto-load .env.local).

import { writeFile, mkdir, access } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import type { Terrace } from '../src/types/index.js';

function loadEnvLocal(): void {
  const path = '.env.local';
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim();
  }
}
loadEnvLocal();

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
const RATE_LIMIT_MS = 100;
const GRID_M = 500; // passo griglia (metri). 500m = ~400 chiamate per bbox 10km
const RADIUS_M = 350; // raggio searchNearby (>√2 × GRID/2 per copertura sovrapposta)
const MAX_RESULTS = 20; // massimo Google per query
const INCLUDED_TYPES = ['restaurant', 'cafe', 'bar', 'pub', 'wine_bar', 'fast_food_restaurant', 'meal_takeaway'];

// FieldMask con outdoorSeating per filtrare i veri candidati terrazza
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.formattedAddress',
  'places.outdoorSeating',
].join(',');

type CityConf = { bbox: [number, number, number, number]; label: string; idPrefix: string };
const CITY_BBOX: Record<string, CityConf> = {
  // [lngMin, latMin, lngMax, latMax]
  sev: { bbox: [-6.05, 37.34, -5.92, 37.43], label: 'Sevilla', idPrefix: 'SG' },
  val: { bbox: [-0.45, 39.42, -0.30, 39.52], label: 'Valencia', idPrefix: 'VG' },
  ali: { bbox: [-0.52, 38.32, -0.44, 38.40], label: 'Alicante', idPrefix: 'AG' },
};

const CITY = (process.env.CITY ?? '').toLowerCase();
const cityConf = CITY_BBOX[CITY];
if (!cityConf) {
  throw new Error(`CITY ignota: '${CITY}'. Valori validi: ${Object.keys(CITY_BBOX).join(', ')}`);
}

const OUT_FILE = `data-raw/discover-places-${CITY}.raw.json`;

type DiscoveredPlace = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  primaryType?: string;
  types?: string[];
  formattedAddress?: string;
  outdoorSeating: boolean;
};

type CacheFile = {
  fetchedAt: string;
  bbox: [number, number, number, number];
  visitedCells: string[]; // celle già processate
  places: DiscoveredPlace[]; // dedupe per placeId
};

async function existsP(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function loadCache(): Promise<CacheFile> {
  if (await existsP(OUT_FILE)) {
    return JSON.parse(await readFile(OUT_FILE, 'utf-8')) as CacheFile;
  }
  return { fetchedAt: new Date().toISOString(), bbox: cityConf.bbox, visitedCells: [], places: [] };
}

async function searchNearbyCell(
  apiKey: string,
  lat: number,
  lng: number,
): Promise<DiscoveredPlace[]> {
  const body = {
    includedPrimaryTypes: INCLUDED_TYPES,
    maxResultCount: MAX_RESULTS,
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M },
    },
    rankPreference: 'POPULARITY',
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 403 || res.status === 401) {
    throw new Error(`Google API key non valida o Places API non abilitata (HTTP ${res.status})`);
  }
  if (res.status === 429) throw new Error('Rate limit raggiunto (HTTP 429)');
  if (!res.ok) throw new Error(`Places API errore HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      location?: { latitude: number; longitude: number };
      types?: string[];
      primaryType?: string;
      formattedAddress?: string;
      outdoorSeating?: boolean;
    }>;
  };
  const out: DiscoveredPlace[] = [];
  for (const p of json.places ?? []) {
    if (!p.id || !p.displayName?.text || !p.location) continue;
    out.push({
      placeId: p.id,
      name: p.displayName.text,
      lat: p.location.latitude,
      lng: p.location.longitude,
      primaryType: p.primaryType,
      types: p.types,
      formattedAddress: p.formattedAddress,
      outdoorSeating: p.outdoorSeating === true,
    });
  }
  return out;
}

function gridCellsForBbox(
  bbox: [number, number, number, number],
  stepMeters: number,
): { lat: number; lng: number; key: string }[] {
  const [lngMin, latMin, lngMax, latMax] = bbox;
  const dLat = stepMeters / 111_320;
  const meanLat = (latMin + latMax) / 2;
  const dLng = stepMeters / (111_320 * Math.cos((meanLat * Math.PI) / 180));
  const out: { lat: number; lng: number; key: string }[] = [];
  let r = 0;
  for (let lat = latMin + dLat / 2; lat < latMax; lat += dLat, r++) {
    let c = 0;
    for (let lng = lngMin + dLng / 2; lng < lngMax; lng += dLng, c++) {
      out.push({
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        key: `${r}_${c}`,
      });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('!! GOOGLE_PLACES_API_KEY mancante.');
    process.exit(1);
  }

  const cells = gridCellsForBbox(cityConf.bbox, GRID_M);
  const cost = (cells.length / 1000) * 32;
  console.log(`Discovery ${cityConf.label}: ${cells.length} celle (grid ${GRID_M}m), costo stimato ~$${cost.toFixed(2)}`);

  const cache = await loadCache();
  const seenCells = new Set(cache.visitedCells);
  const todo = cells.filter((c) => !seenCells.has(c.key));
  const placesByPid = new Map(cache.places.map((p) => [p.placeId, p] as const));
  console.log(`Già in cache: ${seenCells.size} celle, ${placesByPid.size} luoghi. Restanti: ${todo.length}`);

  let totalNew = 0;
  let totalWithOutdoor = 0;
  let errors = 0;
  const start = Date.now();

  for (let i = 0; i < todo.length; i++) {
    const cell = todo[i]!;
    try {
      const places = await searchNearbyCell(apiKey, cell.lat, cell.lng);
      let newPlaces = 0;
      for (const p of places) {
        if (placesByPid.has(p.placeId)) continue;
        placesByPid.set(p.placeId, p);
        newPlaces++;
        if (p.outdoorSeating) totalWithOutdoor++;
      }
      totalNew += newPlaces;
      cache.visitedCells.push(cell.key);
    } catch (err) {
      errors++;
      console.error(`  cella ${cell.key} (${cell.lat},${cell.lng}): ${(err as Error).message}`);
      if (errors >= 5) {
        console.error('!! 5 errori, salvo cache e abort.');
        break;
      }
    }
    if ((i + 1) % 25 === 0 || i === todo.length - 1) {
      cache.fetchedAt = new Date().toISOString();
      cache.places = Array.from(placesByPid.values());
      await mkdir('data-raw', { recursive: true });
      await writeFile(OUT_FILE, JSON.stringify(cache));
      const eta = Math.round(((Date.now() - start) / (i + 1)) * (todo.length - i - 1) / 1000);
      console.log(
        `  ${i + 1}/${todo.length} celle (nuovi: ${totalNew}, con outdoor: ${totalWithOutdoor}) — ETA ${eta}s`,
      );
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  cache.fetchedAt = new Date().toISOString();
  cache.places = Array.from(placesByPid.values());
  await mkdir('data-raw', { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(cache));

  const withOutdoor = cache.places.filter((p) => p.outdoorSeating);
  console.log(
    `\nDiscovery completata. ${cache.places.length} luoghi totali, di cui ${withOutdoor.length} con outdoorSeating=true.`,
  );
  console.log(`Output: ${OUT_FILE}`);
}

// Esegui main() SOLO se chiamato direttamente come script (non quando importato
// da build-output.ts per i tipi/helper di merge).
const isMainScript = process.argv[1]?.endsWith('discover-places.ts');
if (isMainScript) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Exporter: helper per integrazione build-output (chiamato in fase merge)
export type { DiscoveredPlace };

/** Converte DiscoveredPlace in Terrace (per merge in build-output). */
export function discoveredToTerrace(p: DiscoveredPlace, idPrefix: string): Terrace {
  // Estrae street/number da formattedAddress (formato Google "Calle X, 5, Madrid, Spain")
  let address = '';
  if (p.formattedAddress) {
    const parts = p.formattedAddress.split(',').map((s) => s.trim());
    // Primo segmento è la via, secondo spesso il distretto/CP
    if (parts.length >= 1) address = parts[0] || '';
  }
  return {
    id: `${idPrefix}-${p.placeId.slice(0, 12)}`,
    name: p.name,
    address: address || p.name,
    lat: Math.round(p.lat * 1e5) / 1e5,
    lng: Math.round(p.lng * 1e5) / 1e5,
    tables: 4, // stima conservativa (Google non espone count tavoli)
    chairs: 0,
    surfaceSqM: 0,
    neighborhood: '',
    placeId: p.placeId,
    nameSource: 'google',
  };
}
