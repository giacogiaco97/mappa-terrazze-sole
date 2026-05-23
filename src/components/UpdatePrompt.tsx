import { useEffect, useState } from 'react';
import { t } from '../i18n/i18n.js';
import '../styles/update-prompt.css';

/**
 * Mostra un toast quando il service worker ha scaricato un aggiornamento.
 * Click su "Aggiorna" → skipWaiting + reload, che attiva la nuova versione.
 *
 * vite-plugin-pwa con registerType='autoUpdate' di default aggiorna in
 * background ma non avvisa l'utente. Questo componente comunica esplicitamente
 * "c'è una nuova versione" e dà il consenso all'utente.
 */
export default function UpdatePrompt() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const onWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setNeedsUpdate(true);
      }
    };

    navigator.serviceWorker.ready.then((reg) => {
      // SW già in stato 'waiting' al mount?
      onWaiting(reg);
      // Nuovo SW installato dopo il mount?
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(nw);
            setNeedsUpdate(true);
          }
        });
      });
    }).catch(() => undefined);

    // Quando il nuovo SW prende il controllo, reload.
    let didReload = false;
    const onControllerChange = () => {
      if (didReload) return;
      didReload = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!needsUpdate) return null;

  const apply = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <div className="update-prompt" role="status" aria-live="polite">
      <span>{t('updateAvailable')}</span>
      <button onClick={apply} className="update-prompt__btn">
        {t('updateApply')}
      </button>
    </div>
  );
}
