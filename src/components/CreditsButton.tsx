import { useState, useRef } from 'react';
import { t } from '../i18n/i18n.js';
import { useModalDismiss } from '../lib/use-modal-dismiss.js';
import { useStore } from '../store/use-store.js';
import '../styles/credits.css';

export default function CreditsButton() {
  const [open, setOpen] = useState(false);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalDismiss(open, () => setOpen(false), modalRef);

  const nextTheme = () => {
    // ciclo: auto (null) → light → dark → auto
    if (theme === null) setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme(null);
  };
  const themeLabel = theme === null ? t('themeAuto') : theme === 'light' ? t('themeLight') : t('themeDark');

  return (
    <>
      <button
        className="credits-btn"
        onClick={() => setOpen(true)}
        aria-label={t('credits')}
        title={t('credits')}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open && (
        <div className="credits-backdrop" data-modal-backdrop>
          <div ref={modalRef} className="credits-modal" role="dialog" aria-modal="true" aria-label={t('creditsTitle')}>
            <button className="credits-modal__close" onClick={() => setOpen(false)} aria-label={t('close')}>
              <span aria-hidden="true">×</span>
            </button>
            <h3>{t('creditsTitle')}</h3>
            <p>{t('credits')}</p>
            <p>OSM © OpenStreetMap contributors (ODbL).<br />Open Data BCN — CC-BY-4.0.</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Tiles: OpenFreeMap (libera). Calcolo sole: suncalc (BSD).
            </p>
            <button className="theme-toggle" onClick={nextTheme} aria-label={t('themeToggle')}>
              <span aria-hidden="true">🎨</span>
              <span>{t('themeToggle')}: <strong>{themeLabel}</strong></span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
