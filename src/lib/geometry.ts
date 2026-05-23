const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (lat1 === lat2 && lng1 === lng2) return 0;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Intersezione raggio (origine ox,oy + direzione dx,dy non normalizzata) con segmento (x1,y1)→(x2,y2).
 * Ritorna il parametro t lungo il raggio (>= 0) se interseca, null altrimenti.
 * Tutte le coordinate sono assunte in un piano locale (es. metri Cartesiani).
 */
export function raySegmentIntersection(
  ox: number, oy: number, dx: number, dy: number,
  x1: number, y1: number, x2: number, y2: number,
): number | null {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-12) return null; // paralleli
  const tRay = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
  const tSeg = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;
  if (tRay < 0 || tSeg < 0 || tSeg > 1) return null;
  return tRay;
}

export function pointInPolygon(x: number, y: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-30) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function bboxOfPolygon(ring: [number, number][]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
