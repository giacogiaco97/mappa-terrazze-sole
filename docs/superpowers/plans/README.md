# Piano di sviluppo — Mappa delle terrazze al sole

Per il documento di design completo: [`../specs/2026-05-22-mappa-terrazze-sole-design.md`](../specs/2026-05-22-mappa-terrazze-sole-design.md).

Lo sviluppo dell'MVP è diviso in **3 sessioni Claude consecutive** per non saturare mai il contesto. Ogni sessione produce software funzionante e testato; alla fine di ciascuna, l'agente aggiorna il knowledge graph (`graphiti-memory`, `group_id = "mappa-delle-terrazze-al-sole"`) e genera il prompt iniziale per la sessione successiva.

## Le 3 sessioni

| # | Piano | Obiettivo |
|---|---|---|
| 1 | [Session 1 — Data Foundation](./2026-05-22-session-1-data-foundation.md) | Pipeline dati: scarica BCN + OSM, produce `/public/data/*.json`. Test unitari. GitHub Actions per refresh mensile. |
| 2 | [Session 2 — PWA Core](./2026-05-22-session-2-pwa-core.md) | App React: mappa MapLibre, geolocalizzazione, calcolo sole/ombra, marker colorati. PWA installabile. |
| 3 | [Session 3 — UX & Deploy](./2026-05-22-session-3-ux-deploy.md) | Bottom sheet, slider orario, scheda con Google Maps, edge case, i18n, deploy su GitHub Pages. |

## Come usarle

1. Apri una sessione Claude **fresca** dentro la cartella di progetto.
2. Incolla il prompt iniziale. La prima volta usa [`START-SESSION-1.md`](./START-SESSION-1.md). Le sessioni 2 e 3 leggeranno `START-SESSION-2.md` / `START-SESSION-3.md`, **generati automaticamente** al termine della sessione precedente.
3. L'agente esegue il piano task per task, committando dopo ogni task.
4. **Alla fine** salva su graphiti, scrive il file `START-SESSION-N+1.md` e te lo indica per il copia-incolla.

## Riferimenti condivisi tra sessioni
- Spec di design: `docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md`
- Memoria progetto (graphiti): `group_id = "mappa-delle-terrazze-al-sole"`
- Regole globali utente: `~/.claude/CLAUDE.md` (auto-caricato a ogni sessione)
