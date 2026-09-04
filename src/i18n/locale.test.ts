import { describe, expect, it } from 'vitest';
import { browserLanguages, INTL_LOCALE, isLocale, LOCALE_NAMES, LOCALES, resolveLocale } from './locale';

/** FR-I18N-1 (PLAN §9.1 "Locale resolution"). */
describe('resolveLocale', () => {
  it('picks Spanish when a Spanish tag is in the browser list', () => {
    expect(resolveLocale(['es-AR', 'en'])).toBe('es');
    expect(resolveLocale(['es'])).toBe('es');
    expect(resolveLocale(['ES-419'])).toBe('es');
  });

  it('picks English for any other list, and for an empty or missing one', () => {
    expect(resolveLocale(['en-GB'])).toBe('en');
    expect(resolveLocale(['pt-BR'])).toBe('en');
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('lets a saved preference beat the browser either way', () => {
    expect(resolveLocale(['es-AR', 'en'], 'en')).toBe('en');
    expect(resolveLocale(['en-GB'], 'es')).toBe('es');
  });

  it('is not fooled by a language whose tag merely starts with es', () => {
    expect(resolveLocale(['est'])).toBe('en'); // Estonian
    expect(resolveLocale(['eu'])).toBe('en'); // Basque
  });
});

describe('the locale table', () => {
  it('names both languages in their own language, and gives each an Intl tag', () => {
    expect(LOCALES).toEqual(['en', 'es']);
    expect(LOCALE_NAMES).toEqual({ en: 'English', es: 'Español' });
    for (const locale of LOCALES) expect(new Intl.DateTimeFormat(INTL_LOCALE[locale]).resolvedOptions().locale).toContain(locale);
  });

  it('recognises its own tags and nothing else', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('es-AR')).toBe(false);
  });
});

describe('browserLanguages', () => {
  it('falls back to navigator.language when the list is empty', () => {
    expect(browserLanguages().length).toBeGreaterThan(0); // jsdom always reports one
  });
});
