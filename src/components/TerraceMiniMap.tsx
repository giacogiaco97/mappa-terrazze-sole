import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Props = {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
};

/**
 * Mini-mappa satellitare per la card.
 *
 * Tile: ESRI World Imagery (gratis, niente API key, CORS aperto).
 * Attribution richiesta dai termini d'uso ESRI.
 *
 * Alternative considerate:
 * - Google Maps Embed API (iframe ufficiale): gratuita ma richiede API key
 *   + progetto Google Cloud + billing attivato. Più complesso.
 * - Iframe legacy maps.google.com/maps?output=embed: Google ha dismesso
 *   (HTTP 404 + X-Frame-Options: SAMEORIGIN, novembre 2024).
 *
 * La mappa è non-interactive (dragPan/zoom disabilitati) per non rubare
 * gesture allo scroll della card. L'utente apre Google Maps via i CTA sotto.
 */
export default function TerraceMiniMap({ lat, lng, zoom = 18, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'sat', type: 'raster', source: 'satellite' }],
      },
      center: [lng, lat],
      zoom,
      attributionControl: { compact: true },
      interactive: false,
      pitchWithRotate: false,
      touchPitch: false,
      keyboard: false,
    });

    // Marker arancio brand al centro
    const el = document.createElement('div');
    el.style.cssText = `
      width: 32px; height: 32px;
      background: #f5a623;
      border: 3px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    `;
    new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, zoom]);

  return (
    <div
      ref={containerRef}
      className={`card__map ${className}`.trim()}
      aria-label="Vista satellitare della terrazza"
      role="img"
    />
  );
}
