import { describe, expect, test } from 'vitest';
import { sortTerracesByDistance } from '../sort-terraces.js';
import type { Terrace } from '../../types/index.js';

const mk = (id: string, lat: number, lng: number): Terrace => ({
  id, name: id, address: '', lat, lng, tables: 0, chairs: 0, surfaceSqM: 0, neighborhood: '',
});

describe('sortTerracesByDistance', () => {
  test('ordina dal più vicino al più lontano', () => {
    const user = { lat: 41.39, lng: 2.165 };
    const items = [
      mk('far', 41.45, 2.20),
      mk('near', 41.391, 2.166),
      mk('mid', 41.40, 2.18),
    ];
    const out = sortTerracesByDistance(items, user);
    expect(out.map((x) => x.terrace.id)).toEqual(['near', 'mid', 'far']);
    expect(out[0]!.distanceMeters).toBeLessThan(out[1]!.distanceMeters);
  });
});
