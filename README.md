# Mappa delle terrazze al sole

Webapp mobile-first che mostra in tempo reale quali terrazze di Barcellona sono al sole.

Design completo: `docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md`.

## Pipeline dati

```bash
npm install
npm run pipeline:run
```

I file generati finiscono in `public/data/`.

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

```bash
npm test
```
