export type TimelineState = 'night' | 'sun' | 'shade';

export type TimelineSegment = {
  /** Inizio del segmento (inclusivo, ora locale). */
  from: Date;
  /** Fine del segmento (esclusiva, ora locale). */
  to: Date;
  state: TimelineState;
};

export type TimelineResult = {
  /** Segmenti coalescenti che coprono esattamente 24h. */
  segments: TimelineSegment[];
  /** Minuti totali al sole nella giornata. */
  sunMinutes: number;
  /** Minuti totali con sole sopra l'orizzonte (sole + ombra). */
  daylightMinutes: number;
};

/**
 * Costruisce il timeline 24h (dalla mezzanotte locale) della terrazza
 * dato un classificatore puro. Coalescente: sample consecutivi con stesso
 * stato vengono fusi in un unico segmento.
 *
 * Il classificatore può essere mockato nei test; in produzione si compone
 * a partire da getSunPosition + isInSun (vedi makeBuildingClassifier).
 */
export function computeSunTimeline(
  reference: Date,
  classify: (date: Date) => TimelineState,
  stepMinutes = 15,
): TimelineResult {
  if (stepMinutes <= 0 || !Number.isFinite(stepMinutes)) {
    throw new Error(`stepMinutes deve essere > 0, ricevuto ${stepMinutes}`);
  }
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const stepMs = stepMinutes * 60_000;
  const totalSteps = Math.round((24 * 60) / stepMinutes);

  const segments: TimelineSegment[] = [];
  let sunMinutes = 0;
  let daylightMinutes = 0;
  let cur: TimelineSegment | null = null;

  for (let i = 0; i < totalSteps; i++) {
    const sampleStart = new Date(start.getTime() + i * stepMs);
    const sampleEnd = new Date(start.getTime() + (i + 1) * stepMs);
    const state = classify(sampleStart);
    if (state === 'sun') sunMinutes += stepMinutes;
    if (state === 'sun' || state === 'shade') daylightMinutes += stepMinutes;

    if (cur && cur.state === state) {
      cur.to = sampleEnd;
    } else {
      if (cur) segments.push(cur);
      cur = { from: sampleStart, to: sampleEnd, state };
    }
  }
  if (cur) segments.push(cur);

  return { segments, sunMinutes, daylightMinutes };
}

/** Converte un timestamp in frazione [0..1] della giornata di `reference`. */
export function dayFraction(date: Date, reference: Date): number {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  const ms = date.getTime() - start.getTime();
  const f = ms / (24 * 60 * 60_000);
  return Math.max(0, Math.min(1, f));
}
