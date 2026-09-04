import { createContext, createElement, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { Locale } from '../model';
import { en } from './en';
import { es } from './es';
import type { Messages } from './messages';

/**
 * FR-I18N-1/5 (D-69): the active language and its catalog, in one context, so
 * a switch re-renders the whole tree without a reload and without touching
 * the URL (FR-I18N-6). `main.tsx` mounts the provider around `App` with the
 * locale the store resolved (D-70), and the provider keeps
 * `documentElement.lang` and the document title on the active language.
 *
 * The default value is the English catalog: the app always mounts the
 * provider (`AppRoot`), and the default is what lets a unit test render one
 * component on its own. It is not the fallback FR-I18N-2 forbids — a missing
 * key cannot reach here, `tsc -b` stops it in `es.ts`.
 *
 * No JSX: PLAN §3 lists this file as `useT.ts`, and one `createElement` for
 * one provider is a small price for keeping it there.
 */
export const CATALOGS: Record<Locale, Messages> = { en, es };

export interface I18n {
  locale: Locale;
  t: Messages;
}

const I18nContext = createContext<I18n>({ locale: 'en', t: en });

export interface I18nProviderProps {
  locale: Locale;
  children: ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const value = useMemo<I18n>(() => ({ locale, t: CATALOGS[locale] }), [locale]);
  useEffect(() => {
    applyLocale(locale);
  }, [locale]);
  return createElement(I18nContext.Provider, { value }, children);
}

/** FR-I18N-5: the document follows the language. Called by the provider and, before the first render, by `main.tsx` (D-70). */
export function applyLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = CATALOGS[locale].app.title;
}

/** The active catalog. Every user-visible string in `src/ui` comes from here (FR-I18N-2). */
export function useT(): Messages {
  return useContext(I18nContext).t;
}

/** The active language, for the formatting helpers that take one (FR-I18N-4). */
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
