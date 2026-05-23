import { isInSun } from './shadow-engine.js';
import type { BuildingIndex } from './building-index.js';
import type { Terrace } from '../types/index.js';
import { getSunPosition } from './sun.js';
import type { TerraceStatus } from '../store/use-store.js';
import { getWeatherAt, isEffectivelySunny, type Weather } from './weather.js';

/**
 * Calcola lo stato di ogni terrazza al timestamp `now`.
 *
 * Stati:
 * - 'closed': sole sotto orizzonte (notte)
 * - 'shade': sole astronomico bloccato da un edificio vicino
 * - 'cloudy': sole astronomico libero MA nuvolosità alta / pioggia / temporale
 * - 'sun': sole astronomico libero e cielo abbastanza pulito
 *
 * `weather` è opzionale: senza, ricade nel comportamento legacy (sun/shade/closed
 * basato solo su geometria; il filtro nuvole viene saltato).
 */
export function computeAllStates(
  terraces: Terrace[],
  now: Date,
  index: BuildingIndex,
  weather: Weather | null = null,
): Record<string, TerraceStatus> {
  const out: Record<string, TerraceStatus> = {};
  // Il meteo è centralizzato su Barcellona: stesso valore per tutte le terrazze
  // all'istante `now` (la nuvolosità in città non varia significativamente in
  // pochi km nel breve termine).
  const weatherNow = getWeatherAt(weather, now);

  for (const t of terraces) {
    const sun = getSunPosition(now, t.lat, t.lng);
    if (sun.altitude <= 0) {
      out[t.id] = 'closed';
      continue;
    }
    const astronomicalSun = isInSun(t.lat, t.lng, sun, index);
    if (!astronomicalSun) {
      out[t.id] = 'shade';
      continue;
    }
    out[t.id] = isEffectivelySunny(true, weatherNow) ? 'sun' : 'cloudy';
  }
  return out;
}
