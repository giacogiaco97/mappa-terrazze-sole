# Prompt iniziale — Session 3

> Copia-incolla tutto il blocco qui sotto nella nuova sessione Claude.

---

```
Sei in una nuova sessione di Claude per il progetto "Mappa delle terrazze al sole".

CARTELLA: C:\Users\masch\Desktop\Software Builds\Mappa delle terrazze al sole
GROUP_ID graphiti: mappa-delle-terrazze-al-sole

PRIMA DI INIZIARE:
1. ~/.claude/CLAUDE.md è auto-caricato.
2. Esegui search_memory_facts e search_nodes su graphiti con group_id="mappa-delle-terrazze-al-sole" — troverai gli episodi "Session 1 completata - Data Foundation" e "Session 2 completata - PWA Core" con tutto il contesto.
3. Leggi nell'ordine:
   - docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md
   - docs/superpowers/plans/2026-05-22-session-3-ux-deploy.md (il tuo piano per oggi)
4. Verifica lo stato del repo: ultimo commit Session 2 = 9eaf6ddb75364945d2282caa3321528d059fea6a. Su branch main. `npm test` passa con 43 test (11 file).

STATO APP (output di Session 2, già committato):
- Vite 8 + React 19 + TypeScript + vite-plugin-pwa funzionanti (`npm run dev`, `npm run build`)
- MapLibre 5 + basemap OpenFreeMap Positron, mappa centrata su Barcellona
- Geolocalizzazione (hook useGeolocation) → centra mappa se utente in BCN
- Data loader (terraces.json, meta.json, buildings/{x}_{y}.json) con cache + cellsForBbox
- Shadow engine completo: per ogni terrazza calcola sole/ombra/notte usando suncalc + raycasting su footprint edifici
- Markers colorati sulla mappa: sun=#f5a623, shade=#3a6ea5, closed=#666, pending=#ccc
- Store Zustand (now, userPos, terraces, states)
- PWA: manifest, service worker (Workbox), runtime caching tile + dati
- ANCORA NON ESISTONO: bottom sheet, slider orario, scheda terrazza, link Google Maps, i18n, attribuzione UI, gestione edge case, deploy live

GOTCHA EREDITATI DA SESSION 2 (utili per Session 3):
- Vite ha server.port=5180 strictPort in vite.config.ts (workaround port conflicts locali). Puoi cambiarla se serve.
- Verifica visiva nel browser di preview è impedita dal dialog geolocation che blocca screenshot. Per Session 3 puoi usare la skill debug-via-browser oppure aprire il dev server localmente per testare flussi UI.
- Warning `npm run build`: chunk JS > 500 KB. Valuta dynamic import per code-splitting (MapLibre è il pezzo grosso) — opzionale per MVP ma raccomandato prima del deploy.
- src/types/index.ts: il dataset BCN NON ha il nome commerciale del locale → `Terrace.name === Terrace.address`. Nella scheda mostra l'indirizzo come "titolo", oppure usa neighborhood come sottotitolo.

POI:
- Usa la skill superpowers:executing-plans per il Session 3 plan.
- Committa dopo ogni task con `git -c user.name="mascherin2797g" -c user.email="mascherin2797g@gmail.com" commit -m "tipo(scope): descrizione"` (niente git config sulla macchina). Messaggi in italiano.
- TDD per le funzioni pure (google-maps URL builder, walking-time, sunny-until scanner).
- Per i componenti UI: verifica visiva su viewport mobile 390×844 (Claude Preview o Playwright).
- Non saltare il Task FINAL (graphiti finale + verifica deploy live + aggiornamento CLAUDE.md del progetto se esiste).

OBIETTIVO: portare l'app in produzione su GitHub Pages, completa di tutte le funzionalità dell'MVP (Fase 1) come da sezione 14 dello spec.

Procedi.
```
