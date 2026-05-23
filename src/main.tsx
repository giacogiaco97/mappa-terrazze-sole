import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App.js';
import './styles/global.css';

// Prefetch del chunk pesante (~273KB gzip) in parallelo al bundle iniziale.
// Quando MapView lo richiede via dynamic import, il chunk è già scaricato → niente
// second-roundtrip lag → LCP non si dilata oltre il caricamento del bundle iniziale.
void import('maplibre-gl');

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
