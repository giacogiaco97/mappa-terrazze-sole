import { isInSun } from './shadow-engine.js';
import type { BuildingIndex } from './building-index.js';
import type { Terrace } from '../types/index.js';
import { getSunPosition } from './sun.js';
import type { TerraceStatus } from '../store/use-store.js';

export function computeAllStates(
  terraces: Terrace[],
  now: Date,
  index: BuildingIndex,
): Record<string, TerraceStatus> {
  const out: Record<string, TerraceStatus> = {};
  for (const t of terraces) {
    const sun = getSunPosition(now, t.lat, t.lng);
    if (sun.altitude <= 0) {
      out[t.id] = 'closed';
      continue;
    }
    out[t.id] = isInSun(t.lat, t.lng, sun, index) ? 'sun' : 'shade';
  }
  return out;
}
