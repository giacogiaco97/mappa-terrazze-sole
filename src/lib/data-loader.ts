import type { Building, Meta, Terrace } from '../types/index.js';

const BASE = `${import.meta.env.BASE_URL}data/`;

export type CityCode = string;

export type CityConfig = {
  code: CityCode;
  name: string;
  displayName: { es: string; en: string; ca: string };
  bbox: [number, number, number, number];
  center: { lat: number; lng: number; zoom: number };
};

export async function loadCitiesIndex(): Promise<Record<string, CityConfig>> {
  const r = await fetch(`${BASE}cities.json`);
  if (!r.ok) throw new Error(`cities.json HTTP ${r.status}`);
  const json = (await r.json()) as { cities: Record<string, CityConfig> };
  return json.cities;
}

export async function loadTerraces(city: CityCode): Promise<Terrace[]> {
  const r = await fetch(`${BASE}${city}/terraces.json`);
  if (!r.ok) throw new Error(`terraces.json (${city}) HTTP ${r.status}`);
  return r.json() as Promise<Terrace[]>;
}

export async function loadMeta(city: CityCode): Promise<Meta> {
  const r = await fetch(`${BASE}${city}/meta.json`);
  if (!r.ok) throw new Error(`meta.json (${city}) HTTP ${r.status}`);
  return r.json() as Promise<Meta>;
}

// Cache in-memory dei chunk già scaricati (chiave include city per evitare collisioni)
const buildingCache = new Map<string, Promise<Building[]>>();

export function loadBuildingChunk(city: CityCode, key: string): Promise<Building[]> {
  const cacheKey = `${city}:${key}`;
  let p = buildingCache.get(cacheKey);
  if (!p) {
    p = fetch(`${BASE}${city}/buildings/${key}.json`)
      .then((r) => r.ok ? r.json() as Promise<Building[]> : [])
      .catch(() => []);
    buildingCache.set(cacheKey, p);
  }
  return p;
}

/** Svuota la cache (chiamare al cambio città per liberare memoria) */
export function clearBuildingCache(): void {
  buildingCache.clear();
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
