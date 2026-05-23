import { describe, expect, test } from 'vitest';
import {
  haversineMeters,
  raySegmentIntersection,
  pointInPolygon,
  bboxOfPolygon,
} from '../geometry.js';

describe('haversineMeters', () => {
  test('stessa coordinata = 0', () => {
    expect(haversineMeters(41.39, 2.165, 41.39, 2.165)).toBe(0);
  });
  test('~1 grado di latitudine ≈ 111 km', () => {
    expect(haversineMeters(41.39, 2.165, 42.39, 2.165)).toBeCloseTo(111_195, -2);
  });
});

describe('raySegmentIntersection', () => {
  test('raggio orizzontale verso est intercetta segmento verticale davanti', () => {
    // raggio da (0,0) direzione (1,0)
    // segmento da (5,-1) a (5,1)
    const t = raySegmentIntersection(0, 0, 1, 0, 5, -1, 5, 1);
    expect(t).toBeCloseTo(5, 6);
  });

  test('null se il segmento è dietro al raggio', () => {
    const t = raySegmentIntersection(0, 0, 1, 0, -5, -1, -5, 1);
    expect(t).toBeNull();
  });

  test('null se paralleli', () => {
    const t = raySegmentIntersection(0, 0, 1, 0, 1, 1, 2, 1);
    expect(t).toBeNull();
  });
});

describe('pointInPolygon', () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  test('punto interno', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
  });
  test('punto esterno', () => {
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });
});

describe('bboxOfPolygon', () => {
  test('quadrato', () => {
    const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(bboxOfPolygon(square)).toEqual([0, 0, 10, 10]);
  });
});
