import { useMemo } from 'react';
import { useStore } from '../store/use-store.js';
import { googleMapsUrl, streetViewUrl } from '../lib/google-maps.js';
import { walkingMinutes } from '../lib/walking-time.js';
import { haversineMeters } from '../lib/geometry.js';
import { sunnyUntil } from '../lib/sunny-until.js';
import { getSunPosition } from '../lib/sun.js';
import { isInSun } from '../lib/shadow-engine.js';
import { getShadeConfidence } from '../lib/shade-confidence.js';
import { useModalDismiss } from '../lib/use-modal-dismiss.js';
import { computeSunTimeline, type TimelineState } from '../lib/sun-timeline.js';
import SunTimeline from './SunTimeline.js';
import TerraceMiniMap from './TerraceMiniMap.js';
import { getWeatherAt, weatherKind, weatherEmoji, findNextRain } from '../lib/weather.js';
import { t } from '../i18n/i18n.js';
import '../styles/card.css';

function formatHours(minutes: number): string {
  if (minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TerraceCard() {
  const terraces = useStore((s) => s.terraces);
  const userPos = useStore((s) => s.userPos);
  const now = useStore((s) => s.now);
  const states = useStore((s) => s.states);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const buildingIndex = useStore((s) => s.buildingIndex);
  const weather = useStore((s) => s.weather);

  useModalDismiss(!!selectedId, () => setSelectedId(null));

  const t1 = useMemo(
    () => (selectedId ? terraces.find((x) => x.id === selectedId) ?? null : null),
    [terraces, selectedId],
  );

  const timeline = useMemo(() => {
    if (!t1 || !buildingIndex) return null;
    return computeSunTimeline(
      now,
      (d): TimelineState => {
        const sun = getSunPosition(d, t1.lat, t1.lng);
        if (sun.altitude <= 0) return 'night';
        if (!isInSun(t1.lat, t1.lng, sun, buildingIndex)) return 'shade';
        // Sole astronomico libero: applica filtro meteo
        const w = getWeatherAt(weather, d);
        const k = weatherKind(w);
        if (k === 'cloudy' || k === 'rain' || k === 'snow' || k === 'thunder' || k === 'fog') return 'shade';
        return 'sun';
      },
      15,
    );
  }, [t1, buildingIndex, now, weather]);

  if (!t1) return null;

  const status = states[t1.id] ?? 'pending';
  const dist = userPos ? haversineMeters(userPos.lat, userPos.lng, t1.lat, t1.lng) : null;

  let flip: Date | null = null;
  if (status === 'sun' && buildingIndex) {
    flip = sunnyUntil(now, t1.lat, t1.lng, (lat, lng, d) => {
      const sun = getSunPosition(d, lat, lng);
      if (sun.altitude <= 0) return false;
      return isInSun(lat, lng, sun, buildingIndex);
    });
  }

  const confidence = buildingIndex ? getShadeConfidence(t1.lat, t1.lng, buildingIndex) : 'low';

  const sunPct = timeline && timeline.daylightMinutes > 0
    ? Math.round((timeline.sunMinutes / timeline.daylightMinutes) * 100)
    : null;

  const showAddressLine = t1.name && t1.address && t1.name !== t1.address;
  const subtitle = [showAddressLine ? t1.address : null, t1.neighborhood]
    .filter(Boolean)
    .join(' · ');

  const statusLabel =
    status === 'sun' ? t('statusSunNow') :
    status === 'shade' ? t('statusShadeNow') :
    status === 'cloudy' ? t('statusCloudyNow') :
    status === 'closed' ? t('statusClosedNow') : '';
  const statusIcon =
    status === 'sun' ? '☀️' :
    status === 'shade' ? '🌫️' :
    status === 'cloudy' ? '☁️' :
    status === 'closed' ? '🌙' : '';

  // Meteo per l'ora corrente
  const weatherHour = getWeatherAt(weather, now);
  const wKind = weatherKind(weatherHour);
  const weatherLabel = t(`weather${wKind.charAt(0).toUpperCase()}${wKind.slice(1)}` as 'weatherClear');
  // Pioggia entro le prossime 6 ore (a livello città)
  const rainAhead = findNextRain(weather, now, 6);
  const rainLabel = rainAhead ? formatTime(new Date(rainAhead.time)) : null;

  return (
    <div className="card" role="dialog" aria-modal="true" aria-labelledby="card-title">
      <button className="card__close" onClick={() => setSelectedId(null)} aria-label={t('close')}>
        <span aria-hidden="true">×</span>
      </button>

      <header className={`card__hero card__hero--${status}`}>
        <span className={`card__pill card__pill--${status}`}>
          <span aria-hidden="true">{statusIcon}</span>
          <span>{statusLabel}</span>
        </span>
        <h2 id="card-title" className="card__title">{t1.name || t1.address}</h2>
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
        {weatherHour && wKind !== 'unknown' && (
          <p className="card__weather" title={t('weatherForecast')}>
            <span aria-hidden="true">{weatherEmoji(wKind)}</span>{' '}
            <span>{Math.round(weatherHour.tempC)}°C</span>
            <span className="card__weather-sep" aria-hidden="true"> · </span>
            <span>{weatherLabel}</span>
            <span className="card__weather-sep" aria-hidden="true"> · </span>
            <span>{t('cloudCoverPct', { n: weatherHour.cloudCover })}</span>
          </p>
        )}
        {rainAhead && rainLabel && (
          <p className="card__rain-alert" role="status">
            <span aria-hidden="true">🌧️</span>{' '}
            {t('rainSoon', { time: rainLabel, prob: rainAhead.precipProb })}
          </p>
        )}
      </header>

      {timeline && (
        <section className="card__sun" aria-labelledby="card-sun-heading">
          <div className="card__sun-header">
            <span id="card-sun-heading" className="card__sun-label">{t('sunToday')}</span>
            {sunPct != null && (
              <span className={`card__sun-badge ${sunPct >= 50 ? 'card__sun-badge--good' : ''}`}>
                <span aria-hidden="true">☀️</span>{' '}
                {t('sunPercentOfDay', { pct: sunPct })}
                {' · '}
                {formatHours(timeline.sunMinutes)}
              </span>
            )}
          </div>
          <SunTimeline
            result={timeline}
            now={now}
            reference={now}
            label={`${t('sunToday')}: ${sunPct ?? 0}%`}
          />
          {flip && (
            <p className="card__until">
              <span aria-hidden="true">☀️</span>{' '}
              {t('sunnyUntil', { time: formatTime(flip) })}
            </p>
          )}
          {sunPct === 0 && timeline.daylightMinutes > 0 && (
            <p className="card__hint">{t('allDayShade')}</p>
          )}
          {sunPct === 100 && (
            <p className="card__hint">{t('allDaySun')}</p>
          )}
        </section>
      )}

      <section className="card__stats" aria-label={t('sunToday')}>
        {t1.tables > 0 && (
          <div className="card__stat">
            <span className="card__stat-icon" aria-hidden="true">🍽️</span>
            <span className="card__stat-value">
              {t1.tables}{t1.chairs && t1.chairs > 0 ? ` / ${t1.chairs}` : ''}
            </span>
            <span className="card__stat-label">
              {t1.chairs && t1.chairs > 0 ? `${t('tablesCount', { n: t1.tables })} · ${t('chairsCount', { n: t1.chairs })}` : t('tablesCount', { n: t1.tables })}
            </span>
          </div>
        )}
        {t1.surfaceSqM != null && t1.surfaceSqM > 0 && (
          <div className="card__stat">
            <span className="card__stat-icon" aria-hidden="true">📏</span>
            <span className="card__stat-value">{t1.surfaceSqM}</span>
            <span className="card__stat-label">{t('surfaceSqm', { n: t1.surfaceSqM })}</span>
          </div>
        )}
        {dist != null && (
          <div className="card__stat">
            <span className="card__stat-icon" aria-hidden="true">🚶</span>
            <span className="card__stat-value">{t('walkMinutes', { n: walkingMinutes(dist) })}</span>
            <span className="card__stat-label">{Math.round(dist)} m</span>
          </div>
        )}
      </section>

      <TerraceMiniMap lat={t1.lat} lng={t1.lng} />

      <p
        className={`card__confidence card__confidence--${confidence}`}
        title={t(`confidence_${confidence}_tip` as 'confidence_high_tip')}
      >
        <span aria-hidden="true">
          {confidence === 'high' ? '✓' : confidence === 'medium' ? '~' : '?'}
        </span>{' '}
        <span>{t(`confidence_${confidence}` as 'confidence_high')}</span>
      </p>

      <div className="card__actions">
        <a
          className="card__btn card__btn--primary"
          href={googleMapsUrl({ name: t1.name, address: t1.address, placeId: t1.placeId })}
          target="_blank" rel="noreferrer"
        >
          <span aria-hidden="true">🗺️</span>{' '}
          <span>{t('googleMapsShort')}</span>
        </a>
        <a
          className="card__btn card__btn--secondary"
          href={streetViewUrl(t1.lat, t1.lng)}
          target="_blank" rel="noreferrer"
          aria-label={t('openInStreetView')}
        >
          <span aria-hidden="true">📍</span>{' '}
          <span>{t('streetViewShort')}</span>
        </a>
      </div>
    </div>
  );
}
