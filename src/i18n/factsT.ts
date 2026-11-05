import { facts as en } from './en/facts';
import { facts as es } from './es/facts';
import { useLocale } from './useT';
import type { Locale } from '../model';

/** R188 (FR-I18N-2, D-1125): the facts groups' words in the active language, imported only from the `facts` chunk. */
export type FactsMessages = typeof en;

export const FACTS_CATALOGS: Readonly<Record<Locale, FactsMessages>> = { en, es };

export function useFactsT(): FactsMessages {
  return FACTS_CATALOGS[useLocale()];
}
