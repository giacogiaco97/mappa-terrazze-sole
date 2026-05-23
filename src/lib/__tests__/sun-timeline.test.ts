import { describe, expect, test } from 'vitest';
import { computeSunTimeline, type TimelineState } from '../sun-timeline.js';

describe('computeSunTimeline', () => {
  test('un solo segmento se la classifica è sempre la stessa', () => {
    const ref = new Date(2026, 5, 21, 12, 0, 0); // 21 giu 2026, mezzogiorno locale
    const { segments, sunMinutes, daylightMinutes } = computeSunTimeline(
      ref,
      () => 'night',
      60,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]!.state).toBe('night');
    expect(sunMinutes).toBe(0);
    expect(daylightMinutes).toBe(0);
    expect(segments[0]!.from.getHours()).toBe(0);
    expect(segments[0]!.to.getHours()).toBe(0); // +1 giorno → 0
  });

  test('giornata sempre al sole conta 1440 min di sole', () => {
    const ref = new Date(2026, 5, 21, 12, 0, 0);
    const { segments, sunMinutes, daylightMinutes } = computeSunTimeline(
      ref,
      () => 'sun',
      60,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]!.state).toBe('sun');
    expect(sunMinutes).toBe(24 * 60);
    expect(daylightMinutes).toBe(24 * 60);
  });

  test('night → sun → shade → night produce 4 segmenti coalescenti', () => {
    const classify = (d: Date): TimelineState => {
      const h = d.getHours();
      if (h < 7) return 'night';
      if (h < 14) return 'sun';
      if (h < 20) return 'shade';
      return 'night';
    };
    const ref = new Date(2026, 5, 21, 0, 0, 0);
    const { segments, sunMinutes, daylightMinutes } = computeSunTimeline(ref, classify, 60);
    expect(segments).toHaveLength(4);
    expect(segments[0]!.state).toBe('night');
    expect(segments[1]!.state).toBe('sun');
    expect(segments[2]!.state).toBe('shade');
    expect(segments[3]!.state).toBe('night');
    expect(sunMinutes).toBe((14 - 7) * 60);
    expect(daylightMinutes).toBe((20 - 7) * 60);
  });

  test('i segmenti coprono esattamente 24h senza gap', () => {
    const ref = new Date(2026, 5, 21, 8, 30, 0);
    const { segments } = computeSunTimeline(ref, () => 'sun', 30);
    expect(segments).toHaveLength(1);
    const startMs = segments[0]!.from.getTime();
    const endMs = segments[0]!.to.getTime();
    expect(endMs - startMs).toBe(24 * 60 * 60_000);
  });

  test('step più piccolo = più precisione (segmenti consecutivi non si fondono se cambia stato)', () => {
    let calls = 0;
    const classify = (): TimelineState => {
      calls++;
      // Alterna ogni chiamata: sun, shade, sun, shade…
      return calls % 2 === 0 ? 'shade' : 'sun';
    };
    const ref = new Date(2026, 5, 21, 0, 0, 0);
    const { segments } = computeSunTimeline(ref, classify, 15);
    // 96 sample alternati = 96 segmenti
    expect(segments.length).toBe(96);
  });
});
