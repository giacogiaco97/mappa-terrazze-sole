import { useMemo } from 'react';
import { useStore } from '../store/use-store.js';
import { sortTerracesByDistance } from '../lib/sort-terraces.js';
import TerraceListRow from './TerraceListRow.js';

type Props = { onSelectTerrace: (id: string) => void };

export default function TerraceList({ onSelectTerrace }: Props) {
  const terraces = useStore((s) => s.terraces);
  const states = useStore((s) => s.states);
  const userPos = useStore((s) => s.userPos);

  const sorted = useMemo(() => {
    if (!userPos) return [];
    return sortTerracesByDistance(terraces, userPos);
  }, [terraces, userPos]);

  // Filtra solo terrazze al sole.
  const sunny = sorted.filter((x) => states[x.terrace.id] === 'sun').slice(0, 200);

  if (!userPos) return null;
  return (
    <div className="list">
      {sunny.map(({ terrace, distanceMeters }) => (
        <TerraceListRow
          key={terrace.id}
          terrace={terrace}
          status={states[terrace.id] ?? 'pending'}
          distanceMeters={distanceMeters}
          onSelect={() => onSelectTerrace(terrace.id)}
        />
      ))}
    </div>
  );
}
