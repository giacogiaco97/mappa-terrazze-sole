import { useEffect, useState, useRef } from 'react';
import { t } from '../i18n/i18n.js';
import '../styles/update-prompt.css';

/**
 * Mostra un toast quando il service worker ha attivato un aggiornamento
 * (con `skipWaiting + clientsClaim` succede al fetch del nuovo SW).
 *
 * Flow:
 * - `controllerchange` scatta quando il nuovo SW prende il controllo della pagina.
 * - Mostriamo il toast: "Nuova versione disponibile" + bottone Aggiorna.
 * - Click su Aggiorna → `location.reload()` → l'utente vede il nuovo content.
 *
 * Senza UpdatePrompt l'utente vedrebbe il nuovo content al prossimo refresh
 * spontaneo (potrebbero passare ore). Questo lo notifica subito.
 */
export default function UpdatePrompt() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const isFirstControllerRef = useRef(true);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onControllerChange = () => {
      // Il primo controllerchange dopo il page load è il SW che registra il
      // controllo iniziale (es. dopo lo stato "redundant" → "activated").
      // Lo ignoriamo per evitare un prompt al primo visit.
      if (isFirstControllerRef.current) {
        isFirstControllerRef.current = false;
        return;
      }
      setNeedsRefresh(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!needsRefresh) return null;

  return (
    <div className="update-prompt" role="status" aria-live="polite">
      <span>{t('updateAvailable')}</span>
      <button onClick={() => window.location.reload()} className="update-prompt__btn">
        {t('updateApply')}
      </button>
    </div>
  );
}
