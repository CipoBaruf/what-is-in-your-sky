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
 *
 * R24 (FR-OFF-2, FR-OFF-5) adds the stored run: a fourth test serves both
 * providers on the first visit and then reloads with every route blocked and
 * counted — the list comes back, neither provider is asked (the elements are
 * inside the 2 h rule and the forecast inside its 30 min TTL), and the
 * `passRuns` entry in IndexedDB is read straight out of the page to show that
 * a finished job was stored with no action from anyone, and stored again after
 * the offline recompute.
 *
 * R27 (FR-OFF-4, FR-OFF-8) adds what the offline app says: the readiness line
 * with its date and time, on one row at 390 px in both languages; the three
 * nights grouped with tonight open; and the soft failures — place search says
 * it is offline while the device button still sets a location and the list
 * comes back for it.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';

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
  await expect(status).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });
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
  await waitForRecompute(status, onlineStatus);
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
  await expect(status).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });
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
  await expect(status).toHaveText(/visible passes in the next 72 h|No visible passes/, { timeout: 30_000 });
  const banner = page.getByTestId('epoch-banner');
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText('[Warning] The orbital elements are 5 d');
  await expect(banner).toContainText('Predictions lose accuracy after 5 days');
  await expect(page.getByTestId('elements-age')).toContainText(/newest epoch 5 d( \d+ h)? old/);
  await expect(page.getByTestId('stale-banner')).toHaveCount(0);
});

interface StoredRun {
  cellKey: string;
  computedAt: number;
  window: { startMs: number; endMs: number };
  passes: { id: string }[];
}

/**
 * Waits for the recompute, not for the stored run standing in for it. A stored run renders as a
 * *finished* list (FR-OFF-2) carrying the same passes, so it produces the same status text: waiting
 * on the text alone can resolve before the recompute has even started, and the list read straight
 * after is then whatever the job has replaced so far. The busy flag goes up when the job starts and
 * down at `jobDone`, so waiting for both edges gates on the real thing (D-108).
 */
async function waitForRecompute(status: Locator, text: string): Promise<void> {
  await expect(status).toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
  await expect(status).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
  await expect(status).toHaveText(text, { timeout: 30_000 });
}

/** Everything in the `passRuns` store of the real IndexedDB, read from the page (FR-OFF-2, D-78). */
async function storedRuns(page: Page): Promise<StoredRun[]> {
  return page.evaluate(
    async () =>
      new Promise<StoredRun[]>((resolve, reject) => {
        const open = indexedDB.open('wiys');
        open.onerror = () => reject(new Error('could not open the wiys database'));
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('passRuns')) {
            resolve([]);
            return;
          }
          const all = db.transaction('passRuns', 'readonly').objectStore('passRuns').getAll();
          all.onerror = () => reject(new Error('could not read passRuns'));
          all.onsuccess = () => resolve(all.result as StoredRun[]);
        };
      }),
  );
}

test('the finished run is stored, and a reload with the network blocked shows it without asking either provider', async ({ page }) => {
  // Both providers answer on the first visit, so both caches are warm when the network goes.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const celestrakRequests: string[] = [];
  await serveCelestrak(page, celestrakRequests);
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({ path: 'tests/fixtures/open-meteo/2026-09-02-neuquen-forecast.json', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));

  const onlineStatus = await firstVisit(page);
  const onlineIds = await page.locator('article[data-pass-id]').evaluateAll((cards) => cards.map((c) => c.getAttribute('data-pass-id')));
  expect(onlineIds.length).toBeGreaterThan(0);

  // FR-OFF-5: storing happened on its own, with no "prepare" action anywhere on screen.
  const stored = await storedRuns(page);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ cellKey: '-38.93,-67.99', computedAt: T0, window: { startMs: T0, endMs: T0 + 3 * DAY } });
  expect(stored[0]?.passes.map((pass) => pass.id).sort()).toEqual([...onlineIds].sort());

  // The network is gone, and every attempt at it is recorded.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const attempted: string[] = [];
  for (const pattern of EXTERNAL) {
    await page.route(pattern, (route) => {
      attempted.push(route.request().url());
      return route.abort('failed');
    });
  }
  // The clock stays at T0, so the offline recompute covers the same window and any difference in the
  // list would be the storage, not the window.
  await page.reload();

  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await waitForRecompute(status, onlineStatus);
  const offlineIds = await page.locator('article[data-pass-id]').evaluateAll((cards) => cards.map((c) => c.getAttribute('data-pass-id')));
  expect(offlineIds).toEqual(onlineIds);
  // Elements inside the 2 h rule, forecast inside its 30 min TTL: nothing to ask either provider for.
  expect(attempted).toEqual([]);
  expect(celestrakRequests).toHaveLength(2); // the two from the first visit, and no more

  // Still one run for the one cell: the offline recompute rewrote it rather than adding to it (D-78).
  expect(await storedRuns(page)).toHaveLength(1);
});

/** How many rows of text an element occupies; 1 is "it fits on one line". */
async function rows(locator: Locator): Promise<number> {
  return locator.evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
}

test('offline: the readiness line, the three nights, and the soft failures (R27, FR-OFF-4, FR-OFF-8)', async ({ page, context }) => {
  // Warm both caches, as the R24 test does: elements from CelesTrak, the forecast from Open-Meteo.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const celestrakRequests: string[] = [];
  await serveCelestrak(page, celestrakRequests);
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({ path: 'tests/fixtures/open-meteo/2026-09-02-neuquen-forecast.json', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => route.abort('failed'));
  const onlineStatus = await firstVisit(page);

  // The network is gone; the app reloads from what is on the device.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await abortEverything(page);
  await page.reload();
  const status = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status');
  await waitForRecompute(status, onlineStatus);

  // FR-OFF-4: a date and a time, the earlier of the stored passes' end and the stored forecast's.
  const readiness = page.getByTestId('readiness');
  await expect(readiness).toHaveText(/^Ready offline until \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

  // US-16 AC5: three nights, tonight open, named from the reader's own clock.
  const nights = page.getByTestId('night-group');
  await expect(nights).toHaveCount(3);
  expect(await nights.evaluateAll((els) => els.map((el) => (el as HTMLDetailsElement).open))).toEqual([true, false, false]);
  await expect(nights.nth(0).locator('summary')).toContainText('Tonight');
  await expect(nights.nth(1).locator('summary')).toContainText('Tomorrow night');
  await expect(nights.nth(2).locator('summary')).toContainText(/Night of \d{4}-\d{2}-\d{2}/);

  // A closed night keeps its cards out of the way until it is opened, which is what the grouping is for.
  const cardCounts = await nights.evaluateAll((els) => els.map((el) => el.querySelectorAll('article[data-pass-id]').length));
  const closed = cardCounts.findIndex((count, index) => index > 0 && count > 0);
  expect(closed, `a closed night with cards in ${JSON.stringify(cardCounts)}`).toBeGreaterThan(0);
  await expect(nights.nth(closed).locator('article[data-pass-id]').first()).toBeHidden();
  await nights.nth(closed).locator('summary').click();
  await expect(nights.nth(closed).locator('article[data-pass-id]').first()).toBeVisible();

  // The line fits one row on a phone, in both languages.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await rows(readiness)).toBeLessThanOrEqual(1);
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
  await expect(readiness).toHaveText(/^Sin conexión hasta \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(await rows(readiness)).toBeLessThanOrEqual(1);
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'English' }).click();

  // FR-OFF-8. `navigator.onLine` is what the app reads, so the browser itself goes offline here.
  await context.setOffline(true);
  await page.getByLabel('Place name').fill('Cipolletti');
  await expect(page.getByTestId('place-search-status')).toHaveText('No connection, so places cannot be searched. The device location button still works, or enter coordinates instead.');
  await expect(page.getByRole('option')).toHaveCount(0);

  // …while the device button still sets a location, for a cell that was never computed before.
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: ha.observer.lat + 0.5, longitude: ha.observer.lon, accuracy: 300 });
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByTestId('active-location')).toContainText('from your device');
  await expect(status).toHaveText(/visible passes in the next 72 h|No visible passes|No darkness/, { timeout: 60_000 });
  // Recomputed from the cached elements, with no forecast for the new cell: FR-X-4's "weather then shows unknown".
  await expect(page.getByTestId('readiness')).toHaveText(/^Not ready offline: no cloud forecast/);
});
