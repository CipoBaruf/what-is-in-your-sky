/**
 * R83 (FR-VISIT-1, US-32 AC1, F-89, D-538): a link is a visit. A reader with a
 * saved, named place — a label and a time zone of its own — opens a friend's
 * pass link for somewhere else. The app looks from there, and
 * `wiys:prefs:v1` is left byte for byte as it was; a reload without the hash
 * finds the reader's own place, its label and its zone. Before R83 the link's
 * observer was stored over the saved one (D-135), and the reload opened on the
 * link's rounded coordinates with no zone.
 *
 * The saved place is written into storage directly rather than typed: a
 * geocoded place with a zone is what F-89 loses, and the offline stubs below
 * would never produce one.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
}

const OMM_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${OMM_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;
const CLOCK = Date.parse(ha.capturedAt) + 9 * DAY_MS;
const PREFS_KEY = 'wiys:prefs:v1';
const SAVED = { lat: -38.95, lon: -68.06, altM: 270, label: 'Neuquén, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' };
const SAVED_PREFS = JSON.stringify({ observer: SAVED, locale: 'en' });
const START = new Date(CLOCK + 3_600_000).toISOString().replace('.000Z', 'Z');
const PASS_LINK = `/#pass?lat=48.86&lon=2.35&alt=35&norad=25544&start=${START}`;

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(CLOCK);
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

test("a pass link over a saved, named place is a visit: storage is untouched and a reload finds the reader's own place and zone", async ({ page }) => {
  await page.goto('/');
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
  }, [PREFS_KEY, SAVED_PREFS] as const);

  // A fresh document on the link, so `startApp` reads it as an arrival (a hash-only goto would not reload).
  await page.goto('about:blank');
  await page.goto(PASS_LINK);
  await expect(page.getByTestId('location-summary')).toContainText('48.86, 2.35');
  const status = page.getByRole('region', { name: 'Upcoming passes', includeHidden: true }).getByRole('status', { includeHidden: true });
  await expect(status).toHaveText(/\d+ visible passes? in 72 h|No visible passes/, { timeout: 60_000 });
  expect(await page.evaluate((key) => localStorage.getItem(key), PREFS_KEY)).toBe(SAVED_PREFS);

  // The reload, with no hash: the reader's own place, by its own name, in its own zone.
  await page.goto('about:blank');
  await page.goto('/');
  await expect(page.getByTestId('location-summary')).toHaveText('Neuquén (−38.95, −68.06)');
  const stored = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), PREFS_KEY)) ?? 'null') as { observer?: typeof SAVED } | null;
  expect(stored?.observer).toEqual(SAVED);
  expect(stored?.observer?.timeZone).toBe('America/Argentina/Salta');
});

/**
 * R87 (FR-VISIT-2, US-32 AC1): the notice. Over the same saved, named place a
 * pass link heads the page with the link's place and two controls;
 * `[ back to my place ]` puts the reader's own place back, by its name, and
 * takes the link out of the URL, and `[ keep this place ]` stores the link's.
 */
const arriveOnTheLink = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
  }, [PREFS_KEY, SAVED_PREFS] as const);
  await page.goto('about:blank');
  await page.goto(PASS_LINK);
  await expect(page.getByTestId('location-summary')).toContainText('48.86, 2.35');
};

const storedPrefs = (page: Page): Promise<string | null> => page.evaluate((key) => localStorage.getItem(key), PREFS_KEY);

test('a pass link shows the visit notice, and [ back to my place ] restores the label and clears the hash (FR-VISIT-2)', async ({ page }) => {
  await arriveOnTheLink(page);
  const notice = page.getByTestId('visit-notice');
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText('48.86, 2.35');
  expect(await storedPrefs(page)).toBe(SAVED_PREFS);

  await notice.getByRole('button', { name: 'back to my place' }).click();
  await expect(page.getByTestId('visit-notice')).toHaveCount(0);
  await expect(page.getByTestId('location-summary')).toHaveText('Neuquén (−38.95, −68.06)');
  expect(new URL(page.url()).hash).toBe('');
  expect(await storedPrefs(page)).toBe(SAVED_PREFS);
});

test('[ keep this place ] stores the visited place and removes the notice (FR-VISIT-2, FR-LOC-5)', async ({ page }) => {
  await arriveOnTheLink(page);
  await page.getByTestId('visit-notice').getByRole('button', { name: 'keep this place' }).click();
  await expect(page.getByTestId('visit-notice')).toHaveCount(0);
  await expect(page.getByTestId('location-summary')).toContainText('48.86, 2.35');
  const stored = JSON.parse((await storedPrefs(page)) ?? 'null') as { observer?: { lat: number; lon: number } } | null;
  expect(stored?.observer).toMatchObject({ lat: 48.86, lon: 2.35 });
});

/**
 * R87 (FR-VISIT-4, US-32 AC3, F-93): a hash that starts as a route and does
 * not parse lands on the reader's own home with one line saying so, and leaves
 * the URL; one that is no route at all leaves it with nothing said. Neither
 * touches the saved place.
 */
test('#live?lat=999 lands on home with "That link could not be read." and the hash cleared; #nonsense is cleared silently (FR-VISIT-4)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
  }, [PREFS_KEY, SAVED_PREFS] as const);

  await page.goto('about:blank');
  await page.goto('/#live?lat=999');
  await expect(page.getByTestId('link-note')).toContainText('That link could not be read.');
  await expect(page.getByTestId('location-summary')).toHaveText('Neuquén (−38.95, −68.06)');
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.getByTestId('visit-notice')).toHaveCount(0);
  await page.getByTestId('link-note-dismiss').click();
  await expect(page.getByTestId('link-note')).toHaveCount(0);

  await page.goto('about:blank');
  await page.goto('/#nonsense');
  await expect(page.getByTestId('location-summary')).toHaveText('Neuquén (−38.95, −68.06)');
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  await expect(page.getByTestId('link-note')).toHaveCount(0);
  expect(await storedPrefs(page)).toBe(SAVED_PREFS);
});
