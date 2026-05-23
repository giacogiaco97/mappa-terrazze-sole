import es from './es.json';
import en from './en.json';

const PACKS = { es, en } as const;
type Lang = keyof typeof PACKS;

function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'es';
  return nav.startsWith('en') ? 'en' : 'es';
}

const lang: Lang = detectLang();
const pack = PACKS[lang];

export function t(key: keyof typeof es, vars?: Record<string, string | number>): string {
  let s = (pack as Record<string, string>)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
