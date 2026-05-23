import { useEffect, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { getTimes } from '../lib/sun.js';
import { t } from '../i18n/i18n.js';
import '../styles/time-slider.css';

const BCN = { lat: 41.39, lng: 2.165 };

function formatHM(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TimeSlider() {
  const now = useStore((s) => s.now);
  const setNow = useStore((s) => s.setNow);
  const realNow = new Date();
  const [valueMin, setValueMin] = useState(0);

  const sunset = getTimes(realNow, BCN.lat, BCN.lng).sunset;

  useEffect(() => {
    const delta = Math.round((now.getTime() - realNow.getTime()) / 60_000);
    setValueMin(delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = Number(e.target.value);
    setValueMin(m);
    const next = new Date(realNow.getTime() + m * 60_000);
    setNow(next);
  };

  const reset = () => {
    setNow(new Date());
    setValueMin(0);
  };

  return (
    <div className="time-slider">
      <div className="time-slider__row">
        <button className="time-slider__now" onClick={reset}>{t('now')} {formatHM(now)}</button>
        <span className="time-slider__sunset">{t('sunset')} {formatHM(sunset)}</span>
      </div>
      <input
        type="range"
        min={-180}
        max={720}
        step={10}
        value={valueMin}
        onChange={onChange}
        aria-label="time offset"
      />
    </div>
  );
}
