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

// Bug reale: nel dataset Open Data Barcelona le coordinate della terrazza
// corrispondono all'ingresso del locale, che cade DENTRO il footprint del
// palazzo del locale stesso. Il vecchio comportamento "pointInPolygon → ombra
// permanente" trasformava ogni terrazza addossata al suo palazzo in
// "todo el día a la sombra". In realtà la terrazza fisica sta sul marciapiede
// esterno ed è esposta al sole quando nessun altro edificio la blocca.
describe('isInSun — punto dentro footprint del proprio palazzo', () => {
  // Palazzo del locale: blocco 30 m × 30 m centrato sulla terrazza, h=30 m.
  const selfHalf = 15 / 111_320;
  const selfHalfLng = 15 / (111_320 * Math.cos((tLat * Math.PI) / 180));
  const selfBuilding: Building = {
    id: 'self',
    height: 30,
    heightSource: 'levels',
    footprint: [
      [tLng - selfHalfLng, tLat - selfHalf],
      [tLng + selfHalfLng, tLat - selfHalf],
      [tLng + selfHalfLng, tLat + selfHalf],
      [tLng - selfHalfLng, tLat + selfHalf],
      [tLng - selfHalfLng, tLat - selfHalf],
    ],
  };

  test('terrazza dentro il footprint del palazzo del locale, nessun altro edificio → al sole', () => {
    const index = buildBuildingIndex([selfBuilding]);
    const sun = { altitude: 1.0, azimuth: 0 }; // sole alto a sud
    expect(isInSun(tLat, tLng, sun, index)).toBe(true);
  });

  test('terrazza dentro il proprio palazzo MA palazzo dirimpetto più alto a sud → ombra (non-regressione)', () => {
    const index = buildBuildingIndex([selfBuilding, south]);
    // sole basso a sud (30°), edificio south h=30m blocca davvero
    const sun = { altitude: 0.524, azimuth: 0 };
    expect(isInSun(tLat, tLng, sun, index)).toBe(false);
  });

  test('terrazza dentro il proprio palazzo, sole a nord → al sole', () => {
    const index = buildBuildingIndex([selfBuilding]);
    const sun = { altitude: 0.524, azimuth: Math.PI }; // sole basso da nord
    expect(isInSun(tLat, tLng, sun, index)).toBe(true);
  });
});
