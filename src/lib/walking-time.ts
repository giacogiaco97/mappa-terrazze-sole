const KM_PER_H = 5;
export function walkingMinutes(meters: number): number {
  if (meters <= 0) return 0;
  return Math.max(1, Math.round((meters / 1000) / KM_PER_H * 60));
}
