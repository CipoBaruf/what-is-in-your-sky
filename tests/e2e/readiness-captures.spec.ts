/**
 * R27 captures (FR-OFF-4, FR-OFF-8, US-16 AC2/AC5): the readiness line under
 * the location, the three nights grouped with tonight open, and the offline
 * message under the place field — both widths, both languages, both themes.
 * Evidence for the PR, not a test: the assertions only make sure the capture
 * shows the thing it is named after.
 *
 * The same fixtures and clock as `offline.spec.ts`: one online visit over
 * Neuquén warms the elements, the forecast and the stored run, and then every
 * external route is aborted, which is the state the line is about.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  observer: { lat: number; lon: number };
}
interface OmmMeta {
  fetchedAt: string;
}

const OMM_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const ommMeta = JSON.parse(readFileSync(`tests/fixtures/omm/${OMM_DATE}.meta.json`, 'utf8')) as OmmMeta;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;
const T0 = Date.parse(ommMeta.fetchedAt);
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

const LABEL = {
  en: { coords: 'Coordinates (lat, lon)', passes: 'Upcoming passes', place: 'Place name', language: 'Language' },
  es: { coords: 'Coordenadas (lat, lon)', passes: 'Próximos pases', place: 'Nombre del lugar', language: 'Idioma' },
} as const;

/** One online visit, then the network gone and the page reloaded from the device. */
async function offlineHome(page: Page, width: 390 | 1280, locale: 'en' | 'es'): Promise<void> {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  await page.clock.setFixedTime(T0);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({ path: 'tests/fixtures/open-meteo/2026-09-02-neuquen-forecast.json', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.goto('/');
  if (locale === 'es') await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
  await page.getByLabel(LABEL[locale].coords).fill(NEUQUEN);
  const status = page.getByRole('region', { name: LABEL[locale].passes }).getByRole('status');
  await expect(status).toHaveText(/\d+ (visible passes in the next 72 h|pases visibles en las próximas 72 h)/, { timeout: 60_000 });

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.reload();
  // The stored run renders first and the offline recompute then takes it over (D-105). Both edges of
  // the busy flag, so the captures show a settled page and not a job half done.
  await expect(status).toHaveAttribute('aria-busy', 'true', { timeout: 60_000 });
  await expect(status).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
  await expect(page.getByTestId('readiness')).toHaveText(/^(Ready offline until|Sin conexión hasta) /);
  await expect(page.getByTestId('night-group')).toHaveCount(3);
}

/** Puts a night's heading at the top of the viewport; the phone cannot hold a whole night and the next heading at once. */
async function toHeading(page: Page, index: number): Promise<void> {
  // The pointer is wherever the last click left it, and a cloud badge that scrolls under it opens its tooltip over the capture.
  await page.mouse.move(0, 0);
  await page.getByTestId('night-group').nth(index).evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
  });
}

/** The theme is remembered (US-19), so a capture run has to put it back before the next language starts. */
async function setTheme(page: Page, theme: 'dark' | 'night'): Promise<void> {
  await page.getByRole('banner').getByRole('group', { name: 'Theme' }).getByRole('button', { name: theme === 'night' ? 'Night' : 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

test('the readiness line and the three nights at 390 px, in both languages and both themes', async ({ page }) => {
  for (const locale of ['en', 'es'] as const) {
    await offlineHome(page, 390, locale);
    // The line sits under a location block taller than a phone screen, so the capture has to go to it.
    await page.getByTestId('readiness').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/r27-readiness-390-dark-${locale}.png` });
    // The later nights, closed, with their counts: the one view that shows the grouping as grouping.
    await toHeading(page, 1);
    await page.screenshot({ path: `test-results/r27-nights-later-390-dark-${locale}.png` });
    if (locale === 'en') {
      await toHeading(page, 0);
      await page.screenshot({ path: `test-results/r27-nights-390-dark-${locale}.png` });
      await setTheme(page, 'night');
      await page.getByTestId('readiness').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/r27-readiness-390-night-${locale}.png` });
      await toHeading(page, 1);
      await page.screenshot({ path: `test-results/r27-nights-later-390-night-${locale}.png` });
      await setTheme(page, 'dark');
    }
  }
});

test('the wide page carries both at once, in both languages and both themes', async ({ page }) => {
  for (const locale of ['en', 'es'] as const) {
    await offlineHome(page, 1280, locale);
    await page.screenshot({ path: `test-results/r27-home-1280-dark-${locale}.png` });
  }
});

test('the place field says it is offline, in both languages', async ({ page, context }) => {
  for (const locale of ['en', 'es'] as const) {
    await offlineHome(page, 390, locale);
    await context.setOffline(true);
    await page.getByLabel(LABEL[locale].place).fill('Cipolletti');
    await expect(page.getByTestId('place-search-status')).toHaveText(/^(No connection|Sin conexión)/);
    await page.screenshot({ path: `test-results/r27-offline-search-390-dark-${locale}.png` });
    await context.setOffline(false);
  }
});
