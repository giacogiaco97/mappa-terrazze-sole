const MAX_HOURS_AHEAD = 8;

export type SunPredicate = (lat: number, lng: number, date: Date) => boolean;

export function sunnyUntil(
  now: Date,
  lat: number,
  lng: number,
  isSun: SunPredicate,
  stepMinutes = 10,
): Date | null {
  if (!isSun(lat, lng, now)) return null;
  const stepMs = stepMinutes * 60_000;
  const maxIters = (MAX_HOURS_AHEAD * 60) / stepMinutes;
  let t = new Date(now.getTime());
  for (let i = 0; i < maxIters; i++) {
    t = new Date(t.getTime() + stepMs);
    if (!isSun(lat, lng, t)) return t;
  }
  return null;
}
