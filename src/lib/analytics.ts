/**
 * Analytics privacy-friendly via Plausible.
 *
 * Si attiva solo se la env var `VITE_PLAUSIBLE_DOMAIN` è settata al build.
 * Senza valore, niente script caricato, niente cookie, niente fingerprinting,
 * niente tracking. Plausible non usa cookie ed è GDPR-compliant senza banner.
 *
 * Setup:
 * 1. Crea progetto su https://plausible.io con il tuo dominio (o self-hosted).
 * 2. Build con `VITE_PLAUSIBLE_DOMAIN=mappa-terrazze-sole.example npm run build`.
 * 3. Lo script verrà aggiunto a runtime e tracciato un pageview iniziale.
 */
export function setupAnalytics(): void {
  const domain = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined)?.trim();
  if (!domain) return;
  if (typeof document === 'undefined') return;
  // Evita doppio inserimento (HMR / strict mode)
  if (document.querySelector('script[data-plausible]')) return;

  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = domain;
  s.dataset.plausible = 'true';
  s.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(s);
}
