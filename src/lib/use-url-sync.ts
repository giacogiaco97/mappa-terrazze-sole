import { useEffect } from 'react';
import { useStore } from '../store/use-store.js';

function tryLocate(): void {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (p) => useStore.getState().setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => undefined,
    { enableHighAccuracy: true, timeout: 8000 },
  );
}

/**
 * Sincronizza `selectedId` con il query parameter `?id=...`.
 * - Al mount: legge `?id=` e setta selectedId.
 * - Quando selectedId cambia (via tap su marker o lista): aggiorna URL senza reload (replaceState).
 * - Listen popstate per navigazione browser (back/forward).
 */
export function useUrlSync(): void {
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);

  // 1) Mount: leggi URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');
    if (id) setSelectedId(id);
    // PWA shortcut `?action=locate` → forza geolocation
    if (url.searchParams.get('action') === 'locate') {
      tryLocate();
      url.searchParams.delete('action');
      window.history.replaceState(null, '', url.toString());
    }
    const onPop = () => {
      const u = new URL(window.location.href);
      setSelectedId(u.searchParams.get('id'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setSelectedId]);

  // 2) selectedId cambia → aggiorna URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const current = url.searchParams.get('id');
    if (current === selectedId) return;
    if (selectedId) url.searchParams.set('id', selectedId);
    else url.searchParams.delete('id');
    window.history.replaceState(null, '', url.toString());
  }, [selectedId]);
}
