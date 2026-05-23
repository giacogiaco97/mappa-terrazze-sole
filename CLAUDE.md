# CLAUDE.md — Mappa delle terrazze al sole

PWA mobile-first che mostra in tempo reale quali terrazze di Barcellona sono al sole.

- **Lancio:** Barcellona (estendibile multi-città in Fase 4)
- **Stack:** Vite 8 + React 19 + TypeScript + MapLibre 5 + suncalc + RBush + Zustand + vite-plugin-pwa
- **Hosting:** GitHub Pages (statico, gratuito)
- **URL live:** https://giacogiaco97.github.io/mappa-terrazze-sole/
- **Repo:** https://github.com/giacogiaco97/mappa-terrazze-sole
- **Group ID graphiti:** `mappa-delle-terrazze-al-sole`

## Storia

- **Session 1** (2026-05-23) — Data Foundation: pipeline dati (CSV terrazze BCN, Overpass edifici, risolutore altezze, partizionamento spaziale), libreria funzioni pure (geometry, sun, shadow-engine).
- **Session 2** (2026-05-23) — PWA Core: shell Vite+React+TS, basemap MapLibre + OpenFreeMap, geolocation, data-loader, markers colorati, store Zustand, PWA (manifest + service worker).
- **Session 3** (2026-05-23) — UX & Deploy: BottomSheet trascinabile, lista terrazze ordinata per distanza, TimeSlider con tramonto, TerraceCard con "sunny until" + Google Maps, GeolocateButton, banner edge case (geoloc denied / fuori BCN), CreditsButton CC-BY, icone PWA brandate, deploy live su GitHub Pages.

## Layout file

- `src/lib/` — funzioni pure (TDD obbligatorio). Geometria, sun, shadow engine, helper (google-maps, walking-time, sunny-until, sort-terraces).
- `src/components/` — UI React. MapView, Markers, TimeSlider, BottomSheet, TerraceList(+Row), TerraceCard, GeolocateButton, CreditsButton.
- `src/store/use-store.ts` — Zustand. State: now, userPos, terraces, states, selectedId, buildingIndex.
- `src/i18n/` — ES + EN, helper `t(key, vars)`.
- `src/styles/` — CSS per componente.
- `scripts/` — pipeline Node (TS via tsx) + generate-icons.mjs.
- `public/data/` — terraces.json, meta.json, buildings/{x}_{y}.json (output pipeline).
- `.github/workflows/` — data-pipeline (cron mensile) + deploy-pages (push su main).
- `docs/superpowers/` — spec + plan per ogni sessione.

## Comandi utili

```bash
npm run dev               # dev server su :5180 (strictPort)
npm test                  # vitest run (51 test attualmente)
npm run build             # build prod in dist/
npm run preview           # serve dist/
npm run pipeline:run      # rigenera tutti i dati (terraces + buildings + heights + chunks)
```

## Convenzioni

- TDD per ogni funzione pura in `src/lib/`.
- Niente `any`, niente `// @ts-ignore`.
- Commit in italiano, formato `tipo(scope): descrizione`.
- Verifica visiva mobile a 390×844 / 375×667.
- Spec design: `docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md`.

## Gotcha

- Dataset BCN non ha il nome commerciale del locale → `Terrace.name === Terrace.address`. La card mostra l'indirizzo come titolo.
- `map.on('load')` / `map.once('idle')` non sono affidabili in ambienti headless (Playwright preview) e con tile lenti. App.tsx esegue `run()` immediatamente dopo `setMap`; Markers attende `isStyleLoaded()` o `map.once('load')` come fallback.
- `vite.config.ts` ha `base: './'` per supportare GitHub Pages sotto `/repo/`.
- `vite.config.ts` ha `server.port=5180 strictPort` per evitare conflitti con altri progetti.
- Bundle JS attuale ~1.24 MB (340 KB gzip): MapLibre è il pezzo grosso. Code-splitting da valutare in Fase 2.
- Per ripushare workflow su questo repo serve `gh auth refresh -h github.com -s workflow` (il primo push iniziale è stato fatto rimuovendoli temporaneamente).

## Decisioni architetturali

- **Calcolo sole/ombra interamente client-side** — zero server, costo €0.
- **Pipeline statica via GitHub Actions** (cron mensile) — i dati cambiano lentamente, non serve runtime fetch.
- **OpenFreeMap come tile provider** — libera, niente API key. Cache via service worker.
- **Coordinate del dataset = ingresso del locale**, non poligono esatto della terrazza → errore di pochi metri trascurabile per il calcolo del sole.
- **i18n con file JSON statici + helper `t()` autodetect** — niente i18next, evitiamo dipendenza pesante.
- **selectedId nello store** (non props drilling) — la card è invocata da marker click (Markers.tsx) e da row click (TerraceList).

## Prossimi step (Fase 2 / Fase 3)

- Stato "parziale" multi-campione + indicatore di confidenza
- Riempimento altezze edifici con GlobalBuildingAtlas
- Offline completo via Protomaps PMTiles
- Lingua catalana
- Code-splitting MapLibre per ridurre il bundle initial
- Estensione multi-città
