import { useState, useEffect, useRef } from 'react';
import { t } from '../i18n/i18n.js';
import { useModalDismiss } from '../lib/use-modal-dismiss.js';
import '../styles/onboarding.css';

const STORAGE_KEY = 'onboarding-seen-v1';

export default function Onboarding() {
  const [show, setShow] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch { /* ignore */ }
  }, []);

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };

  useModalDismiss(show, close, modalRef);

  if (!show) return null;
  return (
    <div className="onboarding-backdrop" data-modal-backdrop>
      <div ref={modalRef} className="onboarding" role="dialog" aria-modal="true" aria-label={t('onboardingTitle')}>
        <h2 className="onboarding__title">{t('onboardingTitle')}</h2>
        <p className="onboarding__intro">{t('onboardingIntro')}</p>
        <ul className="onboarding__list">
          <li><span className="onboarding__dot" style={{ background: '#f5a623' }} aria-hidden="true" /> {t('legendSun')}</li>
          <li><span className="onboarding__dot" style={{ background: '#3a6ea5' }} aria-hidden="true" /> {t('legendShade')}</li>
          <li><span className="onboarding__dot" style={{ background: '#666666' }} aria-hidden="true" /> {t('legendNight')}</li>
        </ul>
        <p className="onboarding__hint">{t('onboardingSliderHint')}</p>
        <button className="onboarding__cta" onClick={close}>{t('onboardingCta')}</button>
      </div>
    </div>
  );
}
