import { describe, expect, test } from 'vitest';
import { getSunPosition, isSunUp } from '../sun.js';

// 21 giugno 2026, 12:00 UTC a Barcellona — vicino al transito solare (~11:52 UTC),
// sole alto a sud.
const summer = new Date('2026-06-21T12:00:00Z');
const BCN = { lat: 41.39, lng: 2.165 };

describe('getSunPosition', () => {
  test('a mezzogiorno solstizio estivo a BCN il sole è alto', () => {
    const { altitude, azimuth } = getSunPosition(summer, BCN.lat, BCN.lng);
    // Altezza > 60° (1.05 rad) attesa
    expect(altitude).toBeGreaterThan(1.05);
    // Azimut intorno a sud — suncalc misura da sud (0 = sud), quindi |az| piccolo
    expect(Math.abs(azimuth)).toBeLessThan(0.5);
  });

  test('a mezzanotte sole sotto orizzonte', () => {
    const midnight = new Date('2026-06-21T01:00:00Z');
    expect(isSunUp(midnight, BCN.lat, BCN.lng)).toBe(false);
  });

  test('di giorno isSunUp = true', () => {
    expect(isSunUp(summer, BCN.lat, BCN.lng)).toBe(true);
  });
});
