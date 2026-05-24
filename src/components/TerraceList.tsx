import { useMemo, useRef, useEffect, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { sortTerracesByDistance } from '../lib/sort-terraces.js';
import { requestGeolocationOnce } from '../lib/use-geolocation.js';
import { t } from '../i18n/i18n.js';
import TerraceListRow from './TerraceListRow.js';

type Props = { onSelectTerrace: (id: string) => void };

const PAGE_SIZE = 50;

export default function TerraceList({ onSelectTerrace }: Props) {
  const terraces = useStore((s) => s.terraces);
  const states = useStore((s) => s.states);
  const userPos = useStore((s) => s.userPos);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const minTables = useStore((s) => s.minTables);
  const setMinTables = useStore((s) => s.setMinTables);
  const showShade = useStore((s) => s.showShade);
  const setShowShade = useStore((s) => s.setShowShade);

  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => {
    if (!userPos) return [];
    return sortTerracesByDistance(terraces, userPos);
  }, [terraces, userPos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter(({ terrace }) => {
      const status = states[terrace.id] ?? 'pending';
      // Default: solo terrazze davvero al sole (cielo pulito).
      // Con "Includi in ombra": anche shade + cloudy (sole bloccato da nuvole).
      if (!showShade && status !== 'sun') return false;
      if (showShade && status !== 'sun' && status !== 'shade' && status !== 'cloudy') return false;
      if (terrace.tables < minTables) return false;
      if (q) {
        const inName = terrace.name.toLowerCase().includes(q);
        const inAddr = terrace.address.toLowerCase().includes(q);
        const inHood = terrace.neighborhood.toLowerCase().includes(q);
        if (!inName && !inAddr && !inHood) return false;
      }
      return true;
    });
  }, [sorted, states, search, minTables, showShade]);

  // Reset paginazione al cambio filtri
  useEffect(() => { setPage(1); }, [search, minTables, showShade]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setPage((p) => p + 1);
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  if (!userPos) {
    return (
      <button
        type="button"
        className="list__activate-geo"
        onClick={() => requestGeolocationOnce()}
        aria-label={t('listNeedsLocation')}
      >
        <span aria-hidden="true" className="list__activate-geo-icon">📍</span>
        <span>{t('listNeedsLocation')}</span>
      </button>
    );
  }

  return (
    <div className="list-wrap">
      <div className="filters">
        <input
          type="search"
          className="filters__search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('searchPlaceholder')}
        />
        <div className="filters__row">
          <label className="filters__chip">
            <input
              type="checkbox"
              checked={showShade}
              onChange={(e) => setShowShade(e.target.checked)}
            />
            <span>{t('includeShade')}</span>
          </label>
          <label className="filters__chip">
            <span>{t('minTablesLabel')}</span>
            <select
              value={minTables}
              onChange={(e) => setMinTables(Number(e.target.value))}
              aria-label={t('minTablesLabel')}
            >
              <option value={0}>0</option>
              <option value={2}>2+</option>
              <option value={4}>4+</option>
              <option value={8}>8+</option>
            </select>
          </label>
          <span className="filters__count" aria-live="polite">
            {filtered.length}
          </span>
        </div>
      </div>

      <div className="list">
        {visible.map(({ terrace, distanceMeters }) => (
          <TerraceListRow
            key={terrace.id}
            terrace={terrace}
            status={states[terrace.id] ?? 'pending'}
            distanceMeters={distanceMeters}
            onSelect={() => onSelectTerrace(terrace.id)}
          />
        ))}
        {visible.length < filtered.length && (
          <div ref={sentinelRef} className="list__sentinel" aria-hidden="true" />
        )}
        {filtered.length === 0 && (
          <p className="list__empty">{t('listEmpty')}</p>
        )}
      </div>
    </div>
  );
}
