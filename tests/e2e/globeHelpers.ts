/**
 * R170 (FR-GLOBE-1, FR-GLOBE-9; D-1042), on the live page since R222 (FR-LAND-3, D-1240): the wide sky with the globe
 * shown, for `globe.spec.ts`, `globe-perf.spec.ts`, `axe.spec.ts` and the specs that read the stars' groups — the live
 * page opened over the stored run's Neuquén on the suite's night, optionally a saved place, and its opening view drawn.
 */
import { expect, type Page } from '@playwright/test';
import { favouriteCellKey } from '../../src/data/favourites';
import type { Observer } from '../../src/model';
import { NINE_DAYS_ON, seedStoredRun } from './liveHelpers';

const GLOBE_WORD = { en: 'Globe', es: 'Globo' } as const;

export interface SkySeed {
  locale?: 'en' | 'es';
  theme?: 'dark' | 'night';
  favourites?: readonly Observer[];
}

/** The live page over Neuquén on the suite's night, its opening view drawn: the globe on a desk (FR-LAND-2), the window on a phone. */
export async function openLiveSky(page: Page, { locale = 'en', theme = 'dark', favourites = [] }: SkySeed = {}): Promise<void> {
  const saved = favourites.map((observer, i) => ({ cellKey: favouriteCellKey(observer), observer, addedAt: NINE_DAYS_ON - 1_000, lastUsedAt: NINE_DAYS_ON - 1_000 * (i + 1) }));
  await seedStoredRun(page, { locale, settled: true, prefs: { theme, favourites: saved, chartView: undefined } });
  await page.evaluate(() => {
    window.location.hash = '#live';
  });
  await expect(page.getByTestId('live-page')).toBeVisible({ timeout: 30_000 });
  if ((page.viewportSize()?.width ?? 0) >= 964) await expect(page.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
  else await expect(page.locator('[data-drawing="window"]')).toBeAttached({ timeout: 30_000 });
}

/** The live page's view row. */
const viewRow = (page: Page) => page.getByTestId('live-layout').getByRole('group', { name: /^(Chart view|Vista del gráfico)$/ });

/** `Globe` pressed in the view row (if it is not the view already), the globe drawn (its disc in the SVG) and `Turn` in the rail. */
export async function showGlobe(page: Page, locale: 'en' | 'es' = 'en'): Promise<void> {
  if ((await page.getByTestId('sky-chart').getAttribute('data-view')) !== 'globe') await viewRow(page).getByRole('button', { name: GLOBE_WORD[locale] }).click();
  await expect(page.getByTestId('globe-box')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId('globe-turn')).toBeVisible({ timeout: 30_000 });
}
