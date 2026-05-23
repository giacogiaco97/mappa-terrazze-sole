export function cellKey(lng: number, lat: number, step: number): string {
  const x = Math.floor(lng / step);
  const y = Math.floor(lat / step);
  return `${x}_${y}`;
}

export type ChunkableFeature = {
  id: string;
  footprint: [number, number][];
};

export function chunkByGrid<T extends ChunkableFeature>(
  features: T[],
  step: number,
): Record<string, T[]> {
  const buckets: Record<string, T[]> = {};
  for (const f of features) {
    const first = f.footprint[0];
    if (!first) continue;
    const [lng, lat] = first;
    const key = cellKey(lng, lat, step);
    (buckets[key] ??= []).push(f);
  }
  return buckets;
}
