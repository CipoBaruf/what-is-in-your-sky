import { starsPage as en } from './en/starsPage';
import { starsPage as es } from './es/starsPage';
import { useLocale } from './useT';
import type { Locale } from '../model';

/**
 * R115 (FR-I18N-2, FR-STAR-10; D-777): the stars page's own words in the
 * active language. Imported only from the `stars` chunk (and the window the
 * chunk renders), so both languages' page words ship with the page and not in
 * the main chunk (FR-STAR-9's 1 KB). The type is the English section's, and
 * `es/starsPage.ts` is typed against it: a missing word fails `tsc -b`.
 */
export type StarsPageMessages = typeof en;

export const STARS_PAGE_CATALOGS: Readonly<Record<Locale, StarsPageMessages>> = { en, es };

export function useStarsPageT(): StarsPageMessages {
  return STARS_PAGE_CATALOGS[useLocale()];
}
