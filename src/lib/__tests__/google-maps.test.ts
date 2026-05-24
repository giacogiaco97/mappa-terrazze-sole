import { describe, expect, test } from 'vitest';
import { googleMapsUrl, streetViewUrl } from '../google-maps.js';

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

  test('con placeId genera link pixel-perfect alla scheda Google', () => {
    const url = googleMapsUrl({
      name: 'Café Turó',
      address: 'C. TENOR VIÑAS, 1',
      placeId: 'ChIJ1234567890abcdef',
    });
    expect(url).toContain('query_place_id=ChIJ1234567890abcdef');
    expect(url).toContain(encodeURIComponent('Café Turó'));
    // Senza Barcellona/indirizzo quando ho placeId (Google ha già tutto dal place_id)
    expect(url).not.toContain(encodeURIComponent('Barcelona'));
  });

  test('senza placeId NON include query_place_id', () => {
    const url = googleMapsUrl({ name: 'Bar', address: 'Via X' });
    expect(url).not.toContain('query_place_id');
  });
});

describe('streetViewUrl', () => {
  test('contiene lat/lng e map_action=pano', () => {
    const url = streetViewUrl(41.39, 2.165);
    expect(url).toContain('map_action=pano');
    expect(url).toContain('viewpoint=41.39,2.165');
  });
});
