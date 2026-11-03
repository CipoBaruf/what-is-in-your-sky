/**
 * R170 (FR-GLOBE-1, FR-GLOBE-9; D-1042): the wide stars page with the globe shown, for `globe.spec.ts`,
 * `globe-perf.spec.ts` and `axe.spec.ts` — the stars page opened over Neuquén on the suite's night with the network
 * refused, optionally a saved place, then `Globe` pressed and the globe drawn.
 */
import { expect, type Page } from '@playwright/test';
import { favouriteCellKey } from '../../src/data/favourites';
import type { Observer } from '../../src/model';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

/** FR-GLOBE-9's saved place for the specs: London, in a zone of its own. */
export const LONDON: Observer = { lat: 51.51, lon: -0.13, altM: 0, label: 'London', source: 'coords', timeZone: 'Europe/London' };

export const GLOBE_WORD = { en: 'Globe', es: 'Globo' } as const;
export const WINDOW_WORD = { en: 'Window', es: 'Ventana' } as const;

export interface StarsSeed {
  locale?: 'en' | 'es';
  theme?: 'dark' | 'night';
  favourites?: readonly Observer[];
  /** `'fixed'` (the default): `setFixedTime`, the timers and frames real; `'installed'`: the fake clock, running, for `pauseAt`. */
  clock?: 'fixed' | 'installed';
}

/** The stars page over Neuquén on the suite's night, the window drawn. */
export async function openStarsPage(page: Page, { locale = 'en', theme = 'dark', favourites = [], clock = 'fixed' }: StarsSeed = {}): Promise<void> {
  if (clock === 'installed') await page.clock.install({ time: NINE_DAYS_ON });
  else await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  const saved = favourites.map((observer, i) => ({ cellKey: favouriteCellKey(observer), observer, addedAt: NINE_DAYS_ON - 1_000, lastUsedAt: NINE_DAYS_ON - 1_000 * (i + 1) }));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, theme, observer: NEUQUEN, favourites: saved })] as [string, string],
  );
  await page.goto('/#stars');
  await expect(page.getByTestId('stars-page')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-drawing="window"]')).toBeAttached({ timeout: 30_000 });
}

/** `Globe` pressed in the view row, the globe drawn (its disc in the SVG) and the rail's groups in. */
export async function showGlobe(page: Page, locale: 'en' | 'es' = 'en'): Promise<void> {
  await page.getByTestId('stars-view-row').getByRole('button', { name: GLOBE_WORD[locale] }).click();
  await expect(page.getByTestId('globe-box')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
  await expect(page.getByTestId('globe-groups')).toBeVisible({ timeout: 30_000 });
}

/** The globe's instant, as the clock line carries it. */
export async function globeAt(page: Page): Promise<number> {
  return Number(await page.getByTestId('globe-clock').getAttribute('data-at'));
}
