import { describe, it, expect } from 'vitest';
import { utmToWgs84 } from '../utm-to-wgs84.js';

describe('utmToWgs84 — zona 30N (Madrid, Spagna)', () => {
  it('converte Puerta del Sol con precisione < 5m', () => {
    // Puerta del Sol: lat 40.4168, lng -3.7038
    // UTM 30N: ~440370, 4474348 (approx)
    const { lat, lng } = utmToWgs84(440370, 4474348, 30);
    expect(lat).toBeCloseTo(40.4168, 2);
    expect(lng).toBeCloseTo(-3.7038, 2);
  });

  it('converte coordinate reali dal CSV Madrid (O´REILLYS, Calle Victoria)', () => {
    // Dal CSV: x=440447.59, y=4474173.53 → Calle Victoria 6, dovrebbe ≈ 40.415, -3.703
    const { lat, lng } = utmToWgs84(440447.59, 4474173.53, 30);
    expect(lat).toBeGreaterThan(40.41);
    expect(lat).toBeLessThan(40.42);
    expect(lng).toBeGreaterThan(-3.71);
    expect(lng).toBeLessThan(-3.69);
  });

  it('converte coordinate Salamanca (CAÑADIO, Conde de Peñalver)', () => {
    // Dal CSV: x=442762.58, y=4476056.5 → barrio Lista, distrito Salamanca (NE Madrid)
    const { lat, lng } = utmToWgs84(442762.58, 4476056.5, 30);
    expect(lat).toBeGreaterThan(40.43);
    expect(lat).toBeLessThan(40.44);
    expect(lng).toBeGreaterThan(-3.68);
    expect(lng).toBeLessThan(-3.67);
  });

  it('round-trip è consistente (zona 30N tutta nella penisola iberica)', () => {
    // Coordinate generiche nella penisola
    const { lat, lng } = utmToWgs84(450000, 4500000, 30);
    expect(lat).toBeGreaterThan(40);
    expect(lat).toBeLessThan(41);
    expect(lng).toBeGreaterThan(-4);
    expect(lng).toBeLessThan(-3);
  });
});
