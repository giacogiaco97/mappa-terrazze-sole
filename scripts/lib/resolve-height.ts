export type HeightResult = {
  height: number;
  source: 'osm' | 'levels' | 'default';
};

const METERS_PER_LEVEL = 3;
const DEFAULT_HEIGHT = 12;

export function resolveHeight(tags: Record<string, string>): HeightResult {
  const h = parseMeters(tags.height);
  if (h != null) return { height: h, source: 'osm' };

  const lv = parseInt(tags['building:levels'] ?? '', 10);
  if (Number.isFinite(lv) && lv > 0) {
    return { height: lv * METERS_PER_LEVEL, source: 'levels' };
  }

  return { height: DEFAULT_HEIGHT, source: 'default' };
}

function parseMeters(s: string | undefined): number | null {
  if (!s) return null;
  // Accetta "18", "18.5", "18 m", "18,5 m"
  const match = s.replace(',', '.').match(/^([0-9]+(?:\.[0-9]+)?)\s*(m|meter|meters)?$/i);
  if (!match) return null;
  const n = parseFloat(match[1]!);
  return Number.isFinite(n) && n > 0 ? n : null;
}
