import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { getTimes, getSunPosition } from '../lib/sun.js';
import { getDailySummary, weatherEmoji } from '../lib/weather.js';
import { t } from '../i18n/i18n.js';
import '../styles/time-slider.css';

const BCN = { lat: 41.39, lng: 2.165 };
const MIN_OFFSET = -180;        // 3h fa
const MAX_OFFSET = 7 * 24 * 60; // 7 giorni avanti
const STEP_MIN = 15;
const DAYS_VISIBLE = 8;          // oggi + 7 giorni

function formatHM(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayChip(d: Date, today: Date, locale: string | undefined): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / (24 * 3600_000));
  if (diff === 0) return t('today');
  if (diff === 1) return t('tomorrow');
  // Es. "Lun 26"
  const wd = d.toLocaleDateString(locale, { weekday: 'short' });
  const day = d.getDate();
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1, 3)} ${day}`;
}

export default function TimeSlider() {
  const now = useStore((s) => s.now);
  const setNow = useStore((s) => s.setNow);
  const weather = useStore((s) => s.weather);
  const [valueMin, setValueMin] = useState(0);
  const [realNow, setRealNow] = useState(() => new Date());

  // Refresh realNow ogni 60s per mantenere allineato il riferimento
  useEffect(() => {
    const id = window.setInterval(() => setRealNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const times = useMemo(() => getTimes(realNow, BCN.lat, BCN.lng), [realNow]);
  const sunset = times.sunset;
  const sunrise = times.sunrise;
  const tomorrow = useMemo(() => new Date(realNow.getTime() + 24 * 3600_000), [realNow]);
  const sunriseTomorrow = useMemo(() => getTimes(tomorrow, BCN.lat, BCN.lng).sunrise, [tomorrow]);
  const sunAltitudeRad = useMemo(() => getSunPosition(now, BCN.lat, BCN.lng).altitude, [now]);
  const isNight = sunAltitudeRad <= 0;
  const nextSunrise = now.getTime() < sunrise.getTime() ? sunrise : sunriseTomorrow;

  // Lista dei giorni visibili nel day picker (oggi + 7 successivi)
  const dayOptions = useMemo(() => {
    const arr: Date[] = [];
    const base = startOfDay(realNow);
    for (let i = 0; i < DAYS_VISIBLE; i++) {
      arr.push(new Date(base.getTime() + i * 24 * 3600_000));
    }
    return arr;
  }, [realNow]);

  // Lingua sistema per i nomi giorni nel day picker
  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined;

  useEffect(() => {
    const delta = Math.round((now.getTime() - realNow.getTime()) / 60_000);
    const clamped = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, delta));
    setValueMin(clamped);
  }, [now, realNow]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = Number(e.target.value);
    setValueMin(m);
    setNow(new Date(realNow.getTime() + m * 60_000));
  };

  const reset = () => {
    const n = new Date();
    setRealNow(n);
    setNow(n);
    setValueMin(0);
  };

  // Cambia il giorno mantenendo l'ora corrente del `now`
  const pickDay = (day: Date) => {
    const target = new Date(day);
    target.setHours(now.getHours(), now.getMinutes(), 0, 0);
    setNow(target);
  };

  // Label primario: ora; se il `now` non è oggi, aggiungo il giorno breve
  const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(realNow).getTime()) / (24 * 3600_000));
  const dayPrefix =
    dayDiff === 0 ? `${t('now')} ${formatHM(now)}` :
    dayDiff === 1 ? `${t('tomorrow')} ${formatHM(now)}` :
    `${now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })} ${formatHM(now)}`;

  // Etichetta destra: tramonto (oggi se il `now` non è notte) o alba (se notte)
  const rightLabel = isNight
    ? `${t('sunrise')} ${formatHM(nextSunrise)}`
    : `${t('sunset')} ${formatHM(sunset)}`;

  return (
    <div className="time-slider">
      <div className="time-slider__days" role="tablist" aria-label={t('pickDayLabel')}>
        {dayOptions.map((d) => {
          const active = sameDay(d, now);
          const summary = getDailySummary(weather, d);
          return (
            <button
              key={d.toISOString().slice(0, 10)}
              role="tab"
              aria-selected={active}
              className={`time-slider__day${active ? ' time-slider__day--active' : ''}`}
              onClick={() => pickDay(d)}
              aria-label={summary ? `${formatDayChip(d, realNow, locale)} · ${t('sparklineSun', { n: summary.sunPct })} · ${Math.round(summary.tempMax)}°C` : formatDayChip(d, realNow, locale)}
            >
              <span className="time-slider__day-name">{formatDayChip(d, realNow, locale)}</span>
              {summary && (
                <span className="time-slider__day-stat">
                  <span aria-hidden="true">{weatherEmoji(summary.dominantKind)}</span>{' '}
                  <span className="time-slider__day-pct">{summary.sunPct}%</span>
                </span>
              )}
              {summary && (
                <span className="time-slider__day-temp" aria-hidden="true">
                  {Math.round(summary.tempMax)}°
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="time-slider__row">
        <button
          className="time-slider__now"
          onClick={reset}
          aria-label={`${t('resetToNow')} (${formatHM(realNow)})`}
        >
          {dayPrefix}
        </button>
        <span className="time-slider__sunset">{rightLabel}</span>
      </div>
      <input
        type="range"
        min={MIN_OFFSET}
        max={MAX_OFFSET}
        step={STEP_MIN}
        value={valueMin}
        onChange={onChange}
        aria-label={t('timeSliderLabel')}
        aria-valuetext={dayPrefix}
      />
    </div>
  );
}
