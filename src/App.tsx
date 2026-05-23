import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import MapView from './components/MapView.js';
import Markers from './components/Markers.js';
import TimeSlider from './components/TimeSlider.js';
import BottomSheet from './components/BottomSheet.js';
import TerraceList from './components/TerraceList.js';
import TerraceCard from './components/TerraceCard.js';
import GeolocateButton from './components/GeolocateButton.js';
import { useGeolocation } from './lib/use-geolocation.js';
import { useStore } from './store/use-store.js';
import { loadTerraces, loadMeta, loadBuildingChunk, cellsForBbox } from './lib/data-loader.js';
import { buildBuildingIndex } from './lib/building-index.js';
import { computeAllStates } from './lib/compute-states.js';
import { t } from './i18n/i18n.js';
import type { Building } from './types/index.js';

export default function App() {
  const [map, setMap] = useState<MLMap | null>(null);
  const geo = useGeolocation();
  const setTerraces = useStore((s) => s.setTerraces);
  const setStates = useStore((s) => s.setStates);
  const setUserPos = useStore((s) => s.setUserPos);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const setBuildingIndex = useStore((s) => s.setBuildingIndex);
  const now = useStore((s) => s.now);
  const states = useStore((s) => s.states);

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

      setBuildingIndex(index);
      const newStates = computeAllStates(list, now, index);
      setStates(newStates);
    };
    map.once('idle', run);
    return () => { cancelled = true; };
  }, [map, now, setTerraces, setStates, setBuildingIndex]);

  const sunnyCount = Object.values(states).filter((s) => s === 'sun').length;

  const outsideBcn =
    geo.status === 'ok' &&
    (geo.lng < 2.0 || geo.lng > 2.3 || geo.lat < 41.3 || geo.lat > 41.5);

  return (
    <div className="app-root">
      <MapView onMapReady={setMap} />
      {map && <Markers map={map} />}
      <TimeSlider />
      {geo.status === 'denied' && (
        <div className="edge-banner">{t('geoDenied')}</div>
      )}
      {outsideBcn && (
        <div className="edge-banner">{t('outsideBcn')}</div>
      )}
      <BottomSheet collapsedLabel={t('sunnyNearby', { count: sunnyCount })}>
        <TerraceList onSelectTerrace={setSelectedId} />
      </BottomSheet>
      <TerraceCard />
      <GeolocateButton map={map} />
    </div>
  );
}
