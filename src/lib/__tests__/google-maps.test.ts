import { describe, expect, test } from 'vitest';
import { googleMapsUrl } from '../google-maps.js';

describe('googleMapsUrl', () => {
  test('usa nome + indirizzo + Barcelona', () => {
    const url = googleMapsUrl({ name: 'Bar Pepito', address: 'Carrer Major 12' });
    expect(url).toMatch(/google\.com\/maps\/search\/\?api=1&query=/);
    expect(url).toContain(encodeURIComponent('Bar Pepito'));
    expect(url).toContain(encodeURIComponent('Carrer Major 12'));
    expect(url).toContain(encodeURIComponent('Barcelona'));
  });

  test('gestisce nome vuoto fallback su indirizzo', () => {
    const url = googleMapsUrl({ name: '', address: 'Plaça X' });
    expect(url).toContain(encodeURIComponent('Plaça X'));
  });
});
