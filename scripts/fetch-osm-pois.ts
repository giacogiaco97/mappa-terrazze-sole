import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWithRetry } from './lib/http.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

const CITY_BBOX: Record<string, { bbox: string; label: string }> = {
  bcn: { bbox: '41.32,2.07,41.47,2.23', label: 'Barcellona' },
  mad: { bbox: '40.36,-3.80,40.52,-3.55', label: 'Madrid' },
};
const CITY = (process.env.CITY ?? 'bcn').toLowerCase();
const cityConf = CITY_BBOX[CITY];
if (!cityConf) {
  throw new Error(`CITY ignota: '${CITY}'. Valori validi: ${Object.keys(CITY_BBOX).join(', ')}`);
}
const BBOX = cityConf.bbox;

// Amenity gastronomiche con `name` settato. Includiamo anche shop=bakery
// e shop=coffee perché spesso hanno tavolini fuori.
const QUERY = `
[out:json][timeout:120];
(
  node["amenity"~"^(restaurant|bar|cafe|pub|fast_food|biergarten|ice_cream|food_court|ice_cream_parlour|nightclub)$"]["name"](${BBOX});
  way["amenity"~"^(restaurant|bar|cafe|pub|fast_food|biergarten|ice_cream|food_court|ice_cream_parlour|nightclub)$"]["name"](${BBOX});
  node["shop"~"^(bakery|coffee|deli|pastry|confectionery|chocolate|wine|alcohol)$"]["name"](${BBOX});
  way["shop"~"^(bakery|coffee|deli|pastry|confectionery|chocolate|wine|alcohol)$"]["name"](${BBOX});
  node["tourism"~"^(hotel|hostel|guest_house)$"]["name"](${BBOX});
  way["tourism"~"^(hotel|hostel|guest_house)$"]["name"](${BBOX});
);
out center tags;
`.trim();

const OUT_DIR = 'data-raw';
const OUT_FILE = `${OUT_DIR}/osm-pois-${CITY}.raw.json`;

export type RawPoi = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: string; // amenity o shop value
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements: OverpassElement[] };

function elementToPoi(el: OverpassElement): RawPoi | null {
  const tags = el.tags ?? {};
  const name = tags.name;
  if (!name) return null;
  const lat = el.type === 'node' ? el.lat : el.center?.lat;
  const lng = el.type === 'node' ? el.lon : el.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const kind = tags.amenity ?? tags.shop ?? tags.tourism ?? 'other';
  return {
    id: `${el.type[0]}${el.id}`,
    name: name.trim(),
    lat,
    lng,
    kind,
  };
}

async function main(): Promise<void> {
  console.log(`Overpass: query POI commerciali ${cityConf.label}…`);
  const url = `${OVERPASS}?data=${encodeURIComponent(QUERY)}`;
  const res = await fetchWithRetry(url, {
    retries: 3,
    delayMs: 30_000,
    init: {
      method: 'GET',
      headers: {
        'User-Agent': 'mappa-terrazze-sole-pipeline/1.0 (https://github.com/giacogiaco97/mappa-terrazze-sole)',
        Accept: 'application/json',
      },
    },
  });
  const json = (await res.json()) as OverpassResponse;
  const pois: RawPoi[] = [];
  const seenIds = new Set<string>();
  for (const el of json.elements) {
    const p = elementToPoi(el);
    if (!p) continue;
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    pois.push(p);
  }
  console.log(`POI estratti: ${pois.length}`);
  if (pois.length < 500) {
    throw new Error(
      `Solo ${pois.length} POI: la query Overpass potrebbe essere troncata.`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({
      bbox: BBOX,
      fetchedAt: new Date().toISOString(),
      pois,
    }),
  );
  console.log(
    `Scritto ${OUT_FILE} (${(JSON.stringify(pois).length / 1024).toFixed(1)} KB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
