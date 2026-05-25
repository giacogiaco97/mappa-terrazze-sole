/**
 * Conversione UTM ETRS89 → WGS84 (lat/lng) per zona 30N (Madrid, gran parte
 * della penisola iberica). Formula di Karney/USGS, implementazione pura senza
 * dipendenze esterne. ETRS89 e WGS84 in Spagna differiscono di pochi cm,
 * accettabile per il calcolo sole/ombra.
 *
 * Riferimento: https://en.wikipedia.org/wiki/Universal_Transverse_Mercator_coordinate_system#Simplified_formulas
 */

const a = 6378137; // semi-axis WGS84/ETRS89 (m)
const f = 1 / 298.257223563;
const e2 = 2 * f - f * f; // first eccentricity squared
const ep2 = e2 / (1 - e2); // second eccentricity squared
const k0 = 0.9996;
const E0 = 500000; // false easting

/**
 * @param east coordenada X UTM in metri
 * @param north coordenada Y UTM in metri
 * @param zone numero zona UTM (30 per Madrid)
 * @param northernHemisphere true (default) per emisfero nord (Spagna)
 */
export function utmToWgs84(
  east: number,
  north: number,
  zone: number,
  northernHemisphere = true,
): { lat: number; lng: number } {
  const N0 = northernHemisphere ? 0 : 10000000; // false northing

  const x = east - E0;
  const y = north - N0;

  // Meridiano centrale della zona (gradi)
  const lambda0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

  // Latitudine "footprint" M
  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const J1 = (3 * e1) / 2 - (27 * e1 * e1 * e1) / 32;
  const J2 = (21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32;
  const J3 = (151 * e1 * e1 * e1) / 96;
  const J4 = (1097 * e1 * e1 * e1 * e1) / 512;

  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu) +
    J4 * Math.sin(8 * mu);

  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);

  const N = a / Math.sqrt(1 - e2 * sinFp * sinFp);
  const T = tanFp * tanFp;
  const C = ep2 * cosFp * cosFp;
  const R = (a * (1 - e2)) / Math.pow(1 - e2 * sinFp * sinFp, 1.5);
  const D = x / (N * k0);

  const lat =
    fp -
    ((N * tanFp) / R) *
      ((D * D) / 2 -
        ((5 + 3 * T + 10 * C - 4 * C * C - 9 * ep2) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T + 298 * C + 45 * T * T - 252 * ep2 - 3 * C * C) *
          Math.pow(D, 6)) /
          720);

  const lng =
    lambda0 +
    (D -
      ((1 + 2 * T + C) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C + 28 * T - 3 * C * C + 8 * ep2 + 24 * T * T) * Math.pow(D, 5)) /
        120) /
      cosFp;

  return {
    lat: lat * (180 / Math.PI),
    lng: lng * (180 / Math.PI),
  };
}
