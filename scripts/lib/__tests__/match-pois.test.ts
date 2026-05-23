import { describe, expect, test } from 'vitest';
import { matchTerracesToPois } from '../match-pois.js';
import type { RawPoi } from '../../fetch-osm-pois.js';
import type { Terrace } from '../../../src/types/index.js';

const mkT = (id: string, lat: number, lng: number, name = id): Terrace => ({
  id, name, address: name, lat, lng,
  tables: 0, neighborhood: '',
});
const mkP = (id: string, lat: number, lng: number, name: string, kind = 'restaurant'): RawPoi => ({
  id, lat, lng, name, kind,
});

describe('matchTerracesToPois', () => {
  test('assegna il POI più vicino entro 30 m', () => {
    // ~10 m a est di una terrazza a 41.39 / 2.165
    const terraces = [mkT('T1', 41.39, 2.165)];
    const pois = [mkP('n1', 41.39, 2.16512, 'Bar Pepito')];
    const out = matchTerracesToPois(terraces, pois, 30);
    expect(out[0]!.name).toBe('Bar Pepito');
    expect(out[0]!.address).toBe('T1'); // address inalterato
  });

  test('non assegna se POI è oltre la soglia', () => {
    const terraces = [mkT('T1', 41.39, 2.165)];
    // ~100 m via
    const pois = [mkP('n1', 41.39, 2.166, 'Far Bar')];
    const out = matchTerracesToPois(terraces, pois, 30);
    expect(out[0]!.name).toBe('T1'); // fallback su nome originale
  });

  test('preferisce il POI più vicino se più candidati nella soglia', () => {
    const terraces = [mkT('T1', 41.39, 2.165)];
    const pois = [
      mkP('far', 41.39, 2.16518, 'Far'),  // ~15 m
      mkP('near', 41.39, 2.16505, 'Near'), // ~4 m
    ];
    const out = matchTerracesToPois(terraces, pois, 30);
    expect(out[0]!.name).toBe('Near');
  });

  test('un singolo POI viene assegnato a una sola terrazza (più vicina)', () => {
    // POI tra due terrazze, più vicino a T1
    const terraces = [
      mkT('T1', 41.39, 2.165),
      mkT('T2', 41.39, 2.16515),
    ];
    const pois = [mkP('n1', 41.39, 2.16502, 'Único Bar')];
    const out = matchTerracesToPois(terraces, pois, 30);
    expect(out[0]!.name).toBe('Único Bar');
    expect(out[1]!.name).toBe('T2'); // non riusa il POI già assegnato
  });

  test('lavora su grande input in tempi ragionevoli (smoke)', () => {
    const terraces: Terrace[] = [];
    const pois: RawPoi[] = [];
    for (let i = 0; i < 1000; i++) {
      terraces.push(mkT(`T${i}`, 41.39 + Math.random() * 0.1, 2.165 + Math.random() * 0.1));
      pois.push(mkP(`p${i}`, 41.39 + Math.random() * 0.1, 2.165 + Math.random() * 0.1, `Bar ${i}`));
    }
    const t0 = Date.now();
    const out = matchTerracesToPois(terraces, pois, 30);
    const dt = Date.now() - t0;
    expect(out.length).toBe(1000);
    expect(dt).toBeLessThan(1500);
  });
});
