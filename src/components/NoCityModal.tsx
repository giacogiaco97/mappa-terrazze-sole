import { useRef } from 'react';
import { useStore } from '../store/use-store.js';
import { useModalDismiss } from '../lib/use-modal-dismiss.js';
import { t } from '../i18n/i18n.js';
import '../styles/no-city-modal.css';

/**
 * Modal mostrato quando la geolocalizzazione dell'utente è FUORI da tutte
 * le città attualmente supportate. Permette di scegliere una città
 * disponibile o richiedere l'aggiunta della propria via email.
 *
 * Triggered: geo.status === 'ok' && nessuna città disponibile contiene
 * la posizione.
 */

const REQUEST_EMAIL = 'mascherin2797g@gmail.com';

type Props = {
  open: boolean;
  userLat?: number;
  userLng?: number;
  onClose: () => void;
};

export default function NoCityModal({ open, userLat, userLng, onClose }: Props) {
  const cities = useStore((s) => s.cities);
  const setCurrentCity = useStore((s) => s.setCurrentCity);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalDismiss(open, onClose, modalRef);

  if (!open) return null;

  const ordered = Object.values(cities).sort((a, b) => a.name.localeCompare(b.name));

  const subject = encodeURIComponent(t('requestCityEmailSubject'));
  const body = encodeURIComponent(
    `${t('requestCityEmailBody')}\n\n` +
    `Posición: ${userLat?.toFixed(4) ?? '?'}, ${userLng?.toFixed(4) ?? '?'}\n` +
    `URL: ${typeof window !== 'undefined' ? window.location.href : ''}\n`,
  );
  const mailto = `mailto:${REQUEST_EMAIL}?subject=${subject}&body=${body}`;

  const onSelectCity = (code: string) => {
    setCurrentCity(code);
    onClose();
  };

  return (
    <div className="no-city-backdrop" data-modal-backdrop>
      <div ref={modalRef} className="no-city-modal" role="dialog" aria-modal="true" aria-labelledby="no-city-title">
        <button className="no-city-modal__close" onClick={onClose} aria-label={t('close')}>
          <span aria-hidden="true">×</span>
        </button>
        <span className="no-city-modal__icon" aria-hidden="true">🌍</span>
        <h3 id="no-city-title">{t('noCityTitle')}</h3>
        <p className="no-city-modal__intro">{t('noCityIntro')}</p>

        <div className="no-city-modal__list" role="list">
          {ordered.map((c) => (
            <button
              key={c.code}
              type="button"
              role="listitem"
              className="no-city-modal__city"
              onClick={() => onSelectCity(c.code)}
            >
              <span className="no-city-modal__city-name">{c.name}</span>
              <span className="no-city-modal__city-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>

        <a
          className="no-city-modal__request"
          href={mailto}
          target="_blank"
          rel="noreferrer"
        >
          <span aria-hidden="true">✉️</span>{' '}
          {t('requestNewCity')}
        </a>
      </div>
    </div>
  );
}
