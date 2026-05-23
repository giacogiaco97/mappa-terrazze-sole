import { useEffect, useState } from 'react';

export type GeoState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ok'; lat: number; lng: number };

export function useGeolocation(autostart = true): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'idle' });

  useEffect(() => {
    if (!autostart) return;
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Geolocalizzazione non supportata' });
      return;
    }
    setState({ status: 'pending' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState({ status: 'denied' });
        else setState({ status: 'error', message: err.message });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, [autostart]);

  return state;
}
