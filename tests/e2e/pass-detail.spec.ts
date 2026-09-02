/**
 * R6 (US-6, FR-GUIDE-1, D-13): the Neuquén flow, open the golden ISS pass,
 * and the sentence on screen equals the golden string from
 * `tests/fixtures/guide-sentences.json`. The hash mirrors the selection,
 * Escape returns to the list, and a 390 px screenshot of the sheet is saved
 * for the PR's visual check.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const golden = JSON.parse(readFileSync('tests/fixtures/guide-sentences.json', 'utf8')) as { asComputed: string };
const DAY_MS = 86_400_000;

test.use({ viewport: { width: 390, height: 844 } });

test('opening the golden ISS pass shows the golden guide sentence, mirrors the hash, and closes on Escape', async ({ page }) => {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
  const passId = `25544-${String(pass.start.t)}`;

  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });

  // R8: without a forecast the zone stays unknown and times stay in UTC, which is what this spec asserts (weather.spec.ts covers the forecast).
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));

  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  // R7's Now panel adds a second live status line, so scope to the passes region.
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 24 h/, { timeout: 15_000 });

  const card = page.locator(`article[data-pass-id="${passId}"]`);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('sky still bright');
  await card.getByRole('button', { name: /Open guide/ }).click();

  const dialog = page.getByRole('dialog', { name: 'ISS (Zarya)' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#pass=${passId}$`));
  await expect(dialog.getByTestId('guide-sentence')).toHaveText(golden.asComputed);
  await expect(dialog.getByRole('timer')).toHaveText(/Appears in \d+:\d\d/);
  await expect(dialog.getByRole('heading', { name: 'ISS (Zarya)' })).toBeFocused();
  // The sheet fits the phone width: no horizontal scroll on the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/r6-pass-detail-390.png' });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/#pass=/);
  await expect(card).toBeVisible();
});
