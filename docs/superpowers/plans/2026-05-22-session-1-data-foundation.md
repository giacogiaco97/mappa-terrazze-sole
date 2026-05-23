# Session 1 — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipeline dati che scarica le terrazze di Barcellona (Open Data) e gli edifici (OSM Overpass) e produce file statici ottimizzati in `/public/data/`, con test unitari e una GitHub Actions per il refresh mensile.

**Architecture:** Quattro script TypeScript autonomi in `/scripts/`, eseguiti con `tsx`. Ognuno è una funzione pura testabile + un thin wrapper di I/O. Output consumabile dall'app web di Session 2.

**Tech Stack:** Node.js 22 LTS, TypeScript 5, `tsx`, Vitest, GitHub Actions.

---

## Stato all'avvio della sessione
- Repo `git init` già eseguito; ramo `main`.
- Identità git **non** configurata sulla macchina — il primo `git commit` potrebbe fallire (vedi nota su Task 1).
- Spec di design completa: `docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md`.
- Nessun codice ancora scritto.

## Convenzioni di sessione
- Commit dopo ogni task. Messaggi in italiano, formato `tipo(scope): descrizione` (es. `feat(pipeline): parser CSV terrazze`).
- Nessun `any` in TypeScript.
- Tutti i test usano Vitest e stanno accanto al modulo testato in `__tests__/`.
- Esegui sempre i test prima di committare.

---

### Task 1: Bootstrap del repo

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.editorconfig`, `README.md`

- [ ] **Step 1: Crea `package.json`**

```json
{
  "name": "mappa-terrazze-sole",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "pipeline:terraces": "tsx scripts/fetch-terraces.ts",
    "pipeline:buildings": "tsx scripts/fetch-buildings.ts",
    "pipeline:heights": "tsx scripts/resolve-heights.ts",
    "pipeline:build": "tsx scripts/build-output.ts",
    "pipeline:run": "npm run pipeline:terraces && npm run pipeline:buildings && npm run pipeline:heights && npm run pipeline:build"
  }
}
```

- [ ] **Step 2: Crea `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["scripts/**/*", "src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Crea `.gitignore`**

```
node_modules/
dist/
.DS_Store
.env
.env.local
*.log
data-raw/
.cache/
.vitest-cache/
```

- [ ] **Step 4: Crea `.editorconfig`**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 5: Crea `README.md`**

```markdown
# Mappa delle terrazze al sole

Webapp mobile-first che mostra in tempo reale quali terrazze di Barcellona sono al sole.

Design completo: `docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md`.

## Pipeline dati

\`\`\`bash
npm install
npm run pipeline:run
\`\`\`

I file generati finiscono in `public/data/`.
```

(Nota: sostituisci i backtick tripli interni con quelli reali quando salvi.)

- [ ] **Step 6: Installa dev dependencies**

Run:
```bash
npm install -D typescript@^5 tsx vitest @types/node
```

Expected: `package-lock.json` + `node_modules/` creati.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .editorconfig README.md
git commit -m "chore: bootstrap progetto TypeScript con Vitest"
```

> **Se il commit fallisce per identità git mancante:** non aggiornare `git config` automaticamente (regola globale dell'utente). Avvisa l'utente: «`git config --global user.name` e `user.email` non sono impostati. Per favore impostali e poi conferma per procedere con il commit». Attendi conferma.

---

### Task 2: Setup Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/sanity.test.ts`

- [ ] **Step 1: Crea `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Crea `tests/sanity.test.ts`**

```ts
import { expect, test } from 'vitest';

test('vitest funziona', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 3: Esegui il test**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/sanity.test.ts
git commit -m "chore: configurazione Vitest"
```

---

### Task 3: Tipi condivisi

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Definisci i tipi**

```ts
// src/types/index.ts
export type Terrace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tables: number;
  chairs: number;
  surfaceSqM: number;
  neighborhood: string;
};

export type Building = {
  id: string;
  height: number;          // metri, sempre risolta
  footprint: [number, number][]; // anello chiuso, [lng, lat][]
  heightSource: 'osm' | 'levels' | 'default';
};

export type Meta = {
  city: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  generatedAt: string;     // ISO 8601
  gridStep: number;        // gradi per cella
  buildingCount: number;
  terraceCount: number;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): Terrace, Building, Meta"
```

---

### Task 4: Utility HTTP con retry esponenziale

**Files:**
- Create: `scripts/lib/http.ts`, `scripts/lib/__tests__/http.test.ts`

- [ ] **Step 1: Test**

`scripts/lib/__tests__/http.test.ts`:
```ts
import { describe, expect, test, vi } from 'vitest';
import { fetchWithRetry } from '../http.js';

describe('fetchWithRetry', () => {
  test('successo al primo tentativo', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('https://example.com');
    expect(await res.text()).toBe('ok');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('riprova al 503 e poi riesce', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('https://example.com', { retries: 2, delayMs: 1 });
    expect(await res.text()).toBe('ok');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('lancia dopo aver esaurito i retry', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('busy', { status: 503 }));
    await expect(
      fetchWithRetry('https://example.com', { retries: 1, delayMs: 1 })
    ).rejects.toThrow(/HTTP 503/);
  });

  test('non riprova su 404', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response('nope', { status: 404 }));
    await expect(
      fetchWithRetry('https://example.com', { retries: 3, delayMs: 1 })
    ).rejects.toThrow(/HTTP 404/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- scripts/lib/__tests__/http.test.ts`
Expected: FAIL, modulo non trovato.

- [ ] **Step 3: Implementa**

`scripts/lib/http.ts`:
```ts
export type FetchOptions = {
  retries?: number;
  delayMs?: number;
  init?: RequestInit;
};

export async function fetchWithRetry(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.delayMs ?? 1000;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, opts.init);
      if (res.ok) return res;

      const retriable = res.status >= 500 || res.status === 429;
      if (!retriable) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (err) {
      if (!isRetriable(err)) throw err;
      lastErr = err;
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }
  throw lastErr ?? new Error('fetchWithRetry: tentativi esauriti');
}

function isRetriable(err: unknown): boolean {
  if (err instanceof Error && /HTTP (5|429)/.test(err.message)) return true;
  return err instanceof TypeError; // network errors
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- scripts/lib/__tests__/http.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/http.ts scripts/lib/__tests__/http.test.ts
git commit -m "feat(http): fetchWithRetry con backoff esponenziale"
```

---

### Task 5: Discovery — schema effettivo del CSV terrazze BCN

Il dataset BCN può cambiare i nomi delle colonne fra semestri. Questo task verifica le colonne reali **prima** di scrivere il parser.

- [ ] **Step 1: Trova l'URL più recente via CKAN**

Run:
```bash
curl -s "https://opendata-ajuntament.barcelona.cat/data/api/3/action/package_show?id=terrasses-comercos-vigents" \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d); const csvs=j.result.resources.filter(r=>r.format==='CSV'); csvs.sort((a,b)=>new Date(b.last_modified)-new Date(a.last_modified)); console.log(csvs[0].url); console.log('last_modified:', csvs[0].last_modified);});"
```

Expected: stampa un URL `.csv` + data dell'ultima modifica.

- [ ] **Step 2: Ispeziona l'header**

Sostituisci `<URL>` con quello dello Step 1.

Run:
```bash
curl -s "<URL>" | head -2
```

Expected: prima riga = nomi delle colonne (separatore probabilmente `,` o `;`).

- [ ] **Step 3: Annota le colonne in un commento**

Apri (o crea) `scripts/lib/csv-schema.md` e incolla l'header letterale + una mappatura proposta:

```markdown
# Schema CSV terrazze BCN (verificato YYYY-MM-DD)

Separatore: `,` (o `;`, verifica!).

Header letterale:
```
<incolla qui le colonne reali>
```

Mappatura → tipo `Terrace`:
- `<colonna_lat>` → `lat` (parseFloat, gestire la virgola decimale)
- `<colonna_lng>` → `lng`
- `<colonna_nome>` → `name`
- `<colonna_indirizzo>` → `address`
- `<colonna_quartiere>` → `neighborhood`
- `<colonne_tavoli_vorera + calçada>` → `tables` (somma)
- `<colonne_sedie_vorera + calçada>` → `chairs` (somma)
- `<colonna_superficie>` → `surfaceSqM`
- `<colonna_id>` (o riga indice) → `id`
```

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/csv-schema.md
git commit -m "docs(pipeline): schema CSV terrazze verificato"
```

---

### Task 6: Parser CSV terrazze

**Files:**
- Create: `scripts/lib/parse-terraces.ts`, `scripts/lib/__tests__/parse-terraces.test.ts`

> Adatta i nomi di colonna nel parser allo schema verificato nel Task 5.

- [ ] **Step 1: Test**

`scripts/lib/__tests__/parse-terraces.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { parseTerracesCsv } from '../parse-terraces.js';

// Sostituisci le colonne sotto con quelle reali del CSV (Task 5).
const SAMPLE_CSV = `LONGITUD,LATITUD,NOM_LOCAL,ADRECA,BARRI,TAULES_VORERA,TAULES_CALCADA,CADIRES_VORERA,CADIRES_CALCADA,SUPERFICIE,ID
2.16234,41.38765,Bar Test,Carrer Gran 12,Eixample,3,1,12,4,8.5,T001
2.17000,41.39000,Cafè Demo,Plaça Major 1,Gòtic,2,0,8,0,4.2,T002`;

describe('parseTerracesCsv', () => {
  test('parsa due record validi', () => {
    const out = parseTerracesCsv(SAMPLE_CSV);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: 'T001',
      name: 'Bar Test',
      address: 'Carrer Gran 12',
      lat: 41.38765,
      lng: 2.16234,
      tables: 4,
      chairs: 16,
      surfaceSqM: 8.5,
      neighborhood: 'Eixample',
    });
  });

  test('scarta righe con coordinate non valide', () => {
    const csv = `LONGITUD,LATITUD,NOM_LOCAL,ADRECA,BARRI,TAULES_VORERA,TAULES_CALCADA,CADIRES_VORERA,CADIRES_CALCADA,SUPERFICIE,ID
ABC,41.38,Bar Bad,,Eixample,1,0,2,0,1,T003`;
    expect(parseTerracesCsv(csv)).toHaveLength(0);
  });

  test('gestisce virgola decimale in stile europeo', () => {
    const csv = `LONGITUD,LATITUD,NOM_LOCAL,ADRECA,BARRI,TAULES_VORERA,TAULES_CALCADA,CADIRES_VORERA,CADIRES_CALCADA,SUPERFICIE,ID
"2,16234","41,38765",Bar Eu,Carrer X,Eixample,1,0,2,0,1,T004`;
    const out = parseTerracesCsv(csv);
    expect(out[0]?.lat).toBeCloseTo(41.38765, 4);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- scripts/lib/__tests__/parse-terraces.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa**

`scripts/lib/parse-terraces.ts`:
```ts
import type { Terrace } from '../../src/types/index.js';

const COLS = {
  lng: 'LONGITUD',
  lat: 'LATITUD',
  name: 'NOM_LOCAL',
  address: 'ADRECA',
  neighborhood: 'BARRI',
  tablesA: 'TAULES_VORERA',
  tablesB: 'TAULES_CALCADA',
  chairsA: 'CADIRES_VORERA',
  chairsB: 'CADIRES_CALCADA',
  surface: 'SUPERFICIE',
  id: 'ID',
} as const;

export function parseTerracesCsv(text: string): Terrace[] {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return [];
  const sep = detectSeparator(lines[0]!);
  const header = parseCsvRow(lines[0]!, sep);
  const idx = Object.fromEntries(
    Object.entries(COLS).map(([k, v]) => [k, header.indexOf(v)]),
  ) as Record<keyof typeof COLS, number>;

  const out: Terrace[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]!, sep);
    const lat = num(cells[idx.lat]);
    const lng = num(cells[idx.lng]);
    if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) continue;
    out.push({
      id: cells[idx.id] ?? `row-${i}`,
      name: cells[idx.name] ?? '',
      address: cells[idx.address] ?? '',
      lat,
      lng,
      tables: (num(cells[idx.tablesA]) || 0) + (num(cells[idx.tablesB]) || 0),
      chairs: (num(cells[idx.chairsA]) || 0) + (num(cells[idx.chairsB]) || 0),
      surfaceSqM: num(cells[idx.surface]) || 0,
      neighborhood: cells[idx.neighborhood] ?? '',
    });
  }
  return out;
}

function detectSeparator(headerLine: string): string {
  return headerLine.includes(';') && !headerLine.includes(',')
    ? ';'
    : ',';
}

function splitCsvLines(text: string): string[] {
  // Gestisce \r\n e righe vuote.
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

function parseCsvRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(s: string | undefined): number {
  if (s == null || s === '') return NaN;
  // Accetta virgola decimale: "41,38" → 41.38
  const cleaned = s.replace(',', '.').replace(/[^0-9.\-eE]/g, '');
  return parseFloat(cleaned);
}
```

> Se i nomi di colonna reali (Task 5) differiscono, aggiorna l'oggetto `COLS`.

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- scripts/lib/__tests__/parse-terraces.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/parse-terraces.ts scripts/lib/__tests__/parse-terraces.test.ts
git commit -m "feat(pipeline): parser CSV terrazze BCN"
```

---

### Task 7: Script `fetch-terraces`

**Files:**
- Create: `scripts/fetch-terraces.ts`

- [ ] **Step 1: Implementa**

`scripts/fetch-terraces.ts`:
```ts
import { writeFile, mkdir } from 'node:fs/promises';
import { fetchWithRetry } from './lib/http.js';
import { parseTerracesCsv } from './lib/parse-terraces.js';

const CKAN = 'https://opendata-ajuntament.barcelona.cat/data/api/3/action/package_show?id=terrasses-comercos-vigents';
const OUT_DIR = 'data-raw';
const OUT_FILE = `${OUT_DIR}/terraces.raw.json`;

type CkanResource = { format: string; url: string; last_modified: string };

async function main() {
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
    throw new Error(`Solo ${terraces.length} terrazze: probabile cambio di schema. Aggiorna scripts/lib/parse-terraces.ts`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify({
    source: latest.url,
    lastModified: latest.last_modified,
    fetchedAt: new Date().toISOString(),
    terraces,
  }, null, 2));
  console.log(`Scritto ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Esegui smoke**

Run: `npm run pipeline:terraces`
Expected: stampa la URL, scarica, riporta ~6000+ terrazze, scrive `data-raw/terraces.raw.json`. Se < 1000 → adatta i nomi di colonna (Task 5/6).

- [ ] **Step 3: Verifica visiva**

Run: `node -e "const d=require('./data-raw/terraces.raw.json'); console.log(d.terraces.slice(0,3));"`
Expected: 3 oggetti che assomigliano a `Terrace`.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-terraces.ts
git commit -m "feat(pipeline): script fetch-terraces (CKAN + parser)"
```

---

### Task 8: Parser Overpass per edifici

**Files:**
- Create: `scripts/lib/parse-buildings.ts`, `scripts/lib/__tests__/parse-buildings.test.ts`

- [ ] **Step 1: Test**

`scripts/lib/__tests__/parse-buildings.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { parseOverpassBuildings } from '../parse-buildings.js';

const SAMPLE = {
  elements: [
    {
      type: 'way',
      id: 111,
      tags: { building: 'yes', height: '15.5' },
      geometry: [
        { lat: 41.38, lon: 2.16 },
        { lat: 41.38, lon: 2.161 },
        { lat: 41.381, lon: 2.161 },
        { lat: 41.381, lon: 2.16 },
        { lat: 41.38, lon: 2.16 },
      ],
    },
    {
      type: 'way',
      id: 222,
      tags: { building: 'residential', 'building:levels': '4' },
      geometry: [
        { lat: 41.39, lon: 2.17 },
        { lat: 41.39, lon: 2.171 },
        { lat: 41.391, lon: 2.171 },
        { lat: 41.391, lon: 2.17 },
        { lat: 41.39, lon: 2.17 },
      ],
    },
    { type: 'way', id: 333, tags: { building: 'yes' } }, // niente geometria, da scartare
  ],
};

describe('parseOverpassBuildings', () => {
  test('estrae footprint + tag', () => {
    const out = parseOverpassBuildings(SAMPLE);
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe('w111');
    expect(out[0]?.tags.height).toBe('15.5');
    expect(out[0]?.footprint[0]).toEqual([2.16, 41.38]);
  });

  test('scarta edifici senza geometria', () => {
    const out = parseOverpassBuildings(SAMPLE);
    expect(out.find((b) => b.id === 'w333')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- scripts/lib/__tests__/parse-buildings.test.ts`

- [ ] **Step 3: Implementa**

`scripts/lib/parse-buildings.ts`:
```ts
export type RawBuilding = {
  id: string;
  tags: Record<string, string>;
  footprint: [number, number][]; // [lng, lat][]
};

type Element = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

export function parseOverpassBuildings(json: { elements: Element[] }): RawBuilding[] {
  const out: RawBuilding[] = [];
  for (const el of json.elements) {
    if (el.type !== 'way') continue;
    if (!el.geometry || el.geometry.length < 3) continue;
    out.push({
      id: `w${el.id}`,
      tags: el.tags ?? {},
      footprint: el.geometry.map((p) => [p.lon, p.lat]),
    });
  }
  return out;
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- scripts/lib/__tests__/parse-buildings.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/parse-buildings.ts scripts/lib/__tests__/parse-buildings.test.ts
git commit -m "feat(pipeline): parser Overpass edifici"
```

---

### Task 9: Script `fetch-buildings`

**Files:**
- Create: `scripts/fetch-buildings.ts`

- [ ] **Step 1: Implementa**

`scripts/fetch-buildings.ts`:
```ts
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

async function main() {
  console.log('Overpass: query edifici Barcellona…');
  const res = await fetchWithRetry(OVERPASS, {
    retries: 3,
    delayMs: 30_000,
    init: {
      method: 'POST',
      body: `data=${encodeURIComponent(QUERY)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  });
  const json = await res.json();
  const buildings = parseOverpassBuildings(json);
  console.log(`Edifici estratti: ${buildings.length}`);
  if (buildings.length < 10_000) {
    throw new Error(`Solo ${buildings.length} edifici: query potrebbe essere troncata, controlla.`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify({
    bbox: BBOX,
    fetchedAt: new Date().toISOString(),
    buildings,
  }));
  console.log(`Scritto ${OUT_FILE} (${(JSON.stringify(buildings).length / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Esegui smoke**

Run: `npm run pipeline:buildings`
Expected: tipicamente 60k–120k edifici. Può richiedere 30–120 s. Se Overpass è in rate-limit, attendi e riprova (lo script fa retry esponenziale).

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-buildings.ts
git commit -m "feat(pipeline): script fetch-buildings (Overpass)"
```

---

### Task 10: Risolutore altezza singolo edificio

**Files:**
- Create: `scripts/lib/resolve-height.ts`, `scripts/lib/__tests__/resolve-height.test.ts`

- [ ] **Step 1: Test**

`scripts/lib/__tests__/resolve-height.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { resolveHeight } from '../resolve-height.js';

describe('resolveHeight', () => {
  test('usa il tag height se valido', () => {
    expect(resolveHeight({ height: '18.5' })).toEqual({ height: 18.5, source: 'osm' });
  });

  test('parsa "18 m" come 18', () => {
    expect(resolveHeight({ height: '18 m' })).toEqual({ height: 18, source: 'osm' });
  });

  test('usa building:levels × 3 in fallback', () => {
    expect(resolveHeight({ 'building:levels': '5' })).toEqual({ height: 15, source: 'levels' });
  });

  test('default 12 m se nulla è disponibile', () => {
    expect(resolveHeight({})).toEqual({ height: 12, source: 'default' });
  });

  test('preferisce height su levels', () => {
    expect(resolveHeight({ height: '20', 'building:levels': '8' }))
      .toEqual({ height: 20, source: 'osm' });
  });

  test('ignora height non numerico e cade su levels', () => {
    expect(resolveHeight({ height: 'alto', 'building:levels': '3' }))
      .toEqual({ height: 9, source: 'levels' });
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- scripts/lib/__tests__/resolve-height.test.ts`

- [ ] **Step 3: Implementa**

`scripts/lib/resolve-height.ts`:
```ts
export type HeightResult = {
  height: number;
  source: 'osm' | 'levels' | 'default';
};

const METERS_PER_LEVEL = 3;
const DEFAULT_HEIGHT = 12;

export function resolveHeight(tags: Record<string, string>): HeightResult {
  const h = parseMeters(tags.height);
  if (h != null) return { height: h, source: 'osm' };

  const lv = parseInt(tags['building:levels'] ?? '', 10);
  if (Number.isFinite(lv) && lv > 0) {
    return { height: lv * METERS_PER_LEVEL, source: 'levels' };
  }

  return { height: DEFAULT_HEIGHT, source: 'default' };
}

function parseMeters(s: string | undefined): number | null {
  if (!s) return null;
  // Accetta "18", "18.5", "18 m", "18,5 m"
  const match = s.replace(',', '.').match(/^([0-9]+(?:\.[0-9]+)?)\s*(m|meter|meters)?$/i);
  if (!match) return null;
  const n = parseFloat(match[1]!);
  return Number.isFinite(n) && n > 0 ? n : null;
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- scripts/lib/__tests__/resolve-height.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/resolve-height.ts scripts/lib/__tests__/resolve-height.test.ts
git commit -m "feat(pipeline): resolveHeight (OSM height/levels/default)"
```

---

### Task 11: Script `resolve-heights`

**Files:**
- Create: `scripts/resolve-heights.ts`

- [ ] **Step 1: Implementa**

`scripts/resolve-heights.ts`:
```ts
import { readFile, writeFile } from 'node:fs/promises';
import { resolveHeight } from './lib/resolve-height.js';
import type { Building } from '../src/types/index.js';
import type { RawBuilding } from './lib/parse-buildings.js';

const IN_FILE = 'data-raw/buildings.raw.json';
const OUT_FILE = 'data-raw/buildings.resolved.json';

async function main() {
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
  console.log(`Altezze risolte — osm: ${stats.osm}, levels: ${stats.levels}, default: ${stats.default}`);

  await writeFile(OUT_FILE, JSON.stringify({ buildings: resolved }));
  console.log(`Scritto ${OUT_FILE}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Esegui smoke**

Run: `npm run pipeline:heights`
Expected: stampa le statistiche (es. "osm: 6k, levels: 70k, default: 30k") e scrive `buildings.resolved.json`.

- [ ] **Step 3: Commit**

```bash
git add scripts/resolve-heights.ts
git commit -m "feat(pipeline): script resolve-heights"
```

---

### Task 12: Chunker spaziale a griglia

**Files:**
- Create: `scripts/lib/chunk-by-grid.ts`, `scripts/lib/__tests__/chunk-by-grid.test.ts`

- [ ] **Step 1: Test**

`scripts/lib/__tests__/chunk-by-grid.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { chunkByGrid, cellKey } from '../chunk-by-grid.js';

describe('cellKey', () => {
  test('coordinate negative + step 1 = (-1,-1) per (-0.5,-0.5)', () => {
    expect(cellKey(-0.5, -0.5, 1)).toBe('-1_-1');
  });
  test('origine cade in 0_0', () => {
    expect(cellKey(0.1, 0.1, 1)).toBe('0_0');
  });
});

describe('chunkByGrid', () => {
  test('raggruppa features per cella usando il centroide del primo punto', () => {
    const features = [
      { id: 'a', footprint: [[2.16, 41.38]] as [number, number][] },
      { id: 'b', footprint: [[2.17, 41.39]] as [number, number][] },
      { id: 'c', footprint: [[2.165, 41.385]] as [number, number][] },
    ];
    const out = chunkByGrid(features, 0.01);
    // a e c potrebbero finire nella stessa cella, b in un'altra
    const total = Object.values(out).reduce((s, v) => s + v.length, 0);
    expect(total).toBe(3);
    expect(Object.keys(out).length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- scripts/lib/__tests__/chunk-by-grid.test.ts`

- [ ] **Step 3: Implementa**

`scripts/lib/chunk-by-grid.ts`:
```ts
export function cellKey(lng: number, lat: number, step: number): string {
  const x = Math.floor(lng / step);
  const y = Math.floor(lat / step);
  return `${x}_${y}`;
}

export type ChunkableFeature = {
  id: string;
  footprint: [number, number][];
};

export function chunkByGrid<T extends ChunkableFeature>(
  features: T[],
  step: number,
): Record<string, T[]> {
  const buckets: Record<string, T[]> = {};
  for (const f of features) {
    const first = f.footprint[0];
    if (!first) continue;
    const [lng, lat] = first;
    const key = cellKey(lng, lat, step);
    (buckets[key] ??= []).push(f);
  }
  return buckets;
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- scripts/lib/__tests__/chunk-by-grid.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/chunk-by-grid.ts scripts/lib/__tests__/chunk-by-grid.test.ts
git commit -m "feat(pipeline): chunkByGrid per partizionamento spaziale"
```

---

### Task 13: Script `build-output`

**Files:**
- Create: `scripts/build-output.ts`

- [ ] **Step 1: Implementa**

`scripts/build-output.ts`:
```ts
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { chunkByGrid } from './lib/chunk-by-grid.js';
import type { Building, Meta, Terrace } from '../src/types/index.js';

const TERRACES_IN = 'data-raw/terraces.raw.json';
const BUILDINGS_IN = 'data-raw/buildings.resolved.json';
const OUT_DIR = 'public/data';
const BUILDINGS_DIR = `${OUT_DIR}/buildings`;
const GRID_STEP = 0.01; // ~1 km

const BCN_BBOX: [number, number, number, number] = [2.07, 41.32, 2.23, 41.47];
const CITY = 'Barcelona';

function truncCoords<T extends [number, number][]>(coords: T): T {
  return coords.map(([lng, lat]) =>
    [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6] as [number, number],
  ) as T;
}

async function main() {
  // Terrazze
  const tRaw = JSON.parse(await readFile(TERRACES_IN, 'utf-8')) as { terraces: Terrace[] };
  const terraces = tRaw.terraces.map((t) => ({
    ...t,
    lat: Math.round(t.lat * 1e6) / 1e6,
    lng: Math.round(t.lng * 1e6) / 1e6,
  }));

  // Edifici
  const bRaw = JSON.parse(await readFile(BUILDINGS_IN, 'utf-8')) as { buildings: Building[] };
  const buildings = bRaw.buildings.map((b) => ({ ...b, footprint: truncCoords(b.footprint) }));

  // Pulisce e ricrea l'output
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(BUILDINGS_DIR, { recursive: true });

  // Scrive terraces.json
  await writeFile(`${OUT_DIR}/terraces.json`, JSON.stringify(terraces));

  // Suddivide edifici in griglia
  const chunks = chunkByGrid(buildings, GRID_STEP);
  for (const [key, list] of Object.entries(chunks)) {
    await writeFile(`${BUILDINGS_DIR}/${key}.json`, JSON.stringify(list));
  }

  const meta: Meta = {
    city: CITY,
    bbox: BCN_BBOX,
    generatedAt: new Date().toISOString(),
    gridStep: GRID_STEP,
    buildingCount: buildings.length,
    terraceCount: terraces.length,
  };
  await writeFile(`${OUT_DIR}/meta.json`, JSON.stringify(meta, null, 2));

  console.log(`Output scritto in ${OUT_DIR}: ${terraces.length} terrazze, ${buildings.length} edifici in ${Object.keys(chunks).length} celle.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Esegui**

Run: `npm run pipeline:build`
Expected: stampa contatori; verifica che `public/data/terraces.json` esista e che `public/data/buildings/` contenga molti file `.json`.

- [ ] **Step 3: Verifica dimensioni**

Run:
```bash
ls -lh public/data/terraces.json public/data/meta.json
ls public/data/buildings | wc -l
```

Expected: `terraces.json` qualche MB, `meta.json` < 1 KB, decine/centinaia di chunk edifici.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-output.ts
git commit -m "feat(pipeline): build-output (terraces + buildings chunked + meta)"
```

---

### Task 14: Pipeline end-to-end + check committenza output

**Files:**
- Modify: `.gitignore` (rimuovere se necessario per consentire commit di `public/data/`)

- [ ] **Step 1: Pulisci e riesegui tutto**

Run:
```bash
rm -rf data-raw public/data
npm run pipeline:run
```

Expected: il pipeline gira fino in fondo senza errori. Tempo: ~1–3 minuti totali.

- [ ] **Step 2: Conferma che `public/data/` non sia ignorato**

Apri `.gitignore` e assicurati che NON ci sia `public/data/` né `public/`. (Era stato ignorato `data-raw/` invece, che è corretto.)

- [ ] **Step 3: Aggiungi `public/data/` al repo**

Run:
```bash
git add public/data
git status
```

Expected: vedi `terraces.json`, `meta.json` e molti `buildings/*.json` come nuovi file.

- [ ] **Step 4: Commit dei dati**

```bash
git commit -m "data: dataset iniziale Barcellona generato dalla pipeline"
```

---

### Task 15: GitHub Actions workflow per refresh dati

**Files:**
- Create: `.github/workflows/data-pipeline.yml`

- [ ] **Step 1: Crea il workflow**

```yaml
name: Data Pipeline

on:
  schedule:
    - cron: '0 4 1 * *'   # primo del mese, 04:00 UTC
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Run pipeline
        run: npm run pipeline:run

      - name: Commit data updates
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/data
          if git diff --cached --quiet; then
            echo "Nessuna variazione nei dati."
          else
            git commit -m "data: refresh automatico pipeline ($(date -u +%Y-%m-%d))"
            git push
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/data-pipeline.yml
git commit -m "ci: workflow refresh mensile dati"
```

---

### Task 16: README — sezione pipeline

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Aggiungi sezione**

Aggiungi in fondo a `README.md`:

```markdown
## Architettura della pipeline

La pipeline gira via GitHub Actions il primo del mese (cron) oppure on-demand (`workflow_dispatch`).

Step:
1. `npm run pipeline:terraces` — CKAN → CSV → JSON terrazze
2. `npm run pipeline:buildings` — Overpass → JSON edifici
3. `npm run pipeline:heights` — risolve altezze (OSM `height` / `building:levels × 3` / default 12 m)
4. `npm run pipeline:build` — produce `public/data/terraces.json`, `public/data/buildings/{x}_{y}.json`, `public/data/meta.json`

Fonti:
- **Open Data Barcelona** — `terrasses-comercos-vigents` (CC-BY-4.0)
- **OpenStreetMap** — via Overpass API (ODbL — attribuzione obbligatoria)

Test:
\`\`\`bash
npm test
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: sezione pipeline nel README"
```

---

### Task FINAL: Aggiornamento graphiti + prompt per Session 2

> Questo task NON è opzionale. Senza di esso la sessione successiva non saprà cosa è stato fatto.

- [ ] **Step 1: Verifica finale**

Run:
```bash
npm test
ls public/data
```

Expected: tutti i test passano (decine di test), `terraces.json` + `meta.json` + decine di chunk in `buildings/` presenti.

- [ ] **Step 2: Aggiorna graphiti**

Chiama `mcp__graphiti-memory__add_memory` con:
- `group_id`: `"mappa-delle-terrazze-al-sole"`
- `name`: `"Session 1 completata - Data Foundation"`
- `source`: `"text"`
- `episode_body`: includi (in italiano):
  - Cosa è stato consegnato (pipeline + CI + test + dataset iniziale committato)
  - I path principali: `scripts/`, `src/types/`, `public/data/`, `.github/workflows/data-pipeline.yml`
  - Numeri reali della pipeline (n. terrazze, n. edifici, % osm/levels/default)
  - Decisioni o gotcha emersi (es. se il CSV ha colonne diverse dal previsto)
  - Stato git: commit hash dell'ultimo commit (`git log -1 --format=%H`), branch `main`
  - Next: Session 2 — costruire la PWA che consumi `public/data/`

- [ ] **Step 3: Genera il prompt per Session 2**

Crea il file `docs/superpowers/plans/START-SESSION-2.md` con questo contenuto (sostituisci i marcatori `<…>` con i valori reali):

```markdown
# Prompt iniziale — Session 2

> Copia-incolla tutto il blocco qui sotto nella nuova sessione Claude.

---

\`\`\`
Sei in una nuova sessione di Claude per il progetto "Mappa delle terrazze al sole".

CARTELLA: C:\Users\masch\Desktop\Software Builds\Mappa delle terrazze al sole
GROUP_ID graphiti: mappa-delle-terrazze-al-sole

PRIMA DI INIZIARE:
1. Le regole globali in ~/.claude/CLAUDE.md sono auto-caricate.
2. Esegui search_memory_facts e search_nodes su graphiti con group_id="mappa-delle-terrazze-al-sole" — troverai un episodio "Session 1 completata" con tutto il contesto.
3. Leggi nell'ordine:
   - docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md
   - docs/superpowers/plans/2026-05-22-session-2-pwa-core.md (il tuo piano per oggi)
4. Verifica lo stato del repo: ultimo commit Session 1 = <COMMIT_HASH>. Su branch main.

STATO PIPELINE DATI (output di Session 1):
- public/data/terraces.json: <N_TERRAZZE> terrazze
- public/data/buildings/: <N_CELLE> chunk con <N_EDIFICI> edifici totali
- public/data/meta.json: bbox + gridStep (0.01°)

POI:
- Usa la skill superpowers:executing-plans per il Session 2 plan.
- Committa dopo ogni task. Messaggi in italiano "tipo(scope): descrizione".
- TDD per ogni funzione pura (sun, geometry, shadow-engine).
- Se trovi inconsistenze nello spec o nel plan, FERMATI e segnalalo.
- Non saltare il Task FINAL (graphiti + generazione di START-SESSION-3.md).

OBIETTIVO: PWA installabile che mostri la mappa di Barcellona, geolocalizzi l'utente, calcoli sole/ombra per ogni terrazza e la colori sulla mappa. NIENTE bottom sheet, slider o card — quelli stanno in Session 3.

Procedi.
\`\`\`
```

- [ ] **Step 4: Commit finale di sessione**

```bash
git add docs/superpowers/plans/START-SESSION-2.md
git commit -m "docs(plans): handoff per Session 2"
```

- [ ] **Step 5: Avvisa l'utente**

Stampa in chat:
> Session 1 completata. Tutti i test passano e i dati sono in `public/data/`. Ho aggiornato graphiti e scritto il prompt per la Session 2 in `docs/superpowers/plans/START-SESSION-2.md`. Apri una nuova sessione Claude e incolla il contenuto di quel file per proseguire.

---

## Auto-review finale (eseguila prima del Task FINAL)

Prima di chiudere la sessione, controlla:
- [ ] `npm test` → tutti i test passano
- [ ] `npm run pipeline:run` → gira fino in fondo senza errori
- [ ] `public/data/terraces.json` esiste e contiene > 5000 record
- [ ] `public/data/buildings/` contiene > 10 file chunk
- [ ] `git status` → working tree pulito
- [ ] Nessun `any`, nessun `TODO`, nessun `console.log` di debug residuo (i `console.log` informativi negli script vanno bene)
