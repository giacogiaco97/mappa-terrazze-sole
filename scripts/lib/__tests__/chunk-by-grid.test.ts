import { describe, expect, test } from 'vitest';
import { chunkByGrid, cellKey } from '../chunk-by-grid.js';

describe('cellKey', () => {
  test('coordinate negative + step 1 = (-1,-1) per (-0.5,-0.5)', () => {
    expect(cellKey(-0.5, -0.5, 1)).toBe('-1_-1');
  });
  test('origine cade in 0_0', () => {
    expect(cellKey(0.1, 0.1, 1)).toBe('0_0');
  });
});

describe('chunkByGrid', () => {
  test('raggruppa features per cella usando il primo punto del footprint', () => {
    const features = [
      { id: 'a', footprint: [[2.16, 41.38]] as [number, number][] },
      { id: 'b', footprint: [[2.17, 41.39]] as [number, number][] },
      { id: 'c', footprint: [[2.165, 41.385]] as [number, number][] },
    ];
    const out = chunkByGrid(features, 0.01);
    const total = Object.values(out).reduce((s, v) => s + v.length, 0);
    expect(total).toBe(3);
    expect(Object.keys(out).length).toBeGreaterThanOrEqual(2);
  });

  test('scarta features con footprint vuoto', () => {
    const features = [
      { id: 'empty', footprint: [] as [number, number][] },
      { id: 'ok', footprint: [[2.16, 41.38]] as [number, number][] },
    ];
    const out = chunkByGrid(features, 0.01);
    const total = Object.values(out).reduce((s, v) => s + v.length, 0);
    expect(total).toBe(1);
  });
});
