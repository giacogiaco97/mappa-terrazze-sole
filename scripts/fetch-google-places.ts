// Arricchimento Google Places per TUTTE le terrazze di una città.
//
// Strategia: per ogni terrazza chiama Places API (New) v1 `searchNearby` nel
// raggio 30m, prende il primo locale gastronomico, salva (placeId, name, lat,
// lng). Cache su disco per resume in caso di interruzione: rieseguendo lo
// script salta le terrazze già processate.
//
// Il build-output decide come usare i match:
//   - se la terrazza ha già un name autoritativo (dataset comunale BCN/MAD o
//     OSM nativo), allega SOLO il placeId per il link Google Maps pixel-perfect
//   - se name è ancora vuoto/uguale ad address (BCN dopo OSM match fallito),
//     usa name+placeId di Google come fallback
//
// Costo: Places Search Nearby = $32 per 1000 chiamate (Essentials SKU). Con
// FieldMask limitato a id+displayName+location+types, restiamo nel pricing
// essentials. Esempi: BCN ~6900 = $220, Madrid ~6400 = $200, Sevilla 296 = $10,
// coperti dal free tier $200/mese di Google Cloud.
//
// Env var SKIP_NAMED=1 forza il vecchio comportamento (solo terrazze senza
// nome), utile per risparmiare costi se il placeId non interessa.
//
// API key: variabile d'ambiente GOOGLE_PLACES_API_KEY (o .env.local).
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { matchTerracesToPois } from './lib/match-pois.js';
import type { RawPoi } from './fetch-osm-pois.js';
import type { Terrace } from '../src/types/index.js';

// Carica .env.local se presente (formato minimal KEY=value, una per riga).
// Evita di dover esportare manualmente la variabile in shell ogni volta.
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
const RADIUS_M = 30;
const RATE_LIMIT_MS = 100; // 10 req/sec (Google permette ~100/sec, restiamo gentili)
const INCLUDED_TYPES = [
  'restaurant', 'cafe', 'bar', 'bakery', 'fast_food_restaurant',
  'ice_cream_shop', 'coffee_shop', 'pub', 'wine_bar', 'meal_takeaway',
];
const FIELD_MASK = 'places.id,places.displayName,places.location,places.types,places.formattedAddress';

const CITY = (process.env.CITY ?? 'bcn').toLowerCase();
const TERRACES_IN = `data-raw/terraces-${CITY}.raw.json`;
const POIS_IN = `data-raw/osm-pois-${CITY}.raw.json`;
const OUT_FILE = `data-raw/google-places-${CITY}.raw.json`;

export type GooglePlaceMatch = {
  terraceId: string;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  types: string[];
  formattedAddress?: string;
};

type CacheFile = {
  fetchedAt: string;
  matches: GooglePlaceMatch[];
  /** Terrace IDs tentati ma senza risultato Google: skip al prossimo run. */
  triedNoMatch: string[];
};

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

async function loadCache(): Promise<CacheFile> {
  if (await exists(OUT_FILE)) {
    const raw = await readFile(OUT_FILE, 'utf-8');
    return JSON.parse(raw) as CacheFile;
  }
  return { fetchedAt: new Date().toISOString(), matches: [], triedNoMatch: [] };
}

async function searchNearbyOne(
  apiKey: string,
  lat: number,
  lng: number,
): Promise<GooglePlaceMatch | null> {
  const body = {
    includedTypes: INCLUDED_TYPES,
    maxResultCount: 1,
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius: RADIUS_M },
    },
    rankPreference: 'DISTANCE',
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
  if (res.status === 429) {
    throw new Error(`Rate limit raggiunto (HTTP 429). Rilancia tra qualche minuto.`);
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Places API errore HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      location?: { latitude: number; longitude: number };
      types?: string[];
      formattedAddress?: string;
    }>;
  };
  const p = json.places?.[0];
  if (!p || !p.id || !p.displayName?.text || !p.location) return null;
  return {
    terraceId: '', // riempito dal chiamante
    placeId: p.id,
    name: p.displayName.text,
    lat: p.location.latitude,
    lng: p.location.longitude,
    types: p.types ?? [],
    formattedAddress: p.formattedAddress,
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('!! GOOGLE_PLACES_API_KEY mancante. Salto l\'arricchimento Google Places.');
    console.warn('   Per abilitarlo: setta la variabile d\'ambiente (o secret GitHub) GOOGLE_PLACES_API_KEY.');
    return; // soft exit: la pipeline prosegue con la sola copertura OSM
  }

  // 1. Carica raw terraces
  const tRaw = JSON.parse(await readFile(TERRACES_IN, 'utf-8')) as { terraces: Terrace[] };
  const skipNamed = process.env.SKIP_NAMED === '1';

  // 2. Determina target. Default: tutte le terrazze (per ottenere placeId
  //    per il link Google Maps pixel-perfect su ogni card). Con SKIP_NAMED=1
  //    saltiamo le già-nominate (modalità risparmio costi, usata in passato).
  let target: Terrace[];
  if (skipNamed) {
    if (await exists(POIS_IN)) {
      const pRaw = JSON.parse(await readFile(POIS_IN, 'utf-8')) as { pois: RawPoi[] };
      const withOsm = matchTerracesToPois(tRaw.terraces, pRaw.pois, 70);
      target = withOsm.filter((t) => t.name === t.address);
    } else {
      target = tRaw.terraces.filter((t) => !t.name || t.name === t.address);
    }
    console.log(`Modalità SKIP_NAMED: solo terrazze senza nome (${target.length}/${tRaw.terraces.length})`);
  } else {
    target = tRaw.terraces;
    console.log(`Modalità default: arricchimento placeId per TUTTE le terrazze (${target.length})`);
  }

  // Stima costo (Essentials SKU $32/1000)
  const estCost = (target.length / 1000) * 32;
  console.log(`Costo stimato (Essentials SKU): ~$${estCost.toFixed(2)}`);

  // 3. Cache: salta già processate (sia match riusciti che falliti)
  const cache = await loadCache();
  const seen = new Set<string>([...cache.matches.map((m) => m.terraceId), ...cache.triedNoMatch]);
  const todo = target.filter((t) => !seen.has(t.id));
  console.log(`Già in cache: ${seen.size}. Restanti da chiamare: ${todo.length}`);

  // 4. Chiama Google Places per le restanti
  let ok = 0;
  let noMatch = 0;
  let errors = 0;
  const startedAt = Date.now();
  for (let i = 0; i < todo.length; i++) {
    const t = todo[i]!;
    try {
      const match = await searchNearbyOne(apiKey, t.lat, t.lng);
      if (match) {
        match.terraceId = t.id;
        cache.matches.push(match);
        ok++;
      } else {
        cache.triedNoMatch.push(t.id);
        noMatch++;
      }
    } catch (err) {
      errors++;
      console.error(`  ${t.id} (${t.address}): ${(err as Error).message}`);
      if (errors >= 5) {
        console.error('!! 5 errori consecutivi/totali, salvo cache e abort.');
        break;
      }
    }
    // Persistenza incrementale ogni 50 chiamate, così un crash non perde nulla
    if ((i + 1) % 50 === 0) {
      cache.fetchedAt = new Date().toISOString();
      await mkdir('data-raw', { recursive: true });
      await writeFile(OUT_FILE, JSON.stringify(cache));
      const eta = Math.round(((Date.now() - startedAt) / (i + 1)) * (todo.length - i - 1) / 1000);
      console.log(`  ${i + 1}/${todo.length} (ok=${ok}, no=${noMatch}, err=${errors}) — ETA ~${eta}s`);
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  // 5. Finalizza
  cache.fetchedAt = new Date().toISOString();
  await mkdir('data-raw', { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(cache));

  const coverageGoogle = ((cache.matches.length / target.length) * 100).toFixed(1);
  console.log(
    `Google Places: ${cache.matches.length}/${target.length} terrazze processate con match (${coverageGoogle}%).`,
  );
  console.log(`Output: ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
