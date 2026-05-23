import { readFile, writeFile } from 'node:fs/promises';
import { resolveHeight } from './lib/resolve-height.js';
import type { Building } from '../src/types/index.js';
import type { RawBuilding } from './lib/parse-buildings.js';

const IN_FILE = 'data-raw/buildings.raw.json';
const OUT_FILE = 'data-raw/buildings.resolved.json';

async function main(): Promise<void> {
  const raw = JSON.parse(await readFile(IN_FILE, 'utf-8')) as { buildings: RawBuilding[] };
  const stats = { osm: 0, levels: 0, default: 0 };
  const resolved: Building[] = raw.buildings.map((b) => {
    const r = resolveHeight(b.tags);
    stats[r.source]++;
    return {
      id: b.id,
      height: r.height,
      footprint: b.footprint,
      heightSource: r.source,
    };
  });
  console.log(
    `Altezze risolte — osm: ${stats.osm}, levels: ${stats.levels}, default: ${stats.default}`,
  );

  await writeFile(OUT_FILE, JSON.stringify({ buildings: resolved }));
  console.log(`Scritto ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
