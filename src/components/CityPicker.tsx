import { useStore } from '../store/use-store.js';
import { t } from '../i18n/i18n.js';
import '../styles/city-picker.css';

/**
 * Selettore città. Mostra il nome della città corrente + dropdown con tutte
 * le città disponibili dal cities.json. Selezione cambia la città globale
 * (con persistenza localStorage) → App.tsx ricarica dati al cambio.
 *
 * Posizionato in alto a sinistra (sopra al TimeSlider, dentro un piccolo
 * pill). Su desktop sta nella sidebar header.
 */
export default function CityPicker() {
  const currentCity = useStore((s) => s.currentCity);
  const cities = useStore((s) => s.cities);
  const setCurrentCity = useStore((s) => s.setCurrentCity);

  const ordered = Object.values(cities).sort((a, b) => a.name.localeCompare(b.name));
  if (ordered.length <= 1) return null;

  return (
    <label className="city-picker" aria-label={t('cityPickerLabel')}>
      <span className="city-picker__icon" aria-hidden="true">🌆</span>
      <select
        className="city-picker__select"
        value={currentCity}
        onChange={(e) => setCurrentCity(e.target.value)}
        aria-label={t('cityPickerLabel')}
      >
        {ordered.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
      <span className="city-picker__chevron" aria-hidden="true">▾</span>
    </label>
  );
}
