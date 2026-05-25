import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWithRetry } from './lib/http.js';
import { parseOverpassBuildings } from './lib/parse-buildings.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

// Bbox per città. Selezionato via env var CITY=bcn|mad (default: bcn).
const CITY_BBOX: Record<string, { bbox: string; label: string }> = {
  bcn: { bbox: '41.32,2.07,41.47,2.23', label: 'Barcellona' },
  mad: { bbox: '40.36,-3.80,40.52,-3.55', label: 'Madrid (centro + barrios principali)' },
};

const CITY = (process.env.CITY ?? 'bcn').toLowerCase();
const cityConf = CITY_BBOX[CITY];
if (!cityConf) {
  throw new Error(`CITY ignota: '${CITY}'. Valori validi: ${Object.keys(CITY_BBOX).join(', ')}`);
}
const BBOX = cityConf.bbox;
const QUERY = `
[out:json][timeout:300];
way["building"](${BBOX});
out body geom tags;
`.trim();

const OUT_DIR = 'data-raw';
const OUT_FILE = `${OUT_DIR}/buildings-${CITY}.raw.json`;

async function main(): Promise<void> {
  console.log(`Overpass: query edifici ${cityConf.label}…`);
  const url = `${OVERPASS}?data=${encodeURIComponent(QUERY)}`;
  const res = await fetchWithRetry(url, {
    retries: 3,
    delayMs: 30_000,
    init: {
      method: 'GET',
      headers: {
        'User-Agent': 'mappa-terrazze-sole-pipeline/1.0 (https://github.com/mascherin2797g/mappa-terrazze-sole)',
        Accept: 'application/json',
      },
    },
  });
  const json = (await res.json()) as Parameters<typeof parseOverpassBuildings>[0];
  const buildings = parseOverpassBuildings(json);
  console.log(`Edifici estratti: ${buildings.length}`);
  if (buildings.length < 10_000) {
    throw new Error(
      `Solo ${buildings.length} edifici: query potrebbe essere troncata, controlla.`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({
      bbox: BBOX,
      fetchedAt: new Date().toISOString(),
      buildings,
    }),
  );
  console.log(
    `Scritto ${OUT_FILE} (${(JSON.stringify(buildings).length / 1024 / 1024).toFixed(1)} MB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
