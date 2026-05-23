import { useEffect } from 'react';
import type { Map as MLMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
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
    const sourceId = 'terraces-src';
    const layerId = 'terraces-layer';
    const clusterLayerId = 'terraces-cluster';
    const clusterCountLayerId = 'terraces-cluster-count';

    const upsert = () => {
      const features = terraces.map((tr) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [tr.lng, tr.lat] },
        properties: {
          id: tr.id,
          status: states[tr.id] ?? 'pending',
        },
      }));
      const geojson = { type: 'FeatureCollection' as const, features };

      const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(geojson);
        return;
      }
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterRadius: 28, // px: aggrega marker entro 28 px → desovrappone i duplicati
        clusterMaxZoom: 17, // a zoom > 17 ogni terrazza è separata
        clusterProperties: {
          // conta quante sono al sole in ogni cluster (utile per colorarlo)
          sunny: ['+', ['case', ['==', ['get', 'status'], 'sun'], 1, 0]],
        },
      });

      // Layer 1: marker singolo (non-clusterizzato)
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
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

      // Layer 2: cluster (bolla più grande con count)
      map.addLayer({
        id: clusterLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          // colore: arancio se il cluster ha almeno una sunny, blu altrimenti
          'circle-color': [
            'case',
            ['>', ['get', 'sunny'], 0], COLORS.sun,
            COLORS.shade,
          ],
          // raggio in base al count
          'circle-radius': [
            'step', ['get', 'point_count'],
            12, 5,   // <5: 12px
            16, 20,  // ≥5: 16px
            22,      // ≥20: 22px
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.92,
        },
      });

      // Layer 3: testo count sul cluster
      map.addLayer({
        id: clusterCountLayerId,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          'text-font': ['Noto Sans Regular'],
        },
        paint: {
          'text-color': '#1a1a1a',
        },
      });

      // Click marker singolo → seleziona
      map.on('click', layerId, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as { id: string }).id;
        useStore.getState().setSelectedId(id);
      });
      // Click cluster → zoom in
      map.on('click', clusterLayerId, (e: MapMouseEvent) => {
        const f = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] })[0];
        if (!f) return;
        const clusterId = (f.properties as { cluster_id?: number }).cluster_id;
        const src = map.getSource(sourceId) as GeoJSONSource;
        if (clusterId == null) return;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
          map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 18), duration: 400 });
        }).catch(() => undefined);
      });
      // Cursori
      const setPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
      const resetPointer = () => { map.getCanvas().style.cursor = ''; };
      map.on('mouseenter', layerId, setPointer);
      map.on('mouseleave', layerId, resetPointer);
      map.on('mouseenter', clusterLayerId, setPointer);
      map.on('mouseleave', clusterLayerId, resetPointer);
    };

    if (map.isStyleLoaded()) upsert();
    else map.once('load', upsert);
  }, [map, terraces, states]);

  return null;
}
