import { describe, expect, test } from 'vitest';
import { parseTerracesCsv } from '../parse-terraces.js';

// Header reale del dataset Open Data BCN (verificato 2026-05-23, vedi csv-schema.md).
const HEADER = '"DATA_EXPLO";"OCUPACIO";"CODI_DISTRICTE";"NOM_DISTRICTE";"CODI_BARRI";"NOM_BARRI";"EMPLACAMENT";"SUPERFICIE_OCUPADA";"TAULES";"CADIRES";"TAULES_VORERA";"CADIRES_VORERA";"TAULES_CALCADA";"CADIRES_CALCADA";"ORDENACIO";"VIGENCIA";"X_ETRS89";"Y_ETRS89";"LATITUD";"LONGITUD"';

const SAMPLE_CSV = [
  HEADER,
  '1/1/2026 0:00:00;"Terrasses en Via Pública";2;"Eixample";6;"la Sagrada Família";"AV. GAUDI, 66";"12";4.00;16.00;4.00;16.00;0.00;0.00;"General";"Anual";31007048;84626422;"41.4102259966535";"2.17451116103995"',
  '1/1/2026 0:00:00;"Terrasses en Via Pública";1;"Ciutat Vella";1;"el Raval";"C. EXEMPLE, 12";"8.5";3.00;12.00;3.00;12.00;0.00;0.00;"General";"Anual";0;0;"41.38";"2.17"',
].join('\n');

describe('parseTerracesCsv', () => {
  test('parsa due record validi col separatore `;`', () => {
    const out = parseTerracesCsv(SAMPLE_CSV);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: 'T-1',
      name: 'AV. GAUDI, 66',
      address: 'AV. GAUDI, 66',
      neighborhood: 'la Sagrada Família',
      tables: 4,
      chairs: 16,
      surfaceSqM: 12,
    });
    expect(out[0]?.lat).toBeCloseTo(41.4102259966535, 6);
    expect(out[0]?.lng).toBeCloseTo(2.17451116103995, 6);
  });

  test('scarta righe con coordinate non parsabili', () => {
    const csv = [
      HEADER,
      '1/1/2026 0:00:00;"x";1;"d";1;"b";"E";"1";1;1;1;1;0;0;"o";"v";0;0;"ABC";"2.17"',
    ].join('\n');
    expect(parseTerracesCsv(csv)).toHaveLength(0);
  });

  test('scarta righe con lat o lng = 0', () => {
    const csv = [
      HEADER,
      '1/1/2026 0:00:00;"x";1;"d";1;"b";"E";"1";1;1;1;1;0;0;"o";"v";0;0;"0";"2.17"',
    ].join('\n');
    expect(parseTerracesCsv(csv)).toHaveLength(0);
  });

  test('assegna ID progressivo basato sull\'indice di riga', () => {
    const out = parseTerracesCsv(SAMPLE_CSV);
    expect(out[0]?.id).toBe('T-1');
    expect(out[1]?.id).toBe('T-2');
  });

  test('gestisce valori numerici sia quotati che non quotati', () => {
    const out = parseTerracesCsv(SAMPLE_CSV);
    // SUPERFICIE_OCUPADA è "12" (quotato) → 12
    expect(out[0]?.surfaceSqM).toBe(12);
    // TAULES è 4.00 (non quotato) → 4
    expect(out[0]?.tables).toBe(4);
  });

  test('ignora righe vuote', () => {
    const csv = SAMPLE_CSV + '\n\n\n';
    expect(parseTerracesCsv(csv)).toHaveLength(2);
  });
});
