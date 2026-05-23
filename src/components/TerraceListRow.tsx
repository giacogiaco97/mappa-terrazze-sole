import { googleMapsUrl } from '../lib/google-maps.js';
import { walkingMinutes } from '../lib/walking-time.js';
import { t } from '../i18n/i18n.js';
import type { TerraceStatus } from '../store/use-store.js';
import type { Terrace } from '../types/index.js';

type Props = {
  terrace: Terrace;
  status: TerraceStatus;
  distanceMeters: number;
  onSelect: () => void;
};

const STATUS_EMOJI: Record<TerraceStatus, string> = {
  sun: '☀️', shade: '🌫️', closed: '🌙', pending: '…',
};

export default function TerraceListRow({ terrace, status, distanceMeters, onSelect }: Props) {
  const mins = walkingMinutes(distanceMeters);
  return (
    <div className="row">
      <button className="row__main" onClick={onSelect}>
        <span className="row__status" aria-label={status}>{STATUS_EMOJI[status]}</span>
        <span className="row__text">
          <span className="row__name">{terrace.name || terrace.address}</span>
          <span className="row__meta">
            {Math.round(distanceMeters)} m · {t('walkMinutes', { n: mins })} · {t('tables', { n: terrace.tables })}
          </span>
        </span>
      </button>
      <a
        className="row__maps"
        href={googleMapsUrl({ name: terrace.name, address: terrace.address })}
        target="_blank" rel="noreferrer"
        aria-label={t('openInGoogleMaps')}
      >🗺️</a>
    </div>
  );
}
