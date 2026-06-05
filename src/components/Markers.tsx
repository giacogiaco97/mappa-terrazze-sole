import { useEffect } from 'react';
import type { Map as MLMap, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { useStore, type TerraceStatus } from '../store/use-store.js';

const SOURCE_ID = 'terraces-src';
const LAYER_ID = 'terraces-layer';
const CLUSTER_LAYER_ID = 'terraces-cluster';
const CLUSTER_COUNT_LAYER_ID = 'terraces-cluster-count';

function removeMarkersFromMap(map: MLMap): void {
  try {
    if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) map.removeLayer(CLUSTER_COUNT_LAYER_ID);
    if (map.getLayer(CLUSTER_LAYER_ID)) map.removeLayer(CLUSTER_LAYER_ID);
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  } catch { /* ignore */ }
}

const COLORS: Record<TerraceStatus, string> = {
  sun: '#f5a623',
  shade: '#3a6ea5',
  cloudy: '#a89b7c', // sole astronomico ma cielo coperto
  closed: '#666666',
  pending: '#cccccc',
};

type Props = { map: MLMap };

export default function Markers({ map }: Props) {
  const terraces = useStore((s) => s.terraces);
  const states = useStore((s) => s.states);
  const currentCity = useStore((s) => s.currentCity);

  // Effect dedicato al cambio città: rimuove source+layers vecchi (terrazze BCN
  // restano altrimenti in cache MapLibre e non si vedono quelle Madrid).
  // Il prossimo render dell'effect principale ricostruirà tutto da zero.
  useEffect(() => {
    if (!map) return;
    removeMarkersFromMap(map);
    // intentionally no cleanup: la pulizia è il punto di questo effect
  }, [map, currentCity]);

  useEffect(() => {
    const sourceId = SOURCE_ID;
    const layerId = LAYER_ID;
    const clusterLayerId = CLUSTER_LAYER_ID;
    const clusterCountLayerId = CLUSTER_COUNT_LAYER_ID;

    if (!terraces.length) return;

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
        // Cluster meno aggressivi: prima erano 28px/zoom17, ora 16px/zoom14
        // → l'utente vede i singoli locali a zoom più ampio, senza dover
        // bucare la stessa bolla 3-4 volte. Solo veri overlap vengono ridotti.
        clusterRadius: 16,
        clusterMaxZoom: 14,
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
            'cloudy', COLORS.cloudy,
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
      // Click cluster → zoom in "deciso": almeno +2 livelli dal corrente, per
      // spaccare subito il gruppo e mostrare i singoli locali in un solo click
      // (era +0.5: spesso non bastava e l'utente doveva cliccare la stessa bolla
      // 3-4 volte).
      map.on('click', clusterLayerId, (e: MapMouseEvent) => {
        const f = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] })[0];
        if (!f) return;
        const clusterId = (f.properties as { cluster_id?: number }).cluster_id;
        const src = map.getSource(sourceId) as GeoJSONSource;
        if (clusterId == null) return;
        src.getClusterExpansionZoom(clusterId).then((expansionZoom) => {
          const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
          const currentZoom = map.getZoom();
          // Almeno +2 dal corrente, oltre l'expansion zoom, capped a 19.
          const target = Math.min(Math.max(expansionZoom + 0.5, currentZoom + 2), 19);
          map.easeTo({ center: coords, zoom: target, duration: 450 });
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

    // Readiness robusto: NON ci basiamo su map.isStyleLoaded() né su once('load').
    // In produzione (service worker + tile lenti, oppure volo verso una città
    // lontana al cambio città) isStyleLoaded() può restare false a tempo
    // indefinito ANCHE quando addSource funziona già, e 'load' è scattato una
    // sola volta al primo render iniziale e non riparte più. Risultato: i marker
    // non comparivano mai (es. Madrid). Proviamo direttamente l'upsert: se lo
    // style non è ancora pronto addSource lancia → ritentiamo a ogni 'styledata'
    // e 'idle' finché non riesce.
    const tryUpsert = (): boolean => {
      try { upsert(); return true; } catch { return false; }
    };
    if (tryUpsert()) return;
    const retry = () => {
      if (tryUpsert()) {
        map.off('styledata', retry);
        map.off('idle', retry);
      }
    };
    map.on('styledata', retry);
    map.on('idle', retry);
    return () => { map.off('styledata', retry); map.off('idle', retry); };
  }, [map, terraces, states]);

  return null;
}
