# Session 2 — PWA Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App React installabile (PWA) che carica i dati prodotti in Session 1, mostra la mappa MapLibre di Barcellona, geolocalizza l'utente, e per ogni terrazza visibile calcola lo stato sole/ombra al momento "adesso" e la colora sul marker. Niente bottom sheet, slider o card (Session 3).

**Architecture:** Vite + React + TypeScript. Tutto client-side. Componenti React per il map shell; logica pura in `src/lib/` (suncalc wrapper, helper geometrici, shadow-engine, building index RBush, data loader). Stato condiviso in Zustand. PWA via `vite-plugin-pwa`.

**Tech Stack:** Vite 5+, React 18, TypeScript 5, MapLibre GL JS 4+, suncalc 1.x, RBush 4.x, Zustand 5.x, vite-plugin-pwa, Vitest.

---

## Stato all'avvio della sessione

- Session 1 completata: pipeline + dati in `public/data/` + GitHub Actions + test unitari pipeline (vedi episodio graphiti "Session 1 completata").
- Struttura attuale: `scripts/`, `src/types/`, `public/data/`, `tests/`, `.github/workflows/data-pipeline.yml`, `package.json`, `tsconfig.json`, `vitest.config.ts`.
- Niente codice React, niente Vite, niente componenti UI ancora.

## Convenzioni di sessione
- Commit dopo ogni task, messaggi `tipo(scope): descrizione` in italiano.
- Componenti React in `src/components/`, logica pura in `src/lib/`, store in `src/store/`, stili in `src/styles/`.
- Per le funzioni pure (sun, geometry, shadow-engine, building-index): TDD obbligatorio.
- Per i componenti React: verifica visiva (browser dev server) + test minimi solo dove cambia comportamento non banale.
- Nessun `any`. Nessun `// @ts-ignore`.

---

### Task 1: Vite + React + TypeScript scaffold

**Files:**
- Modify: `package.json`
- Create: `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles/global.css`

- [ ] **Step 1: Installa dipendenze runtime e dev**

Run:
```bash
npm install react react-dom maplibre-gl suncalc rbush zustand
npm install -D @vitejs/plugin-react vite vite-plugin-pwa @types/react @types/react-dom @types/suncalc
```

- [ ] **Step 2: Aggiorna `package.json` scripts**

Aggiungi:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Mantieni gli script `pipeline:*` e `test*` esistenti.

- [ ] **Step 3: `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#f5a623" />
    <title>Mappa delle terrazze al sole</title>
    <link rel="manifest" href="/manifest.webmanifest" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './', // pronto per GitHub Pages sotto /repo/
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Mappa delle terrazze al sole',
        short_name: 'Terrazze al sole',
        description: 'Quali terrazze sono al sole adesso a Barcellona',
        lang: 'es',
        theme_color: '#f5a623',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'app-data' },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('openfreemap.org'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tiles', expiration: { maxEntries: 500 } },
          },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 5: `src/main.tsx` e `src/App.tsx`**

`src/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App.js';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

`src/App.tsx`:
```tsx
export default function App() {
  return <div className="app-root">Mappa delle terrazze al sole — Session 2 in costruzione</div>;
}
```

- [ ] **Step 6: `src/styles/global.css`**

```css
html, body, #root, .app-root {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  background: #fafafa;
}
* { box-sizing: border-box; }
```

- [ ] **Step 7: Placeholder icone PWA**

Crea `public/icons/` con due file PNG placeholder 192×192 e 512×512 (anche giallo pieno va bene; saranno sostituiti in Session 3).

Run (esempio rapido — un colore pieno):
```bash
mkdir -p public/icons
# Sostituisci con icone reali in Session 3.
# Per ora un placeholder qualsiasi va bene (anche un png trasparente da qualche tool).
```

Se hai ImageMagick/`convert`: `convert -size 192x192 xc:#f5a623 public/icons/icon-192.png` (analogo per 512). Se no, scarica un placeholder qualsiasi.

- [ ] **Step 8: Smoke test dev server**

Run: `npm run dev`
Expected: server su `http://localhost:5173`, apri nel browser, vedi il testo placeholder.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts src/main.tsx src/App.tsx src/styles/global.css public/icons
git commit -m "feat: scaffold Vite + React + PWA"
```

---

### Task 2: MapLibre + basemap OpenFreeMap

**Files:**
- Create: `src/components/MapView.tsx`, `src/styles/map.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: `MapView.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/map.css';

const BCN_CENTER: [number, number] = [2.165, 41.39];
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

type Props = {
  onMapReady?: (map: MLMap) => void;
};

export default function MapView({ onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: BCN_CENTER,
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => onMapReady?.(map));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [onMapReady]);

  return <div className="map-container" ref={containerRef} />;
}
```

- [ ] **Step 2: `map.css`**

```css
.map-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 3: Aggiorna `App.tsx`**

```tsx
import MapView from './components/MapView.js';

export default function App() {
  return (
    <div className="app-root">
      <MapView />
    </div>
  );
}
```

- [ ] **Step 4: Smoke test**

Run: `npm run dev`
Expected: mappa di Barcellona renderizza, pan/zoom funzionano. Attribuzione MapLibre/OpenFreeMap visibile.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapView.tsx src/styles/map.css src/App.tsx
git commit -m "feat(map): MapLibre + basemap OpenFreeMap"
```

---

### Task 3: Hook di geolocalizzazione

**Files:**
- Create: `src/lib/use-geolocation.ts`, `src/lib/__tests__/use-geolocation.test.ts`

- [ ] **Step 1: Implementa hook**

`src/lib/use-geolocation.ts`:
```ts
import { useEffect, useState } from 'react';

export type GeoState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ok'; lat: number; lng: number };

export function useGeolocation(autostart = true): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'idle' });

  useEffect(() => {
    if (!autostart) return;
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Geolocalizzazione non supportata' });
      return;
    }
    setState({ status: 'pending' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState({ status: 'denied' });
        else setState({ status: 'error', message: err.message });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, [autostart]);

  return state;
}
```

- [ ] **Step 2: Verifica manuale in dev**

Modifica temporaneamente `App.tsx` per loggare lo stato:
```tsx
import { useGeolocation } from './lib/use-geolocation.js';
import MapView from './components/MapView.js';

export default function App() {
  const geo = useGeolocation();
  return (
    <div className="app-root">
      <MapView />
      <div style={{ position: 'absolute', top: 10, left: 10, background: 'white', padding: 8, zIndex: 1 }}>
        Geo: {JSON.stringify(geo)}
      </div>
    </div>
  );
}
```

Run: `npm run dev`. Permetti la geolocalizzazione, verifica che mostri `{status:'ok', lat, lng}`. Poi togli/concedi il permesso e riprova.

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-geolocation.ts src/App.tsx
git commit -m "feat(geo): hook useGeolocation"
```

---

### Task 4: Data loader (terrazze, meta, chunk edifici)

**Files:**
- Create: `src/lib/data-loader.ts`

- [ ] **Step 1: Implementa**

```ts
// src/lib/data-loader.ts
import type { Building, Meta, Terrace } from '../types/index.js';

const BASE = `${import.meta.env.BASE_URL}data/`;

export async function loadTerraces(): Promise<Terrace[]> {
  const r = await fetch(`${BASE}terraces.json`);
  if (!r.ok) throw new Error(`terraces.json HTTP ${r.status}`);
  return r.json() as Promise<Terrace[]>;
}

export async function loadMeta(): Promise<Meta> {
  const r = await fetch(`${BASE}meta.json`);
  if (!r.ok) throw new Error(`meta.json HTTP ${r.status}`);
  return r.json() as Promise<Meta>;
}

// Cache in-memory dei chunk già scaricati.
const buildingCache = new Map<string, Promise<Building[]>>();

export function loadBuildingChunk(key: string): Promise<Building[]> {
  let p = buildingCache.get(key);
  if (!p) {
    p = fetch(`${BASE}buildings/${key}.json`)
      .then((r) => r.ok ? r.json() as Promise<Building[]> : [])
      .catch(() => []);
    buildingCache.set(key, p);
  }
  return p;
}

export function cellsForBbox(bbox: [number, number, number, number], step: number, marginMeters = 300): string[] {
  // Espande il bbox del margine richiesto (in metri ~ degrees lat).
  const dLat = marginMeters / 111_320;
  const meanLat = (bbox[1] + bbox[3]) / 2;
  const dLng = marginMeters / (111_320 * Math.cos(meanLat * Math.PI / 180));
  const minLng = bbox[0] - dLng;
  const maxLng = bbox[2] + dLng;
  const minLat = bbox[1] - dLat;
  const maxLat = bbox[3] + dLat;
  const xMin = Math.floor(minLng / step);
  const xMax = Math.floor(maxLng / step);
  const yMin = Math.floor(minLat / step);
  const yMax = Math.floor(maxLat / step);
  const out: string[] = [];
  for (let x = xMin; x <= xMax; x++)
    for (let y = yMin; y <= yMax; y++) out.push(`${x}_${y}`);
  return out;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data-loader.ts
git commit -m "feat(data): loader terraces/meta/buildings con cache"
```

---

### Task 5: Wrapper suncalc

**Files:**
- Create: `src/lib/sun.ts`, `src/lib/__tests__/sun.test.ts`

- [ ] **Step 1: Test**

`src/lib/__tests__/sun.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { getSunPosition, isSunUp } from '../sun.js';

// 21 giugno 2026, 14:00 UTC a Barcellona — sole alto a sud
const summer = new Date('2026-06-21T14:00:00Z');
const BCN = { lat: 41.39, lng: 2.165 };

describe('getSunPosition', () => {
  test('a mezzogiorno solstizio estivo a BCN il sole è alto', () => {
    const { altitude, azimuth } = getSunPosition(summer, BCN.lat, BCN.lng);
    // Altezza > 60° (1.05 rad) attesa
    expect(altitude).toBeGreaterThan(1.05);
    // Azimut intorno a sud — suncalc misura da sud (0 = sud), quindi |az| piccolo
    expect(Math.abs(azimuth)).toBeLessThan(0.5);
  });

  test('a mezzanotte sole sotto orizzonte', () => {
    const midnight = new Date('2026-06-21T01:00:00Z');
    expect(isSunUp(midnight, BCN.lat, BCN.lng)).toBe(false);
  });

  test('di giorno isSunUp = true', () => {
    expect(isSunUp(summer, BCN.lat, BCN.lng)).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- src/lib/__tests__/sun.test.ts`

- [ ] **Step 3: Implementa**

`src/lib/sun.ts`:
```ts
import SunCalc from 'suncalc';

export type SunPosition = { altitude: number; azimuth: number }; // radianti

/**
 * Posizione del sole. `azimuth` è misurato da sud (0 = sud, +ovest, -est), `altitude` da orizzonte (radianti).
 */
export function getSunPosition(date: Date, lat: number, lng: number): SunPosition {
  const p = SunCalc.getPosition(date, lat, lng);
  return { altitude: p.altitude, azimuth: p.azimuth };
}

export function isSunUp(date: Date, lat: number, lng: number, minAltitudeRad = 0): boolean {
  return getSunPosition(date, lat, lng).altitude > minAltitudeRad;
}

export function getTimes(date: Date, lat: number, lng: number) {
  return SunCalc.getTimes(date, lat, lng); // sunrise, sunset, etc.
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- src/lib/__tests__/sun.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sun.ts src/lib/__tests__/sun.test.ts
git commit -m "feat(sun): wrapper suncalc + isSunUp"
```

---

### Task 6: Helper geometrici puri

**Files:**
- Create: `src/lib/geometry.ts`, `src/lib/__tests__/geometry.test.ts`

- [ ] **Step 1: Test**

`src/lib/__tests__/geometry.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import {
  haversineMeters,
  raySegmentIntersection,
  pointInPolygon,
  bboxOfPolygon,
} from '../geometry.js';

describe('haversineMeters', () => {
  test('stessa coordinata = 0', () => {
    expect(haversineMeters(41.39, 2.165, 41.39, 2.165)).toBe(0);
  });
  test('~1 grado di latitudine ≈ 111 km', () => {
    expect(haversineMeters(41.39, 2.165, 42.39, 2.165)).toBeCloseTo(111_195, -2);
  });
});

describe('raySegmentIntersection', () => {
  test('raggio orizzontale verso est intercetta segmento verticale davanti', () => {
    // raggio da (0,0) direzione (1,0)
    // segmento da (5,-1) a (5,1)
    const t = raySegmentIntersection(0, 0, 1, 0, 5, -1, 5, 1);
    expect(t).toBeCloseTo(5, 6);
  });

  test('null se il segmento è dietro al raggio', () => {
    const t = raySegmentIntersection(0, 0, 1, 0, -5, -1, -5, 1);
    expect(t).toBeNull();
  });

  test('null se paralleli', () => {
    const t = raySegmentIntersection(0, 0, 1, 0, 1, 1, 2, 1);
    expect(t).toBeNull();
  });
});

describe('pointInPolygon', () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  test('punto interno', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
  });
  test('punto esterno', () => {
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });
});

describe('bboxOfPolygon', () => {
  test('quadrato', () => {
    const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(bboxOfPolygon(square)).toEqual([0, 0, 10, 10]);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- src/lib/__tests__/geometry.test.ts`

- [ ] **Step 3: Implementa**

`src/lib/geometry.ts`:
```ts
const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Intersezione raggio (origine ox,oy + direzione dx,dy non normalizzata) con segmento (x1,y1)→(x2,y2).
 * Ritorna il parametro t lungo il raggio (>= 0) se interseca, null altrimenti.
 * Tutte le coordinate sono assunte in un piano locale (es. metri Cartesiani).
 */
export function raySegmentIntersection(
  ox: number, oy: number, dx: number, dy: number,
  x1: number, y1: number, x2: number, y2: number,
): number | null {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-12) return null; // paralleli
  const tRay = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
  const tSeg = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;
  if (tRay < 0 || tSeg < 0 || tSeg > 1) return null;
  return tRay;
}

export function pointInPolygon(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-30) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function bboxOfPolygon(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- src/lib/__tests__/geometry.test.ts`
Expected: tutti i test passano.

- [ ] **Step 5: Commit**

```bash
git add src/lib/geometry.ts src/lib/__tests__/geometry.test.ts
git commit -m "feat(geom): haversine, raySegment, pointInPolygon, bbox"
```

---

### Task 7: Proiezione locale lat/lng → metri

**Files:**
- Create: `src/lib/local-projection.ts`, `src/lib/__tests__/local-projection.test.ts`

Per fare raycasting useremo una proiezione equirettangolare locale ancorata sulla terrazza (precisione sub-metrica entro qualche km — più che sufficiente).

- [ ] **Step 1: Test**

`src/lib/__tests__/local-projection.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { makeLocalProjection } from '../local-projection.js';

describe('makeLocalProjection', () => {
  test('origine = (0,0)', () => {
    const proj = makeLocalProjection(41.39, 2.165);
    expect(proj.project(41.39, 2.165)).toEqual([0, 0]);
  });

  test('1 grado di latitudine ≈ 111 km a nord', () => {
    const proj = makeLocalProjection(41.39, 2.165);
    const [x, y] = proj.project(42.39, 2.165);
    expect(x).toBeCloseTo(0, 0);
    expect(y).toBeCloseTo(111_320, -2);
  });

  test('1 grado di longitudine alla latitudine BCN ≈ cos(lat) × 111 km', () => {
    const proj = makeLocalProjection(41.39, 2.165);
    const [x, y] = proj.project(41.39, 3.165);
    const expected = Math.cos((41.39 * Math.PI) / 180) * 111_320;
    expect(x).toBeCloseTo(expected, -2);
    expect(y).toBeCloseTo(0, 0);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- src/lib/__tests__/local-projection.test.ts`

- [ ] **Step 3: Implementa**

`src/lib/local-projection.ts`:
```ts
const M_PER_DEG_LAT = 111_320;

export type LocalProjection = {
  project: (lat: number, lng: number) => [number, number]; // [x_east_m, y_north_m]
  unproject: (x: number, y: number) => [number, number];   // [lat, lng]
};

export function makeLocalProjection(originLat: number, originLng: number): LocalProjection {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  return {
    project(lat, lng) {
      return [(lng - originLng) * mPerDegLng, (lat - originLat) * M_PER_DEG_LAT];
    },
    unproject(x, y) {
      return [originLat + y / M_PER_DEG_LAT, originLng + x / mPerDegLng];
    },
  };
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- src/lib/__tests__/local-projection.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-projection.ts src/lib/__tests__/local-projection.test.ts
git commit -m "feat(geom): proiezione locale equirettangolare"
```

---

### Task 8: Indice spaziale edifici (RBush)

**Files:**
- Create: `src/lib/building-index.ts`, `src/lib/__tests__/building-index.test.ts`

- [ ] **Step 1: Test**

`src/lib/__tests__/building-index.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { buildBuildingIndex } from '../building-index.js';
import type { Building } from '../../types/index.js';

const b1: Building = {
  id: 'a',
  height: 12,
  footprint: [[2.16, 41.38], [2.161, 41.38], [2.161, 41.381], [2.16, 41.381], [2.16, 41.38]],
  heightSource: 'osm',
};
const b2: Building = {
  id: 'b',
  height: 12,
  footprint: [[2.20, 41.42], [2.201, 41.42], [2.201, 41.421], [2.20, 41.421], [2.20, 41.42]],
  heightSource: 'osm',
};

describe('buildBuildingIndex', () => {
  test('search ritorna solo gli edifici dentro il bbox', () => {
    const idx = buildBuildingIndex([b1, b2]);
    const hits = idx.search(2.159, 41.379, 2.162, 41.382);
    expect(hits.map((h) => h.id)).toEqual(['a']);
  });

  test('bbox che copre tutto', () => {
    const idx = buildBuildingIndex([b1, b2]);
    const hits = idx.search(2.0, 41.0, 2.5, 42.0);
    expect(hits).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- src/lib/__tests__/building-index.test.ts`

- [ ] **Step 3: Implementa**

`src/lib/building-index.ts`:
```ts
import RBush from 'rbush';
import type { Building } from '../types/index.js';
import { bboxOfPolygon } from './geometry.js';

type IndexedBuilding = { minX: number; minY: number; maxX: number; maxY: number; building: Building };

class BuildingTree extends RBush<IndexedBuilding> {}

export type BuildingIndex = {
  search: (minLng: number, minLat: number, maxLng: number, maxLat: number) => Building[];
};

export function buildBuildingIndex(buildings: Building[]): BuildingIndex {
  const tree = new BuildingTree();
  const items: IndexedBuilding[] = buildings.map((b) => {
    const [minX, minY, maxX, maxY] = bboxOfPolygon(b.footprint);
    return { minX, minY, maxX, maxY, building: b };
  });
  tree.load(items);
  return {
    search(minLng, minLat, maxLng, maxLat) {
      return tree
        .search({ minX: minLng, minY: minLat, maxX: maxLng, maxY: maxLat })
        .map((it) => it.building);
    },
  };
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- src/lib/__tests__/building-index.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/building-index.ts src/lib/__tests__/building-index.test.ts
git commit -m "feat(index): RBush index per edifici"
```

---

### Task 9: Shadow engine — `isInSun`

**Files:**
- Create: `src/lib/shadow-engine.ts`, `src/lib/__tests__/shadow-engine.test.ts`

- [ ] **Step 1: Test**

`src/lib/__tests__/shadow-engine.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { isInSun } from '../shadow-engine.js';
import { buildBuildingIndex } from '../building-index.js';
import type { Building } from '../../types/index.js';

// Costruiamo una scena controllata in BCN: un edificio alto a sud della terrazza.
// suncalc azimuth: 0 = sud, +Ovest, -Est. altitude in radianti.

const tLat = 41.39;
const tLng = 2.165;

// Edificio piccolo, alto 30m, ~10m a sud della terrazza.
// 10 m a sud ≈ 10 / 111320 ° lat
const dLat = 10 / 111_320;
const dLatSpan = 5 / 111_320;
const dLngSpan = 5 / (111_320 * Math.cos((tLat * Math.PI) / 180));
const south: Building = {
  id: 'south',
  height: 30,
  heightSource: 'osm',
  footprint: [
    [tLng - dLngSpan, tLat - dLat - dLatSpan],
    [tLng + dLngSpan, tLat - dLat - dLatSpan],
    [tLng + dLngSpan, tLat - dLat + dLatSpan],
    [tLng - dLngSpan, tLat - dLat + dLatSpan],
    [tLng - dLngSpan, tLat - dLat - dLatSpan],
  ],
};

describe('isInSun — sole basso a sud', () => {
  test('sole basso (30°) a sud bloccato da edificio alto a sud → ombra', () => {
    // sole a sud (azimuth=0), altezza 30° (~0.524 rad). Tan 30° = 0.577. A 10 m, ombra fino a 5.77 m. Edificio alto 30 m blocca.
    const index = buildBuildingIndex([south]);
    const sun = { altitude: 0.524, azimuth: 0 };
    expect(isInSun(tLat, tLng, sun, index)).toBe(false);
  });

  test('sole alto in zenit (87°) → quasi nulla blocca → sole', () => {
    const index = buildBuildingIndex([south]);
    const sun = { altitude: 1.518, azimuth: 0 }; // ~87°
    expect(isInSun(tLat, tLng, sun, index)).toBe(true);
  });

  test('sole basso ma proviene da nord → l\'edificio a sud non blocca', () => {
    const index = buildBuildingIndex([south]);
    const sun = { altitude: 0.524, azimuth: Math.PI }; // 180° dal sud = nord
    expect(isInSun(tLat, tLng, sun, index)).toBe(true);
  });

  test('sole sotto orizzonte → false', () => {
    const index = buildBuildingIndex([]);
    const sun = { altitude: -0.1, azimuth: 0 };
    expect(isInSun(tLat, tLng, sun, index)).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui — deve fallire**

Run: `npm test -- src/lib/__tests__/shadow-engine.test.ts`

- [ ] **Step 3: Implementa**

`src/lib/shadow-engine.ts`:
```ts
import { raySegmentIntersection, pointInPolygon } from './geometry.js';
import { makeLocalProjection } from './local-projection.js';
import type { BuildingIndex } from './building-index.js';
import type { SunPosition } from './sun.js';

const MIN_ALT_RAD = 0.05; // ~3°: sotto questa soglia il sole è troppo basso, "shade" come default sicuro

/**
 * Decide se una terrazza è al sole in base al sole + agli edifici vicini.
 * Convenzione suncalc: azimuth 0 = sud, +Ovest, -Est. altitude da orizzonte.
 */
export function isInSun(
  lat: number, lng: number,
  sun: SunPosition,
  index: BuildingIndex,
): boolean {
  if (sun.altitude <= 0) return false;
  if (sun.altitude < MIN_ALT_RAD) return false;

  // Raggio di ricerca: edifici fino a (maxBuildingHeight / tan(alt)) lontani.
  // Cap a 300 m per evitare scansioni enormi.
  const reach = Math.min(300, 200 / Math.tan(sun.altitude));
  const dLat = reach / 111_320;
  const meanCos = Math.cos((lat * Math.PI) / 180);
  const dLng = reach / (111_320 * meanCos);
  const candidates = index.search(lng - dLng, lat - dLat, lng + dLng, lat + dLat);
  if (candidates.length === 0) return true;

  const proj = makeLocalProjection(lat, lng);
  // Direzione del raggio verso il sole, proiezione orizzontale.
  // suncalc: az=0 → sud. dx_east = -sin(az), dy_north = -cos(az). Sole a sud = direzione (0, -1).
  const dx = -Math.sin(sun.azimuth);
  const dy = -Math.cos(sun.azimuth);
  const tanAlt = Math.tan(sun.altitude);

  for (const b of candidates) {
    // Proietta footprint in metri locali.
    const ring = b.footprint.map(([blng, blat]) => proj.project(blat, blng));

    // Se la terrazza è dentro il footprint dell'edificio stesso, considerala ombra
    // (terrazza addossata al muro interno — caso raro ma reale).
    if (pointInPolygon(0, 0, ring)) {
      if (b.height >= 1) return false;
    }

    let minHit = Infinity;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]!;
      const [x2, y2] = ring[i + 1]!;
      const t = raySegmentIntersection(0, 0, dx, dy, x1, y1, x2, y2);
      if (t != null && t > 0 && t < minHit) minHit = t;
    }
    if (minHit < Infinity) {
      if (b.height > minHit * tanAlt) return false; // bloccato
    }
  }
  return true;
}
```

- [ ] **Step 4: Esegui — devono passare**

Run: `npm test -- src/lib/__tests__/shadow-engine.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shadow-engine.ts src/lib/__tests__/shadow-engine.test.ts
git commit -m "feat(shadow): engine isInSun con raycasting su footprint"
```

---

### Task 10: Store Zustand

**Files:**
- Create: `src/store/use-store.ts`

- [ ] **Step 1: Implementa**

```ts
// src/store/use-store.ts
import { create } from 'zustand';
import type { Terrace } from '../types/index.js';

export type TerraceStatus = 'sun' | 'shade' | 'closed' | 'pending';

type State = {
  now: Date;
  setNow: (d: Date) => void;
  userPos: { lat: number; lng: number } | null;
  setUserPos: (p: { lat: number; lng: number } | null) => void;
  terraces: Terrace[];
  setTerraces: (t: Terrace[]) => void;
  states: Record<string, TerraceStatus>; // id → status
  setStates: (s: Record<string, TerraceStatus>) => void;
};

export const useStore = create<State>((set) => ({
  now: new Date(),
  setNow: (now) => set({ now }),
  userPos: null,
  setUserPos: (userPos) => set({ userPos }),
  terraces: [],
  setTerraces: (terraces) => set({ terraces }),
  states: {},
  setStates: (states) => set({ states }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/use-store.ts
git commit -m "feat(store): Zustand store"
```

---

### Task 11: Componente `Markers` (rendering terrazze sulla mappa)

**Files:**
- Create: `src/components/Markers.tsx`

- [ ] **Step 1: Implementa**

```tsx
// src/components/Markers.tsx
import { useEffect } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import { useStore, TerraceStatus } from '../store/use-store.js';

const COLORS: Record<TerraceStatus, string> = {
  sun: '#f5a623',
  shade: '#3a6ea5',
  closed: '#666666',
  pending: '#cccccc',
};

type Props = { map: MLMap };

export default function Markers({ map }: Props) {
  const terraces = useStore((s) => s.terraces);
  const states = useStore((s) => s.states);

  useEffect(() => {
    if (!map.isStyleLoaded()) return;
    const sourceId = 'terraces-src';
    const layerId = 'terraces-layer';

    const features = terraces.map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lng, t.lat] },
      properties: {
        id: t.id,
        status: states[t.id] ?? 'pending',
      },
    }));
    const geojson = { type: 'FeatureCollection' as const, features };

    const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match', ['get', 'status'],
            'sun', COLORS.sun,
            'shade', COLORS.shade,
            'closed', COLORS.closed,
            COLORS.pending,
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }, [map, terraces, states]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Markers.tsx
git commit -m "feat(markers): layer terrazze colorate per stato"
```

---

### Task 12: Orchestrazione — calcolo stati al caricamento

**Files:**
- Create: `src/lib/compute-states.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Funzione di calcolo**

`src/lib/compute-states.ts`:
```ts
import { isInSun } from './shadow-engine.js';
import type { BuildingIndex } from './building-index.js';
import type { Terrace } from '../types/index.js';
import { getSunPosition } from './sun.js';
import type { TerraceStatus } from '../store/use-store.js';

export function computeAllStates(
  terraces: Terrace[],
  now: Date,
  index: BuildingIndex,
): Record<string, TerraceStatus> {
  const out: Record<string, TerraceStatus> = {};
  for (const t of terraces) {
    const sun = getSunPosition(now, t.lat, t.lng);
    if (sun.altitude <= 0) {
      out[t.id] = 'closed';
      continue;
    }
    out[t.id] = isInSun(t.lat, t.lng, sun, index) ? 'sun' : 'shade';
  }
  return out;
}
```

- [ ] **Step 2: Wiring nell'App**

`src/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import MapView from './components/MapView.js';
import Markers from './components/Markers.js';
import { useGeolocation } from './lib/use-geolocation.js';
import { useStore } from './store/use-store.js';
import { loadTerraces, loadMeta, loadBuildingChunk, cellsForBbox } from './lib/data-loader.js';
import { buildBuildingIndex } from './lib/building-index.js';
import { computeAllStates } from './lib/compute-states.js';
import type { Building } from './types/index.js';

export default function App() {
  const [map, setMap] = useState<MLMap | null>(null);
  const geo = useGeolocation();
  const setTerraces = useStore((s) => s.setTerraces);
  const setStates = useStore((s) => s.setStates);
  const setUserPos = useStore((s) => s.setUserPos);
  const terraces = useStore((s) => s.terraces);
  const now = useStore((s) => s.now);

  // Geolocalizzazione → centra mappa
  useEffect(() => {
    if (geo.status === 'ok' && map) {
      setUserPos({ lat: geo.lat, lng: geo.lng });
      // Center solo se l'utente è dentro BCN
      if (geo.lng > 2.0 && geo.lng < 2.3 && geo.lat > 41.3 && geo.lat < 41.5) {
        map.flyTo({ center: [geo.lng, geo.lat], zoom: 15, duration: 800 });
      }
    }
  }, [geo, map, setUserPos]);

  // Carica terrazze + chunk edifici per il viewport + calcola stati
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const run = async () => {
      const [list, meta] = await Promise.all([loadTerraces(), loadMeta()]);
      if (cancelled) return;
      setTerraces(list);

      const b = map.getBounds();
      const cells = cellsForBbox(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        meta.gridStep,
        300,
      );
      const chunks = await Promise.all(cells.map((k) => loadBuildingChunk(k)));
      const allBuildings: Building[] = chunks.flat();
      const index = buildBuildingIndex(allBuildings);
      if (cancelled) return;

      const states = computeAllStates(list, now, index);
      setStates(states);
    };
    map.once('idle', run);
    return () => { cancelled = true; };
  }, [map, now, setTerraces, setStates]);

  return (
    <div className="app-root">
      <MapView onMapReady={setMap} />
      {map && <Markers map={map} />}
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
Expected: la mappa di Barcellona si apre, dopo un istante centinaia/migliaia di pallini compaiono colorati. Pallini gialli = sole, blu = ombra. Cambia l'orario di sistema (o passa al notturno con DevTools) per verificare cambi di stato.

> Se rendering lento (>2 s per molti markers), va bene per ora — Session 3 può aggiungere LOD / filtri viewport.

- [ ] **Step 4: Commit**

```bash
git add src/lib/compute-states.ts src/App.tsx
git commit -m "feat(app): wiring carico dati + calcolo stati + markers"
```

---

### Task 13: Test viewport mobile

- [ ] **Step 1: Apri DevTools mobile**

Run: `npm run dev`, poi nel browser: DevTools → device toolbar → "iPhone 12 Pro" (390×844).

- [ ] **Step 2: Checklist**
- [ ] Mappa a tutto schermo, niente scrollbar
- [ ] Pinch-zoom abilitato (non bloccato dal viewport meta)
- [ ] Marker visibili e cliccabili
- [ ] Geolocalizzazione richiesta correttamente
- [ ] Niente errori in console

Annota in chat eventuali bug visivi/UX — risolveremo i grossi in Session 3.

---

### Task FINAL: Aggiornamento graphiti + prompt per Session 3

- [ ] **Step 1: Verifica finale**

Run:
```bash
npm test
npm run build
```

Expected: tutti i test passano; `npm run build` produce `dist/` senza errori.

- [ ] **Step 2: Aggiorna graphiti**

Chiama `mcp__graphiti-memory__add_memory` con:
- `group_id`: `"mappa-delle-terrazze-al-sole"`
- `name`: `"Session 2 completata - PWA Core"`
- `source`: `"text"`
- `episode_body`: includi (in italiano):
  - Cosa è stato consegnato (Vite + React + PWA scaffold; map MapLibre + OpenFreeMap; geolocation; data loader; sun + geometry + shadow-engine + RBush + Zustand; markers colorati; wiring completo)
  - File principali: `src/components/`, `src/lib/`, `src/store/`, `vite.config.ts`, `index.html`
  - Conferma test passanti (numero totale)
  - Gotcha incontrati (es. se OpenFreeMap aveva problemi, scelte alternative, ecc.)
  - Stato git: commit hash, branch
  - Next: Session 3 — bottom sheet, slider, scheda con Google Maps, edge case, i18n, service worker, deploy

- [ ] **Step 3: Genera prompt Session 3**

Crea `docs/superpowers/plans/START-SESSION-3.md` con questo contenuto (sostituisci `<…>`):

```markdown
# Prompt iniziale — Session 3

> Copia-incolla tutto il blocco qui sotto nella nuova sessione Claude.

---

\`\`\`
Sei in una nuova sessione di Claude per il progetto "Mappa delle terrazze al sole".

CARTELLA: C:\Users\masch\Desktop\Software Builds\Mappa delle terrazze al sole
GROUP_ID graphiti: mappa-delle-terrazze-al-sole

PRIMA DI INIZIARE:
1. ~/.claude/CLAUDE.md è auto-caricato.
2. Esegui search_memory_facts e search_nodes su graphiti con group_id="mappa-delle-terrazze-al-sole" — troverai gli episodi "Session 1 completata" e "Session 2 completata".
3. Leggi nell'ordine:
   - docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md
   - docs/superpowers/plans/2026-05-22-session-3-ux-deploy.md
4. Stato repo: ultimo commit Session 2 = <COMMIT_HASH>. Su branch main. \`npm test\` passa con <N> test.

STATO APP (output di Session 2):
- Vite + React + PWA scaffold funzionante
- MapLibre + OpenFreeMap, mappa Barcellona
- Geolocalizzazione funzionante
- Shadow engine completo: per ogni terrazza calcola sole/ombra alle <NOW_EXEMPLO>
- Markers colorati sulla mappa
- ANCORA NON ESISTONO: bottom sheet, slider orario, scheda terrazza, link Google Maps, i18n, attribuzione, deploy

POI:
- Usa la skill superpowers:executing-plans per il Session 3 plan.
- Committa dopo ogni task. Messaggi in italiano.
- TDD per le funzioni pure (google-maps URL, walking-time, sunny-until).
- Per i componenti UI: verifica visiva su viewport mobile 390×844.
- Non saltare il Task FINAL (graphiti finale + verifica deploy live).

OBIETTIVO: portare l'app in produzione su GitHub Pages, completa di tutte le funzionalità dell'MVP.

Procedi.
\`\`\`
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/START-SESSION-3.md
git commit -m "docs(plans): handoff per Session 3"
```

- [ ] **Step 5: Avvisa l'utente**

Stampa in chat:
> Session 2 completata. La mappa di Barcellona mostra le terrazze colorate per stato di sole/ombra. Prompt per Session 3 in `docs/superpowers/plans/START-SESSION-3.md`. Apri una nuova sessione Claude e incolla quel contenuto per continuare.

---

## Auto-review finale (prima del Task FINAL)
- [ ] `npm test` passa
- [ ] `npm run dev` apre l'app, geoloc + map + markers funzionano
- [ ] `npm run build` produce `dist/` senza errori
- [ ] Nessun `any`, nessun TODO residuo
- [ ] Working tree pulito (`git status`)
