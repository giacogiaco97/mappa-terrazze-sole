import { describe, expect, test } from 'vitest';
import { buildBuildingIndex } from '../building-index.js';
import type { Building } from '../../types/index.js';

const b1: Building = {
  id: 'a',
  height: 12,
  footprint: [[2.16, 41.38], [2.161, 41.38], [2.161, 41.381], [2.16, 41.381], [2.16, 41.38]],
  heightSource: 'osm',
};
const b2: Building = {
  id: 'b',
  height: 12,
  footprint: [[2.20, 41.42], [2.201, 41.42], [2.201, 41.421], [2.20, 41.421], [2.20, 41.42]],
  heightSource: 'osm',
};

describe('buildBuildingIndex', () => {
  test('search ritorna solo gli edifici dentro il bbox', () => {
    const idx = buildBuildingIndex([b1, b2]);
    const hits = idx.search(2.159, 41.379, 2.162, 41.382);
    expect(hits.map((h) => h.id)).toEqual(['a']);
  });

  test('bbox che copre tutto', () => {
    const idx = buildBuildingIndex([b1, b2]);
    const hits = idx.search(2.0, 41.0, 2.5, 42.0);
    expect(hits).toHaveLength(2);
  });
});
