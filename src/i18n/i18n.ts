import es from './es.json';
import en from './en.json';
import ca from './ca.json';

const PACKS = { es, en, ca } as const;
type Lang = keyof typeof PACKS;

function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'es';
  if (nav.startsWith('ca')) return 'ca';
  if (nav.startsWith('en')) return 'en';
  return 'es';
}

const lang: Lang = detectLang();
const pack = PACKS[lang];

export function t(key: keyof typeof es, vars?: Record<string, string | number>): string {
  let s = (pack as Record<string, string>)[key] ?? (es as Record<string, string>)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
