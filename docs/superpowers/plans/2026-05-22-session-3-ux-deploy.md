# Session 3 — UX & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completare l'MVP: bottom sheet trascinabile con lista ordinata, slider orario, scheda terrazza con link Google Maps, edge case gestiti, i18n ES+EN, attribuzione, service worker offline, deploy su GitHub Pages.

**Architecture:** Aggiunta di componenti UI sopra il map shell di Session 2. Tutta la logica nuova in `src/lib/` come funzioni pure (testabili). Stili in CSS files dedicati. Deploy via GitHub Actions su GitHub Pages.

**Tech Stack:** React, MapLibre, suncalc, Zustand. Nessuna nuova dipendenza pesante (eventuale `framer-motion` solo se necessario — preferire CSS transitions).

---

## Stato all'avvio
- Session 1 e 2 completate. Vedi episodi graphiti `Session 1 completata` e `Session 2 completata`.
- L'app mostra mappa + markers colorati ma niente lista, slider, card, deploy.
- Test passanti (vedi episodio Session 2 per il numero).

## Convenzioni
- Stessi pattern delle sessioni precedenti (commit per task, messaggi italiano, niente `any`).
- Componenti UI in `src/components/`, stili `.css` in `src/styles/`.
- Per ogni nuova funzione pura: TDD.

---

### Task 1: Helper Google Maps URL

**Files:**
- Create: `src/lib/google-maps.ts`, `src/lib/__tests__/google-maps.test.ts`

- [ ] **Step 1: Test**

```ts
// src/lib/__tests__/google-maps.test.ts
import { describe, expect, test } from 'vitest';
import { googleMapsUrl } from '../google-maps.js';

describe('googleMapsUrl', () => {
  test('usa nome + indirizzo + Barcelona', () => {
    const url = googleMapsUrl({ name: 'Bar Pepito', address: 'Carrer Major 12' });
    expect(url).toMatch(/google\.com\/maps\/search\/\?api=1&query=/);
    expect(url).toContain(encodeURIComponent('Bar Pepito'));
    expect(url).toContain(encodeURIComponent('Carrer Major 12'));
    expect(url).toContain(encodeURIComponent('Barcelona'));
  });

  test('gestisce nome vuoto fallback su indirizzo', () => {
    const url = googleMapsUrl({ name: '', address: 'Plaça X' });
    expect(url).toContain(encodeURIComponent('Plaça X'));
  });
});
```

- [ ] **Step 2: Implementa**

```ts
// src/lib/google-maps.ts
export function googleMapsUrl(input: { name: string; address: string }): string {
  const parts = [input.name, input.address, 'Barcelona'].filter(Boolean);
  const q = encodeURIComponent(parts.join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
```

- [ ] **Step 3: Esegui**

Run: `npm test -- src/lib/__tests__/google-maps.test.ts`
Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/google-maps.ts src/lib/__tests__/google-maps.test.ts
git commit -m "feat(maps): helper googleMapsUrl"
```

---

### Task 2: Helper walking time

**Files:**
- Create: `src/lib/walking-time.ts`, `src/lib/__tests__/walking-time.test.ts`

- [ ] **Step 1: Test**

```ts
// src/lib/__tests__/walking-time.test.ts
import { describe, expect, test } from 'vitest';
import { walkingMinutes } from '../walking-time.js';

describe('walkingMinutes', () => {
  test('500 m → 6 minuti (5 km/h)', () => {
    expect(walkingMinutes(500)).toBe(6);
  });
  test('arrotonda al minuto', () => {
    expect(walkingMinutes(100)).toBe(1);
  });
  test('0 m = 0', () => {
    expect(walkingMinutes(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Implementa**

```ts
// src/lib/walking-time.ts
const KM_PER_H = 5;
export function walkingMinutes(meters: number): number {
  if (meters <= 0) return 0;
  return Math.max(1, Math.round((meters / 1000) / KM_PER_H * 60));
}
```

- [ ] **Step 3: Esegui + commit**

```bash
npm test -- src/lib/__tests__/walking-time.test.ts
git add src/lib/walking-time.ts src/lib/__tests__/walking-time.test.ts
git commit -m "feat(walk): walkingMinutes"
```

---

### Task 3: Helper "sunny until"

**Files:**
- Create: `src/lib/sunny-until.ts`, `src/lib/__tests__/sunny-until.test.ts`

- [ ] **Step 1: Test**

```ts
// src/lib/__tests__/sunny-until.test.ts
import { describe, expect, test } from 'vitest';
import { sunnyUntil } from '../sunny-until.js';

// Mockiamo isInSun: sole fino alle 17:00, ombra dopo.
const fakeIsInSun = (_lat: number, _lng: number, date: Date) =>
  date.getUTCHours() < 17;

describe('sunnyUntil', () => {
  test('quando attualmente al sole, ritorna l\'ora del flip a ombra', () => {
    const now = new Date('2026-06-21T14:00:00Z');
    const flip = sunnyUntil(now, 41.39, 2.165, fakeIsInSun, 10);
    expect(flip).not.toBeNull();
    expect(flip!.getUTCHours()).toBe(17);
  });

  test('null se già in ombra', () => {
    const now = new Date('2026-06-21T18:00:00Z');
    expect(sunnyUntil(now, 41.39, 2.165, fakeIsInSun, 10)).toBeNull();
  });
});
```

- [ ] **Step 2: Implementa**

```ts
// src/lib/sunny-until.ts
const MAX_HOURS_AHEAD = 8;

export type SunPredicate = (lat: number, lng: number, date: Date) => boolean;

export function sunnyUntil(
  now: Date,
  lat: number,
  lng: number,
  isSun: SunPredicate,
  stepMinutes = 10,
): Date | null {
  if (!isSun(lat, lng, now)) return null;
  const stepMs = stepMinutes * 60_000;
  const maxIters = (MAX_HOURS_AHEAD * 60) / stepMinutes;
  let t = new Date(now.getTime());
  for (let i = 0; i < maxIters; i++) {
    t = new Date(t.getTime() + stepMs);
    if (!isSun(lat, lng, t)) return t;
  }
  return null;
}
```

- [ ] **Step 3: Esegui + commit**

```bash
npm test -- src/lib/__tests__/sunny-until.test.ts
git add src/lib/sunny-until.ts src/lib/__tests__/sunny-until.test.ts
git commit -m "feat(sun): sunnyUntil (scan forward)"
```

---

### Task 4: Selettore terrazze ordinate per distanza

**Files:**
- Create: `src/lib/sort-terraces.ts`, `src/lib/__tests__/sort-terraces.test.ts`

- [ ] **Step 1: Test**

```ts
// src/lib/__tests__/sort-terraces.test.ts
import { describe, expect, test } from 'vitest';
import { sortTerracesByDistance } from '../sort-terraces.js';
import type { Terrace } from '../../types/index.js';

const mk = (id: string, lat: number, lng: number): Terrace => ({
  id, name: id, address: '', lat, lng, tables: 0, chairs: 0, surfaceSqM: 0, neighborhood: '',
});

describe('sortTerracesByDistance', () => {
  test('ordina dal più vicino al più lontano', () => {
    const user = { lat: 41.39, lng: 2.165 };
    const items = [
      mk('far', 41.45, 2.20),
      mk('near', 41.391, 2.166),
      mk('mid', 41.40, 2.18),
    ];
    const out = sortTerracesByDistance(items, user);
    expect(out.map((x) => x.terrace.id)).toEqual(['near', 'mid', 'far']);
    expect(out[0]!.distanceMeters).toBeLessThan(out[1]!.distanceMeters);
  });
});
```

- [ ] **Step 2: Implementa**

```ts
// src/lib/sort-terraces.ts
import { haversineMeters } from './geometry.js';
import type { Terrace } from '../types/index.js';

export type WithDistance = { terrace: Terrace; distanceMeters: number };

export function sortTerracesByDistance(
  terraces: Terrace[],
  user: { lat: number; lng: number },
): WithDistance[] {
  return terraces
    .map((t) => ({ terrace: t, distanceMeters: haversineMeters(user.lat, user.lng, t.lat, t.lng) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
```

- [ ] **Step 3: Esegui + commit**

```bash
npm test -- src/lib/__tests__/sort-terraces.test.ts
git add src/lib/sort-terraces.ts src/lib/__tests__/sort-terraces.test.ts
git commit -m "feat(sort): sortTerracesByDistance"
```

---

### Task 5: Setup i18n minimale

**Files:**
- Create: `src/i18n/es.json`, `src/i18n/en.json`, `src/i18n/i18n.ts`

- [ ] **Step 1: Stringhe**

`src/i18n/es.json`:
```json
{
  "appName": "Terrazas al sol",
  "sunnyNearby": "{count} terrazas al sol cerca de ti",
  "openInGoogleMaps": "Abrir en Google Maps",
  "sunnyUntil": "Al sol hasta las {time}",
  "tables": "{n} mesas",
  "walkMinutes": "{n} min a pie",
  "now": "Ahora",
  "sunset": "Atardecer",
  "geoDenied": "Permiso de ubicación denegado",
  "outsideBcn": "Por ahora solo cubrimos Barcelona",
  "night": "El sol ya se puso",
  "credits": "Datos: Open Data BCN · OpenStreetMap · OpenFreeMap"
}
```

`src/i18n/en.json`:
```json
{
  "appName": "Sunny terraces",
  "sunnyNearby": "{count} sunny terraces near you",
  "openInGoogleMaps": "Open in Google Maps",
  "sunnyUntil": "Sunny until {time}",
  "tables": "{n} tables",
  "walkMinutes": "{n} min walk",
  "now": "Now",
  "sunset": "Sunset",
  "geoDenied": "Location permission denied",
  "outsideBcn": "We only cover Barcelona for now",
  "night": "The sun has set",
  "credits": "Data: Open Data BCN · OpenStreetMap · OpenFreeMap"
}
```

- [ ] **Step 2: Hook**

`src/i18n/i18n.ts`:
```ts
import es from './es.json';
import en from './en.json';

const PACKS = { es, en } as const;
type Lang = keyof typeof PACKS;

function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'es';
  return nav.startsWith('en') ? 'en' : 'es';
}

const lang: Lang = detectLang();
const pack = PACKS[lang];

export function t(key: keyof typeof es, vars?: Record<string, string | number>): string {
  let s = (pack as Record<string, string>)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n
git commit -m "feat(i18n): ES + EN strings + helper t()"
```

---

### Task 6: Componente `TimeSlider`

**Files:**
- Create: `src/components/TimeSlider.tsx`, `src/styles/time-slider.css`

- [ ] **Step 1: Implementa**

```tsx
// src/components/TimeSlider.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { getTimes } from '../lib/sun.js';
import { t } from '../i18n/i18n.js';
import '../styles/time-slider.css';

const BCN = { lat: 41.39, lng: 2.165 };

function formatHM(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TimeSlider() {
  const now = useStore((s) => s.now);
  const setNow = useStore((s) => s.setNow);
  const realNow = new Date();
  const [valueMin, setValueMin] = useState(0);

  const sunset = getTimes(realNow, BCN.lat, BCN.lng).sunset;

  useEffect(() => {
    const delta = Math.round((now.getTime() - realNow.getTime()) / 60_000);
    setValueMin(delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = Number(e.target.value);
    setValueMin(m);
    const next = new Date(realNow.getTime() + m * 60_000);
    setNow(next);
  };

  const reset = () => {
    setNow(new Date());
    setValueMin(0);
  };

  return (
    <div className="time-slider">
      <div className="time-slider__row">
        <button className="time-slider__now" onClick={reset}>{t('now')} {formatHM(now)}</button>
        <span className="time-slider__sunset">{t('sunset')} {formatHM(sunset)}</span>
      </div>
      <input
        type="range"
        min={-180}
        max={720}
        step={10}
        value={valueMin}
        onChange={onChange}
        aria-label="time offset"
      />
    </div>
  );
}
```

- [ ] **Step 2: CSS**

`src/styles/time-slider.css`:
```css
.time-slider {
  position: absolute;
  top: env(safe-area-inset-top, 0);
  left: 0; right: 0;
  padding: 10px 16px 8px;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(8px);
  z-index: 5;
}
.time-slider__row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 14px; margin-bottom: 6px;
}
.time-slider__now {
  background: #f5a623; color: white; border: 0; padding: 6px 12px; border-radius: 999px;
  font-weight: 600; font-size: 14px; cursor: pointer;
}
.time-slider input[type=range] { width: 100%; }
```

- [ ] **Step 3: Inserisci nello shell**

In `src/App.tsx` aggiungi `<TimeSlider />` dentro `.app-root` (sopra `MapView` ma fuori; il CSS lo posiziona in absolute).

- [ ] **Step 4: Effetto sui marker**

Modifica l'effetto principale di `App.tsx` per ricalcolare lo stato anche al cambio di `now` (è già nel deps array). Verifica che trascinando lo slider i colori cambino.

- [ ] **Step 5: Commit**

```bash
git add src/components/TimeSlider.tsx src/styles/time-slider.css src/App.tsx
git commit -m "feat(ui): TimeSlider con tramonto + ricalcolo stati"
```

---

### Task 7: Componente `BottomSheet` (trascinabile)

**Files:**
- Create: `src/components/BottomSheet.tsx`, `src/styles/bottom-sheet.css`

- [ ] **Step 1: Implementa**

```tsx
// src/components/BottomSheet.tsx
import { useEffect, useRef, useState } from 'react';
import '../styles/bottom-sheet.css';

type Props = {
  collapsedLabel: string;
  children: React.ReactNode;
};

export default function BottomSheet({ collapsedLabel, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0]!.clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0]!.clientY - startY.current;
    setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY < -40) setExpanded(true);
    if (dragY > 40) setExpanded(false);
    startY.current = null;
    setDragY(0);
  };

  useEffect(() => { setDragY(0); }, [expanded]);

  return (
    <div
      className={`bottom-sheet ${expanded ? 'bottom-sheet--expanded' : ''}`}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
    >
      <button
        className="bottom-sheet__handle"
        onClick={() => setExpanded((v) => !v)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label="toggle sheet"
      >
        <span className="bottom-sheet__bar" />
        <span className="bottom-sheet__label">{collapsedLabel}</span>
      </button>
      <div className="bottom-sheet__content">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: CSS**

`src/styles/bottom-sheet.css`:
```css
.bottom-sheet {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 35%;
  background: white;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
  display: flex; flex-direction: column;
  transition: height 220ms ease;
  z-index: 4;
}
.bottom-sheet--expanded { height: 80%; }
.bottom-sheet__handle {
  appearance: none; background: white; border: 0; padding: 12px 16px;
  display: flex; flex-direction: column; align-items: center; cursor: pointer;
  border-top-left-radius: 16px; border-top-right-radius: 16px;
}
.bottom-sheet__bar { width: 40px; height: 4px; background: #ccc; border-radius: 2px; margin-bottom: 8px; }
.bottom-sheet__label { font-size: 14px; font-weight: 600; color: #333; }
.bottom-sheet__content { flex: 1; overflow-y: auto; padding: 0 16px 16px; }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomSheet.tsx src/styles/bottom-sheet.css
git commit -m "feat(ui): BottomSheet trascinabile"
```

---

### Task 8: `TerraceListRow` + lista nella bottom sheet

**Files:**
- Create: `src/components/TerraceListRow.tsx`, `src/components/TerraceList.tsx`, `src/styles/list.css`

- [ ] **Step 1: `TerraceListRow.tsx`**

```tsx
// src/components/TerraceListRow.tsx
import { googleMapsUrl } from '../lib/google-maps.js';
import { walkingMinutes } from '../lib/walking-time.js';
import { t } from '../i18n/i18n.js';
import type { TerraceStatus } from '../store/use-store.js';
import type { Terrace } from '../types/index.js';

type Props = {
  terrace: Terrace;
  status: TerraceStatus;
  distanceMeters: number;
  onSelect: () => void;
};

const STATUS_EMOJI: Record<TerraceStatus, string> = {
  sun: '☀️', shade: '🌫️', closed: '🌙', pending: '…',
};

export default function TerraceListRow({ terrace, status, distanceMeters, onSelect }: Props) {
  const mins = walkingMinutes(distanceMeters);
  return (
    <div className="row">
      <button className="row__main" onClick={onSelect}>
        <span className="row__status" aria-label={status}>{STATUS_EMOJI[status]}</span>
        <span className="row__text">
          <span className="row__name">{terrace.name || terrace.address}</span>
          <span className="row__meta">
            {Math.round(distanceMeters)} m · {t('walkMinutes', { n: mins })} · {t('tables', { n: terrace.tables })}
          </span>
        </span>
      </button>
      <a
        className="row__maps"
        href={googleMapsUrl({ name: terrace.name, address: terrace.address })}
        target="_blank" rel="noreferrer"
        aria-label={t('openInGoogleMaps')}
      >🗺️</a>
    </div>
  );
}
```

- [ ] **Step 2: `TerraceList.tsx`**

```tsx
// src/components/TerraceList.tsx
import { useMemo } from 'react';
import { useStore } from '../store/use-store.js';
import { sortTerracesByDistance } from '../lib/sort-terraces.js';
import TerraceListRow from './TerraceListRow.js';

type Props = { onSelectTerrace: (id: string) => void };

export default function TerraceList({ onSelectTerrace }: Props) {
  const terraces = useStore((s) => s.terraces);
  const states = useStore((s) => s.states);
  const userPos = useStore((s) => s.userPos);

  const sorted = useMemo(() => {
    if (!userPos) return [];
    return sortTerracesByDistance(terraces, userPos);
  }, [terraces, userPos]);

  // Filtra solo terrazze al sole.
  const sunny = sorted.filter((x) => states[x.terrace.id] === 'sun').slice(0, 200);

  if (!userPos) return null;
  return (
    <div className="list">
      {sunny.map(({ terrace, distanceMeters }) => (
        <TerraceListRow
          key={terrace.id}
          terrace={terrace}
          status={states[terrace.id] ?? 'pending'}
          distanceMeters={distanceMeters}
          onSelect={() => onSelectTerrace(terrace.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: CSS**

`src/styles/list.css`:
```css
.list { display: flex; flex-direction: column; gap: 6px; }
.row { display: flex; align-items: stretch; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.row__main { flex: 1; display: flex; gap: 12px; align-items: center; background: transparent; border: 0; padding: 6px 4px; text-align: left; cursor: pointer; }
.row__status { font-size: 22px; width: 32px; text-align: center; }
.row__text { display: flex; flex-direction: column; }
.row__name { font-size: 15px; font-weight: 600; color: #222; }
.row__meta { font-size: 12px; color: #666; }
.row__maps { display: flex; align-items: center; justify-content: center; min-width: 44px; height: 44px; text-decoration: none; font-size: 22px; }
```

- [ ] **Step 4: Importa `list.css` in `BottomSheet.tsx`** o in `global.css`. Aggiorna `global.css`:
```css
@import url('./list.css');
```

- [ ] **Step 5: Wiring in App**

Aggiungi `<BottomSheet>` con `<TerraceList>` dentro a `App.tsx`. Calcola il label tipo `"{N} terrazas al sol cerca de ti"`. Esempio:

```tsx
import BottomSheet from './components/BottomSheet.js';
import TerraceList from './components/TerraceList.js';
import { t } from './i18n/i18n.js';

// dentro App:
const sunnyCount = Object.values(states).filter((s) => s === 'sun').length;
// ...
<BottomSheet collapsedLabel={t('sunnyNearby', { count: sunnyCount })}>
  <TerraceList onSelectTerrace={setSelectedId} />
</BottomSheet>
```

Aggiungi `const [selectedId, setSelectedId] = useState<string | null>(null);` allo state di App.

- [ ] **Step 6: Smoke test**

`npm run dev`. Verifica che la bottom sheet appaia, la lista mostri le terrazze al sole ordinate per distanza, l'icona 🗺️ apra Google Maps.

- [ ] **Step 7: Commit**

```bash
git add src/components/TerraceList.tsx src/components/TerraceListRow.tsx src/styles/list.css src/styles/global.css src/App.tsx
git commit -m "feat(ui): bottom sheet con lista ordinata + Google Maps"
```

---

### Task 9: Componente `TerraceCard`

**Files:**
- Create: `src/components/TerraceCard.tsx`, `src/styles/card.css`

- [ ] **Step 1: Implementa**

```tsx
// src/components/TerraceCard.tsx
import { useStore } from '../store/use-store.js';
import { googleMapsUrl } from '../lib/google-maps.js';
import { walkingMinutes } from '../lib/walking-time.js';
import { haversineMeters } from '../lib/geometry.js';
import { sunnyUntil } from '../lib/sunny-until.js';
import { getSunPosition } from '../lib/sun.js';
import { isInSun } from '../lib/shadow-engine.js';
import { t } from '../i18n/i18n.js';
import type { BuildingIndex } from '../lib/building-index.js';
import '../styles/card.css';

type Props = {
  terraceId: string | null;
  buildingIndex: BuildingIndex | null;
  onClose: () => void;
};

export default function TerraceCard({ terraceId, buildingIndex, onClose }: Props) {
  const terraces = useStore((s) => s.terraces);
  const userPos = useStore((s) => s.userPos);
  const now = useStore((s) => s.now);
  const states = useStore((s) => s.states);

  if (!terraceId) return null;
  const t1 = terraces.find((x) => x.id === terraceId);
  if (!t1) return null;

  const status = states[t1.id] ?? 'pending';
  const dist = userPos ? haversineMeters(userPos.lat, userPos.lng, t1.lat, t1.lng) : null;

  let flip: Date | null = null;
  if (status === 'sun' && buildingIndex) {
    flip = sunnyUntil(now, t1.lat, t1.lng, (lat, lng, d) => {
      const sun = getSunPosition(d, lat, lng);
      if (sun.altitude <= 0) return false;
      return isInSun(lat, lng, sun, buildingIndex);
    });
  }

  return (
    <div className="card" role="dialog" aria-modal="true">
      <button className="card__close" onClick={onClose} aria-label="close">×</button>
      <h2 className="card__title">{t1.name || t1.address}</h2>
      <p className="card__address">{t1.address}</p>
      <p className={`card__status card__status--${status}`}>
        {status === 'sun' && '☀️'} {status === 'shade' && '🌫️'} {status === 'closed' && '🌙'} {t1.tables ? t('tables', { n: t1.tables }) : ''}
      </p>
      {flip && (
        <p className="card__until">
          {t('sunnyUntil', { time: flip.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
        </p>
      )}
      {dist != null && (
        <p className="card__walk">
          {Math.round(dist)} m · {t('walkMinutes', { n: walkingMinutes(dist) })}
        </p>
      )}
      <a
        className="card__cta"
        href={googleMapsUrl({ name: t1.name, address: t1.address })}
        target="_blank" rel="noreferrer"
      >{t('openInGoogleMaps')}</a>
    </div>
  );
}
```

- [ ] **Step 2: CSS**

`src/styles/card.css`:
```css
.card {
  position: absolute;
  left: 16px; right: 16px; bottom: 96px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 16px;
  z-index: 6;
}
.card__close { position: absolute; top: 8px; right: 8px; background: transparent; border: 0; font-size: 24px; cursor: pointer; padding: 4px 8px; }
.card__title { margin: 0 0 4px; font-size: 18px; }
.card__address { margin: 0 0 12px; color: #666; font-size: 13px; }
.card__status { margin: 6px 0; font-size: 15px; font-weight: 600; }
.card__status--sun { color: #b06b00; }
.card__status--shade { color: #244a78; }
.card__until { font-size: 14px; color: #b06b00; margin: 4px 0; }
.card__walk { font-size: 13px; color: #555; margin: 4px 0 12px; }
.card__cta {
  display: block; text-align: center;
  background: #f5a623; color: white; text-decoration: none;
  padding: 12px; border-radius: 12px; font-weight: 600;
}
```

- [ ] **Step 3: Wiring in App**

In `App.tsx` rendi `buildingIndex` accessibile (tienilo in uno state ref), passa a `<TerraceCard terraceId={selectedId} buildingIndex={index} onClose={() => setSelectedId(null)} />`.

- [ ] **Step 4: Tap sui marker apre la card**

Modifica `Markers.tsx` per aggiungere un listener click sul layer e propagare l'id selezionato (usa la store):
```tsx
// dentro l'useEffect, dopo addLayer:
map.on('click', layerId, (e) => {
  const f = e.features?.[0];
  if (!f) return;
  const id = (f.properties as { id: string }).id;
  useStore.setState((s) => ({ ...s, selectedId: id }));
  // NOTA: aggiungi selectedId allo store nel Task 10 sotto, e leggi da lì.
});
map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
```

- [ ] **Step 5: Commit**

```bash
git add src/components/TerraceCard.tsx src/styles/card.css src/components/Markers.tsx src/App.tsx
git commit -m "feat(ui): TerraceCard + tap-to-open"
```

---

### Task 10: Esponi `selectedId` nello store

**Files:**
- Modify: `src/store/use-store.ts`, `src/App.tsx`, `src/components/TerraceList.tsx`

- [ ] **Step 1: Estendi store**

In `use-store.ts` aggiungi:
```ts
selectedId: string | null;
setSelectedId: (id: string | null) => void;
```

Aggiungi i default e setter come per gli altri campi.

- [ ] **Step 2: Sostituisci useState locale**

In `App.tsx` rimuovi `const [selectedId, setSelectedId] = useState(...)`, usa lo store. Passa `selectedId` e `setSelectedId` a `<TerraceCard>` e `<TerraceList>`.

- [ ] **Step 3: Commit**

```bash
git add src/store/use-store.ts src/App.tsx src/components/TerraceList.tsx
git commit -m "refactor(store): selectedId centralizzato"
```

---

### Task 11: Pulsante "📍 la mia posizione"

**Files:**
- Create: `src/components/GeolocateButton.tsx`, `src/styles/geolocate.css`

- [ ] **Step 1: Componente**

```tsx
// src/components/GeolocateButton.tsx
import { useGeolocation } from '../lib/use-geolocation.js';
import { useStore } from '../store/use-store.js';
import type { Map as MLMap } from 'maplibre-gl';
import '../styles/geolocate.css';

type Props = { map: MLMap | null };

export default function GeolocateButton({ map }: Props) {
  const geo = useGeolocation(false);
  const userPos = useStore((s) => s.userPos);
  const onClick = () => {
    if (!map) return;
    if (userPos) map.flyTo({ center: [userPos.lng, userPos.lat], zoom: 15, duration: 400 });
    else {
      navigator.geolocation.getCurrentPosition((p) => {
        useStore.getState().setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15, duration: 400 });
      });
    }
  };
  return <button className="geolocate-btn" onClick={onClick} aria-label="locate me">📍</button>;
}
```

- [ ] **Step 2: CSS**

`src/styles/geolocate.css`:
```css
.geolocate-btn {
  position: absolute;
  right: 12px;
  bottom: calc(35% + 12px); /* sopra la bottom sheet collassata */
  width: 48px; height: 48px;
  border-radius: 50%;
  background: white;
  border: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.16);
  font-size: 22px;
  z-index: 3;
}
```

- [ ] **Step 3: Wiring + commit**

Aggiungi `<GeolocateButton map={map} />` in `App.tsx`.
```bash
git add src/components/GeolocateButton.tsx src/styles/geolocate.css src/App.tsx
git commit -m "feat(ui): pulsante geolocate"
```

---

### Task 12: Edge case — fuori da BCN / geoloc negata

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Banner**

Aggiungi un componente inline `<EdgeMessage>` (o un div condizionale in App.tsx) che mostra:
- Se `geo.status === 'denied'`: messaggio `t('geoDenied')` + comunque mappa centrata su BCN
- Se utente è geolocalizzato MA fuori dal bbox BCN: messaggio `t('outsideBcn')`

Esempio:
```tsx
{geo.status === 'denied' && (
  <div className="edge-banner">{t('geoDenied')}</div>
)}
{geo.status === 'ok' && (geo.lng < 2.0 || geo.lng > 2.3 || geo.lat < 41.3 || geo.lat > 41.5) && (
  <div className="edge-banner">{t('outsideBcn')}</div>
)}
```

CSS minimale in `global.css`:
```css
.edge-banner {
  position: absolute; top: 72px; left: 16px; right: 16px;
  background: #fffbe6; border: 1px solid #f5a623;
  padding: 10px 12px; border-radius: 10px;
  font-size: 13px; color: #6b3a00;
  z-index: 7;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx src/styles/global.css
git commit -m "feat(ux): banner per geoloc denied / fuori BCN"
```

---

### Task 13: Pannello crediti / attribuzione

**Files:**
- Create: `src/components/CreditsButton.tsx`, `src/styles/credits.css`

- [ ] **Step 1: Componente**

```tsx
// src/components/CreditsButton.tsx
import { useState } from 'react';
import { t } from '../i18n/i18n.js';
import '../styles/credits.css';

export default function CreditsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="credits-btn" onClick={() => setOpen(true)} aria-label="credits">i</button>
      {open && (
        <div className="credits-modal" role="dialog">
          <button className="credits-modal__close" onClick={() => setOpen(false)}>×</button>
          <h3>Crediti</h3>
          <p>{t('credits')}</p>
          <p>OSM © OpenStreetMap contributors (ODbL).<br/>Open Data BCN — CC-BY-4.0.</p>
          <p style={{ fontSize: 12, color: '#888' }}>Tiles: OpenFreeMap (libera). Calcolo sole: suncalc (BSD).</p>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: CSS**

`src/styles/credits.css`:
```css
.credits-btn {
  position: absolute; right: 12px; top: calc(env(safe-area-inset-top, 0px) + 64px);
  width: 32px; height: 32px; border-radius: 50%;
  background: white; border: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  font-style: italic; font-weight: 700;
  z-index: 3;
}
.credits-modal {
  position: absolute; left: 16px; right: 16px; top: 80px;
  background: white; border-radius: 14px;
  padding: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  z-index: 8;
}
.credits-modal__close { position: absolute; top: 6px; right: 8px; background: transparent; border: 0; font-size: 22px; }
```

- [ ] **Step 3: Wiring + commit**

```bash
git add src/components/CreditsButton.tsx src/styles/credits.css src/App.tsx
git commit -m "feat(ux): pannello crediti CC-BY"
```

---

### Task 14: Icone PWA finali

**Files:**
- Replace: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`

- [ ] **Step 1: Crea icone semplici ma brandate**

Suggerimento: sfondo `#f5a623` + emoji ☀️ centrale (o iniziali "TS"). Strumenti consigliati: https://realfavicongenerator.net oppure ImageMagick:
```bash
convert -size 512x512 xc:'#f5a623' -gravity center -pointsize 320 -fill white -annotate 0 '☀' public/icons/icon-512.png
convert public/icons/icon-512.png -resize 192x192 public/icons/icon-192.png
cp public/icons/icon-512.png public/icons/icon-512-maskable.png
```

- [ ] **Step 2: Aggiorna `vite.config.ts`** manifest se nomi differenti.

- [ ] **Step 3: Commit**

```bash
git add public/icons vite.config.ts
git commit -m "chore(pwa): icone finali"
```

---

### Task 15: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README — istruzioni per abilitare Pages**

Aggiungi al README:
```markdown
## Deploy

Su GitHub, repo Settings → Pages → Source = "GitHub Actions". Al primo push su `main`, il workflow `deploy-pages.yml` pubblica l'app.

URL: `https://<utente>.github.io/<repo>/`.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-pages.yml README.md
git commit -m "ci: deploy automatico su GitHub Pages"
```

---

### Task 16: Lighthouse audit + fix top 3 issues

- [ ] **Step 1: Build di produzione**

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

- [ ] **Step 2: Lighthouse**

Apri Chrome DevTools → Lighthouse → Mobile → Performance + Accessibility + PWA. Genera report.

- [ ] **Step 3: Fix top 3**

Tipiche correzioni:
- Aggiungi `<meta name="description" content="...">` in `index.html`
- Aggiungi `<html lang="es">` (già presente — verifica)
- Aggiungi `aria-label` ai pulsanti senza testo
- Lazy-loading o riduzione bundle se Performance < 80

- [ ] **Step 4: Commit**

```bash
git add -p
git commit -m "perf(lighthouse): fix top 3 issue (a11y, meta)"
```

---

### Task 17: QA manuale mobile finale

- [ ] **Step 1: Apri preview su viewport iPhone 12 (390×844) e iPhone SE (375×667)**

Verifica:
- [ ] Mappa renderizza
- [ ] Marker colorati immediatamente al caricamento
- [ ] Slider orario funzionante (i marker cambiano colore)
- [ ] Bottom sheet trascinabile + lista ordinata
- [ ] Icona 🗺️ apre Google Maps (o l'app se installata)
- [ ] Tap su marker → card; CTA "Apri su Google Maps" funziona
- [ ] Geolocate button centra la mappa
- [ ] Crediti accessibili
- [ ] Niente errori console

Se trovi bug bloccanti, fixali ora e committa.

---

### Task FINAL: Verifica deploy live + graphiti

- [ ] **Step 1: Push e attendi il workflow**

```bash
git push origin main
```

Vai su GitHub Actions, attendi che `Deploy to GitHub Pages` finisca con success.

- [ ] **Step 2: Apri l'URL live e installa come PWA**

Apri `https://<utente>.github.io/<repo>/` su un iPhone reale (o emulatore Safari). Verifica:
- Mappa, markers, slider, bottom sheet, card, geolocate
- Safari → Condividi → "Aggiungi a Home" → l'icona appare sulla home, apre in standalone

- [ ] **Step 3: Aggiorna graphiti**

Chiama `mcp__graphiti-memory__add_memory` con:
- `group_id`: `"mappa-delle-terrazze-al-sole"`
- `name`: `"Session 3 completata - MVP in produzione"`
- `source`: `"text"`
- `episode_body`: in italiano:
  - URL live (`https://...`)
  - Funzionalità deployate (lista breve)
  - Lighthouse score finale
  - Eventuali problemi conosciuti / TODO per future iterazioni
  - Stato git: commit hash, branch
  - Riferimento a spec + plan + sessioni precedenti

- [ ] **Step 4: Commit finale e messaggio all'utente**

Stampa in chat (in italiano):
> MVP completato e in produzione su `<URL>`. Installabile come icona su iPhone via "Aggiungi a Home". Tutte e 3 le sessioni completate. Funzionalità: mappa colorata, lista ordinata, slider orario, scheda con Google Maps. Memoria graphiti aggiornata con stato finale.

---

## Auto-review finale (prima del Task FINAL)
- [ ] `npm test` passa al 100%
- [ ] `npm run build` produce `dist/` senza errori né warning
- [ ] Working tree pulito
- [ ] Anteprima locale (`npm run preview`) testata su mobile viewport: tutte le 7 verifiche del Task 17 passano
- [ ] Nessun `any`, nessun `// @ts-ignore`, nessun `TODO`
