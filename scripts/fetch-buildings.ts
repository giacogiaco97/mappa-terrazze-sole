import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWithRetry } from './lib/http.js';
import { parseOverpassBuildings } from './lib/parse-buildings.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const BBOX = '41.32,2.07,41.47,2.23'; // Barcellona generosa
const QUERY = `
[out:json][timeout:300];
way["building"](${BBOX});
out body geom tags;
`.trim();

const OUT_DIR = 'data-raw';
const OUT_FILE = `${OUT_DIR}/buildings.raw.json`;

async function main(): Promise<void> {
  console.log('Overpass: query edifici Barcellona…');
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
