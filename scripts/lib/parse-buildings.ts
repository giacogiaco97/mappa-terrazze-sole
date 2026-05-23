export type RawBuilding = {
  id: string;
  tags: Record<string, string>;
  footprint: [number, number][]; // [lng, lat][]
};

type Element = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

export function parseOverpassBuildings(json: { elements: Element[] }): RawBuilding[] {
  const out: RawBuilding[] = [];
  for (const el of json.elements) {
    if (el.type !== 'way') continue;
    if (!el.geometry || el.geometry.length < 3) continue;
    out.push({
      id: `w${el.id}`,
      tags: el.tags ?? {},
      footprint: el.geometry.map((p) => [p.lon, p.lat]),
    });
  }
  return out;
}
