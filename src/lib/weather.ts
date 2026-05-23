/**
 * Meteo per Barcellona via Open-Meteo (GRATIS, no API key, CORS aperto).
 * Cache localStorage 1h per evitare hammering al refresh.
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
};

export type Weather = {
  fetchedAt: number; // epoch ms
  hours: WeatherHour[];
};

const CACHE_KEY = 'weather-cache-v1';
const CACHE_TTL_MS = 60 * 60_000; // 1h
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

type OpenMeteoResponse = {
  hourly: {
    time: string[];
    cloud_cover: number[];
    precipitation_probability: number[];
    weather_code: number[];
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
  // Cache hit
  if (storage) {
    try {
      const raw = storage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as Weather;
        if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
      }
    } catch { /* ignore */ }
  }

  const url = `${ENDPOINT}?latitude=${lat}&longitude=${lng}&hourly=cloud_cover,precipitation_probability,weather_code&forecast_days=${days}&timezone=Europe%2FMadrid`;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoResponse;
    const hours: WeatherHour[] = json.hourly.time.map((time, i) => ({
      time,
      cloudCover: json.hourly.cloud_cover[i] ?? 0,
      precipProb: json.hourly.precipitation_probability[i] ?? 0,
      weatherCode: json.hourly.weather_code[i] ?? 0,
    }));
    const weather: Weather = { fetchedAt: Date.now(), hours };
    if (storage) {
      try { storage.setItem(CACHE_KEY, JSON.stringify(weather)); } catch { /* quota */ }
    }
    return weather;
  } catch {
    return null;
  }
}

/**
 * Cerca la WeatherHour più vicina al timestamp `at`.
 * Ritorna null se il meteo non copre quel timestamp.
 */
export function getWeatherAt(weather: Weather | null, at: Date): WeatherHour | null {
  if (!weather || weather.hours.length === 0) return null;
  const atMs = at.getTime();
  // Open-Meteo dà ore esatte (HH:00). Trova quella più vicina.
  let best: WeatherHour | null = null;
  let bestDelta = Infinity;
  for (const h of weather.hours) {
    const d = Math.abs(new Date(h.time).getTime() - atMs);
    if (d < bestDelta) {
      bestDelta = d;
      best = h;
    }
  }
  // Se la differenza è > 90 minuti, consideriamo "fuori range"
  if (bestDelta > 90 * 60_000) return null;
  return best;
}

/**
 * Categoria meteo derivata dal weather code WMO + cloud cover.
 */
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

/**
 * Vera ombra effettiva: se la nuvolosità è alta o sta piovendo / nevicando /
 * tempo brutto, il sole astronomico non scalda. Ritorna `true` se la terrazza
 * vede il sole DAVVERO (sole astronomico + cielo abbastanza pulito).
 */
export function isEffectivelySunny(astronomicalSun: boolean, weather: WeatherHour | null): boolean {
  if (!astronomicalSun) return false;
  if (!weather) return true; // fallback se manca il meteo
  const kind = weatherKind(weather);
  if (kind === 'cloudy' || kind === 'rain' || kind === 'snow' || kind === 'thunder' || kind === 'fog') return false;
  return true;
}
