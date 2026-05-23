import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import MapView from './components/MapView.js';
import Markers from './components/Markers.js';
import TimeSlider from './components/TimeSlider.js';
import { useGeolocation } from './lib/use-geolocation.js';
import { useStore } from './store/use-store.js';
import { loadTerraces, loadMeta, loadBuildingChunk, cellsForBbox } from './lib/data-loader.js';
import { buildBuildingIndex } from './lib/building-index.js';
import { computeAllStates } from './lib/compute-states.js';
import type { Building } from './types/index.js';

export default function App() {
  const [map, setMap] = useState<MLMap | null>(null);
  const geo = useGeolocation();
  const setTerraces = useStore((s) => s.setTerraces);
  const setStates = useStore((s) => s.setStates);
  const setUserPos = useStore((s) => s.setUserPos);
  const now = useStore((s) => s.now);

  // Geolocalizzazione → centra mappa (solo se l'utente è dentro BCN)
  useEffect(() => {
    if (geo.status === 'ok' && map) {
      setUserPos({ lat: geo.lat, lng: geo.lng });
      if (geo.lng > 2.0 && geo.lng < 2.3 && geo.lat > 41.3 && geo.lat < 41.5) {
        map.flyTo({ center: [geo.lng, geo.lat], zoom: 15, duration: 800 });
      }
    }
  }, [geo, map, setUserPos]);

  // Carica terrazze + chunk edifici per il viewport + calcola stati
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const run = async () => {
      const [list, meta] = await Promise.all([loadTerraces(), loadMeta()]);
      if (cancelled) return;
      setTerraces(list);

      const b = map.getBounds();
      const cells = cellsForBbox(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        meta.gridStep,
        300,
      );
      const chunks = await Promise.all(cells.map((k) => loadBuildingChunk(k)));
      const allBuildings: Building[] = chunks.flat();
      const index = buildBuildingIndex(allBuildings);
      if (cancelled) return;

      const states = computeAllStates(list, now, index);
      setStates(states);
    };
    map.once('idle', run);
    return () => { cancelled = true; };
  }, [map, now, setTerraces, setStates]);

  return (
    <div className="app-root">
      <MapView onMapReady={setMap} />
      {map && <Markers map={map} />}
      <TimeSlider />
    </div>
  );
}
