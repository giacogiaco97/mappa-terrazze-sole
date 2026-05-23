import { useEffect, useState } from 'react';

export type GeoState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ok'; lat: number; lng: number };

/**
 * Hook geolocation.
 *
 * Con `autostart=true` (default) chiede la posizione SOLO se il permesso è già stato
 * concesso in passato (`navigator.permissions.query`). Altrimenti resta `idle` finché
 * l'utente non clicca il pulsante 📍 (questo evita il "geolocation on page load" che
 * Lighthouse e i browser stessi penalizzano).
 */
export function useGeolocation(autostart = true): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'idle' });

  useEffect(() => {
    if (!autostart) return;
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'Geolocalizzazione non supportata' });
      return;
    }

    let cancelled = false;
    const ask = () => {
      if (cancelled) return;
      setState({ status: 'pending' });
      navigator.geolocation.getCurrentPosition(
        (pos) => !cancelled && setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          if (cancelled) return;
          if (err.code === err.PERMISSION_DENIED) setState({ status: 'denied' });
          else setState({ status: 'error', message: err.message });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      );
    };

    // Prima controlliamo se il permesso è già stato concesso: in tal caso possiamo
    // chiamare getCurrentPosition senza prompt. Altrimenti restiamo idle.
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (cancelled) return;
          if (status.state === 'granted') ask();
          else if (status.state === 'denied') setState({ status: 'denied' });
          // 'prompt' → restiamo idle, l'utente decide via 📍
        })
        .catch(() => {
          // Browser senza Permissions API per geolocation: fallback al chiedere.
          ask();
        });
    } else {
      ask();
    }

    return () => { cancelled = true; };
  }, [autostart]);

  return state;
}
