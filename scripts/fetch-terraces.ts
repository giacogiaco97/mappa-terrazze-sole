import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWithRetry } from './lib/http.js';
import { parseTerracesCsv } from './lib/parse-terraces.js';

const CKAN =
  'https://opendata-ajuntament.barcelona.cat/data/api/3/action/package_show?id=terrasses-comercos-vigents';
const OUT_DIR = 'data-raw';
const OUT_FILE = `${OUT_DIR}/terraces.raw.json`;

type CkanResource = { format: string; url: string; last_modified: string };

async function main(): Promise<void> {
  console.log('CKAN: lookup ultima risorsa CSV…');
  const res = await fetchWithRetry(CKAN, { retries: 3, delayMs: 2000 });
  const pkg = (await res.json()) as { result: { resources: CkanResource[] } };
  const csvs = pkg.result.resources.filter((r) => r.format === 'CSV');
  csvs.sort((a, b) => Date.parse(b.last_modified) - Date.parse(a.last_modified));
  const latest = csvs[0];
  if (!latest) throw new Error('Nessuna risorsa CSV trovata');
  console.log(`Scarico ${latest.url} (mod. ${latest.last_modified})`);

  const csvRes = await fetchWithRetry(latest.url, { retries: 3, delayMs: 5000 });
  const text = await csvRes.text();
  console.log(`CSV: ${(text.length / 1024).toFixed(1)} KB`);

  const terraces = parseTerracesCsv(text);
  console.log(`Parsate ${terraces.length} terrazze valide`);
  if (terraces.length < 1000) {
    throw new Error(
      `Solo ${terraces.length} terrazze: probabile cambio di schema. Aggiorna scripts/lib/parse-terraces.ts`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        source: latest.url,
        lastModified: latest.last_modified,
        fetchedAt: new Date().toISOString(),
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
