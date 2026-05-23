import { haversineMeters } from './geometry.js';
import type { Terrace } from '../types/index.js';

export type WithDistance = { terrace: Terrace; distanceMeters: number };

export function sortTerracesByDistance(
  terraces: Terrace[],
  user: { lat: number; lng: number },
): WithDistance[] {
  return terraces
    .map((t) => ({ terrace: t, distanceMeters: haversineMeters(user.lat, user.lng, t.lat, t.lng) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
