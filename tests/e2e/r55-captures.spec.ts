/**
 * R55 captures (FR-OFF-6 as amended v1.1.2, US-16 AC4): the install hint back
 * on the home screen after its snooze has run out — the state R28's captures
 * could not have, because before v1.1.2 there was no way back from "Not now".
 * The wording and the two buttons are R28's; what is new is that they are here
 * at all, a week after the reader waved them away. Evidence for the PR, not a
 * test: the assertions only make sure the capture shows the thing it is named
 * after. Off the pull-request path (FR-CI-1's budget), like R54's:
 *
 *   CAPTURES=1 npx playwright test r55-captures --project=chromium
 *
 * The place is `observers.ts`'s Neuquén and the clock is Playwright's, since
 * the hint reads it once at mount (D-272). One capture is one test.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR, LOCALES, THEMES } from './captureSet';
import { FIXTURE_DATE, NEUQUEN } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const PREFS_KEY = 'wiys:prefs:v1';
const DAY_MS = 86_400_000;
const T0 = Date.UTC(2026, 8, 6, 21, 0);
/** A week and a day after the decline: the snooze has run out and the browser is offering again. */
const RETURNED = T0 + 8 * DAY_MS;

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`the install hint back after its snooze, 390 px, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      // The device as the reader left it a week ago: their place, their theme and one "Not now".
      await page.addInitScript(
        ([key, value]: [string, string]) => {
          localStorage.setItem(key, value);
        },
        [PREFS_KEY, JSON.stringify({ observer: NEUQUEN, theme, locale, installHintDeclines: 1, installHintSnoozedUntil: T0 + 7 * DAY_MS })] as [string, string],
      );
      await page.route('https://celestrak.org/**', async (route) => {
        const url = new URL(route.request().url());
        await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      });
      for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
      await page.clock.setFixedTime(RETURNED);
      await page.goto('/');
      await offerInstall(page);

      const hint = page.getByTestId('install-hint');
      await expect(hint).toBeVisible({ timeout: 60_000 });
      await expect(hint.getByRole('button', { name: locale === 'en' ? 'Install' : 'Instalar' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await hint.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r55-install-390-${theme}-${locale}.png` });
    });
  }
}

/** The event Chromium fires when it has decided the page is installable; a test server is never one. */
async function offerInstall(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
  });
}
