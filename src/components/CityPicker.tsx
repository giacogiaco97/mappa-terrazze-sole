import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/use-store.js';
import { t } from '../i18n/i18n.js';
import '../styles/city-picker.css';

/**
 * Selettore città custom (NO <select> nativo: rende male su desktop, opzioni
 * non stilizzabili). Button-driven dropdown con SVG icon, lista flottante,
 * click-outside + Escape per chiudere, keyboard nav (ArrowUp/Down/Enter).
 */
export default function CityPicker() {
  const currentCity = useStore((s) => s.currentCity);
  const cities = useStore((s) => s.cities);
  const setCurrentCity = useStore((s) => s.setCurrentCity);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Click outside + Escape per chiudere
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ordered = Object.values(cities).sort((a, b) => a.name.localeCompare(b.name));
  if (ordered.length <= 1) return null;

  const current = cities[currentCity];

  const onSelect = (code: string) => {
    setCurrentCity(code);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`city-picker ${open ? 'city-picker--open' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className="city-picker__button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('cityPickerLabel')}
      >
        <svg className="city-picker__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 21V9l5-3 5 3v3h6v9H4Zm2-2h6v-2H6v2Zm0-4h6v-2H6v2Zm0-4h6V9.18l-3-1.8-3 1.8V11Zm8 8h6v-5h-6v5Z"
            fill="currentColor"
          />
        </svg>
        <span className="city-picker__current">{current?.name ?? '—'}</span>
        <svg className="city-picker__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <ul className="city-picker__menu" role="listbox" aria-label={t('cityPickerLabel')}>
          {ordered.map((c) => {
            const isCurrent = c.code === currentCity;
            return (
              <li key={c.code} role="option" aria-selected={isCurrent}>
                <button
                  type="button"
                  className={`city-picker__item ${isCurrent ? 'city-picker__item--current' : ''}`}
                  onClick={() => onSelect(c.code)}
                >
                  <span className="city-picker__item-name">{c.name}</span>
                  {isCurrent && (
                    <svg className="city-picker__check" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
