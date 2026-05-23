import type { Building, Meta, Terrace } from '../types/index.js';

const BASE = `${import.meta.env.BASE_URL}data/`;

export async function loadTerraces(): Promise<Terrace[]> {
  const r = await fetch(`${BASE}terraces.json`);
  if (!r.ok) throw new Error(`terraces.json HTTP ${r.status}`);
  return r.json() as Promise<Terrace[]>;
}

export async function loadMeta(): Promise<Meta> {
  const r = await fetch(`${BASE}meta.json`);
  if (!r.ok) throw new Error(`meta.json HTTP ${r.status}`);
  return r.json() as Promise<Meta>;
}

// Cache in-memory dei chunk già scaricati.
const buildingCache = new Map<string, Promise<Building[]>>();

export function loadBuildingChunk(key: string): Promise<Building[]> {
  let p = buildingCache.get(key);
  if (!p) {
    p = fetch(`${BASE}buildings/${key}.json`)
      .then((r) => r.ok ? r.json() as Promise<Building[]> : [])
      .catch(() => []);
    buildingCache.set(key, p);
  }
  return p;
}

export function cellsForBbox(
  bbox: [number, number, number, number],
  step: number,
  marginMeters = 300,
): string[] {
  // Espande il bbox del margine richiesto (in metri ~ degrees lat).
  const dLat = marginMeters / 111_320;
  const meanLat = (bbox[1] + bbox[3]) / 2;
  const dLng = marginMeters / (111_320 * Math.cos(meanLat * Math.PI / 180));
  const minLng = bbox[0] - dLng;
  const maxLng = bbox[2] + dLng;
  const minLat = bbox[1] - dLat;
  const maxLat = bbox[3] + dLat;
  const xMin = Math.floor(minLng / step);
  const xMax = Math.floor(maxLng / step);
  const yMin = Math.floor(minLat / step);
  const yMax = Math.floor(maxLat / step);
  const out: string[] = [];
  for (let x = xMin; x <= xMax; x++)
    for (let y = yMin; y <= yMax; y++) out.push(`${x}_${y}`);
  return out;
}
