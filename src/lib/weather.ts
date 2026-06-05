/**
 * Meteo via Open-Meteo (GRATIS, no API key, CORS aperto).
 * Cache localStorage 1h per evitare hammering al refresh.
 *
 * La cache è per-coordinata: città diverse hanno chiavi diverse, così cambiando
 * città il meteo si aggiorna invece di restituire quello della città precedente.
 *
 * Endpoint: https://api.open-meteo.com/v1/forecast
 * Doc: https://open-meteo.com/en/docs
 */

export type WeatherHour = {
  /** ISO 8601 in timezone Europe/Madrid */
  time: string;
  /** % copertura nuvolosa 0-100 */
  cloudCover: number;
  /** % probabilità di precipitazione 0-100 */
  precipProb: number;
  /** WMO weather code (0=clear, 1-3=partly, 45-48=fog, 51-67=rain, 71-77=snow, 80-82=showers, 95-99=thunder) */
  weatherCode: number;
  /** Temperatura a 2m in °C */
  tempC: number;
};

export type Weather = {
  fetchedAt: number; // epoch ms
  hours: WeatherHour[];
};

const CACHE_PREFIX = 'weather-cache-v3';
const CACHE_TTL_MS = 60 * 60_000; // 1h
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/**
 * Chiave cache per coordinate (arrotondate a ~1km). Bump a v3 per invalidare la
 * vecchia chiave globale v2 che ignorava lat/lng (bug: cambiando città restava
 * il meteo della città precedente per 1h).
 */
export function weatherCacheKey(lat: number, lng: number): string {
  return `${CACHE_PREFIX}:${lat.toFixed(2)},${lng.toFixed(2)}`;
}

type OpenMeteoResponse = {
  hourly: {
    time: string[];
    cloud_cover: number[];
    precipitation_probability: number[];
    weather_code: number[];
    temperature_2m: number[];
  };
};

/**
 * Fetch del meteo. Usa cache localStorage se valida (<1h).
 * Restituisce null in caso di errore (l'app continua senza meteo).
 */
export async function fetchWeather(
  lat: number,
  lng: number,
  days = 7,
  storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null,
  fetchImpl: typeof fetch = fetch,
): Promise<Weather | null> {
  const cacheKey = weatherCacheKey(lat, lng);
  if (storage) {
    try {
      const raw = storage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as Weather;
        if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
      }
    } catch { /* ignore */ }
  }

  const url = `${ENDPOINT}?latitude=${lat}&longitude=${lng}&hourly=cloud_cover,precipitation_probability,weather_code,temperature_2m&forecast_days=${days}&timezone=Europe%2FMadrid`;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoResponse;
    const hours: WeatherHour[] = json.hourly.time.map((time, i) => ({
      time,
      cloudCover: json.hourly.cloud_cover[i] ?? 0,
      precipProb: json.hourly.precipitation_probability[i] ?? 0,
      weatherCode: json.hourly.weather_code[i] ?? 0,
      tempC: json.hourly.temperature_2m[i] ?? 0,
    }));
    const weather: Weather = { fetchedAt: Date.now(), hours };
    if (storage) {
      try { storage.setItem(cacheKey, JSON.stringify(weather)); } catch { /* quota */ }
    }
    return weather;
  } catch {
    return null;
  }
}

export function getWeatherAt(weather: Weather | null, at: Date): WeatherHour | null {
  if (!weather || weather.hours.length === 0) return null;
  const atMs = at.getTime();
  let best: WeatherHour | null = null;
  let bestDelta = Infinity;
  for (const h of weather.hours) {
    const d = Math.abs(new Date(h.time).getTime() - atMs);
    if (d < bestDelta) {
      bestDelta = d;
      best = h;
    }
  }
  if (bestDelta > 90 * 60_000) return null;
  return best;
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder' | 'unknown';

export function weatherKind(h: WeatherHour | null): WeatherKind {
  if (!h) return 'unknown';
  const c = h.weatherCode;
  if (c === 95 || c === 96 || c === 99) return 'thunder';
  if (c >= 71 && c <= 77) return 'snow';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if (c === 45 || c === 48) return 'fog';
  if (c === 0) return 'clear';
  if (c >= 1 && c <= 3) {
    if (h.cloudCover >= 70) return 'cloudy';
    return 'partly';
  }
  if (h.cloudCover >= 70) return 'cloudy';
  if (h.cloudCover >= 30) return 'partly';
  return 'clear';
}

export function weatherEmoji(kind: WeatherKind): string {
  switch (kind) {
    case 'clear': return '☀️';
    case 'partly': return '⛅';
    case 'cloudy': return '☁️';
    case 'fog': return '🌫️';
    case 'rain': return '🌧️';
    case 'snow': return '❄️';
    case 'thunder': return '⛈️';
    default: return '❓';
  }
}

export function isEffectivelySunny(astronomicalSun: boolean, weather: WeatherHour | null): boolean {
  if (!astronomicalSun) return false;
  if (!weather) return true;
  const kind = weatherKind(weather);
  if (kind === 'cloudy' || kind === 'rain' || kind === 'snow' || kind === 'thunder' || kind === 'fog') return false;
  return true;
}

/**
 * Cerca la prima ora con probabilità di pioggia >= soglia nelle prossime
 * `lookAheadHours` ore. Considera solo precipProb (non solo weather_code rain)
 * per intercettare anche pioggia leggera prima che diventi codice rain.
 */
export function findNextRain(
  weather: Weather | null,
  now: Date,
  lookAheadHours = 6,
  minProb = 50,
): WeatherHour | null {
  if (!weather) return null;
  const nowMs = now.getTime();
  const horizonMs = nowMs + lookAheadHours * 3600_000;
  for (const h of weather.hours) {
    const t = new Date(h.time).getTime();
    if (t < nowMs) continue;
    if (t > horizonMs) break;
    if (h.precipProb >= minProb) return h;
    // Anche codice rain/thunder/snow (più affidabile della precipProb in alcuni casi)
    const k = weatherKind(h);
    if (k === 'rain' || k === 'thunder' || k === 'snow') return h;
  }
  return null;
}

export type DailySummary = {
  /** Inizio del giorno (00:00 locale) */
  day: Date;
  /** Ore con almeno una possibilità di sole (cloud<70 e niente rain/snow/thunder) */
  sunnyHours: number;
  /** Ore totali con luce solare (giorno) — approssimato dalle ore con tempC > -50 (sempre) e weather attivo */
  daylightHours: number;
  /** % sole sul totale ore di luce */
  sunPct: number;
  /** Kind dominante della giornata */
  dominantKind: WeatherKind;
  /** Min/max temperatura nelle ore di giorno (5–22 locale) */
  tempMin: number;
  tempMax: number;
};

/**
 * Riepilogo per un giorno specifico. Usa solo ore "di giorno" (06-21 locale)
 * per calcolare % sole — di notte non importa.
 */
export function getDailySummary(weather: Weather | null, day: Date): DailySummary | null {
  if (!weather || weather.hours.length === 0) return null;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3600_000);

  const dayHours = weather.hours.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= start.getTime() && t < end.getTime();
  });
  if (dayHours.length === 0) return null;

  // Ore di giorno: 06:00-21:00 locale (sufficiente per primavera/estate BCN)
  const lightHours = dayHours.filter((h) => {
    const d = new Date(h.time);
    const hr = d.getHours();
    return hr >= 6 && hr < 21;
  });
  if (lightHours.length === 0) {
    return {
      day: start,
      sunnyHours: 0, daylightHours: 0, sunPct: 0,
      dominantKind: 'unknown',
      tempMin: 0, tempMax: 0,
    };
  }

  const sunnyHours = lightHours.filter((h) => {
    const k = weatherKind(h);
    return k === 'clear' || k === 'partly';
  }).length;

  // Kind dominante: il più frequente, eccetto 'unknown'
  const counts = new Map<WeatherKind, number>();
  for (const h of lightHours) {
    const k = weatherKind(h);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let dominant: WeatherKind = 'clear';
  let maxCount = -1;
  for (const [k, c] of counts) {
    if (c > maxCount) { maxCount = c; dominant = k; }
  }

  const temps = lightHours.map((h) => h.tempC);
  return {
    day: start,
    sunnyHours,
    daylightHours: lightHours.length,
    sunPct: Math.round((sunnyHours / lightHours.length) * 100),
    dominantKind: dominant,
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
  };
}
