import { useEffect, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { getDailySummary } from '../lib/weather.js';
import { t } from '../i18n/i18n.js';
import '../styles/tomorrow-banner.css';

/**
 * Banner "buona notizia per domani".
 *
 * Sostituto leggero per le notifiche push (le vere push richiedono backend con
 * chiavi VAPID, fuori scope per un sito statico GitHub Pages). Mostra un toast
 * solo se:
 * - Il meteo di domani è caricato
 * - Domani sono previste ≥ 6 ore di sole (cielo pulito)
 * - L'utente non l'ha già dismesso oggi (chiave localStorage data-based)
 *
 * Dismiss persistente per giorno: ogni nuovo giorno il banner riappare se
 * c'è una buona previsione.
 */
const MIN_SUNNY_HOURS = 6;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function TomorrowBanner() {
  const weather = useStore((s) => s.weather);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('tomorrow-banner-dismissed');
      if (seen === todayKey()) setDismissed(true);
    } catch { /* ignore */ }
  }, []);

  if (dismissed || !weather) return null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const summary = getDailySummary(weather, tomorrow);
  if (!summary || summary.sunnyHours < MIN_SUNNY_HOURS) return null;

  const close = () => {
    try { localStorage.setItem('tomorrow-banner-dismissed', todayKey()); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="tomorrow-banner" role="status" aria-live="polite">
      <span className="tomorrow-banner__icon" aria-hidden="true">🌅</span>
      <span className="tomorrow-banner__text">
        {t('tomorrowGreatSun', { h: summary.sunnyHours })}
      </span>
      <button
        className="tomorrow-banner__close"
        onClick={close}
        aria-label={t('tomorrowBannerClose')}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
