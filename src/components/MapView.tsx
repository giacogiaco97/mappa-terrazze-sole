import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/map.css';

const BCN_CENTER: [number, number] = [2.165, 41.39];
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

type Props = {
  onMapReady?: (map: MLMap) => void;
};

export default function MapView({ onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: BCN_CENTER,
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // Static import (non lazy): MapLibre è il contenuto principale → il code-splitting
    // peggiora il LCP (testato con Lighthouse mobile: 39 vs 54). Il chunk pesante è
    // precachato dal service worker dopo il primo visit.
    onMapReady?.(map);
    mapRef.current = map;
    // DEBUG: expose map globally for inspection in browser console
    if (typeof window !== 'undefined') {
      (window as Window & { __mtsMap?: MLMap }).__mtsMap = map;
    }
    return () => { map.remove(); mapRef.current = null; };
  }, [onMapReady]);

  return <div className="map-container" ref={containerRef} />;
}
