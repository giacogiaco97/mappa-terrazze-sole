import { describe, expect, test } from 'vitest';
import { resolveHeight } from '../resolve-height.js';

describe('resolveHeight', () => {
  test('usa il tag height se valido', () => {
    expect(resolveHeight({ height: '18.5' })).toEqual({ height: 18.5, source: 'osm' });
  });

  test('parsa "18 m" come 18', () => {
    expect(resolveHeight({ height: '18 m' })).toEqual({ height: 18, source: 'osm' });
  });

  test('usa building:levels × 3 in fallback', () => {
    expect(resolveHeight({ 'building:levels': '5' })).toEqual({ height: 15, source: 'levels' });
  });

  test('default 12 m se nulla è disponibile', () => {
    expect(resolveHeight({})).toEqual({ height: 12, source: 'default' });
  });

  test('preferisce height su levels', () => {
    expect(resolveHeight({ height: '20', 'building:levels': '8' }))
      .toEqual({ height: 20, source: 'osm' });
  });

  test('ignora height non numerico e cade su levels', () => {
    expect(resolveHeight({ height: 'alto', 'building:levels': '3' }))
      .toEqual({ height: 9, source: 'levels' });
  });
});
