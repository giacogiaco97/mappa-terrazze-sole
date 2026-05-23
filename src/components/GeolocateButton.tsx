import { useStore } from '../store/use-store.js';
import { useGeolocation } from '../lib/use-geolocation.js';
import type { Map as MLMap } from 'maplibre-gl';
import { t } from '../i18n/i18n.js';
import '../styles/geolocate.css';

type Props = { map: MLMap | null };

export default function GeolocateButton({ map }: Props) {
  const userPos = useStore((s) => s.userPos);
  const geo = useGeolocation(false); // solo per leggere lo status già rilevato
  // Disabilitato se il permesso è stato esplicitamente negato (cliccarlo non
  // farebbe nulla).
  const denied = geo.status === 'denied';

  const onClick = () => {
    if (!map || denied) return;
    if (userPos) {
      map.flyTo({ center: [userPos.lng, userPos.lat], zoom: 15, duration: 400 });
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          useStore.getState().setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15, duration: 400 });
        },
        () => undefined,
      );
    }
  };
  return (
    <button
      className="geolocate-btn"
      onClick={onClick}
      disabled={denied}
      aria-label={denied ? t('geoDenied') : t('locateMe')}
      title={denied ? t('geoDenied') : t('locateMe')}
    >
      <span aria-hidden="true">📍</span>
    </button>
  );
}
