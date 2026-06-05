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
import NoCityModal from './components/NoCityModal.js';
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
      // I chunk edifici si calcolano dal CENTRO della città, NON da map.getBounds():
      // al cambio città il flyTo è asincrono, quindi i bounds puntano ancora alla
      // città precedente → si chiederebbero chunk con chiavi di griglia sbagliate
      // (tutti 404) e le ombre risulterebbero vuote (ogni terrazza "al sole").
      const { lat: cLat, lng: cLng } = cityConf.center;
      const dLat = 0.045, dLng = 0.05; // ~5 km attorno al centro: copre la vista iniziale
      const cells = cellsForBbox(
        [cLng - dLng, cLat - dLat, cLng + dLng, cLat + dLat],
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
  const geoCityCode = geo.status === 'ok' && Object.keys(cities).length > 0
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
  // → suggeriamo lo switch. Dismiss esplicito tramite X.
  const suggestCity = geoCityCode && geoCityCode !== currentCity ? cities[geoCityCode] : null;
  const [switchCityDismissedFor, setSwitchCityDismissedFor] = useState<string | null>(null);
  const showSwitchCityBanner =
    suggestCity && !selectedId && !sheetOpen && switchCityDismissedFor !== suggestCity.code;

  // Modal "no data": geo OK + fuori da TUTTE le città + cities caricate.
  const [noCityDismissed, setNoCityDismissed] = useState(false);
  const [noCityInitialForm, setNoCityInitialForm] = useState(false);
  const showNoCityModalByGeo =
    geo.status === 'ok' &&
    Object.keys(cities).length > 0 &&
    geoCityCode === null &&
    !noCityDismissed &&
    !selectedId;

  // Detect navigazione mappa fuori da tutte le città coperte. Attivo solo
  // a zoom ≥ 9 (l'utente sta esaminando un'area specifica, non vista globale).
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const onMove = () => {
      const c = map.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };
    map.on('moveend', onMove);
    onMove();
    return () => { map.off('moveend', onMove); };
  }, [map]);

  const mapInACoveredCity = mapCenter && Object.values(cities).some((c) => {
    const [lngMin, latMin, lngMax, latMax] = c.bbox;
    return mapCenter.lng > lngMin && mapCenter.lng < lngMax &&
           mapCenter.lat > latMin && mapCenter.lat < latMax;
  });
  const [mapOutDismissed, setMapOutDismissed] = useState(false);
  // Reset dismiss quando l'utente torna in una città coperta
  useEffect(() => { if (mapInACoveredCity) setMapOutDismissed(false); }, [mapInACoveredCity]);
  const showMapOutBanner =
    mapCenter != null &&
    !mapInACoveredCity &&
    mapCenter.zoom >= 9 &&
    Object.keys(cities).length > 0 &&
    !mapOutDismissed &&
    !showSwitchCityBanner &&
    !showNoCityModalByGeo &&
    !selectedId &&
    !sheetOpen;

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
          <button
            type="button"
            className="edge-banner__close"
            onClick={() => setSwitchCityDismissedFor(suggestCity.code)}
            aria-label={t('close')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
      {showMapOutBanner && (
        <div className="edge-banner edge-banner--action" role="status">
          <span>{t('mapOutOfCoverage')}</span>
          <button
            type="button"
            className="edge-banner__action"
            onClick={() => { setNoCityInitialForm(true); setNoCityDismissed(false); }}
          >
            {t('mapOutOfCoverageAction')}
          </button>
          <button
            type="button"
            className="edge-banner__close"
            onClick={() => setMapOutDismissed(true)}
            aria-label={t('close')}
          >
            <span aria-hidden="true">×</span>
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
      <NoCityModal
        open={showNoCityModalByGeo || noCityInitialForm}
        initialForm={noCityInitialForm}
        userLat={mapCenter?.lat ?? (geo.status === 'ok' ? geo.lat : undefined)}
        userLng={mapCenter?.lng ?? (geo.status === 'ok' ? geo.lng : undefined)}
        onClose={() => {
          setNoCityDismissed(true);
          setNoCityInitialForm(false);
        }}
      />
      {!selectedId && !sheetOpen && <TomorrowBanner />}
    </div>
  );
}
