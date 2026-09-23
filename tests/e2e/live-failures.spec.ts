/**
 * R89 (FR-LIVE-1 and FR-OFF-8 as amended v2.1, FR-FAIL-6, FR-VISIT-3, US-33
 * AC4; F-92, F-75) on the production build: the live page's three states
 * before it can draw, and what it does with a link's moment.
 *
 *   - no network and a stored run, with no elements anywhere: `#live` opens
 *     on the stored passes' tracks rather than standing inert;
 *   - the elements failing: the failure line, and `[ retry ]` shows loading
 *     and then the page;
 *   - no observer: `[ set a place ]` lands on the where step with the focus
 *     in the input group;
 *   - a live link whose `t` has passed opens watching with its note, and one
 *     30 h ahead opens held at the span's end with its note.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { domeDrawn, FIXTURE_DATE, ha, NINE_DAYS_ON, seedStoredRun, stubNetwork, T } from './liveHelpers';

const HOUR = 3_600_000;
const PREFS_KEY = 'wiys:prefs:v1';
const NEUQUEN = { lat: ha.observer.lat, lon: ha.observer.lon, altM: 0, label: `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`, source: 'coords', timeZone: null };

test.use({ viewport: { width: 390, height: 844 } });

/** Every group of elements the cache holds, gone: what a device that never loaded them has. */
async function forgetElements(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('wiys', 2);
        request.onerror = () => {
          reject(new Error('could not open the wiys database'));
        };
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('elementGroups', 'readwrite');
          tx.objectStore('elementGroups').clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            reject(new Error('could not clear the elements'));
          };
        };
      }),
  );
}

const iso = (t: number): string => new Date(t).toISOString().replace('.000Z', 'Z');
const liveLink = (t: number): string => `/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=${iso(t)}`;

test('with no network and a stored run, #live opens on the stored passes and draws their tracks (FR-OFF-8)', async ({ page }) => {
  await seedStoredRun(page);
  await forgetElements(page);
  // No network: every provider refuses, so nothing but the stored run can put a pass on the page.
  for (const pattern of ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) {
    await page.route(pattern, (route) => route.abort('internetdisconnected'));
  }
  // A minute into the stored run's next pass (its next-event block reads "in 3:45:07" at the seed's instant), so
  // there is an arc on the dome to find: the tracks are drawn as their passes come up (FR-TRAJ-1).
  await page.clock.setFixedTime(NINE_DAYS_ON + (3 * 3600 + 45 * 60 + 7 + 60) * 1000);
  await page.goto('/#live');
  await page.reload();
  await domeDrawn(page);
  await expect(page.getByTestId('live-inert')).toHaveCount(0);
  await expect.poll(() => page.getByTestId('live-dome').locator('[data-drawing] [data-pass-id]').count(), { timeout: 30_000 }).toBeGreaterThan(0);
  // And it was the stored run that drew them: there are still no elements on this device.
  const groups = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('wiys', 2);
        request.onerror = () => {
          reject(new Error('could not open the wiys database'));
        };
        request.onsuccess = () => {
          const db = request.result;
          const count = db.transaction('elementGroups').objectStore('elementGroups').count();
          count.onsuccess = () => {
            db.close();
            resolve(count.result);
          };
        };
      }),
  );
  expect(groups).toBe(0);
});

test('with the elements failing, the page says so, and [ retry ] shows loading and then the page (FR-FAIL-6)', async ({ page }) => {
  await page.clock.setFixedTime(T);
  await stubNetwork(page, 'down');
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
  );
  await page.goto('/#live');
  const inert = page.getByTestId('live-inert');
  await expect(inert).toHaveAttribute('data-inert', 'failed', { timeout: 30_000 });
  const sentence = page.getByTestId('failure-sentence');
  await expect(sentence).toContainText('Could not load the orbital elements');
  expect(await sentence.textContent()).not.toMatch(/HTTP|\d{3}|Error:/);

  // CelesTrak comes back, but holds its answer until the loading state has been seen.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://celestrak.org/**', async (route: Route) => {
    await held;
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.getByRole('button', { name: 'retry' }).click();
  await expect(inert).toHaveAttribute('data-inert', 'loading');
  await expect(page.getByTestId('live-loading')).toHaveText('Loading orbital elements…');
  await expect(page.getByTestId('failure-line')).toHaveCount(0);
  release();
  await domeDrawn(page);
});

test('with no place, [ set a place ] lands on the where step with the focus in the input group (FR-FIRST-1, F-75)', async ({ page }) => {
  await page.clock.setFixedTime(T);
  await stubNetwork(page);
  await page.goto('/#live');
  await expect(page.getByTestId('live-inert')).toHaveAttribute('data-inert', 'no-place');
  await expect(page.getByTestId('live-inert')).toContainText('The live sky needs a place.');
  await page.getByRole('button', { name: 'set a place' }).click();
  await expect(page).not.toHaveURL(/#live/);
  const group = page.getByTestId('cold-open');
  await expect(group).toHaveAttribute('data-step', 'where');
  await expect(group.getByRole('button', { name: 'Use my location' })).toBeFocused();
});

test.describe('a live link’s moment (FR-VISIT-3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(T);
    await stubNetwork(page);
  });

  test('a t that has passed opens watching, with its note', async ({ page }) => {
    await page.goto(liveLink(T - 2 * HOUR));
    await domeDrawn(page);
    await expect(page.getByTestId('live-state-word')).toHaveText('live');
    await expect(page.getByTestId('link-note')).toHaveAttribute('data-note', 'past');
    await expect(page.getByTestId('link-note')).toContainText('which has passed. Showing now.');
  });

  test('a t 30 h ahead opens held at the end of the span, with its note', async ({ page }) => {
    await page.goto(liveLink(T + 30 * HOUR));
    await domeDrawn(page);
    await expect(page.getByTestId('live-state-word')).toHaveText('held');
    await expect(page.getByTestId('time-row')).toContainText('+24 h');
    await expect(page.getByTestId('link-note')).toHaveAttribute('data-note', 'far');
    await expect(page.getByTestId('link-note')).toContainText('more than 24 h ahead');
  });
});
