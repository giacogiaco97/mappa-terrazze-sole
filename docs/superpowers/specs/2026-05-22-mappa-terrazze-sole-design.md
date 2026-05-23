# Mappa delle terrazze al sole — Documento di Design

**Data:** 2026-05-22
**Stato:** In revisione
**Origine:** sessione di brainstorming + ricerca con 3 agenti (reverse engineering competitor, fonti dati, calcolo sole/ombra)

---

## 1. Sommario

Webapp **mobile-first** (PWA installabile come icona su iPhone) che mostra **in tempo reale quali terrazze di bar/ristoranti sono al sole**. L'utente apre l'app, viene geolocalizzato, e vede la mappa della propria città con tutte le terrazze colorate per stato (sole / ombra) più una lista ordinata per distanza.

Lancio su **Barcellona**. Costo di esercizio: **zero** — tutto statico, calcolo interamente sul dispositivo, nessuna API a pagamento, nessun server.

---

## 2. Obiettivi e non-obiettivi

### Obiettivi
- Rispondere entro pochi secondi dall'apertura: «quali terrazze al sole ho vicino, adesso?»
- Calcolo **accurato**: ombre reali degli edifici, non solo «il sole è alto»
- Mobile-first, installabile come icona, funzionante offline dopo il primo uso
- Costo di infrastruttura: 0 €
- Architettura estendibile ad altre città

### Non-obiettivi (YAGNI)
- Nessun account utente, login o profilo
- Nessun backend / server a runtime
- Nessuna recensione, prenotazione o dato di affollamento
- Nessuna notifica push (limitata su iOS PWA, non necessaria)
- Multi-città fuori dall'MVP (architettura predisposta, ma si parte solo da Barcellona)

---

## 3. Decisioni prese (brainstorming 2026-05-22)

| Tema | Decisione |
|---|---|
| Scope MVP | Mappa + lista ordinata + slider orario |
| Accuratezza | Calcolo ombre edificio-per-edificio fin dalla v1 |
| Hosting | GitHub Pages (statico, gratuito); refresh dati via GitHub Actions |

---

## 4. Architettura

Due componenti **disaccoppiati**:

### 4.1 Pipeline dati (build-time)
Script Node che girano periodicamente (GitHub Actions, ~1×/mese + trigger manuale). Producono file statici ottimizzati consumati dall'app. **Non girano a runtime** — nessun utente attende mai una chiamata a Overpass o all'Open Data.

### 4.2 PWA (runtime, client-side)
Applicazione React statica servita da GitHub Pages. Tutto il calcolo (posizione del sole, ombre) avviene **sul dispositivo dell'utente**. Nessuna chiamata a server proprietari; le uniche richieste di rete sono i file statici dell'app e i tile della mappa.

```
[Open Data BCN]  [OSM Overpass]  [GlobalBuildingAtlas]
       \              |               /
        \             |              /
        v             v             v
   ============ PIPELINE DATI (GitHub Actions) ============
        |                                    |
        v                                    v
   terraces.json                    buildings/{x}_{y}.json
        \                                    /
         \                                  /
          v          PWA (browser)         v
   data-loader -> sun -> shadow-engine -> markers + bottom-sheet
                          ^
                          |
                     time-slider
```

---

## 5. Fonti dati

### 5.1 Terrazze — Open Data Barcelona
- **Dataset:** `terrasses-comercos-vigents` (*Autoritzacions de terrasses a l'espai d'ús públic*)
- **Landing:** https://opendata-ajuntament.barcelona.cat/data/ca/dataset/terrasses-comercos-vigents
- **API CKAN (senza token):** `.../data/api/3/action/package_show?id=terrasses-comercos-vigents`
- **Formato:** CSV; ~6.900 record
- **Campi utili:** latitudine/longitudine WGS84, indirizzo, quartiere, n° tavoli, n° sedie, superficie m²
- **Licenza:** CC-BY-4.0 (uso commerciale consentito, con attribuzione)
- **Aggiornamento:** semestrale

### 5.2 Edifici (footprint + altezze) — OpenStreetMap
- Via **Overpass API**, solo nella pipeline (mai a runtime)
- Query: tutti gli oggetti `building` nel bounding box di Barcellona, con i tag `height` e `building:levels`
- Stima altezza: `height` se presente → altrimenti `building:levels × 3 m` → altrimenti default 12 m
- *Fase 2 (rifinitura):* riempimento dei buchi con **GlobalBuildingAtlas** (TUM, 2025, CC-BY-4.0; altezze LoD1 globali, RMSE ~4 m in Europa). L'MVP usa solo OSM + default perché la copertura `building:levels` di OSM è densa nelle zone con più terrazze (Eixample, Ciutat Vella).

### 5.3 Posizione del sole — libreria `suncalc`
- Pacchetto npm `suncalc` (BSD, ~3 KB), 100% client-side, nessuna API key
- `SunCalc.getPosition(date, lat, lng)` → `altitude` e `azimuth` (radianti)
- Algoritmo astronomico NOAA-equivalente, precisione ~0,01°

### 5.4 Basemap — MapLibre + OpenFreeMap
- **MapLibre GL JS** per il rendering (gratuito, open-source, nessuna API key)
- Tile vettoriali da **OpenFreeMap** (gratuito, no key, no rate limit)
- *Fase 2:* opzione **Protomaps PMTiles** self-hosted (singolo file statico) per offline completo

### 5.5 Fonti valutate e scartate
- **Google Solar API:** modella la resa fotovoltaica *annua* dei tetti, non l'ombra istantanea di una terrazza; costo oltre un piccolo free tier → non adatta.
- **OSM `outdoor_seating` come fonte primaria terrazze:** solo ~9% di copertura a Barcellona → inutilizzabile come fonte primaria (resta utile come arricchimento in Fase 3).

### 5.6 Attribuzione
La licenza CC-BY impone l'attribuzione: l'app mostra in un pannello «Crediti» le fonti — Open Data Barcelona, OpenStreetMap contributors, GlobalBuildingAtlas, OpenFreeMap.

---

## 6. Pipeline dati — unità

| Script | Input | Output | Responsabilità |
|---|---|---|---|
| `fetch-terraces` | API CKAN / CSV BCN | `terraces.raw.json` | Scarica e parsa il CSV ufficiale delle terrazze |
| `fetch-buildings` | Overpass API | `buildings.raw.json` | Scarica i footprint degli edifici di Barcellona |
| `resolve-heights` | `buildings.raw` | `buildings.resolved.json` | Assegna un'altezza a ogni edificio (OSM `height` → `building:levels × 3` → default 12 m). *Fase 2:* fallback su GlobalBuildingAtlas. |
| `build-output` | dati risolti | file in `/public/data/` | Normalizza, ottimizza (coordinate troncate), suddivide in griglia |

**Output finale** (in `/public/data/`):
- `terraces.json` — singolo file compatto con tutte le ~6.900 terrazze; caricato in un colpo solo all'avvio
- `buildings/{x}_{y}.json` — edifici suddivisi in una griglia di celle ~0,5–1 km; dataset grande, caricato **on-demand** per le celle visibili
- `meta.json` — bounding box della città, data di aggiornamento, parametri della griglia

---

## 7. PWA — unità

Ogni unità ha una sola responsabilità e un'interfaccia definita.

| Unità | Responsabilità | Interfaccia (sintesi) | Dipende da |
|---|---|---|---|
| `pwa-shell` | Manifest, service worker, install prompt, cache offline | — | — |
| `map-view` | Setup MapLibre, basemap, viewport, pan/zoom | `props {center, zoom, onViewportChange}` | MapLibre |
| `geolocation` | Posizione utente; gestione permesso negato / fuori città | `getUserPosition() → {lat,lon} | 'denied'` | Web Geolocation API |
| `data-loader` | Carica `terraces.json` + i chunk edifici per viewport **+ margine 300 m** | `loadForViewport(bbox) → {terraces, buildings}` | fetch |
| `sun` | Wrapper su suncalc | `getSunPosition(time, lat, lon) → {azimuth, elevation}` | suncalc |
| `shadow-engine` | Decide lo stato di una terrazza | `computeState(terrace, sunPos, buildingIndex) → 'sun'|'shade'|'closed'` | RBush, helper geometrici |
| `terrace-store` | Stato condiviso (orario, posizione utente, stati terrazze) | store Zustand | — |
| `markers` | Render delle terrazze come marker colorati | consuma `terraceStates` | map-view |
| `bottom-sheet` | Pannello trascinabile con lista ordinata per distanza | consuma lista terrazze ordinata | terrace-store |
| `time-slider` | Controllo orario (default «adesso»), mostra il tramonto | scrive `time` nello store | terrace-store |
| `terrace-card` | Scheda dettaglio al tap su una terrazza | `show(terraceId)` | terrace-store |
| `i18n` | Stringhe localizzate | `t(key)` | — |

---

## 8. Algoritmo sole/ombra (cuore dell'app)

### 8.1 Posizione del sole
Per la coppia (terrazza, orario): `suncalc` → elevazione + azimut.
- Elevazione ≤ 0° → **notte**: nessuna terrazza al sole; l'app mostra l'orario della prossima alba.

### 8.2 Raycasting delle ombre
Per ogni terrazza, con il sole sopra l'orizzonte:
1. **Raggio di ricerca** `R = min(altezzaMax / tan(elevazione), 300 m)` — con sole basso, R cresce.
2. **Indice spaziale** (RBush) → edifici entro R dalla terrazza.
3. Si proietta un **raggio 2D** dalla terrazza verso l'azimut del sole.
4. Per ogni edificio attraversato a distanza orizzontale `d`: l'edificio fa ombra se `altezzaEdificio > d × tan(elevazione)`.
5. Si verifica anche l'edificio del locale stesso (terrazza addossata al muro).
6. Se **almeno un** bloccante vince → **OMBRA**; altrimenti → **SOLE**.

Il margine di 300 m sui chunk edifici (sezione 7) garantisce che si considerino anche i palazzi appena fuori dal viewport che proiettano ombra al suo interno.

### 8.3 Sole parziale (Fase 2)
**L'MVP usa lo stato binario SOLE / OMBRA** (più «chiuso/notte»). In Fase 2 si introduce lo stato **PARZIALE**: dalla superficie m² del dataset si ricava un'area approssimata attorno al punto, si campionano ~5 punti e il rapporto al sole determina SOLE (tutti) / PARZIALE (alcuni) / OMBRA (nessuno).

### 8.4 «Al sole fino alle HH:MM»
Per la terrazza selezionata: scansione in avanti a passi di 10 minuti finché lo stato passa da SOLE a OMBRA (o si raggiunge il tramonto). Si riporta quell'orario nella scheda.

### 8.5 Prestazioni
Ogni terrazza = un raycast contro poche decine di edifici vicini → **millisecondi** per l'intera città su un telefono di fascia media. Ricalcolo fluido a ogni spostamento dello slider orario. **Nessuna precomputazione a runtime, nessun server.** Solo il dataset statico degli edifici viene preprocessato una volta nella pipeline.

---

## 9. Flusso utente

1. Apertura → shell PWA + mappa
2. Geolocalizzazione → centra sull'utente (o sul centro di Barcellona se negata / fuori città)
3. `data-loader` carica le terrazze + i chunk edifici del viewport (+ margine 300 m)
4. Slider orario impostato su «adesso»
5. `shadow-engine` calcola lo stato di ogni terrazza visibile
6. `markers` colora la mappa; `bottom-sheet` mostra la lista ordinata per distanza
7. L'utente trascina lo slider → ricalcolo → aggiornamento di mappa e lista
8. Tap su una terrazza → `terrace-card`: nome, indirizzo, stato, «al sole fino alle…», minuti a piedi, «Apri su Google Maps»
9. Pan della mappa → caricamento dei nuovi chunk → ricalcolo

---

## 10. UX / schermate

### Schermata principale
- Mappa a tutto schermo
- Marker: 🟡 **al sole** · 🔵 **in ombra** · ⚫ **chiuso/notte** *(🟠 parziale dalla Fase 2)*
- In alto: slider orario sottile + etichetta («Adesso 14:30 · tramonto 21:08»)
- In basso: **bottom sheet trascinabile** — collassato mostra maniglia + «23 terrazze al sole vicino a te»; espanso mostra la lista
- Pulsante flottante «📍 la mia posizione»

### Riga della lista
`nome` · `distanza` (es. «180 m») · `stato sole` · `n° tavoli` · `«al sole fino alle 17:40»` · icona 🗺️ (scorciatoia diretta a Google Maps)

### Scheda terrazza (al tap)
Nome, indirizzo, stato grande e leggibile, «al sole fino alle…», minuti a piedi, pulsante **«Apri su Google Maps»** → apre la pagina del locale su Google Maps (app su iPhone, oppure web). *(Fase 3: cucina, orari, foto.)*

### Link a Google Maps (costo zero)
L'URL della pagina del locale è generato lato client da **nome + indirizzo** (campi già presenti nel dataset ufficiale), **senza API key e senza costi**:

`https://www.google.com/maps/search/?api=1&query=` + `encodeURIComponent("<nome>, <indirizzo>, Barcelona")`

Su iPhone apre direttamente l'app Google Maps se installata, altrimenti la versione web. Accuratezza ~95%: nome e indirizzo bastano quasi sempre a far atterrare Google sulla scheda corretta del locale. Un link «pixel-perfect» richiederebbe il *Place ID* di Google, che comporta un piccolo costo una-tantum di risoluzione nella pipeline — opzione futura, non necessaria per l'MVP. Il link è presente sia nella scheda sia come icona nella riga della lista: è quindi parte dell'**MVP (Fase 1)**.

### Principi UX
- Tap target ≥ 44 px, font di sistema, **pinch-zoom abilitato**
- **Nessuno step «clicca per calcolare»**: tutto pronto all'apertura
- UI localizzata (MVP: ES + EN; CA in Fase 2), lingua rilevata dal dispositivo

---

## 11. Stack tecnico

- **Vite + React 18 + TypeScript**
- **MapLibre GL JS** (mappa) + **OpenFreeMap** (tile vettoriali)
- **suncalc** (posizione del sole), **RBush** (indice spaziale)
- **Helper geometrici minimi scritti a mano** (intersezione raggio-segmento, point-in-polygon, distanza haversine) — niente Turf.js intero, per mantenere il bundle leggero
- **Zustand** (store leggero per lo stato condiviso)
- **vite-plugin-pwa** (manifest + service worker Workbox)
- **Pipeline:** script TypeScript eseguiti via `tsx`, lanciati in GitHub Actions
- **Hosting:** GitHub Pages; **refresh dati:** GitHub Actions con cron mensile

---

## 12. Gestione errori / casi limite

| Caso | Comportamento |
|---|---|
| Permesso geolocalizzazione negato | Centra sul centro di Barcellona + pulsante «la mia posizione» |
| Utente fuori da Barcellona | Messaggio «per ora copriamo solo Barcellona», centra su Barcellona |
| Offline | Service worker serve mappa e dati da cache; il calcolo sole/ombra funziona comunque (è locale) |
| Notte (sole sotto l'orizzonte) | Marker «chiuso», mostra l'orario della prossima alba |
| Chunk edifici mancante | Terrazza marcata a confidenza ridotta |
| Altezza di un edificio assente | Default 12 m; terrazza a confidenza ridotta |
| OpenFreeMap non raggiungibile | Tile da cache; *(Fase 2: fallback Protomaps PMTiles)* |

---

## 13. Testing

- **Unit** `shadow-engine`: geometrie note (edificio 30 m a 10 m, sole a 30° → ombra attesa) per verificare la trigonometria
- **Unit** `sun`: confronto con valori di riferimento NOAA per data/luogo noti
- **Unit** pipeline: parsing di righe CSV campione → GeoJSON corretto
- **Confronto a campione** con il sito di Barcellona esistente (il cui algoritmo è corretto) e con la realtà
- **Test manuale** a viewport iPhone (390×844)
- **Audit Lighthouse PWA** (installabilità, performance)

---

## 14. Fasi

- **Fase 0 — Pipeline dati:** i 4 script → file statici in `/public/data/`
- **Fase 1 — MVP:** mappa + geolocalizzazione + ombre accurate (SOLE/OMBRA) + marker colorati + bottom-sheet con lista ordinata + slider orario + scheda terrazza + PWA installabile. Solo Barcellona.
- **Fase 2 — Rifinitura:** stato «parziale» multi-punto, indicatore di confidenza, riempimento altezze edifici con GlobalBuildingAtlas, offline completo (Protomaps PMTiles), lingua catalana, tuning prestazioni
- **Fase 3 — Arricchimento:** dati OSM (cucina, orari, foto), filtri, ricerca
- **Fase 4 — Multi-città:** generalizzazione della pipeline, nuove città

---

## 15. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Buchi nelle altezze degli edifici → verdetto errato | OSM `building:levels × 3` + default 12 m. *Fase 2:* GlobalBuildingAtlas + indicatore di confidenza |
| Coordinate = ingresso del locale, non poligono esatto della terrazza | Errore di pochi metri, irrilevante per il calcolo del sole |
| OpenFreeMap è community-funded (possibili disservizi) | Cache del service worker; fallback Protomaps PMTiles (Fase 2) |
| Overpass API in rate-limit durante la pipeline | Retry + esecuzione poco frequente (mensile) |
| Dataset BCN aggiornato solo 2×/anno | Accettabile: le licenze terrazze cambiano lentamente |
| Limiti di storage PWA su iOS | I nostri dati sono piccoli (terrazze ~centinaia di KB) |

---

## 16. Domande aperte (da decidere più avanti)

- Nome e branding dell'app
- Dominio personalizzato vs URL `github.io`
- Quali città dopo Barcellona (dipende dalla disponibilità di dataset terrazze aperti)
