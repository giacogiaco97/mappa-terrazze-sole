import { useEffect } from 'react';
import { useStore } from '../store/use-store.js';

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
