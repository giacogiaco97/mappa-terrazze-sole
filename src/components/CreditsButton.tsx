import { useState } from 'react';
import { t } from '../i18n/i18n.js';
import '../styles/credits.css';

export default function CreditsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="credits-btn" onClick={() => setOpen(true)} aria-label="credits">i</button>
      {open && (
        <div className="credits-modal" role="dialog">
          <button className="credits-modal__close" onClick={() => setOpen(false)} aria-label="close credits">×</button>
          <h3>Crediti</h3>
          <p>{t('credits')}</p>
          <p>OSM © OpenStreetMap contributors (ODbL).<br />Open Data BCN — CC-BY-4.0.</p>
          <p style={{ fontSize: 12, color: '#888' }}>Tiles: OpenFreeMap (libera). Calcolo sole: suncalc (BSD).</p>
        </div>
      )}
    </>
  );
}
