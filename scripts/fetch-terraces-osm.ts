// Fetch terrazze via OSM Overpass per città SENZA dataset comunale open
// (es. Siviglia, Alicante). Usa il tag `outdoor_seating=yes` su amenity
// gastronomiche. Copertura limitata (~30-50% delle terrazze reali, solo
// quelle taggate su OSM) ma uniforme e gratuita.
//
// Per città con dataset comunale (BCN, Madrid) usare fetch-terraces.ts o
// fetch-terraces-mad.ts (più completi e con tavoli/sedie reali).

import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWithRetry } from './lib/http.js';
import type { Terrace } from '../src/types/index.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

type CityConf = { bbox: string; label: string; idPrefix: string };
const CITY_BBOX: Record<string, CityConf> = {
  sev: { bbox: '37.34,-6.05,37.43,-5.92', label: 'Siviglia', idPrefix: 'S' },
  val: { bbox: '39.42,-0.45,39.52,-0.30', label: 'Valencia', idPrefix: 'V' },
  ali: { bbox: '38.32,-0.52,38.40,-0.44', label: 'Alicante', idPrefix: 'A' },
};

const CITY = (process.env.CITY ?? '').toLowerCase();
const cityConf = CITY_BBOX[CITY];
if (!cityConf) {
  throw new Error(
    `CITY ignota: '${CITY}'. Valori validi per OSM-only: ${Object.keys(CITY_BBOX).join(', ')}`,
  );
}

const QUERY = `
[out:json][timeout:180];
(
  node["amenity"~"^(restaurant|bar|cafe|pub|fast_food|biergarten|ice_cream)$"]["outdoor_seating"="yes"](${cityConf.bbox});
  way["amenity"~"^(restaurant|bar|cafe|pub|fast_food|biergarten|ice_cream)$"]["outdoor_seating"="yes"](${cityConf.bbox});
);
out center tags;
`.trim();

const OUT_FILE = `data-raw/terraces-${CITY}.raw.json`;

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
type OverpassResponse = { elements: OverpassElement[] };

async function main(): Promise<void> {
  console.log(`Overpass: query terrazze OSM ${cityConf.label}…`);
  const url = `${OVERPASS}?data=${encodeURIComponent(QUERY)}`;
  const res = await fetchWithRetry(url, {
    retries: 3,
    delayMs: 30_000,
    init: {
      method: 'GET',
      headers: {
        'User-Agent': 'mappa-terrazze-sole-pipeline/1.0',
        Accept: 'application/json',
      },
    },
  });
  const json = (await res.json()) as OverpassResponse;

  const terraces: Terrace[] = [];
  const seenIds = new Set<string>();
  let idx = 0;
  for (const el of json.elements) {
    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lng = el.type === 'node' ? el.lon : el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    const id = `${cityConf.idPrefix}-${el.type[0]}${el.id}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    idx++;

    // OSM raramente espone n. tavoli/sedie. Stime ragionevoli da `capacity:outdoor`
    // o `seats` se presenti, altrimenti default conservativo (~4 tavoli).
    const seatsOutdoor = parseInt(tags['capacity:outdoor'] ?? '', 10);
    const seats = isFinite(seatsOutdoor) ? seatsOutdoor : parseInt(tags.seats ?? '', 10);
    const chairs = isFinite(seats) && seats > 0 ? seats : 0;
    const tables = chairs > 0 ? Math.max(1, Math.round(chairs / 4)) : 4;

    const street = tags['addr:street'] ?? '';
    const houseNum = tags['addr:housenumber'] ?? '';
    // Address vuoto se OSM non ha addr:street (non duplichiamo name → address).
    // La card userà name come fallback display.
    const address = [street, houseNum].filter(Boolean).join(' ');

    terraces.push({
      id,
      name,
      address,
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      tables,
      chairs,
      surfaceSqM: 0,
      neighborhood: tags['addr:suburb'] ?? tags['addr:district'] ?? '',
    });
  }
  console.log(`Estratte ${terraces.length} terrazze OSM ${cityConf.label} (con name + outdoor_seating=yes)`);
  if (terraces.length < 100) {
    throw new Error(`Solo ${terraces.length} terrazze OSM ${CITY}: query potrebbe essere troncata o bbox sbagliato.`);
  }

  await mkdir('data-raw', { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        source: 'OSM Overpass (outdoor_seating=yes)',
        bbox: cityConf.bbox,
        fetchedAt: new Date().toISOString(),
        count: terraces.length,
        terraces,
      },
      null,
      2,
    ),
  );
  console.log(`Scritto ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
