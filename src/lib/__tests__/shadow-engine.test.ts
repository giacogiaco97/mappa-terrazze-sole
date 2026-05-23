import { describe, expect, test } from 'vitest';
import { isInSun } from '../shadow-engine.js';
import { buildBuildingIndex } from '../building-index.js';
import type { Building } from '../../types/index.js';

// Scena controllata in BCN: un edificio alto a sud della terrazza.
// suncalc azimuth: 0 = sud, +Ovest, -Est. altitude in radianti.

const tLat = 41.39;
const tLng = 2.165;

// Edificio piccolo, alto 30m, ~10m a sud della terrazza.
const dLat = 10 / 111_320;
const dLatSpan = 5 / 111_320;
const dLngSpan = 5 / (111_320 * Math.cos((tLat * Math.PI) / 180));
const south: Building = {
  id: 'south',
  height: 30,
  heightSource: 'osm',
  footprint: [
    [tLng - dLngSpan, tLat - dLat - dLatSpan],
    [tLng + dLngSpan, tLat - dLat - dLatSpan],
    [tLng + dLngSpan, tLat - dLat + dLatSpan],
    [tLng - dLngSpan, tLat - dLat + dLatSpan],
    [tLng - dLngSpan, tLat - dLat - dLatSpan],
  ],
};

describe('isInSun — sole basso a sud', () => {
  test('sole basso (30°) a sud bloccato da edificio alto a sud → ombra', () => {
    // sole a sud (azimuth=0), altezza 30° (~0.524 rad). Tan 30° = 0.577. A 5 m, ombra fino a 2.89 m. Edificio alto 30 m blocca.
    const index = buildBuildingIndex([south]);
    const sun = { altitude: 0.524, azimuth: 0 };
    expect(isInSun(tLat, tLng, sun, index)).toBe(false);
  });

  test('sole alto in zenit (87°) → quasi nulla blocca → sole', () => {
    const index = buildBuildingIndex([south]);
    const sun = { altitude: 1.518, azimuth: 0 }; // ~87°
    expect(isInSun(tLat, tLng, sun, index)).toBe(true);
  });

  test('sole basso ma proviene da nord → l\'edificio a sud non blocca', () => {
    const index = buildBuildingIndex([south]);
    const sun = { altitude: 0.524, azimuth: Math.PI }; // 180° dal sud = nord
    expect(isInSun(tLat, tLng, sun, index)).toBe(true);
  });

  test('sole sotto orizzonte → false', () => {
    const index = buildBuildingIndex([]);
    const sun = { altitude: -0.1, azimuth: 0 };
    expect(isInSun(tLat, tLng, sun, index)).toBe(false);
  });
});
