import { describe, expect, test } from 'vitest';
import {
  fetchWeather,
  getWeatherAt,
  weatherKind,
  weatherEmoji,
  isEffectivelySunny,
  type Weather,
} from '../weather.js';

function mockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: () => null,
    length: 0,
  } as Storage;
}

function mockFetchOK(payload: object) {
  return async () => new Response(JSON.stringify(payload), { status: 200 });
}

const SAMPLE = {
  hourly: {
    time: ['2026-05-23T10:00', '2026-05-23T11:00', '2026-05-23T12:00'],
    cloud_cover: [10, 60, 95],
    precipitation_probability: [0, 5, 80],
    weather_code: [0, 2, 61],
  },
};

describe('weather', () => {
  test('fetchWeather popola la cache localStorage', async () => {
    const storage = mockStorage();
    const w = await fetchWeather(41.39, 2.165, 1, storage, mockFetchOK(SAMPLE));
    expect(w).not.toBeNull();
    expect(w!.hours).toHaveLength(3);
    expect(w!.hours[0]!.cloudCover).toBe(10);
    // Cache deve contenere il payload normalizzato
    expect(storage.getItem('weather-cache-v1')).toContain('cloudCover');
  });

  test('fetchWeather usa cache se entro 1h', async () => {
    const storage = mockStorage();
    const fresh: Weather = { fetchedAt: Date.now() - 30 * 60_000, hours: [] };
    storage.setItem('weather-cache-v1', JSON.stringify(fresh));
    // Se chiamasse fetchImpl, fallirebbe con questo mock-throw
    const throwingFetch = (async () => { throw new Error('should not fetch'); }) as typeof fetch;
    const w = await fetchWeather(41.39, 2.165, 1, storage, throwingFetch);
    expect(w).toEqual(fresh);
  });

  test('fetchWeather rifetcha se cache > 1h', async () => {
    const storage = mockStorage();
    const stale: Weather = { fetchedAt: Date.now() - 2 * 60 * 60_000, hours: [] };
    storage.setItem('weather-cache-v1', JSON.stringify(stale));
    const w = await fetchWeather(41.39, 2.165, 1, storage, mockFetchOK(SAMPLE));
    expect(w!.hours).toHaveLength(3);
  });

  test('fetchWeather ritorna null su errore di rete', async () => {
    const failingFetch = (async () => { throw new Error('network down'); }) as typeof fetch;
    const w = await fetchWeather(41.39, 2.165, 1, mockStorage(), failingFetch);
    expect(w).toBeNull();
  });

  test('getWeatherAt trova l\'ora più vicina', () => {
    const w: Weather = { fetchedAt: 0, hours: SAMPLE.hourly.time.map((t, i) => ({
      time: t,
      cloudCover: SAMPLE.hourly.cloud_cover[i]!,
      precipProb: SAMPLE.hourly.precipitation_probability[i]!,
      weatherCode: SAMPLE.hourly.weather_code[i]!,
    })) };
    const at = new Date('2026-05-23T10:30');
    const hour = getWeatherAt(w, at);
    expect(hour).not.toBeNull();
    expect([10, 60]).toContain(hour!.cloudCover);
  });

  test('getWeatherAt ritorna null se timestamp è fuori range > 90min', () => {
    const w: Weather = { fetchedAt: 0, hours: [{ time: '2026-05-23T10:00', cloudCover: 0, precipProb: 0, weatherCode: 0 }] };
    const at = new Date('2026-05-23T15:00');
    expect(getWeatherAt(w, at)).toBeNull();
  });

  test('weatherKind classifica i codici WMO', () => {
    expect(weatherKind({ time: '', cloudCover: 5, precipProb: 0, weatherCode: 0 })).toBe('clear');
    expect(weatherKind({ time: '', cloudCover: 50, precipProb: 0, weatherCode: 2 })).toBe('partly');
    expect(weatherKind({ time: '', cloudCover: 95, precipProb: 0, weatherCode: 3 })).toBe('cloudy');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 61 })).toBe('rain');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 95 })).toBe('thunder');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 71 })).toBe('snow');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 45 })).toBe('fog');
    expect(weatherKind(null)).toBe('unknown');
  });

  test('weatherEmoji ritorna l\'emoji giusta per ogni categoria', () => {
    expect(weatherEmoji('clear')).toBe('☀️');
    expect(weatherEmoji('rain')).toBe('🌧️');
    expect(weatherEmoji('thunder')).toBe('⛈️');
  });

  test('isEffectivelySunny: cloudy/rain bloccano il sole astronomico', () => {
    expect(isEffectivelySunny(false, null)).toBe(false);
    expect(isEffectivelySunny(true, null)).toBe(true); // fallback senza meteo
    expect(isEffectivelySunny(true, { time: '', cloudCover: 95, precipProb: 0, weatherCode: 3 })).toBe(false);
    expect(isEffectivelySunny(true, { time: '', cloudCover: 0, precipProb: 0, weatherCode: 61 })).toBe(false);
    expect(isEffectivelySunny(true, { time: '', cloudCover: 10, precipProb: 0, weatherCode: 0 })).toBe(true);
    expect(isEffectivelySunny(true, { time: '', cloudCover: 40, precipProb: 0, weatherCode: 2 })).toBe(true);
  });
});
