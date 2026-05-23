import type { Terrace } from '../../src/types/index.js';

// Mappatura delle colonne effettive del CSV BCN (vedi scripts/lib/csv-schema.md).
const COLS = {
  lng: 'LONGITUD',
  lat: 'LATITUD',
  emplacament: 'EMPLACAMENT',
  neighborhood: 'NOM_BARRI',
  tables: 'TAULES',
  chairs: 'CADIRES',
  surface: 'SUPERFICIE_OCUPADA',
} as const;

export function parseTerracesCsv(text: string): Terrace[] {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return [];
  const sep = detectSeparator(lines[0]!);
  const header = parseCsvRow(lines[0]!, sep);
  const idx = {
    lng: header.indexOf(COLS.lng),
    lat: header.indexOf(COLS.lat),
    emplacament: header.indexOf(COLS.emplacament),
    neighborhood: header.indexOf(COLS.neighborhood),
    tables: header.indexOf(COLS.tables),
    chairs: header.indexOf(COLS.chairs),
    surface: header.indexOf(COLS.surface),
  };

  const out: Terrace[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]!, sep);
    const lat = num(cells[idx.lat]);
    const lng = num(cells[idx.lng]);
    if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) continue;
    const emplacament = cells[idx.emplacament] ?? '';
    out.push({
      id: `T-${i}`,
      name: emplacament,
      address: emplacament,
      lat,
      lng,
      tables: num(cells[idx.tables]) || 0,
      chairs: num(cells[idx.chairs]) || 0,
      surfaceSqM: num(cells[idx.surface]) || 0,
      neighborhood: cells[idx.neighborhood] ?? '',
    });
  }
  return out;
}

function detectSeparator(headerLine: string): string {
  // Il dataset BCN usa `;`. Lasciamo un fallback su `,` per future varianti.
  if (headerLine.includes(';')) return ';';
  return ',';
}

function splitCsvLines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

function parseCsvRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(s: string | undefined): number {
  if (s == null || s === '') return NaN;
  // Accetta sia "12" che "12,5" che "12.5".
  const cleaned = s.replace(',', '.').replace(/[^0-9.\-eE]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;
  return parseFloat(cleaned);
}
