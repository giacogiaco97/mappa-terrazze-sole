import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import './styles/global.css';

// Bootstrap del tema (legge da localStorage prima del primo render per evitare FOUC).
try {
  const t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch { /* localStorage disabled */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
