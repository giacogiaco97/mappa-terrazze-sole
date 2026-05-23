import { raySegmentIntersection, pointInPolygon } from './geometry.js';
import { makeLocalProjection } from './local-projection.js';
import type { BuildingIndex } from './building-index.js';
import type { SunPosition } from './sun.js';

const MIN_ALT_RAD = 0.05; // ~3°: sotto questa soglia il sole è troppo basso, "shade" come default sicuro

/**
 * Decide se una terrazza è al sole in base al sole + agli edifici vicini.
 * Convenzione suncalc: azimuth 0 = sud, +Ovest, -Est. altitude da orizzonte.
 */
export function isInSun(
  lat: number, lng: number,
  sun: SunPosition,
  index: BuildingIndex,
): boolean {
  if (sun.altitude <= 0) return false;
  if (sun.altitude < MIN_ALT_RAD) return false;

  // Raggio di ricerca: edifici fino a (maxBuildingHeight / tan(alt)) lontani.
  // Cap a 300 m per evitare scansioni enormi.
  const reach = Math.min(300, 200 / Math.tan(sun.altitude));
  const dLat = reach / 111_320;
  const meanCos = Math.cos((lat * Math.PI) / 180);
  const dLng = reach / (111_320 * meanCos);
  const candidates = index.search(lng - dLng, lat - dLat, lng + dLng, lat + dLat);
  if (candidates.length === 0) return true;

  const proj = makeLocalProjection(lat, lng);
  // Direzione del raggio verso il sole, proiezione orizzontale.
  // suncalc: az=0 → sud. dx_east = -sin(az), dy_north = -cos(az). Sole a sud = direzione (0, -1).
  const dx = -Math.sin(sun.azimuth);
  const dy = -Math.cos(sun.azimuth);
  const tanAlt = Math.tan(sun.altitude);

  for (const b of candidates) {
    // Proietta footprint in metri locali.
    const ring = b.footprint.map(([blng, blat]) => proj.project(blat, blng));

    // Se la terrazza è dentro il footprint dell'edificio stesso, considerala ombra
    // (terrazza addossata al muro interno — caso raro ma reale).
    if (pointInPolygon(0, 0, ring)) {
      if (b.height >= 1) return false;
    }

    let minHit = Infinity;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]!;
      const [x2, y2] = ring[i + 1]!;
      const t = raySegmentIntersection(0, 0, dx, dy, x1, y1, x2, y2);
      if (t != null && t > 0 && t < minHit) minHit = t;
    }
    if (minHit < Infinity) {
      if (b.height > minHit * tanAlt) return false; // bloccato
    }
  }
  return true;
}
