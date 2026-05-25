# CLAUDE.md — Mappa delle terrazze al sole

PWA mobile-first che mostra in tempo reale quali terrazze di Barcellona sono al sole.

- **Città coperte:** Barcellona, Madrid (multi-città dal 2026-05-25)
- **Stack:** Vite 8 + React 19 + TypeScript + MapLibre 5 + suncalc + RBush + Zustand + vite-plugin-pwa
- **Hosting:** Vercel (primario) + GitHub Pages (fallback)
- **URL live:** https://mappa-terrazze-sole.vercel.app
- **URL fallback:** https://giacogiaco97.github.io/mappa-terrazze-sole/
- **Repo:** https://github.com/giacogiaco97/mappa-terrazze-sole
- **Vercel project:** `giacomos-projects-75b856d8/mappa-terrazze-sole` (auto-deploy collegato a `main`)
- **Group ID graphiti:** `mappa-delle-terrazze-al-sole`

## Storia

- **Session 1** (2026-05-23) — Data Foundation: pipeline dati (CSV terrazze BCN, Overpass edifici, risolutore altezze, partizionamento spaziale), libreria funzioni pure (geometry, sun, shadow-engine).
- **Session 2** (2026-05-23) — PWA Core: shell Vite+React+TS, basemap MapLibre + OpenFreeMap, geolocation, data-loader, markers colorati, store Zustand, PWA (manifest + service worker).
- **Session 3** (2026-05-23) — UX & Deploy: BottomSheet trascinabile, lista terrazze ordinata per distanza, TimeSlider con tramonto, TerraceCard con "sunny until" + Google Maps, GeolocateButton, banner edge case (geoloc denied / fuori BCN), CreditsButton CC-BY, icone PWA brandate, deploy live su GitHub Pages.
- **Hotfix POI** (2026-05-23) — Arricchimento nomi commerciali via OSM POI (Overpass). Da 0% a 68% copertura nomi locali. Vedi `scripts/fetch-osm-pois.ts` + `scripts/lib/match-pois.ts`.
- **Hotfix Lighthouse/a11y/perf** (2026-05-23) — Mobile A11y 96→100, BP 96→100. Code-splitting MapLibre tentato e revertato (peggiorava LCP). Geolocation gated da permissions.query. requestIdleCallback per computeAllStates.
- **Audit completo** (2026-05-23) — Fix 24 voci da `docs/audit-2026-05-23.md`: split useEffect (slider lag), modali Escape, cluster marker, deep-link `?id=`, ricerca+filtri, dark mode, infinite scroll, onboarding, compressione dati, SW update prompt, ErrorBoundary, catalano i18n, CSP meta, pipeline validation.
- **Hardening finale** (2026-05-23) — Coverage v8 (94% statements), confidence ombra (high/medium/low basato su heightSource), PWA screenshots (mobile+desktop), focus trap completo nei modali, analytics Plausible opzionale (env var), E2E Playwright (6 test smoke).
- **Redesign TerraceCard** (2026-05-23) — Card ridisegnata mobile-first ispirata ai competitor (jveuxdusoleil.fr) ma più moderna. Nuovo lib `sun-timeline` (TDD) che pre-calcola 24h di stati sole/ombra/notte; nuovo componente `SunTimeline` (SVG con gradient sole + marker tempo corrente). Card ora mostra: pill stato con tinta gradient, neighborhood inline, badge "% del día · h" calcolato, timeline bar 24h con tick 0h/6h/12h/18h/24h, stats grid (tavoli/sedie, m², distanza+walking) con `:has()` adattivo 1-3 colonne, confidence pill esistente, 2 CTA (Google Maps + Street View). Aggiunto `streetViewUrl(lat,lng)` in `google-maps.ts`. Runtime `terraces.json` espanso con `chairs` e `surfaceSqM` (era omesso prima, +170KB / +7KB gzip). 11 nuove chiavi i18n in ES/EN/CA. Bundle: 1.26MB / 347KB gzip.
- **Fix "tutto il giorno all'ombra"** (2026-05-24) — `src/lib/shadow-engine.ts`: bug massivo scoperto a partire da Café Turó. Il check `pointInPolygon → return false` trasformava ogni terrazza il cui POI cade DENTRO il footprint del proprio palazzo in "ombra perpetua". Causa: il dataset Open Data BCN usa la coordinata dell'ingresso del locale, che geometricamente sta dentro il muro dell'edificio. Sostituito `return false` con `continue`: se il punto è dentro un footprint, ignoriamo quell'edificio nel raycast (assumiamo terrazza sul marciapiede esterno); gli altri palazzi continuano a bloccare. Verifica reale Café Turó (T-416): da 0%/0h a 97% del día/14h al sole. 3 test TDD aggiunti in `shadow-engine.test.ts` (incluso non-regressione: palazzo dirimpetto più alto resta ombra). 85/85 test verdi. Bonus: raggio match POI 50m → 70m → copertura nomi 68% → 72%.
- **Branding icone PWA** (2026-05-24) — Sostituite le icone procedurali (sole bianco su arancio) con illustrazione cartoon brandizzata (`public/icons/source.png` 1024×1024). `scripts/generate-icons.mjs` riscritto con sharp + png-to-ico: genera icon-192/-512/-512-maskable.png (PWA), apple-touch-icon.png (180), favicon-32/-16.png, favicon.ico (16/32/48 multi-size). `index.html` con link separati per ogni dimensione.
- **TimeSlider 24h del giorno selezionato** (2026-05-24) — Prima: slider 3h fa → 7gg avanti (overflow accidentale di giorno). Ora: slider 0..1425 min (00:00→23:45) relativo al giorno scelto dal day picker. `onChange` preserva la data del `now` e cambia solo HH:MM. Sunrise/sunset usano il giorno selezionato.
- **Google Places enrichment** (2026-05-24) — Per chiudere il gap 28% di terrazze BCN senza nome (es. Café Turó, mancante in OSM), aggiunto `scripts/fetch-google-places.ts` (Places API v1 `searchNearby` raggio 30m). Salva (placeId, name, lat, lng) in `data-raw/google-places.raw.json` con resume da cache. `build-output.ts` lo integra come fallback DOPO il match OSM (priorità OSM). `placeId` opzionale nel runtime; `googleMapsUrl()` lo usa per generare link pixel-perfect (`query_place_id=`) alla scheda Google. Soft-skip se la `GOOGLE_PLACES_API_KEY` manca. Workflow GitHub Actions con secret `GOOGLE_PLACES_API_KEY`. 87/87 test verdi.
- **UX overhaul mobile + desktop** (2026-05-25) — Test end-to-end via Playwright (mobile 390×844 + desktop 1440×900). Identificate 13 criticità UX e applicate in 3 PR concatenate.
  - **PR1 — backdrop card coerente** (`46d1d72`): TerraceCard wrappata in `.card-backdrop[data-modal-backdrop]` con `rgba(0,0,0,0.45)` + `blur(4px)` → risolve la "parte di background in confusione" che restava visibile dietro la card. Stesso pattern delle modali Crediti/Onboarding. z-index riordinato (backdrop=12, card=13) sopra TomorrowBanner (9) e edge-banner (7). Click su backdrop chiude via useModalDismiss; cardRef passato all'hook per attivare il focus trap. Mobile: card slide-up dal basso. Desktop ≥768px: card 420px centrata.
  - **PR2 — layout desktop sidebar** (`4b19f4d`): media query `≥1024px` su `bottom-sheet.css`, `time-slider.css`, `card.css`, `global.css`, `tomorrow-banner.css`. BottomSheet diventa sidebar laterale sinistra fissa 380×100% (non più full-width). TimeSlider centrato sopra alla mappa (max-width 760px, offset left=380px) con border-radius e shadow. Backdrop card esclude la sidebar (`left: 380px`) → resta interattiva mentre la card è aperta. Edge-banner spostato a destra (`left: 396px, max-width 520px`). TomorrowBanner ricentrato sulla zona-mappa. Nessun cambio React, solo CSS.
  - **PR3 — micro-fix UX** (`b398cdb`): tap target HIG/WCAG 2.5.5 (Credits 32→44, Zoom MapLibre 29→38, Tomorrow close 28→36, Back-to-now h 28→36). Handle BottomSheet contestuale: `sunnyInCity` quando manca posizione, `sunnyNearby` con posizione (era sempre "cerca de ti" → fuorviante). Empty state lista attivo con CTA inline "Limpiar filtros" che resetta search + minTables + showShade. Banner edge & TomorrowBanner si nascondono quando `selectedId != null`. Edge banner si nasconde anche se `userPos` è disponibile (lo status hook restava 'denied' anche dopo attivazione via CTA → mismatch corretto). 2 nuove i18n keys (sunnyInCity, listEmptyResetHint) per ES/EN/CA.
  - 87/87 test verdi su tutte e 3 le PR. Nessuna feature toccata: solo presentazione, posizionamento, hide/show logic e dimensioni tap target.
- **Cluster + drawer mobile (round 2)** (2026-05-25) — Feedback utente post-deploy: cluster troppo tenaci e lista bottom in confusione.
  - **PR4 — cluster meno aggressivo** (`432f75e`): `src/components/Markers.tsx`. clusterRadius 28→16 (aggrega solo veri overlap, non più locali su lati opposti della via). clusterMaxZoom 17→14 (a zoom 15+ marker singoli garantiti). Click cluster: zoom = max(expansionZoom + 0.5, currentZoom + 2) capped a 19, per spaccare la bolla in un singolo click (era +0.5 dal solo expansion zoom → spesso insufficiente).
  - **PR5 — drawer laterale mobile + FAB** (`ce030db`): mobile <1024px → BottomSheet diventa drawer slide-from-left (width min(360,92vw), full-height) controllato da prop `open`. Nuovo `SheetFab` (pillola brand "☀️ N" centrata in basso) che apre il drawer al tap, si nasconde quando drawer aperto o card selezionata. Backdrop scuro rgba(0,0,0,0.40) + blur(3px), click+ESC chiudono. Selezione terrazza dalla lista chiude il drawer per non sovrapporsi alla card. TomorrowBanner si nasconde quando il drawer è aperto. Desktop ≥1024px invariato: sidebar sempre visibile (transform:none !important neutralizza il drawer slide), FAB display:none. BottomSheet retro-compatibile (prop `open` opzionale).
- **Multi-città (Fase 4 inizio)** (2026-05-25) — Prima città extra oltre Barcellona: Madrid. PR6 (`8dab4a6`).
  - **Dataset Madrid**: 6397 terrazze da Open Data Madrid "Censo de locales y sus actividades. Terrazas" (dataset id 200085-6, license CC BY 4.0). 100% nomi commerciali via campo `rotulo`. 119671 edifici OSM bbox 40.33-40.54 / -3.80--3.55 (centro + barrios principali). Heights: 443 osm + 20558 levels + 98670 default.
  - **UTM → WGS84**: nuova lib `scripts/lib/utm-to-wgs84.ts` (zona 30N, formula USGS, zero deps), 4 test TDD. Madrid usa coordinate UTM ETRS89 30N (X,Y in metri).
  - **Pipeline parametrica**: env var `CITY=bcn|mad` su tutti gli script (fetch-buildings, fetch-osm-pois, fetch-google-places, resolve-heights, build-output). File raw rinominati con suffisso `-{city}`. Nuovi npm scripts: `pipeline:bcn`, `pipeline:mad`, `pipeline:run`.
  - **Refactor public/data**: ora `public/data/{city}/{terraces,meta,buildings/*.json}` invece di root. Nuovo `public/data/cities.json` come indice (mantenuto/aggiornato da build-output durante merge multi-città).
  - **Front-end multi-città**: store con `currentCity` persisted in localStorage (`mts.currentCity`), `cities` indice. `data-loader.ts` parametri `city` su tutte le fetch. App.tsx carica/ricarica dati al cambio città, flyTo al centro, fetch weather sul centro corrente, cache edifici svuotata al cambio.
  - **CityPicker** (`src/components/CityPicker.tsx` + `city-picker.css`): dropdown pillola top-left con icona 🌆 + select tra città disponibili. Hidden se solo 1 città. Su desktop sta sopra alla sidebar.
  - **i18n contestuale**: `outsideBcn` → `outsideCity` con placeholder `{city}`. `sunnyInCity` con `{city}`. Nuovi `cityPickerLabel`. ES/EN/CA.
  - **Output**: 91/91 test (87 + 4 UTM). Bundle 1.27MB / 352KB gzip. +34MB dati Madrid (totale 63MB statici, ok per Vercel).
  - Google Places NON eseguito per Madrid (i nomi sono già 100% da dataset, serve solo per link Google Maps pixel-perfect). Lanciare manualmente con `CITY=mad npm run pipeline:google` (~$200 una tantum).

## Layout file

- `src/lib/` — funzioni pure (TDD obbligatorio). Geometria, sun, shadow engine, helper (google-maps, walking-time, sunny-until, sort-terraces, use-modal-dismiss, use-url-sync).
- `src/components/` — UI React. MapView, Markers (cluster), TimeSlider, BottomSheet, TerraceList(+Row, con ricerca/filtri/infinite scroll), TerraceCard, GeolocateButton, CreditsButton (+ theme toggle), Onboarding, UpdatePrompt, ErrorBoundary.
- `src/store/use-store.ts` — Zustand. State: now, userPos, terraces, states, selectedId, buildingIndex, search, minTables, showShade, theme.
- `src/i18n/` — ES + EN + CA, helper `t(key, vars)` con fallback ES.
- `src/styles/` — CSS per componente con CSS variables tema light/dark.
- `scripts/` — pipeline Node (TS via tsx) + generate-icons.mjs.
- `public/data/` — terraces.json, meta.json, buildings/{x}_{y}.json (output pipeline).
- `.github/workflows/` — data-pipeline (cron mensile) + deploy-pages (push su main).
- `docs/superpowers/` — spec + plan per ogni sessione.

## Comandi utili

```bash
npm run dev               # dev server su :5180 (strictPort)
npm test                  # vitest run (65 test attualmente)
npm run test:coverage     # vitest + coverage v8 (HTML in coverage/)
npm run test:e2e          # playwright smoke test (6 test, Chromium mobile)
npm run build             # build prod in dist/
npm run preview           # serve dist/
npm run pipeline:run      # rigenera tutti i dati (terraces + buildings + heights + pois + build)
```

## Convenzioni

- TDD per ogni funzione pura in `src/lib/`.
- Niente `any`, niente `// @ts-ignore`.
- Commit in italiano, formato `tipo(scope): descrizione`.
- Verifica visiva mobile a 390×844 / 375×667.
- Spec design: `docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md`.

## Gotcha

- Dataset BCN non ha il nome commerciale → arricchimento via OSM POI in pipeline (`scripts/fetch-osm-pois.ts` + `scripts/lib/match-pois.ts`). Copertura ~68% delle terrazze (raggio 50m, include amenity/shop/tourism).
- **App.tsx ha 2 useEffect separati** per i dati: (a) carica una volta `terraces+buildingIndex` quando `map` cambia. (b) Ricomputa `states` quando `now/terraces/buildingIndex` cambiano. Crucial: senza questo split lo slider orario aveva lag 1-2s perché rifaceva loadTerraces+buildBuildingIndex a ogni cambio `now`.
- Markers usa cluster MapLibre nativo (`cluster: true, clusterRadius: 28, clusterMaxZoom: 17`). Cluster colorato arancio se contiene almeno 1 sunny. Click cluster → easeTo expansion zoom.
- Deep-link condivisibile: `?id=T-1234` apre direttamente la card. Hook `useUrlSync` aggiorna URL via replaceState al cambio `selectedId`. Anche `?action=locate` per PWA shortcut.
- Dark mode: CSS variables `:root` + `:root[data-theme='dark']` + `@media (prefers-color-scheme: dark)`. Toggle 3-stati nel modal crediti (auto → light → dark). Bootstrap in `main.tsx` per evitare FOUC.
- Service worker registerType: `'prompt'` (non più autoUpdate silente). Quando installa nuova versione, `UpdatePrompt` toast con CTA → skipWaiting + reload.
- CSP meta tag in `index.html`: limita origini a self + tiles.openfreemap.org. `frame-ancestors 'none'` previene clickjacking.
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
- `SunTimeline.tsx` usa `useId()` per generare ID gradient unico per istanza — evita collisioni se ci fossero più timeline in pagina. Il gradient `<linearGradient>` usa `gradientUnits="userSpaceOnUse"` con `x2={VIEW_W}` così va da giallo→arancio lungo TUTTA la giornata (mattina gialla, sera arancio).
- `computeSunTimeline` parte sempre da mezzanotte locale del `reference` (con `setHours(0,0,0,0)`), itera 24h a step 15min (96 sample). Per la card è ~96 raycast sun×building → ~1ms per terrazza. `useMemo` con dep `[t1, buildingIndex, now]` evita ricomputo a ogni render.
- Pattern dark-mode CSS: per ogni override scuro servono DUE regole separate — `:root[data-theme='dark']` (toggle forzato) E `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` (auto-dark che rispetta override `light`). Non combinarle in una sola comma-separated selector list senza @media: la regola `:root:not([data-theme='light'])` matcha SEMPRE quando l'attributo non è impostato (anche in light mode prefers-color-scheme), e sovrascrive lo stile chiaro. Fix applicato in `card.css` per pill/confidence.
- E2E test #2 e #3 (`slider orario aggiorna stati` e `ricerca filtra la lista`) sono flake tempo-dipendenti: usano regex `/[1-9]\d* terrazas al sol/` come proxy "dati caricati", ma dopo il tramonto il count è 0. Lo `slider.fill('360')` (=6h ahead) non li recupera perché 21:30 + 6h = 03:30, ancora notte. Sono pre-esistenti, non causati dal redesign card; il test che esercita la card (`deep-link ?id=`) passa.

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
