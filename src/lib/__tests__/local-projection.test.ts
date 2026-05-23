import { describe, expect, test } from 'vitest';
import { makeLocalProjection } from '../local-projection.js';

describe('makeLocalProjection', () => {
  test('origine = (0,0)', () => {
    const proj = makeLocalProjection(41.39, 2.165);
    expect(proj.project(41.39, 2.165)).toEqual([0, 0]);
  });

  test('1 grado di latitudine ≈ 111 km a nord', () => {
    const proj = makeLocalProjection(41.39, 2.165);
    const [x, y] = proj.project(42.39, 2.165);
    expect(x).toBeCloseTo(0, 0);
    expect(y).toBeCloseTo(111_320, -2);
  });

  test('1 grado di longitudine alla latitudine BCN ≈ cos(lat) × 111 km', () => {
    const proj = makeLocalProjection(41.39, 2.165);
    const [x, y] = proj.project(41.39, 3.165);
    const expected = Math.cos((41.39 * Math.PI) / 180) * 111_320;
    expect(x).toBeCloseTo(expected, -2);
    expect(y).toBeCloseTo(0, 0);
  });
});
