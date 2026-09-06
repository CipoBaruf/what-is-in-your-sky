/**
 * R54 captures (FR-LIVE-7 as amended v1.1.1, FR-DOME-1 as amended, F-51..F-53):
 * the wide live page — at 1920 × 1080, where the rows around the dome fold to
 * one above and two below and the raster sits inside its box, and at
 * 1280 × 800 in both themes, where the stripe keeps a row of its own. Evidence
 * for the PR, not a test: the assertions only make sure the capture shows the
 * thing it is named after. Plus the one check that needs this instant's four
 * passes rather than `live.spec.ts`'s one: F-53, the legend beside the drawing
 * scrolls inside the box and its last row is reachable by keyboard (D-271).
 *
 *   npx playwright test r54-captures --project=chromium
 *
 * The place, the pass and the instant are `r45-captures.spec.ts`'s: Paris on
 * 2026-09-02, three minutes into the glare pass, with four passes up so the
 * legend has rows beside the drawing. The theme is seeded in `wiys:prefs:v1`
 * (D-70), never clicked, and one capture is one test.
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR, type CaptureTheme } from './captureSet';
import { domeDrawn, stripFilled } from './liveHelpers';
import { FIXTURE_DATE, PARIS } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;

const VIEWPORTS = {
  1920: { width: 1920, height: 1080 },
  1280: { width: 1280, height: 800 },
  /** A short 1280: the legend column is shorter than its list, so F-53's scroll is exercised. */
  short: { width: 1280, height: 720 },
} as const;

async function openLive(page: import('@playwright/test').Page, width: keyof typeof VIEWPORTS, theme: CaptureTheme): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', theme, observer: PARIS, chartView: 'dome' })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: SHOWN });
  await page.clock.pauseAt(SHOWN);
  await page.goto('/');
  await expect(page.getByTestId('iss-hero')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await page.evaluate(() => {
    location.hash = '#live';
  });
  await domeDrawn(page);
  await stripFilled(page);
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);
  await page.mouse.move(0, 0);
}

test('the live page at 1920 px, dark, en: one row above the dome, two under it', async ({ page }) => {
  await openLive(page, 1920, 'dark');
  const box = await page.getByTestId('chart-box').boundingBox();
  const block = await page.getByTestId('stripe-block').boundingBox();
  const playback = await page.getByTestId('playback-row').boundingBox();
  if (!box || !block || !playback) throw new Error('no rows');
  expect(box.height).toBeGreaterThanOrEqual(0.75 * 1080);
  expect(playback.y).toBeGreaterThanOrEqual(block.y - 1);
  await page.screenshot({ path: `${CAPTURE_DIR}/r54-live-1920-dark-en.png` });
});

for (const theme of ['dark', 'night'] as const) {
  test(`the live page at 1280 px, ${theme}, en: the stripe on its own row`, async ({ page }) => {
    await openLive(page, 1280, theme);
    const block = await page.getByTestId('stripe-block').boundingBox();
    const playback = await page.getByTestId('playback-row').boundingBox();
    if (!block || !playback) throw new Error('no rows');
    expect(block.y).toBeGreaterThanOrEqual(playback.y + playback.height - 1);
    await page.screenshot({ path: `${CAPTURE_DIR}/r54-live-1280-${theme}-en.png` });
  });
}

test('the legend beside the drawing scrolls inside the box; every row is a keyboard stop and the last is reached by pointer (F-53, D-271)', async ({ page }) => {
  await openLive(page, 'short', 'dark');
  const slot = page.getByTestId('chart-legend-slot');
  const rows = slot.locator('button[data-pass-id]');
  const ids = await rows.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-pass-id')));
  expect(ids.length).toBeGreaterThan(1);
  const metrics = await slot.evaluate((el) => ({ overflow: getComputedStyle(el).overflowY, client: el.clientHeight, scroll: el.scrollHeight }));
  expect(metrics.overflow).toBe('auto');
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  // By pointer: the column scrolls to its end and the last row is inside the box, where a click pins it.
  const lastId = ids[ids.length - 1];
  const last = slot.locator(`button[data-pass-id="${String(lastId)}"]`);
  await slot.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  const slotBox = await slot.boundingBox();
  const lastBox = await last.boundingBox();
  if (!slotBox || !lastBox) throw new Error('no legend');
  expect(lastBox.y).toBeGreaterThanOrEqual(slotBox.y - 1);
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(slotBox.y + slotBox.height + 1);
  await last.click();
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  // By keyboard: every row is a focus stop, in order — focus highlights without promoting (D-271), so the list holds
  // still — and the last one is inside the slot's box, scrolled into view by the browser.
  await rows.first().focus();
  const visited = [await page.evaluate(() => document.activeElement?.getAttribute('data-pass-id') ?? null)];
  for (let i = 1; i < ids.length; i++) {
    await page.keyboard.press('Tab');
    visited.push(await page.evaluate(() => document.activeElement?.getAttribute('data-pass-id') ?? null));
  }
  // n − 1 tabs from the first row visit every row once: no repeats, none skipped (the click above moved `lastId` to the top).
  expect(new Set(visited).size).toBe(ids.length);
  expect([...visited].sort()).toEqual([...ids].sort());
  const focused = await slot.locator(':focus').boundingBox();
  const slotNow = await slot.boundingBox();
  if (!focused || !slotNow) throw new Error('no focused row');
  expect(focused.y).toBeGreaterThanOrEqual(slotNow.y - 1);
  expect(focused.y + focused.height).toBeLessThanOrEqual(slotNow.y + slotNow.height + 1);
});
