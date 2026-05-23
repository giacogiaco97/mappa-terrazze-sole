import { haversineMeters } from '../../src/lib/geometry.js';
import type { Terrace } from '../../src/types/index.js';
import type { RawPoi } from '../fetch-osm-pois.js';

/**
 * Assegna a ogni terrazza il nome del POI OSM più vicino entro `maxMeters`.
 *
 * Vincoli:
 * - Un POI è assegnabile a UNA sola terrazza (la più vicina). Questo evita di replicare
 *   "Starbucks" su 5 terrazze adiacenti distinte.
 * - Indicizziamo i POI in una griglia ~0.001° × 0.001° (~111 m × ~82 m a BCN) per ridurre
 *   la complessità da O(N×M) a O(N + M) in pratica.
 */
export function matchTerracesToPois(
  terraces: Terrace[],
  pois: RawPoi[],
  maxMeters: number,
): Terrace[] {
  const CELL_DEG = 0.001;
  // Margine: cerco nelle 9 celle attorno (la cella + le 8 vicine).
  // 0.001° a Barcellona ≈ 111 m (lat) e ~82 m (lng). Quindi 30 m sta sempre in 1 cella.

  // Costruisci grid POI → array di indici
  const grid = new Map<string, number[]>();
  const key = (lat: number, lng: number) =>
    `${Math.floor(lat / CELL_DEG)}_${Math.floor(lng / CELL_DEG)}`;

  for (let i = 0; i < pois.length; i++) {
    const p = pois[i]!;
    const k = key(p.lat, p.lng);
    let arr = grid.get(k);
    if (!arr) {
      arr = [];
      grid.set(k, arr);
    }
    arr.push(i);
  }

  // Per ogni terrazza, trova POI candidati nelle 9 celle vicine.
  // Calcola distanze, ordina coppie (terrazza, POI) globali e assegna greedy:
  // prima la coppia più vicina vince il match; un POI assegnato non è più disponibile.
  type Pair = { ti: number; pi: number; d: number };
  const pairs: Pair[] = [];

  for (let ti = 0; ti < terraces.length; ti++) {
    const t = terraces[ti]!;
    const cLat = Math.floor(t.lat / CELL_DEG);
    const cLng = Math.floor(t.lng / CELL_DEG);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const arr = grid.get(`${cLat + dx}_${cLng + dy}`);
        if (!arr) continue;
        for (const pi of arr) {
          const p = pois[pi]!;
          const d = haversineMeters(t.lat, t.lng, p.lat, p.lng);
          if (d <= maxMeters) pairs.push({ ti, pi, d });
        }
      }
    }
  }

  // Assegna greedy
  pairs.sort((a, b) => a.d - b.d);
  const assignedPoi = new Set<number>();
  const terraceNameFromPoi = new Map<number, string>();
  for (const { ti, pi } of pairs) {
    if (assignedPoi.has(pi)) continue;
    if (terraceNameFromPoi.has(ti)) continue;
    assignedPoi.add(pi);
    terraceNameFromPoi.set(ti, pois[pi]!.name);
  }

  // Restituisci nuove terrazze con name eventualmente sostituito.
  return terraces.map((t, i) => {
    const newName = terraceNameFromPoi.get(i);
    if (!newName) return t;
    return { ...t, name: newName };
  });
}
