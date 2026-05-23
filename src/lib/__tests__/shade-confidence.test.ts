import { describe, expect, test } from 'vitest';
import { getShadeConfidence } from '../shade-confidence.js';
import type { BuildingIndex } from '../building-index.js';
import type { Building } from '../../types/index.js';

const mkIdx = (buildings: Building[]): BuildingIndex => ({
  search: () => buildings,
});

const mkB = (id: string, height: number, source: 'osm' | 'levels' | 'default'): Building => ({
  id, height, heightSource: source,
  footprint: [[2.165, 41.39], [2.166, 41.39], [2.166, 41.391], [2.165, 41.391], [2.165, 41.39]],
});

describe('getShadeConfidence', () => {
  test('high se almeno un edificio ha source osm', () => {
    const idx = mkIdx([mkB('a', 12, 'default'), mkB('b', 20, 'osm'), mkB('c', 9, 'levels')]);
    expect(getShadeConfidence(41.39, 2.165, idx)).toBe('high');
  });

  test('medium se nessun osm ma c\'è almeno un levels', () => {
    const idx = mkIdx([mkB('a', 12, 'default'), mkB('b', 9, 'levels')]);
    expect(getShadeConfidence(41.39, 2.165, idx)).toBe('medium');
  });

  test('low se tutti gli edifici hanno solo default', () => {
    const idx = mkIdx([mkB('a', 12, 'default'), mkB('b', 12, 'default')]);
    expect(getShadeConfidence(41.39, 2.165, idx)).toBe('low');
  });

  test('low se nessun edificio nelle vicinanze', () => {
    const idx = mkIdx([]);
    expect(getShadeConfidence(41.39, 2.165, idx)).toBe('low');
  });
});
