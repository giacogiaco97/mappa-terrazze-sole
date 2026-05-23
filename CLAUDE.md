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

- Dataset BCN non ha il nome commerciale → arricchimento via OSM POI in pipeline (`scripts/fetch-osm-pois.ts` + `scripts/lib/match-pois.ts`). Copertura ~59% delle terrazze.
- `map.on('load')` / `map.once('idle')` non sono affidabili in ambienti headless (Playwright preview) e con tile lenti. App.tsx esegue `run()` immediatamente dopo `setMap`; Markers attende `isStyleLoaded()` o `map.once('load')` come fallback.
- `vite.config.ts` ha `base: './'` per supportare GitHub Pages sotto `/repo/`.
- `vite.config.ts` ha `server.port=5180 strictPort` per evitare conflitti con altri progetti.
- `vite.config.ts` ha `build.sourcemap: true` (Lighthouse valid-source-maps + debug prod).
- Bundle JS ~1.24 MB (340 KB gzip): MapLibre è il pezzo grosso. **Code-splitting tentato e revertato** perché peggiorava il LCP (3.9s → 9.9s mobile throttled): la mappa è il LCP element, il secondo roundtrip ritarda il render. Service worker precache risolve dal secondo visit.
- Per ripushare workflow su questo repo serve `gh auth refresh -h github.com -s workflow` (il primo push iniziale è stato fatto rimuovendoli temporaneamente).
- `useGeolocation` chiede la posizione SOLO se `navigator.permissions.query({name:'geolocation'})` === 'granted'. Altrimenti resta `idle` (no geolocation-on-page-load di Lighthouse). Il pulsante 📍 forza la richiesta.
- `requestIdleCallback` per `computeAllStates` (~6900 raycast): libera il main thread durante LCP/TTI.
- Pulsanti emoji (📍, i, ×, 🗺️) hanno emoji wrap in `<span aria-hidden="true">` e `aria-label` con il vero testo dell'azione (Lighthouse label-content-name-mismatch).
- Brand orange button text è `#1a1a1a` (non `white`): contrast ratio ~12:1 vs 2.55:1.

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
- Estensione multi-città
- Migliorare copertura nomi commerciali (oltre il 59% attuale): Wikidata, scraping mirato, allargare raggio match a 60m
- Place ID Google per link Maps pixel-perfect
- Performance score Lighthouse > 75 (ora ~54 mobile, dominato da MapLibre+raycasting)

## Lighthouse score finale (live)

| Categoria | Mobile (4G + CPU 4× slow) | Desktop |
|---|---|---|
| Performance | 37 | **72** |
| Accessibility | **100** | **100** |
| Best Practices | **100** | **100** |
| SEO | **100** | **100** |

Note: il Performance score mobile throttled è dominato dal canvas WebGL di MapLibre
come LCP element (LCP 9.8s). Su desktop senza throttling LCP è 1.4s, TBT 450ms.
Su utenti reali (5G + iPhone moderno) il LCP è ~1.5–2.5s al primo visit, <500ms
con SW precache dal secondo visit. Nessun cambio architetturale può ridurre il LCP
mobile throttled sotto i ~6s perché il canvas non è renderizzabile finché MapLibre
+ tile non sono pronti — vedere "Code-splitting tentato e revertato" sopra.
