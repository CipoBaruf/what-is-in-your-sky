import type { Locale } from '../model';

/**
 * FR-I18N-1 (R17): which language the app renders in. On the first visit it
 * comes from `navigator.languages` — the first entry whose primary subtag is
 * `es` selects Spanish, anything else English — and a preference saved
 * through the header switch wins over the browser from then on (D-69). The
 * language is a preference, not a route (FR-I18N-6): nothing here reads or
 * writes the URL.
 */
export const LOCALES = ['en', 'es'] as const;

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * FR-I18N-4: the BCP 47 tag each language formats dates, times and numbers
 * with. English is `en-GB` (the MVP's `LOCALE`, so nothing an English reader
 * sees moves in R17); Spanish is the language alone, which CLDR resolves to
 * the neutral international Spanish the copy is written in (FR-I18N-3) rather
 * than to one country's conventions.
 */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-GB', es: 'es' };

/** The language's own name, never translated: a switch is read by someone who cannot read the other language. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español' };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** The primary subtag of a BCP 47 tag, lowercased: `es-419` → `es`, `EN-GB` → `en`. */
function primarySubtag(tag: string): string {
  return (tag.split('-')[0] ?? '').toLowerCase();
}

/**
 * FR-I18N-1. `saved` is the header switch's choice and wins outright;
 * otherwise the browser's list decides, and an empty or unknown list is
 * English.
 */
export function resolveLocale(languages: readonly string[] | undefined, saved?: Locale | undefined): Locale {
  if (saved) return saved;
  for (const tag of languages ?? []) if (primarySubtag(tag) === 'es') return 'es';
  return DEFAULT_LOCALE;
}

/** The locale to resolve from in a browser; `navigator.languages` is empty in some privacy modes, so `language` is the fallback. */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  const list = navigator.languages;
  if (list.length > 0) return list;
  return navigator.language ? [navigator.language] : [];
}
