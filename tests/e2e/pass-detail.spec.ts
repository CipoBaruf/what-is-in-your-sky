/**
 * R6 (US-6, FR-GUIDE-1, D-13): the Neuquén flow, open the golden ISS pass,
 * and the sentence on screen equals the golden string from
 * `tests/fixtures/guide-sentences.json`. The hash mirrors the selection,
 * Escape returns to the list, and a 390 px screenshot of the sheet is saved
 * for the PR's visual check. R13 (US-6 AC5, FR-GUIDE-2b/4/5/7): the sheet
 * carries the polar chart as SVG (no canvas anywhere), captioned by the
 * sentence, with the four cardinals, the pass arc and its markers; the
 * orientation toggle moves east from left to right, relabels the convention
 * and survives a reload; the chart fits the 390 px width. R15 adds the
 * view toggle; the polar chart stays the default (D-68).
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
const golden = JSON.parse(readFileSync('tests/fixtures/guide-sentences.json', 'utf8')) as { en: { asComputed: string } };
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
  await expect(dialog.getByTestId('guide-sentence')).toHaveText(golden.en.asComputed);
  await expect(dialog.getByRole('timer')).toHaveText(/Appears in \d+:\d\d/);
  await expect(dialog.getByRole('heading', { name: 'ISS (Zarya)' })).toBeFocused();
  // The sheet fits the phone width: no horizontal scroll on the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // One scrollbar: the page behind the sheet is locked while the sheet scrolls itself (R13 review).
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
  await page.screenshot({ path: 'test-results/r6-pass-detail-390.png' });

  // R13: the polar chart, as SVG, captioned by the sentence, hidden from AT, inside the viewport width.
  // R15: the polar chart is the default view for now (D-68); sky-dome.spec.ts covers the dome.
  expect(await page.evaluate(() => document.querySelector('canvas'))).toBeNull();
  const figure = dialog.getByRole('figure');
  await expect(figure).toHaveAttribute('data-view', 'polar');
  await expect(figure.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Polar' })).toHaveAttribute('aria-pressed', 'true');
  await expect(figure.getByTestId('guide-sentence')).toHaveText(golden.en.asComputed);
  const drawing = figure.locator('svg[data-drawing="polar"]');
  await expect(drawing).toHaveAttribute('aria-hidden', 'true');
  for (const cardinal of ['N', 'E', 'S', 'W']) await expect(drawing.locator(`[data-anchor="${cardinal}"]`)).toHaveText(cardinal);
  await expect(drawing.locator(`[data-pass-id="${passId}"] [data-anchor="pass"]`)).toContainText('ISS (Zarya)');
  await expect(drawing.locator('[data-anchor="peak"]')).toHaveText(/^max \d+°$/);
  for (const marker of ['rise', 'peak', 'end', 'arrow']) await expect(drawing.locator(`[data-marker="${marker}"]`)).toHaveCount(1);
  const box = await drawing.boundingBox();
  if (!box) throw new Error('drawing has no box');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.width).toBeGreaterThan(200);

  // FR-GUIDE-4: looking up by default (east on the left); the toggle flips it, relabels the convention, and the choice survives a reload.
  const eastX = async (): Promise<number> => (await drawing.locator('[data-anchor="E"]').boundingBox())?.x ?? NaN;
  const orientation = figure.getByRole('group', { name: 'Chart orientation' });
  await expect(orientation.getByRole('button', { name: 'Looking up' })).toHaveAttribute('aria-pressed', 'true');
  await expect(figure.getByTestId('chart-convention')).toHaveText('Looking up: east on the left, as when lying on your back.');
  expect(await eastX()).toBeLessThan(box.x + box.width / 2);
  await orientation.getByRole('button', { name: 'Map' }).click();
  await expect(orientation.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  await expect(figure.getByTestId('chart-convention')).toHaveText('Map: east on the right, as on a map.');
  expect(await eastX()).toBeGreaterThan(box.x + box.width / 2);
  expect(JSON.parse(await page.evaluate(() => window.localStorage.getItem('wiys:prefs:v1') ?? '{}'))).toMatchObject({ chartOrientation: 'map' });
  await figure.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/r13-polar-map-390.png' });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'ISS (Zarya)' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('group', { name: 'Chart orientation' }).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Chart orientation' }).getByRole('button', { name: 'Looking up' }).click();
  await page.getByRole('dialog').getByRole('figure').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/r13-polar-390.png' });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/#pass=/);
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');

  // The golden pass grazes the horizon; for the PR's visual check, also capture the highest pass of the night.
  const list = page.getByRole('region', { name: 'Upcoming passes' }).getByRole('list');
  const highest = await list.locator('article').evaluateAll((cards) => {
    const elevation = (card: Element): number => Number(Array.from(card.querySelectorAll('dt')).find((dt) => dt.textContent === 'Max elevation')?.nextElementSibling?.textContent?.replace('°', '') ?? 0);
    return cards.map((card) => ({ id: card.getAttribute('data-pass-id') ?? '', el: elevation(card) })).sort((a, b) => b.el - a.el)[0];
  });
  if (!highest || highest.el < 30) throw new Error(`no high pass among the fixtures (best ${String(highest?.el)}°)`);
  await list.locator(`article[data-pass-id="${highest.id}"]`).getByRole('button', { name: /Open guide/ }).click();
  const highFigure = page.getByRole('dialog').getByRole('figure');
  await expect(highFigure.locator('[data-anchor="peak"]')).toHaveText(`max ${String(highest.el)}°`);
  await highFigure.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/r13-polar-high-390.png' });
});
