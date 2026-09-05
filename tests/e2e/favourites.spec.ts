/**
 * R28 (FR-OFF-7, US-17): two places saved, switched between, one removed, and
 * the remaining one still there after a reload.
 *
 * What this adds over the unit tests is the round trip nothing else covers:
 * the panel writes to `wiys:prefs:v1`, a selection goes through `setObserver`
 * and starts a real recompute in the worker (D-139), and the list, the
 * readiness line and the pass list all speak for the place that was picked.
 * The pass list's own summary names the observer, so it is the honest witness
 * that the recompute happened for the new place and not the old one.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}

const OMM_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;
const PREFS_KEY = 'wiys:prefs:v1';

const NEUQUEN_LABEL = '−38.93, −67.99';
const PARIS = { lat: 48.86, lon: 2.35 };
const PARIS_LABEL = '48.86, 2.35';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
});

test('save two places, switch between them, remove one, and the other survives a reload', async ({ page }) => {
  // Four recomputes over 72 h of the catalog, one per observer change.
  test.slow();
  await page.goto('/');
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  const coords = page.getByLabel('Coordinates (lat, lon)');
  const save = page.getByTestId('save-favourite');

  // Nothing is saved yet, and the panel says so rather than showing an empty list.
  await expect(page.getByText('No places saved yet.')).toHaveCount(0); // no observer either: the whole panel is absent
  await coords.fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByText('No places saved yet.')).toBeVisible();
  await expect(page.getByText('Up to 8 places. Saving another forgets the one you have not used for longest.')).toBeVisible();
  await expect(status).toHaveText(new RegExp(`from ${NEUQUEN_LABEL}`), { timeout: 30_000 });
  await save.click();
  await expect(page.getByTestId('favourite')).toHaveCount(1);

  // A second place, saved the same way; the panel now marks it as the one in use.
  await coords.fill(`${String(PARIS.lat)}, ${String(PARIS.lon)}`);
  await expect(status).toHaveText(new RegExp(`from ${PARIS_LABEL}`), { timeout: 30_000 });
  await save.click();
  await expect(page.getByTestId('favourite')).toHaveCount(2);
  const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)) ?? 'null') as { favourites?: { observer: { label: string } }[] } | null;
  expect(saved?.favourites?.map((favourite) => favourite.observer.label)).toEqual([PARIS_LABEL, NEUQUEN_LABEL]);
  await expect(page.getByRole('button', { name: `Use ${PARIS_LABEL}` })).toHaveAttribute('aria-current', 'true');
  await page.screenshot({ path: 'test-results/r28-favourites-390.png' });

  // US-17 AC2: picking one makes it the observer, and the list recomputes for it.
  await page.getByRole('button', { name: `Use ${NEUQUEN_LABEL}` }).click();
  await expect(page.getByTestId('active-location')).toHaveText(`Using ${NEUQUEN_LABEL}.`);
  await expect(status).toHaveText(new RegExp(`from ${NEUQUEN_LABEL}`), { timeout: 30_000 });
  await expect(page.getByRole('button', { name: `Use ${NEUQUEN_LABEL}` })).toHaveAttribute('aria-current', 'true');

  // Removing is one click with nothing in front of it, and it does not change the observer.
  await page.getByRole('button', { name: `Remove ${PARIS_LABEL}` }).click();
  await expect(page.getByTestId('favourite')).toHaveCount(1);
  await expect(page.getByTestId('active-location')).toHaveText(`Using ${NEUQUEN_LABEL}.`);

  // FR-LOC-5: the list is in this browser and comes back with it.
  await page.reload();
  await expect(page.getByTestId('favourite')).toHaveCount(1);
  await expect(page.getByRole('button', { name: `Use ${NEUQUEN_LABEL}` })).toBeVisible();
  await expect(page.getByRole('button', { name: `Use ${PARIS_LABEL}` })).toHaveCount(0);
  await expect(status).toHaveText(new RegExp(`from ${NEUQUEN_LABEL}`), { timeout: 30_000 });
});
