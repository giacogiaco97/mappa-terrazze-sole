import { useStore } from '../store/use-store.js';
import type { Map as MLMap } from 'maplibre-gl';
import { t } from '../i18n/i18n.js';
import '../styles/geolocate.css';

type Props = { map: MLMap | null };

export default function GeolocateButton({ map }: Props) {
  const userPos = useStore((s) => s.userPos);
  const onClick = () => {
    if (!map) return;
    if (userPos) {
      map.flyTo({ center: [userPos.lng, userPos.lat], zoom: 15, duration: 400 });
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((p) => {
        useStore.getState().setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15, duration: 400 });
      });
    }
  };
  return (
    <button
      className="geolocate-btn"
      onClick={onClick}
      aria-label={t('locateMe')}
      title={t('locateMe')}
    >
      <span aria-hidden="true">📍</span>
    </button>
  );
}
