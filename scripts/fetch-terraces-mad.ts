import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWithRetry } from './lib/http.js';
import { parseTerracesMadCsv } from './lib/parse-terraces-mad.js';

const CKAN = 'https://datos.madrid.es/api/3/action/package_show?id=200085-0-censo-locales';
const RESOURCE_NAME = '200085-6-censo-locales'; // "Terrazas"
const OUT_DIR = 'data-raw';
const OUT_FILE = `${OUT_DIR}/terraces-mad.raw.json`;

type CkanResource = { name: string; format: string; url: string; modified?: string };

async function main(): Promise<void> {
  console.log('CKAN Madrid: lookup risorsa terrazze…');
  const res = await fetchWithRetry(CKAN, { retries: 3, delayMs: 2000 });
  const pkg = (await res.json()) as { result: { resources: CkanResource[] } };
  const terrazas = pkg.result.resources.find((r) => r.name === RESOURCE_NAME);
  if (!terrazas) throw new Error(`Risorsa ${RESOURCE_NAME} non trovata nel package`);
  console.log(`Scarico ${terrazas.url} (formato ${terrazas.format})`);

  const csvRes = await fetchWithRetry(terrazas.url, { retries: 3, delayMs: 5000 });
  const text = await csvRes.text();
  console.log(`CSV: ${(text.length / 1024).toFixed(1)} KB`);

  const terraces = parseTerracesMadCsv(text);
  console.log(`Parsate ${terraces.length} terrazze Madrid valide (Abierta + dentro bbox)`);
  if (terraces.length < 500) {
    throw new Error(
      `Solo ${terraces.length} terrazze Madrid: probabile cambio di schema. Aggiorna scripts/lib/parse-terraces-mad.ts`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        source: terrazas.url,
        lastModified: terrazas.modified ?? new Date().toISOString(),
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
