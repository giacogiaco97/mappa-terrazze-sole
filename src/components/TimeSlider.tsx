import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { getTimes, getSunPosition } from '../lib/sun.js';
import { getDailySummary, weatherEmoji } from '../lib/weather.js';
import { t } from '../i18n/i18n.js';
import '../styles/time-slider.css';

const BCN = { lat: 41.39, lng: 2.165 };
// Slider relativo al GIORNO SELEZIONATO: range 0..1425 minuti dalla mezzanotte
// (24h - 1 step), per evitare che muovendo lo slider si finisca per sbaglio
// nel giorno successivo. Per cambiare giorno si usa il day picker sopra.
const MIN_OFFSET = 0;
const STEP_MIN = 15;
const MAX_OFFSET = 24 * 60 - STEP_MIN; // 1425 = 23:45
const DAYS_VISIBLE = 8;                // oggi + 7 giorni

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

  // Sunrise/sunset sono SEMPRE relativi al giorno selezionato (`now`), così
  // l'etichetta destra mostra il tramonto/alba del giorno che sto visualizzando.
  const times = useMemo(() => getTimes(now, BCN.lat, BCN.lng), [now]);
  const sunset = times.sunset;
  const sunrise = times.sunrise;
  const sunAltitudeRad = useMemo(() => getSunPosition(now, BCN.lat, BCN.lng).altitude, [now]);
  const isNight = sunAltitudeRad <= 0;

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

  // Sincronizza la posizione dello slider con l'ora del `now` (minuti dalla mezzanotte
  // del giorno selezionato). Quando l'utente cambia giorno dal picker o premiamo reset,
  // questo riallinea la posizione del cursore.
  useEffect(() => {
    setValueMin(now.getHours() * 60 + now.getMinutes());
  }, [now]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = Number(e.target.value);
    setValueMin(m);
    // Cambia SOLO l'ora del giorno selezionato, mantenendo intatta la data.
    const target = startOfDay(now);
    target.setMinutes(m);
    setNow(target);
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

  // Etichetta destra: tramonto del giorno selezionato (di default), o alba di
  // quel giorno se il `now` è in fascia notturna. Tutto resta dentro il giorno.
  const rightLabel = isNight
    ? `${t('sunrise')} ${formatHM(sunrise)}`
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
