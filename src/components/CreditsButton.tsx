import { useState } from 'react';
import { t } from '../i18n/i18n.js';
import { useModalDismiss } from '../lib/use-modal-dismiss.js';
import '../styles/credits.css';

export default function CreditsButton() {
  const [open, setOpen] = useState(false);
  useModalDismiss(open, () => setOpen(false));
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
          <div className="credits-modal" role="dialog" aria-modal="true" aria-label={t('creditsTitle')}>
            <button className="credits-modal__close" onClick={() => setOpen(false)} aria-label={t('close')}>
              <span aria-hidden="true">×</span>
            </button>
            <h3>{t('creditsTitle')}</h3>
            <p>{t('credits')}</p>
            <p>OSM © OpenStreetMap contributors (ODbL).<br />Open Data BCN — CC-BY-4.0.</p>
            <p style={{ fontSize: 12, color: '#555' }}>Tiles: OpenFreeMap (libera). Calcolo sole: suncalc (BSD).</p>
          </div>
        </div>
      )}
    </>
  );
}
