/**
 * R9 (US-1, FR-LOC-1 (a), FR-LOC-2, FR-LOC-3, FR-LOC-6): the place flow at a
 * phone width. Typing "Rosario" key by key produces one geocoding request
 * (the PLAN §7.2 one) after the 500 ms debounce; the pick list shows the
 * eight recorded results with name and region at ≥ 16 px in rows ≥ 44 px
 * tall; choosing the first shows "Using the centre of Rosario, Santa Fe,
 * Argentina" with the coordinates and the pass list for it, whose times are
 * already in the geocoded zone (GMT-3) although the forecast route is
 * aborted — the zone came with the geocoding result, not the forecast.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
}
interface GeocodeFixture {
  results: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone: string }[];
}

const OMM_DATE = '2026-09-02';
const GEOCODE = '2026-09-02-rosario-geocode';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const geocode = JSON.parse(readFileSync(`tests/fixtures/open-meteo/${GEOCODE}.json`, 'utf8')) as GeocodeFixture;
const DAY_MS = 86_400_000;

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  // No forecast: whatever zone the times show must have come from the geocoding result (FR-LOC-3).
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
});

test('search → pick list → confirmation line → pass list for the picked place, at 390 px', async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  const geocodeRequests: URL[] = [];
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    const url = new URL(route.request().url());
    geocodeRequests.push(url);
    if (url.searchParams.get('name') !== 'rosario') {
      await route.fulfill({ json: { generationtime_ms: 0.5 }, headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    await route.fulfill({ path: `tests/fixtures/open-meteo/${GEOCODE}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });

  await page.goto('/');
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/Enter a place name or coordinates/);

  const field = page.getByRole('combobox', { name: 'Place name' });
  await field.pressSequentially('Rosario', { delay: 40 }); // seven keystrokes inside 400 ms → one request (FR-LOC-2)
  const options = page.getByRole('listbox', { name: 'Matching places' }).getByRole('option');
  await expect(options).toHaveCount(geocode.results.length);
  expect(geocodeRequests).toHaveLength(1);
  const [req] = geocodeRequests;
  expect(req?.searchParams.get('name')).toBe('rosario');
  expect(req?.searchParams.get('count')).toBe('8');
  expect(req?.searchParams.get('language')).toBe('en');
  expect(req?.searchParams.get('format')).toBe('json');

  // The list: name and region per row, readable at arm's length (G6): font ≥ 16 px, rows ≥ 44 px, nothing wider than the screen.
  for (let i = 0; i < geocode.results.length; i++) {
    const r = geocode.results[i];
    if (!r) throw new Error('fixture row missing');
    await expect(options.nth(i)).toContainText(r.name);
    if (r.admin1) await expect(options.nth(i)).toContainText(`${r.admin1}, ${r.country ?? ''}`);
    const box = await options.nth(i).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  }
  const fontPx = async (locator: ReturnType<typeof page.locator>): Promise<number> => parseFloat(await locator.evaluate((el) => getComputedStyle(el).fontSize));
  expect(await fontPx(field)).toBeGreaterThanOrEqual(16);
  expect(await fontPx(options.first())).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/r9-place-picker-390.png' });

  // Pick "Rosario, Santa Fe, Argentina" (first row).
  await options.first().click();
  await expect(options).toHaveCount(0);
  await expect(field).toHaveValue('Rosario, Santa Fe, Argentina');
  const note = page.getByTestId('place-confirmation');
  await expect(note).toHaveText('Using the centre of Rosario, Santa Fe, Argentina (−32.95, −60.64).');

  // The pass list for the picked place, with times in its zone from the geocoding result alone.
  await expect(status).toHaveText(/\d+ visible passes in the next 24 h from Rosario, Santa Fe, Argentina/, { timeout: 15_000 });
  const cards = page.locator('article[data-pass-id]');
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(cards.first()).toContainText('GMT-3');
  await expect(cards.first()).not.toContainText('UTC');
  await page.screenshot({ path: 'test-results/r9-place-list-390.png', fullPage: true });
  expect(geocodeRequests).toHaveLength(1);
});

test('no match points at the coordinates input; a failed search leaves the field usable', async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  let fail = true;
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    if (fail) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({ json: { generationtime_ms: 0.5 }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto('/');
  const field = page.getByRole('combobox', { name: 'Place name' });
  await field.fill('Rosario');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Could not search for places');
  await expect(alert.getByRole('link', { name: 'enter coordinates instead' })).toBeVisible();
  await expect(field).toBeEnabled();

  fail = false;
  await field.fill('Zzzzqqqq');
  const empty = page.getByText(/No place matches “Zzzzqqqq”/);
  await expect(empty).toBeVisible();
  await expect(alert).toHaveCount(0);
  await empty.getByRole('link', { name: 'enter coordinates instead' }).click();
  await expect(page.getByLabel('Coordinates (lat, lon)')).toBeFocused();
});
