import type { Terrace } from '../../src/types/index.js';
import { utmToWgs84 } from './utm-to-wgs84.js';

/**
 * Parser CSV "Terrazas de hostelería y restauración" Open Data Madrid
 * (https://datos.madrid.es/dataset/200085-0-censo-locales, risorsa 200085-6).
 *
 * Schema chiave:
 *  - id_terraza               ID univoco
 *  - rotulo                   nome commerciale (es. "BAR EL ROCIO")
 *  - desc_barrio_local        barrio (es. "SOL")
 *  - desc_vial_edificio       nome via (es. "VICTORIA")
 *  - num_edificio             numero civico (es. "000006")
 *  - coordenada_x_local       UTM ETRS89 zona 30N X
 *  - coordenada_y_local       UTM ETRS89 zona 30N Y
 *  - mesas_es / mesas_ra      tavoli (estacional / régimen anual)
 *  - sillas_es / sillas_ra    sedie
 *  - Superficie_ES / Superficie_RA  m²
 *  - desc_situacion_terraza   stato ("Abierta", "Cerrada")
 *  - desc_periodo_terraza     "Anual" o "Estacional"
 *  - desc_ubicacion_terraza   "Acera", "Calle peatonal", etc.
 */

const COLS = {
  id: 'id_terraza',
  rotulo: 'rotulo',
  barrio: 'desc_barrio_local',
  vial: 'desc_vial_edificio',
  num: 'num_edificio',
  x: 'coordenada_x_local',
  y: 'coordenada_y_local',
  mesasEs: 'mesas_es',
  mesasRa: 'mesas_ra',
  sillasEs: 'sillas_es',
  sillasRa: 'sillas_ra',
  supEs: 'Superficie_ES',
  supRa: 'Superficie_RA',
  situacion: 'desc_situacion_terraza',
} as const;

const UTM_ZONE = 30; // Madrid

export function parseTerracesMadCsv(text: string): Terrace[] {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return [];
  const sep = ';';
  const header = parseCsvRow(lines[0]!, sep);

  const idx = {
    id: header.indexOf(COLS.id),
    rotulo: header.indexOf(COLS.rotulo),
    barrio: header.indexOf(COLS.barrio),
    vial: header.indexOf(COLS.vial),
    num: header.indexOf(COLS.num),
    x: header.indexOf(COLS.x),
    y: header.indexOf(COLS.y),
    mesasEs: header.indexOf(COLS.mesasEs),
    mesasRa: header.indexOf(COLS.mesasRa),
    sillasEs: header.indexOf(COLS.sillasEs),
    sillasRa: header.indexOf(COLS.sillasRa),
    supEs: header.indexOf(COLS.supEs),
    supRa: header.indexOf(COLS.supRa),
    situacion: header.indexOf(COLS.situacion),
  };

  // Sanity check: tutte le colonne chiave devono esistere
  for (const [k, v] of Object.entries(idx)) {
    if (v < 0) throw new Error(`Madrid CSV: colonna mancante '${k}' (header cambiato?)`);
  }

  const out: Terrace[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]!, sep);
    const id = (cells[idx.id] ?? '').trim();
    const x = num(cells[idx.x]);
    const y = num(cells[idx.y]);
    if (!id || !isFinite(x) || !isFinite(y) || x === 0 || y === 0) continue;

    // Filtro: solo terrazze "Abierta" (le altre sono storiche / chiuse)
    const situacion = (cells[idx.situacion] ?? '').trim().toLowerCase();
    if (situacion && situacion !== 'abierta') continue;

    const { lat, lng } = utmToWgs84(x, y, UTM_ZONE);
    // Sanity check: dentro bbox Madrid
    if (lng < -4.0 || lng > -3.5 || lat < 40.3 || lat > 40.55) continue;

    const rotulo = (cells[idx.rotulo] ?? '').trim().replace(/\s+/g, ' ');
    const vial = (cells[idx.vial] ?? '').trim().replace(/\s+/g, ' ');
    const numCiv = (cells[idx.num] ?? '').trim().replace(/^0+/, '');
    const address = [vial, numCiv].filter(Boolean).join(' ');

    // Preferenza: dati régimen anual; fallback estacional
    const mesasRa = num(cells[idx.mesasRa]);
    const mesasEs = num(cells[idx.mesasEs]);
    const sillasRa = num(cells[idx.sillasRa]);
    const sillasEs = num(cells[idx.sillasEs]);
    const supRa = num(cells[idx.supRa]);
    const supEs = num(cells[idx.supEs]);

    const tables = Math.round(isFinite(mesasRa) && mesasRa > 0 ? mesasRa : (mesasEs || 0));
    const chairs = Math.round(isFinite(sillasRa) && sillasRa > 0 ? sillasRa : (sillasEs || 0));
    const surface = isFinite(supRa) && supRa > 0 ? supRa : (supEs || 0);

    out.push({
      id: `M-${id}`,
      name: rotulo || address,
      address: address || rotulo,
      lat,
      lng,
      tables,
      chairs,
      surfaceSqM: Math.round(surface * 10) / 10,
      neighborhood: titleCase((cells[idx.barrio] ?? '').trim()),
    });
  }
  return out;
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
  const cleaned = s.replace(',', '.').replace(/[^0-9.\-eE]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return NaN;
  return parseFloat(cleaned);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ''))
    .join(' ');
}
