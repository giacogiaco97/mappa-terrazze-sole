import { useStore } from '../store/use-store.js';
import { googleMapsUrl } from '../lib/google-maps.js';
import { walkingMinutes } from '../lib/walking-time.js';
import { haversineMeters } from '../lib/geometry.js';
import { sunnyUntil } from '../lib/sunny-until.js';
import { getSunPosition } from '../lib/sun.js';
import { isInSun } from '../lib/shadow-engine.js';
import { useModalDismiss } from '../lib/use-modal-dismiss.js';
import { t } from '../i18n/i18n.js';
import '../styles/card.css';

export default function TerraceCard() {
  const terraces = useStore((s) => s.terraces);
  const userPos = useStore((s) => s.userPos);
  const now = useStore((s) => s.now);
  const states = useStore((s) => s.states);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const buildingIndex = useStore((s) => s.buildingIndex);

  useModalDismiss(!!selectedId, () => setSelectedId(null));

  if (!selectedId) return null;
  const t1 = terraces.find((x) => x.id === selectedId);
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

  return (
    <div className="card" role="dialog" aria-modal="true">
      <button className="card__close" onClick={() => setSelectedId(null)} aria-label={t('close')}>
        <span aria-hidden="true">×</span>
      </button>
      <h2 className="card__title">{t1.name || t1.address}</h2>
      {t1.name && t1.name !== t1.address && (
        <p className="card__address">{t1.address}</p>
      )}
      <p className={`card__status card__status--${status}`}>
        {status === 'sun' && '☀️'} {status === 'shade' && '🌫️'} {status === 'closed' && '🌙'} {t1.tables ? t('tables', { n: t1.tables }) : ''}
      </p>
      {flip && (
        <p className="card__until">
          {t('sunnyUntil', { time: flip.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
        </p>
      )}
      {dist != null && (
        <p className="card__walk">
          {Math.round(dist)} m · {t('walkMinutes', { n: walkingMinutes(dist) })}
        </p>
      )}
      <a
        className="card__cta"
        href={googleMapsUrl({ name: t1.name, address: t1.address })}
        target="_blank" rel="noreferrer"
      >{t('openInGoogleMaps')}</a>
    </div>
  );
}
