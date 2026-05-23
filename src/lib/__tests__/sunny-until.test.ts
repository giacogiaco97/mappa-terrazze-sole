import { describe, expect, test } from 'vitest';
import { sunnyUntil } from '../sunny-until.js';

// Mockiamo isInSun: sole fino alle 17:00, ombra dopo.
const fakeIsInSun = (_lat: number, _lng: number, date: Date) =>
  date.getUTCHours() < 17;

describe('sunnyUntil', () => {
  test("quando attualmente al sole, ritorna l'ora del flip a ombra", () => {
    const now = new Date('2026-06-21T14:00:00Z');
    const flip = sunnyUntil(now, 41.39, 2.165, fakeIsInSun, 10);
    expect(flip).not.toBeNull();
    expect(flip!.getUTCHours()).toBe(17);
  });

  test('null se già in ombra', () => {
    const now = new Date('2026-06-21T18:00:00Z');
    expect(sunnyUntil(now, 41.39, 2.165, fakeIsInSun, 10)).toBeNull();
  });
});
