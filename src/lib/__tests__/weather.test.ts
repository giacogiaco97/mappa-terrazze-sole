import { describe, expect, test } from 'vitest';
import {
  fetchWeather,
  getWeatherAt,
  weatherKind,
  weatherEmoji,
  isEffectivelySunny,
  findNextRain,
  getDailySummary,
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
    temperature_2m: [18, 21, 19],
  },
};

describe('weather core', () => {
  test('fetchWeather popola la cache localStorage con temp', async () => {
    const storage = mockStorage();
    const w = await fetchWeather(41.39, 2.165, 1, storage, mockFetchOK(SAMPLE));
    expect(w).not.toBeNull();
    expect(w!.hours).toHaveLength(3);
    expect(w!.hours[0]!.cloudCover).toBe(10);
    expect(w!.hours[0]!.tempC).toBe(18);
    expect(storage.getItem('weather-cache-v2')).toContain('tempC');
  });

  test('fetchWeather usa cache se entro 1h', async () => {
    const storage = mockStorage();
    const fresh: Weather = { fetchedAt: Date.now() - 30 * 60_000, hours: [] };
    storage.setItem('weather-cache-v2', JSON.stringify(fresh));
    const throwingFetch = (async () => { throw new Error('should not fetch'); }) as typeof fetch;
    const w = await fetchWeather(41.39, 2.165, 1, storage, throwingFetch);
    expect(w).toEqual(fresh);
  });

  test('fetchWeather rifetcha se cache > 1h', async () => {
    const storage = mockStorage();
    const stale: Weather = { fetchedAt: Date.now() - 2 * 60 * 60_000, hours: [] };
    storage.setItem('weather-cache-v2', JSON.stringify(stale));
    const w = await fetchWeather(41.39, 2.165, 1, storage, mockFetchOK(SAMPLE));
    expect(w!.hours).toHaveLength(3);
  });

  test('fetchWeather ritorna null su errore di rete', async () => {
    const failingFetch = (async () => { throw new Error('network down'); }) as typeof fetch;
    const w = await fetchWeather(41.39, 2.165, 1, mockStorage(), failingFetch);
    expect(w).toBeNull();
  });

  test("getWeatherAt trova l'ora più vicina", () => {
    const w: Weather = { fetchedAt: 0, hours: SAMPLE.hourly.time.map((t, i) => ({
      time: t,
      cloudCover: SAMPLE.hourly.cloud_cover[i]!,
      precipProb: SAMPLE.hourly.precipitation_probability[i]!,
      weatherCode: SAMPLE.hourly.weather_code[i]!,
      tempC: SAMPLE.hourly.temperature_2m[i]!,
    })) };
    const at = new Date('2026-05-23T10:30');
    const hour = getWeatherAt(w, at);
    expect(hour).not.toBeNull();
    expect([10, 60]).toContain(hour!.cloudCover);
  });

  test('getWeatherAt ritorna null se timestamp è fuori range > 90min', () => {
    const w: Weather = { fetchedAt: 0, hours: [{ time: '2026-05-23T10:00', cloudCover: 0, precipProb: 0, weatherCode: 0, tempC: 0 }] };
    const at = new Date('2026-05-23T15:00');
    expect(getWeatherAt(w, at)).toBeNull();
  });

  test('weatherKind classifica i codici WMO', () => {
    expect(weatherKind({ time: '', cloudCover: 5, precipProb: 0, weatherCode: 0, tempC: 0 })).toBe('clear');
    expect(weatherKind({ time: '', cloudCover: 50, precipProb: 0, weatherCode: 2, tempC: 0 })).toBe('partly');
    expect(weatherKind({ time: '', cloudCover: 95, precipProb: 0, weatherCode: 3, tempC: 0 })).toBe('cloudy');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 61, tempC: 0 })).toBe('rain');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 95, tempC: 0 })).toBe('thunder');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 71, tempC: 0 })).toBe('snow');
    expect(weatherKind({ time: '', cloudCover: 0, precipProb: 0, weatherCode: 45, tempC: 0 })).toBe('fog');
    expect(weatherKind(null)).toBe('unknown');
  });

  test('weatherEmoji ritorna l\'emoji giusta per ogni categoria', () => {
    expect(weatherEmoji('clear')).toBe('☀️');
    expect(weatherEmoji('rain')).toBe('🌧️');
    expect(weatherEmoji('thunder')).toBe('⛈️');
  });

  test('isEffectivelySunny: cloudy/rain bloccano il sole astronomico', () => {
    expect(isEffectivelySunny(false, null)).toBe(false);
    expect(isEffectivelySunny(true, null)).toBe(true);
    expect(isEffectivelySunny(true, { time: '', cloudCover: 95, precipProb: 0, weatherCode: 3, tempC: 0 })).toBe(false);
    expect(isEffectivelySunny(true, { time: '', cloudCover: 0, precipProb: 0, weatherCode: 61, tempC: 0 })).toBe(false);
    expect(isEffectivelySunny(true, { time: '', cloudCover: 10, precipProb: 0, weatherCode: 0, tempC: 20 })).toBe(true);
  });
});

describe('findNextRain', () => {
  const mkH = (time: string, precipProb: number, weatherCode = 0): typeof SAMPLE.hourly.time[0] extends string ? import('../weather.js').WeatherHour : never => ({
    time, cloudCover: 0, precipProb, weatherCode, tempC: 20,
  } as import('../weather.js').WeatherHour);

  test('trova la prima ora con precipProb alta nelle prossime ore', () => {
    const w: Weather = { fetchedAt: 0, hours: [
      mkH('2026-05-23T14:00', 5),
      mkH('2026-05-23T15:00', 10),
      mkH('2026-05-23T16:00', 70),
      mkH('2026-05-23T17:00', 80),
    ]};
    const found = findNextRain(w, new Date('2026-05-23T14:00'), 6);
    expect(found?.time).toBe('2026-05-23T16:00');
  });

  test('null se nessuna ora di pioggia nel range', () => {
    const w: Weather = { fetchedAt: 0, hours: [
      mkH('2026-05-23T14:00', 5),
      mkH('2026-05-23T15:00', 10),
    ]};
    expect(findNextRain(w, new Date('2026-05-23T14:00'), 6)).toBeNull();
  });

  test('null se weather è null', () => {
    expect(findNextRain(null, new Date(), 6)).toBeNull();
  });

  test('intercetta anche weatherCode rain anche se precipProb basso', () => {
    const w: Weather = { fetchedAt: 0, hours: [
      mkH('2026-05-23T14:00', 10),
      mkH('2026-05-23T15:00', 20, 61), // weather code rain
    ]};
    const found = findNextRain(w, new Date('2026-05-23T14:00'), 6);
    expect(found?.time).toBe('2026-05-23T15:00');
  });

  test('ignora ore passate', () => {
    const w: Weather = { fetchedAt: 0, hours: [
      mkH('2026-05-23T10:00', 90),
      mkH('2026-05-23T16:00', 70),
    ]};
    const found = findNextRain(w, new Date('2026-05-23T14:00'), 6);
    expect(found?.time).toBe('2026-05-23T16:00');
  });
});

describe('getDailySummary', () => {
  test('calcola % sole per ore di giorno (06-21 locale)', () => {
    // 06-20: 14 ore di giorno, 7 clear + 4 partly + 3 cloudy = 11 sun, 3 non-sun
    const hours: import('../weather.js').WeatherHour[] = [];
    for (let h = 0; h < 24; h++) {
      const time = `2026-05-23T${String(h).padStart(2, '0')}:00`;
      // 06-12 = clear (7 ore), 13-16 = partly (4 ore), 17-19 = cloudy (3 ore), 20 = clear (1 ora)
      let cc = 0, wc = 0;
      if (h >= 6 && h <= 12) { cc = 5; wc = 0; }
      else if (h >= 13 && h <= 16) { cc = 50; wc = 2; }
      else if (h >= 17 && h <= 19) { cc = 90; wc = 3; }
      else if (h === 20) { cc = 5; wc = 0; }
      hours.push({ time, cloudCover: cc, precipProb: 0, weatherCode: wc, tempC: 20 });
    }
    const w: Weather = { fetchedAt: 0, hours };
    const summary = getDailySummary(w, new Date('2026-05-23T00:00:00'));
    expect(summary).not.toBeNull();
    expect(summary!.daylightHours).toBe(15); // 06-20
    // 7 clear (06-12) + 4 partly (13-16) + 1 clear (20) = 12 sun
    expect(summary!.sunnyHours).toBe(12);
    expect(summary!.sunPct).toBe(80);
    expect(summary!.dominantKind).toBe('clear');
  });

  test('ritorna null se non ci sono ore per quel giorno', () => {
    const w: Weather = { fetchedAt: 0, hours: [
      { time: '2026-05-23T10:00', cloudCover: 0, precipProb: 0, weatherCode: 0, tempC: 20 },
    ]};
    expect(getDailySummary(w, new Date('2026-05-25T00:00:00'))).toBeNull();
  });

  test('temp min/max basata su ore di luce', () => {
    const w: Weather = { fetchedAt: 0, hours: [
      { time: '2026-05-23T03:00', cloudCover: 0, precipProb: 0, weatherCode: 0, tempC: 5 },  // notte, ignorata
      { time: '2026-05-23T10:00', cloudCover: 0, precipProb: 0, weatherCode: 0, tempC: 18 },
      { time: '2026-05-23T14:00', cloudCover: 0, precipProb: 0, weatherCode: 0, tempC: 25 },
      { time: '2026-05-23T22:00', cloudCover: 0, precipProb: 0, weatherCode: 0, tempC: 12 }, // notte, ignorata
    ]};
    const s = getDailySummary(w, new Date('2026-05-23T00:00:00'));
    expect(s!.tempMin).toBe(18);
    expect(s!.tempMax).toBe(25);
  });
});
