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
import SheetFab from './components/SheetFab.js';
import CityPicker from './components/CityPicker.js';
import { useGeolocation } from './lib/use-geolocation.js';
import { useUrlSync } from './lib/use-url-sync.js';
import { useStore } from './store/use-store.js';
import {
  loadTerraces, loadMeta, loadBuildingChunk, cellsForBbox,
  loadCitiesIndex, clearBuildingCache,
} from './lib/data-loader.js';
import { buildBuildingIndex } from './lib/building-index.js';
import { computeAllStates } from './lib/compute-states.js';
import { fetchWeather } from './lib/weather.js';
import { t } from './i18n/i18n.js';
import type { Building } from './types/index.js';

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
  const setCities = useStore((s) => s.setCities);
  const setCurrentCity = useStore((s) => s.setCurrentCity);
  const now = useStore((s) => s.now);
  const states = useStore((s) => s.states);
  const terraces = useStore((s) => s.terraces);
  const buildingIndex = useStore((s) => s.buildingIndex);
  const weather = useStore((s) => s.weather);
  const currentCity = useStore((s) => s.currentCity);
  const cities = useStore((s) => s.cities);
  const cityConf = cities[currentCity];

  // 0) Carica indice città disponibili (cities.json) UNA VOLTA
  useEffect(() => {
    let cancelled = false;
    loadCitiesIndex()
      .then((c) => {
        if (cancelled) return;
        setCities(c);
        // Se la città salvata non esiste più nell'indice, fallback alla prima
        if (!c[currentCity]) {
          const first = Object.keys(c)[0];
          if (first) setCurrentCity(first);
        }
      })
      .catch((err) => console.error('Impossibile caricare cities.json', err));
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 1) Geolocalizzazione → centra mappa SE l'utente è dentro la città corrente
  useEffect(() => {
    if (geo.status === 'ok' && map && cityConf) {
      setUserPos({ lat: geo.lat, lng: geo.lng });
      const [lngMin, latMin, lngMax, latMax] = cityConf.bbox;
      if (geo.lng > lngMin && geo.lng < lngMax && geo.lat > latMin && geo.lat < latMax) {
        map.flyTo({ center: [geo.lng, geo.lat], zoom: 15, duration: 800 });
      }
    }
  }, [geo, map, setUserPos, cityConf]);

  // 2) Centra la mappa sul centro della città corrente al primo load
  //    (o al cambio città manuale dal CityPicker).
  useEffect(() => {
    if (!map || !cityConf) return;
    map.flyTo({
      center: [cityConf.center.lng, cityConf.center.lat],
      zoom: cityConf.center.zoom,
      duration: 600,
    });
  }, [map, cityConf]);

  // 3) Carica terrazze + chunk edifici della città corrente. Re-fetch al cambio.
  useEffect(() => {
    if (!map || !cityConf) return;
    let cancelled = false;
    const load = async () => {
      // Reset stato precedente (terrazze dell'altra città non più valide)
      setTerraces([]);
      setStates({});
      setBuildingIndex(null);
      setSelectedId(null);
      clearBuildingCache();

      const [list, meta] = await Promise.all([
        loadTerraces(currentCity),
        loadMeta(currentCity),
      ]);
      if (cancelled) return;
      setTerraces(list);
      const b = map.getBounds();
      const cells = cellsForBbox(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        meta.gridStep,
        300,
      );
      const chunks = await Promise.all(cells.map((k) => loadBuildingChunk(currentCity, k)));
      const allBuildings: Building[] = chunks.flat();
      if (cancelled) return;
      setBuildingIndex(buildBuildingIndex(allBuildings));
    };
    load().catch((err) => console.error(`Errore caricamento dati ${currentCity}`, err));
    return () => { cancelled = true; };
  }, [map, currentCity, cityConf, setTerraces, setStates, setBuildingIndex, setSelectedId]);

  // 4) Ricomputa states quando cambia now / terraces / buildingIndex / weather.
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

  // 5) Fetch meteo (centro della città corrente) al mount + ogni 30 min
  useEffect(() => {
    if (!cityConf) return;
    let cancelled = false;
    const tick = async () => {
      const w = await fetchWeather(cityConf.center.lat, cityConf.center.lng, 7);
      if (!cancelled) setWeather(w);
    };
    tick();
    const id = window.setInterval(tick, 30 * 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [setWeather, cityConf]);

  // 6) Refresh automatico di `now` se l'utente non l'ha modificato manualmente.
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
  const [sheetOpen, setSheetOpen] = useState(false);

  const cityName = cityConf?.name ?? '';

  // In quale città disponibile è la posizione utente? null = fuori da tutte.
  const geoCityCode = geo.status === 'ok'
    ? Object.values(cities).find((c) => {
        const [lngMin, latMin, lngMax, latMax] = c.bbox;
        return geo.lng > lngMin && geo.lng < lngMax && geo.lat > latMin && geo.lat < latMax;
      })?.code ?? null
    : null;

  const sheetLabel = userPos
    ? t('sunnyNearby', { count: sunnyCount })
    : t('sunnyInCity', { count: sunnyCount, city: cityName });

  const showGeoDeniedBanner = geo.status === 'denied' && !userPos && !selectedId;
  // L'utente è dentro una città disponibile DIVERSA da quella che sta vedendo
  // → suggeriamo lo switch (al posto del vecchio "Por ahora solo cubrimos X"
  // che era fuorviante in multi-città).
  const suggestCity = geoCityCode && geoCityCode !== currentCity ? cities[geoCityCode] : null;
  const showSwitchCityBanner = suggestCity && !selectedId && !sheetOpen;

  const onSelectFromList = (id: string) => {
    setSelectedId(id);
    setSheetOpen(false);
  };

  return (
    <div className="app-root">
      <MapView onMapReady={setMap} />
      {map && <Markers map={map} />}
      <TimeSlider />
      {showGeoDeniedBanner && (
        <div className="edge-banner" role="status">{t('geoDenied')}</div>
      )}
      {showSwitchCityBanner && suggestCity && (
        <div className="edge-banner edge-banner--action" role="status">
          <span>{t('switchCityPrompt', { city: suggestCity.name })}</span>
          <button
            type="button"
            className="edge-banner__action"
            onClick={() => setCurrentCity(suggestCity.code)}
          >
            {t('switchCityAction', { city: suggestCity.name })}
          </button>
        </div>
      )}
      <BottomSheet
        collapsedLabel={sheetLabel}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        headerSlot={<CityPicker />}
      >
        <TerraceList onSelectTerrace={onSelectFromList} />
      </BottomSheet>
      <SheetFab
        onClick={() => setSheetOpen(true)}
        label={sheetLabel}
        count={sunnyCount}
        visible={!sheetOpen && !selectedId}
      />
      <TerraceCard />
      <GeolocateButton map={map} />
      <CreditsButton />
      <Onboarding />
      <UpdatePrompt />
      {!selectedId && !sheetOpen && <TomorrowBanner />}
    </div>
  );
}
