/**
 * R11 (FR-X-4, FR-SAT-6, FR-SAT-4): after one online visit, a reload with
 * every external route aborted still shows the pass list — the elements came
 * back from IndexedDB, no CelesTrak request went out because the copy is
 * younger than 2 h, and every weather badge reads unknown. A second test
 * reloads three hours later, when the copy is past the 2 h rule and the
 * refresh fails: the same list appears, now with the stale warning. The
 * third fixes the clock five days after the newest epoch and expects the
 * epoch-age warning. The saved location (R10) is what brings the list back
 * without typing.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface OmmMeta {
  fetchedAt: string;
}

const OMM_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const ommMeta = JSON.parse(readFileSync(`tests/fixtures/omm/${OMM_DATE}.meta.json`, 'utf8')) as OmmMeta;
const NEUQUEN = `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The fixture capture time: the elements are fresh, no epoch warning. */
const T0 = Date.parse(ommMeta.fetchedAt);

const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

async function serveCelestrak(page: Page, celestrakRequests: string[]): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    celestrakRequests.push(url.toString());
    await route.fulfill({
      path: `tests/fixtures/omm/${OMM_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
}

async function abortEverything(page: Page): Promise<void> {
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
}

/** Types the coordinates and waits for the finished list; returns the status text. */
async function firstVisit(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(NEUQUEN);
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 15_000 });
  return (await status.textContent()) ?? '';
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(T0);
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
});

test('reload with every route aborted: the cached passes are still shown, no CelesTrak request, weather unknown, no warning', async ({ page }) => {
  const celestrakRequests: string[] = [];
  await serveCelestrak(page, celestrakRequests);
  const onlineStatus = await firstVisit(page);
  expect(celestrakRequests).toHaveLength(2);
  await expect(page.getByTestId('elements-age')).toContainText('Orbital elements: newest epoch');
  await expect(page.getByTestId('stale-banner')).toHaveCount(0);
  const onlineIds = await page.locator('article[data-pass-id]').evaluateAll((cards) => cards.map((c) => c.getAttribute('data-pass-id')));
  expect(onlineIds.length).toBeGreaterThan(0);

  // Offline now: nothing external answers. The location comes back from localStorage, the elements from IndexedDB.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await abortEverything(page);
  await page.clock.setFixedTime(T0 + 30 * 60_000);
  await page.reload();
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(onlineStatus, { timeout: 15_000 });
  expect(celestrakRequests).toHaveLength(2); // the aborted routes never reach the fixture handler, and the cache is younger than 2 h anyway
  const offlineIds = await page.locator('article[data-pass-id]').evaluateAll((cards) => cards.map((c) => c.getAttribute('data-pass-id')));
  expect(offlineIds).toEqual(onlineIds);
  const badges = page.locator('article[data-pass-id] [data-state]');
  await expect(badges).toHaveCount(onlineIds.length);
  for (let i = 0; i < onlineIds.length; i++) {
    await expect(badges.nth(i)).toHaveAttribute('data-state', 'unknown');
    await expect(badges.nth(i)).toHaveText('Weather unknown');
  }
  await expect(page.getByRole('region', { name: 'Right now' })).toContainText('Weather unknown');
  await expect(page.getByTestId('stale-banner')).toHaveCount(0);
  await expect(page.getByTestId('epoch-banner')).toHaveCount(0);
  await expect(page.getByTestId('not-cached-banner')).toHaveCount(0);
});

test('reload three hours later with CelesTrak unreachable: the cached passes are shown with the stale warning', async ({ page }) => {
  const celestrakRequests: string[] = [];
  await serveCelestrak(page, celestrakRequests);
  await firstVisit(page);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const failed: string[] = [];
  await page.route('https://celestrak.org/**', (route) => {
    failed.push(route.request().url());
    return route.abort('failed');
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.clock.setFixedTime(T0 + 3 * HOUR);
  await page.reload();
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 15_000 });
  expect(failed).toHaveLength(2); // past the 2 h rule: one attempt per group, both failed
  const banner = page.getByTestId('stale-banner');
  await expect(banner).toHaveCount(1);
  await expect(banner).toHaveAttribute('role', 'alert');
  await expect(banner).toContainText('[Warning] CelesTrak could not be reached, so the elements fetched');
  await expect(page.getByTestId('epoch-banner')).toHaveCount(0);
});

test('five days after the newest epoch the epoch-age warning shows, and the age line states the age', async ({ page }) => {
  const celestrakRequests: string[] = [];
  await serveCelestrak(page, celestrakRequests);
  await page.clock.setFixedTime(T0 + 5 * DAY + 60_000);
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(NEUQUEN);
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await expect(status).toHaveText(/visible passes in the next 72 h|No visible passes/, { timeout: 15_000 });
  const banner = page.getByTestId('epoch-banner');
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText('[Warning] The orbital elements are 5 d');
  await expect(banner).toContainText('Predictions lose accuracy after 5 days');
  await expect(page.getByTestId('elements-age')).toContainText(/newest epoch 5 d( \d+ h)? old/);
  await expect(page.getByTestId('stale-banner')).toHaveCount(0);
});
