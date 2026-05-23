import { useEffect } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import { useStore, type TerraceStatus } from '../store/use-store.js';

const COLORS: Record<TerraceStatus, string> = {
  sun: '#f5a623',
  shade: '#3a6ea5',
  closed: '#666666',
  pending: '#cccccc',
};

type Props = { map: MLMap };

export default function Markers({ map }: Props) {
  const terraces = useStore((s) => s.terraces);
  const states = useStore((s) => s.states);

  useEffect(() => {
    if (!map.isStyleLoaded()) return;
    const sourceId = 'terraces-src';
    const layerId = 'terraces-layer';

    const features = terraces.map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lng, t.lat] },
      properties: {
        id: t.id,
        status: states[t.id] ?? 'pending',
      },
    }));
    const geojson = { type: 'FeatureCollection' as const, features };

    const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match', ['get', 'status'],
            'sun', COLORS.sun,
            'shade', COLORS.shade,
            'closed', COLORS.closed,
            COLORS.pending,
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }, [map, terraces, states]);

  return null;
}
