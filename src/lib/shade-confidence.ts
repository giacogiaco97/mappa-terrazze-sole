import type { BuildingIndex } from './building-index.js';
import type { Building } from '../types/index.js';

export type Confidence = 'high' | 'medium' | 'low';

const SEARCH_RADIUS_M = 60; // ~0.0005° a BCN

/**
 * Confidence del calcolo ombra per una terrazza, basato sulla qualità delle
 * altezze degli edifici nelle vicinanze.
 *
 * - `high`: almeno un edificio vicino ha `heightSource === 'osm'` (altezza esplicita)
 * - `medium`: tutti gli edifici vicini hanno `levels` (altezza derivata da n. piani)
 * - `low`: tutti gli edifici vicini hanno `default` (12 m piazzato arbitrariamente)
 */
export function getShadeConfidence(
  lat: number,
  lng: number,
  index: BuildingIndex,
): Confidence {
  const dLat = SEARCH_RADIUS_M / 111_320;
  const meanCos = Math.cos((lat * Math.PI) / 180);
  const dLng = SEARCH_RADIUS_M / (111_320 * meanCos);
  const candidates: Building[] = index.search(lng - dLng, lat - dLat, lng + dLng, lat + dLat);
  if (candidates.length === 0) return 'low'; // nessun edificio: nessuna ombra calcolabile

  const sources = candidates.map((b) => b.heightSource);
  if (sources.some((s) => s === 'osm')) return 'high';
  if (sources.some((s) => s === 'levels')) return 'medium';
  return 'low';
}
