/**
 * R75 captures (FR-SET-4): the settings page at 390 × 844, inverted.
 *
 *   CAPTURES=1 npx playwright test r75-captures --project=chromium
 *
 * The two states FR-SET-2 fits — no observer, with the coordinate fields
 * closed, and an observer with `SETTINGS_FIT_PLACES` saved places — in both
 * themes and both languages, with the install offer shown in each: eight
 * pictures of the whole viewport, which is the whole page. The owner's gate
 * sets the Spanish ones beside a phone.
 *
 * Evidence for the PR, not a test: the one assertion is only there so a file
 * cannot be a picture of a page that scrolls. Off the pull-request path
 * (FR-CI-1's budget), like every other capture spec. The theme and the
 * language are seeded in `wiys:prefs:v1` and never clicked (D-70).
 */
import { expect, test, type Page } from '@playwright/test';
import { SETTINGS_FIT_PLACES } from '../../src/lib/layout';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR } from './captureSet';
import { NINE_DAYS_ON, stubNetwork } from './liveHelpers';
import { NEUQUEN } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

test.use({ viewport: { width: 390, height: 844 } });

const DAY_MS = 86_400_000;
const DARK_SITE: Observer = { lat: -39.26, lon: -68.78, altM: 380, label: 'Villa El Chocón', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const FAVOURITES = [
  { cellKey: '-38.93,-67.99', observer: NEUQUEN, addedAt: NINE_DAYS_ON - 2 * DAY_MS, lastUsedAt: NINE_DAYS_ON - 60_000 },
  { cellKey: '-39.26,-68.78', observer: DARK_SITE, addedAt: NINE_DAYS_ON - 3 * DAY_MS, lastUsedAt: NINE_DAYS_ON - 120_000 },
].slice(0, SETTINGS_FIT_PLACES);

const STATES = {
  empty: {},
  places: { observer: NEUQUEN, favourites: FAVOURITES },
} as const;

async function shoot(page: Page, state: keyof typeof STATES, theme: 'dark' | 'night', locale: 'en' | 'es'): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    ['wiys:prefs:v1', JSON.stringify({ locale, theme, ...STATES[state] })] as [string, string],
  );
  await page.goto('/#settings');
  await expect(page.getByTestId('settings-back')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
  });
  await expect(page.getByTestId('install-action')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight }));
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
  await page.screenshot({ path: `${CAPTURE_DIR}/r75-settings-390-${state}-${theme}-${locale}.png` });
}

for (const state of ['empty', 'places'] as const) {
  for (const theme of ['dark', 'night'] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`the settings page at 390 × 844, ${state}, ${theme}, ${locale}`, async ({ page }) => {
        await shoot(page, state, theme, locale);
      });
    }
  }
}
