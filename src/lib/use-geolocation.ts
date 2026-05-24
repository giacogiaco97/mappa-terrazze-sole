import { useEffect, useState } from 'react';
import { useStore } from '../store/use-store.js';

export type GeoState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ok'; lat: number; lng: number };

const LS_GRANTED = 'terrazze-geo-granted';

/**
 * Richiede la posizione una volta, chiamando direttamente getCurrentPosition.
 * Usata dai bottoni di attivazione esplicita (es. messaggio "Activa la ubicación"
 * nella lista, pulsante 📍 sulla mappa). Salva un hint in localStorage al primo
 * successo, così alle visite successive `useGeolocation()` parte proattivo.
 */
export function requestGeolocationOnce(
  onSuccess?: (pos: { lat: number; lng: number }) => void,
  onError?: (kind: 'denied' | 'error') => void,
): void {
  if (!('geolocation' in navigator)) {
    onError?.('error');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      try { localStorage.setItem(LS_GRANTED, '1'); } catch { /* private mode: ok */ }
      const coords = { lat: p.coords.latitude, lng: p.coords.longitude };
      useStore.getState().setUserPos(coords);
      onSuccess?.(coords);
    },
    (err) => {
      onError?.(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
  );
}

/**
 * Hook geolocation.
 *
 * Con `autostart=true` (default): se il permesso è già 'granted' (Permissions API)
 * OPPURE l'utente l'ha concesso in passato (flag localStorage), chiede subito la
 * posizione. Altrimenti resta `idle` finché l'utente non attiva via UI.
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
        (pos) => {
          if (cancelled) return;
          try { localStorage.setItem(LS_GRANTED, '1'); } catch { /* private mode: ok */ }
          setState({ status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (cancelled) return;
          if (err.code === err.PERMISSION_DENIED) {
            try { localStorage.removeItem(LS_GRANTED); } catch { /* ignore */ }
            setState({ status: 'denied' });
          } else setState({ status: 'error', message: err.message });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      );
    };

    // Hint locale: se in passato l'utente ha già concesso il permesso, chiediamo
    // subito senza aspettare permissions.query. Il prompt non riappare se il
    // browser ricorda il consenso; se è stato revocato, il fallback gestisce.
    let alreadyGranted = false;
    try { alreadyGranted = localStorage.getItem(LS_GRANTED) === '1'; } catch { /* ignore */ }
    if (alreadyGranted) {
      ask();
      return () => { cancelled = true; };
    }

    // Prima controlliamo se il permesso è già stato concesso: in tal caso possiamo
    // chiamare getCurrentPosition senza prompt. Altrimenti restiamo idle.
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (cancelled) return;
          if (status.state === 'granted') ask();
          else if (status.state === 'denied') setState({ status: 'denied' });
          // 'prompt' → restiamo idle, l'utente decide via UI
        })
        .catch(() => {
          // Browser senza Permissions API per geolocation: restiamo idle, l'utente
          // attiverà esplicitamente (evita prompt all'avvio).
        });
    }

    return () => { cancelled = true; };
  }, [autostart]);

  return state;
}
