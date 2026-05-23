import { describe, expect, test } from 'vitest';
import { parseOverpassBuildings } from '../parse-buildings.js';

const SAMPLE = {
  elements: [
    {
      type: 'way',
      id: 111,
      tags: { building: 'yes', height: '15.5' },
      geometry: [
        { lat: 41.38, lon: 2.16 },
        { lat: 41.38, lon: 2.161 },
        { lat: 41.381, lon: 2.161 },
        { lat: 41.381, lon: 2.16 },
        { lat: 41.38, lon: 2.16 },
      ],
    },
    {
      type: 'way',
      id: 222,
      tags: { building: 'residential', 'building:levels': '4' },
      geometry: [
        { lat: 41.39, lon: 2.17 },
        { lat: 41.39, lon: 2.171 },
        { lat: 41.391, lon: 2.171 },
        { lat: 41.391, lon: 2.17 },
        { lat: 41.39, lon: 2.17 },
      ],
    },
    { type: 'way', id: 333, tags: { building: 'yes' } }, // niente geometria, da scartare
  ],
};

describe('parseOverpassBuildings', () => {
  test('estrae footprint + tag', () => {
    const out = parseOverpassBuildings(SAMPLE);
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe('w111');
    expect(out[0]?.tags.height).toBe('15.5');
    expect(out[0]?.footprint[0]).toEqual([2.16, 41.38]);
  });

  test('scarta edifici senza geometria', () => {
    const out = parseOverpassBuildings(SAMPLE);
    expect(out.find((b) => b.id === 'w333')).toBeUndefined();
  });
});
