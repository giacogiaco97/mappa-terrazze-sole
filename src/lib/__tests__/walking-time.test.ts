import { describe, expect, test } from 'vitest';
import { walkingMinutes } from '../walking-time.js';

describe('walkingMinutes', () => {
  test('500 m → 6 minuti (5 km/h)', () => {
    expect(walkingMinutes(500)).toBe(6);
  });
  test('arrotonda al minuto', () => {
    expect(walkingMinutes(100)).toBe(1);
  });
  test('0 m = 0', () => {
    expect(walkingMinutes(0)).toBe(0);
  });
});
