import { useRef, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { useModalDismiss } from '../lib/use-modal-dismiss.js';
import { t } from '../i18n/i18n.js';
import '../styles/no-city-modal.css';

/**
 * Modal mostrato quando la geolocalizzazione dell'utente è FUORI da tutte
 * le città attualmente supportate.
 *
 * Permette di:
 * - Scegliere una città disponibile (switch immediato)
 * - Richiedere l'aggiunta della propria via form interno (POST /api/request-city).
 *   L'email destinatario NON è esposta nel client: la Vercel Function lato
 *   server invia via Resend al destinatario configurato in env var.
 */

type Props = {
  open: boolean;
  userLat?: number;
  userLng?: number;
  onClose: () => void;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export default function NoCityModal({ open, userLat, userLng, onClose }: Props) {
  const cities = useStore((s) => s.cities);
  const setCurrentCity = useStore((s) => s.setCurrentCity);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalDismiss(open, onClose, modalRef);

  const [showForm, setShowForm] = useState(false);
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!open) return null;

  const ordered = Object.values(cities).sort((a, b) => a.name.localeCompare(b.name));

  const onSelectCity = (code: string) => {
    setCurrentCity(code);
    onClose();
  };

  // Web3Forms: free 250 form/mese.
  // La access_key è PUBBLICA per design (https://docs.web3forms.com/security):
  // serve solo a identificare il form, l'email destinatario è associata
  // server-side ad essa e MAI esposta nel bundle. Quindi committarla è OK.
  // Override possibile via env var VITE_WEB3FORMS_KEY (per fork/dev).
  const DEFAULT_KEY = '8a29a9a7-1b70-49a2-a220-e4eeef437a33';
  const WEB3FORMS_KEY = (import.meta.env.VITE_WEB3FORMS_KEY as string | undefined) || DEFAULT_KEY;
  const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    // Bot honeypot: se compilato, finge successo senza inviare
    if (honeypot) {
      setSubmitState('success');
      return;
    }
    if (!WEB3FORMS_KEY) {
      setErrorMsg(t('requestFormNotConfigured'));
      setSubmitState('error');
      return;
    }
    setSubmitState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `[Terrazas al sol] Pedido nueva ciudad: ${city.trim()}`,
          from_name: 'Terrazas al sol',
          ciudad: city.trim(),
          email_contacto: email.trim() || '(non fornita)',
          mensaje: message.trim() || '(nessuno)',
          posicion: userLat != null && userLng != null
            ? `${userLat.toFixed(4)}, ${userLng.toFixed(4)}`
            : 'non condivisa',
          url: typeof window !== 'undefined' ? window.location.href : '',
          // Web3Forms supporta reply_to: rispondi direttamente all'utente
          replyto: email.trim() || undefined,
          // Honeypot built-in di Web3Forms (nome del campo è "botcheck")
          botcheck: '',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || data.success === false) {
        setErrorMsg(data.message || `Error ${res.status}`);
        setSubmitState('error');
        return;
      }
      setSubmitState('success');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setSubmitState('error');
    }
  };

  return (
    <div className="no-city-backdrop" data-modal-backdrop>
      <div ref={modalRef} className="no-city-modal" role="dialog" aria-modal="true" aria-labelledby="no-city-title">
        <button className="no-city-modal__close" onClick={onClose} aria-label={t('close')}>
          <span aria-hidden="true">×</span>
        </button>

        {!showForm && submitState !== 'success' && (
          <>
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

            <button
              type="button"
              className="no-city-modal__request"
              onClick={() => setShowForm(true)}
            >
              <span aria-hidden="true">✉️</span>{' '}
              {t('requestNewCity')}
            </button>
          </>
        )}

        {showForm && submitState !== 'success' && (
          <form className="no-city-form" onSubmit={onSubmit}>
            <h3 id="no-city-title">{t('requestFormTitle')}</h3>
            <p className="no-city-modal__intro">{t('requestFormIntro')}</p>

            <label className="no-city-form__label">
              <span>{t('requestFormCity')} <span className="no-city-form__required" aria-hidden="true">*</span></span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('requestFormCityPlaceholder')}
                required
                maxLength={100}
                autoComplete="off"
                autoFocus
              />
            </label>

            <label className="no-city-form__label">
              <span>{t('requestFormEmail')} <span className="no-city-form__optional">({t('optional')})</span></span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                maxLength={200}
                autoComplete="email"
              />
            </label>

            <label className="no-city-form__label">
              <span>{t('requestFormMessage')} <span className="no-city-form__optional">({t('optional')})</span></span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('requestFormMessagePlaceholder')}
                maxLength={1000}
                rows={3}
              />
            </label>

            {/* Honeypot: campo nascosto, deve restare vuoto (anti-bot) */}
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
            />

            {submitState === 'error' && (
              <p className="no-city-form__error" role="alert">
                {errorMsg || t('requestFormError')}
              </p>
            )}

            <div className="no-city-form__actions">
              <button
                type="button"
                className="no-city-form__back"
                onClick={() => setShowForm(false)}
                disabled={submitState === 'submitting'}
              >
                {t('back')}
              </button>
              <button
                type="submit"
                className="no-city-form__submit"
                disabled={!city.trim() || submitState === 'submitting'}
              >
                {submitState === 'submitting' ? t('requestFormSubmitting') : t('requestFormSubmit')}
              </button>
            </div>
          </form>
        )}

        {submitState === 'success' && (
          <div className="no-city-success">
            <span className="no-city-success__icon" aria-hidden="true">✅</span>
            <h3>{t('requestFormSuccessTitle')}</h3>
            <p>{t('requestFormSuccessBody')}</p>
            <button type="button" className="no-city-modal__request" onClick={onClose}>
              {t('close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
