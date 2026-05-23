# Prompt iniziale — Session 2

> Copia-incolla tutto il blocco qui sotto nella nuova sessione Claude.

---

```
Sei in una nuova sessione di Claude per il progetto "Mappa delle terrazze al sole".

CARTELLA: C:\Users\masch\Desktop\Software Builds\Mappa delle terrazze al sole
GROUP_ID graphiti: mappa-delle-terrazze-al-sole

PRIMA DI INIZIARE:
1. Le regole globali in ~/.claude/CLAUDE.md sono auto-caricate.
2. Esegui search_memory_facts e search_nodes su graphiti con group_id="mappa-delle-terrazze-al-sole" — troverai un episodio "Session 1 completata - Data Foundation" con tutto il contesto della sessione precedente (pipeline, gotcha emersi, schema CSV reale, ecc.).
3. Leggi nell'ordine:
   - docs/superpowers/specs/2026-05-22-mappa-terrazze-sole-design.md
   - docs/superpowers/plans/2026-05-22-session-2-pwa-core.md (il tuo piano per oggi)
4. Verifica lo stato del repo: ultimo commit Session 1 = 604b7247e20608f1b9ffe099489e19880f579d6a. Su branch main.

STATO PIPELINE DATI (output di Session 1, già committato in `public/data/`):
- public/data/terraces.json: 6899 terrazze (1.22 MB)
- public/data/buildings/: 231 chunk con 88620 edifici totali (27 MB, griglia 0.01° ≈ 1 km)
- public/data/meta.json: bbox [2.07, 41.32, 2.23, 41.47] + gridStep 0.01

GOTCHA da ricordare (sono in graphiti, ma vale ripeterli):
- Il dataset BCN NON ha il nome commerciale del locale → in Terrace `name` e `address` coincidono (entrambi = EMPLACAMENT, l'indirizzo dell'autorizzazione). Tienine conto nell'UI: il marker visualizza l'indirizzo come "titolo".
- Statistiche altezza edifici risolte: 0.36% da OSM height, 60.7% da building:levels×3, 38.9% default 12 m. Marker con confidenza ridotta per `heightSource === 'default'` è in Fase 2, NON da fare in Session 2.

CONVENZIONI:
- Le regole globali sono auto-caricate. Identità git non è configurata sulla macchina → per ogni commit usare `git -c user.name="mascherin2797g" -c user.email="mascherin2797g@gmail.com" commit ...` (regola globale: niente `git config`).
- Usa la skill superpowers:executing-plans per il Session 2 plan.
- Committa dopo ogni task. Messaggi in italiano "tipo(scope): descrizione".
- TDD per ogni funzione pura (sun, geometry, shadow-engine). Esegui i test prima di committare ogni task TDD.
- Se trovi inconsistenze nello spec o nel plan, FERMATI e segnalalo.
- Non saltare il Task FINAL (graphiti + generazione di START-SESSION-3.md).

OBIETTIVO: PWA installabile che mostri la mappa di Barcellona, geolocalizzi l'utente, calcoli sole/ombra per ogni terrazza e la colori sulla mappa. NIENTE bottom sheet, slider o card — quelli stanno in Session 3.

Procedi.
```
