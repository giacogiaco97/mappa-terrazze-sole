import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
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
    // Notifichiamo immediatamente: i consumer (Markers, App) sono responsabili di
    // attendere isStyleLoaded() prima di chiamare addSource/addLayer. Questo evita
    // di restare bloccati se l'evento 'load' tarda (ambienti headless, tile lenti).
    onMapReady?.(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [onMapReady]);

  return <div className="map-container" ref={containerRef} />;
}
