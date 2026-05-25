import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import MapView from './components/MapView.js';
import Markers from './components/Markers.js';
import TimeSlider from './components/TimeSlider.js';
import BottomSheet from './components/BottomSheet.js';
import TerraceList from './components/TerraceList.js';
import TerraceCard from './components/TerraceCard.js';
import GeolocateButton from './components/GeolocateButton.js';
import CreditsButton from './components/CreditsButton.js';
import Onboarding from './components/Onboarding.js';
import UpdatePrompt from './components/UpdatePrompt.js';
import TomorrowBanner from './components/TomorrowBanner.js';
import { useGeolocation } from './lib/use-geolocation.js';
import { useUrlSync } from './lib/use-url-sync.js';
import { useStore } from './store/use-store.js';
import { loadTerraces, loadMeta, loadBuildingChunk, cellsForBbox } from './lib/data-loader.js';
import { buildBuildingIndex } from './lib/building-index.js';
import { computeAllStates } from './lib/compute-states.js';
import { fetchWeather } from './lib/weather.js';
import { t } from './i18n/i18n.js';
import type { Building } from './types/index.js';

const BCN_CENTER_LAT = 41.39;
const BCN_CENTER_LNG = 2.165;

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
};

export default function App() {
  const [map, setMap] = useState<MLMap | null>(null);
  const geo = useGeolocation();
  useUrlSync();
  const setTerraces = useStore((s) => s.setTerraces);
  const setStates = useStore((s) => s.setStates);
  const setUserPos = useStore((s) => s.setUserPos);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const setBuildingIndex = useStore((s) => s.setBuildingIndex);
  const setWeather = useStore((s) => s.setWeather);
  const setNow = useStore((s) => s.setNow);
  const now = useStore((s) => s.now);
  const states = useStore((s) => s.states);
  const terraces = useStore((s) => s.terraces);
  const buildingIndex = useStore((s) => s.buildingIndex);
  const weather = useStore((s) => s.weather);

  // 1) Geolocalizzazione → centra mappa (solo se l'utente è dentro BCN)
  useEffect(() => {
    if (geo.status === 'ok' && map) {
      setUserPos({ lat: geo.lat, lng: geo.lng });
      if (geo.lng > 2.0 && geo.lng < 2.3 && geo.lat > 41.3 && geo.lat < 41.5) {
        map.flyTo({ center: [geo.lng, geo.lat], zoom: 15, duration: 800 });
      }
    }
  }, [geo, map, setUserPos]);

  // 2) Carica terrazze + chunk edifici UNA VOLTA quando la mappa è pronta.
  //    Separato dal ricalcolo states per evitare reload completo a ogni cambio `now`.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const load = async () => {
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
      if (cancelled) return;
      setBuildingIndex(buildBuildingIndex(allBuildings));
    };
    load();
    return () => { cancelled = true; };
  }, [map, setTerraces, setBuildingIndex]);

  // 3) Ricomputa states quando cambia now / terraces / buildingIndex / weather.
  //    Veloce: solo raycasting su dati già caricati. requestIdleCallback per non
  //    bloccare il main thread durante interazioni rapide (es. drag dello slider).
  useEffect(() => {
    if (!terraces.length || !buildingIndex) return;
    let cancelled = false;
    const compute = () => {
      if (cancelled) return;
      setStates(computeAllStates(terraces, now, buildingIndex, weather));
    };
    const w = window as IdleWindow;
    let handle: number | undefined;
    if (w.requestIdleCallback) {
      handle = w.requestIdleCallback(compute, { timeout: 600 });
    } else {
      handle = window.setTimeout(compute, 0);
    }
    return () => {
      cancelled = true;
      if (handle !== undefined && 'cancelIdleCallback' in window) {
        (window as Window & typeof globalThis & { cancelIdleCallback: (h: number) => void })
          .cancelIdleCallback(handle);
      }
    };
  }, [now, terraces, buildingIndex, weather, setStates]);

  // 4) Fetch meteo da Open-Meteo al mount + ogni 30 min (cache localStorage 1h).
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const w = await fetchWeather(BCN_CENTER_LAT, BCN_CENTER_LNG, 7);
      if (!cancelled) setWeather(w);
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [setWeather]);

  // 5) Refresh automatico di `now` se l'utente non l'ha modificato manualmente.
  //    Considera "non modificato" se è entro 1 minuto da Date.now().
  useEffect(() => {
    const id = window.setInterval(() => {
      const drift = Math.abs(Date.now() - useStore.getState().now.getTime());
      if (drift < 60_000) setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [setNow]);

  const sunnyCount = Object.values(states).filter((s) => s === 'sun').length;
  const userPos = useStore((s) => s.userPos);
  const selectedId = useStore((s) => s.selectedId);

  const outsideBcn =
    geo.status === 'ok' &&
    (geo.lng < 2.0 || geo.lng > 2.3 || geo.lat < 41.3 || geo.lat > 41.5);

  // Etichetta sheet contestuale: con posizione → "cerca de ti", senza → "en Barcelona"
  const sheetLabel = userPos
    ? t('sunnyNearby', { count: sunnyCount })
    : t('sunnyInCity', { count: sunnyCount });

  // Banner edge: nascosti se la card è aperta (per non distrarre) o se la posizione
  // è ormai disponibile (lo stato 'denied' può persistere se l'utente attiva via CTA).
  const showGeoDeniedBanner = geo.status === 'denied' && !userPos && !selectedId;
  const showOutsideBcnBanner = outsideBcn && !selectedId;

  return (
    <div className="app-root">
      <MapView onMapReady={setMap} />
      {map && <Markers map={map} />}
      <TimeSlider />
      {showGeoDeniedBanner && (
        <div className="edge-banner" role="status">{t('geoDenied')}</div>
      )}
      {showOutsideBcnBanner && (
        <div className="edge-banner" role="status">{t('outsideBcn')}</div>
      )}
      <BottomSheet collapsedLabel={sheetLabel}>
        <TerraceList onSelectTerrace={setSelectedId} />
      </BottomSheet>
      <TerraceCard />
      <GeolocateButton map={map} />
      <CreditsButton />
      <Onboarding />
      <UpdatePrompt />
      {!selectedId && <TomorrowBanner />}
    </div>
  );
}
