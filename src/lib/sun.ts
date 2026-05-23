import SunCalc from 'suncalc';

export type SunPosition = { altitude: number; azimuth: number }; // radianti

/**
 * Posizione del sole. `azimuth` è misurato da sud (0 = sud, +ovest, -est), `altitude` da orizzonte (radianti).
 */
export function getSunPosition(date: Date, lat: number, lng: number): SunPosition {
  const p = SunCalc.getPosition(date, lat, lng);
  return { altitude: p.altitude, azimuth: p.azimuth };
}

export function isSunUp(date: Date, lat: number, lng: number, minAltitudeRad = 0): boolean {
  return getSunPosition(date, lat, lng).altitude > minAltitudeRad;
}

export function getTimes(date: Date, lat: number, lng: number) {
  return SunCalc.getTimes(date, lat, lng);
}
