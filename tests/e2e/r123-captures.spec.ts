/**
 * R123 (FR-SKY-3, FR-COMP-4, US-40 AC1; D-791, D-814): the review captures of
 * `[ stars ]` and the stars under the arcs — on the wide live page's actions
 * row and on compact the chart's view row (its second text line), on the pass
 * detail's view row, on the landscape phone the readout row (D-814) — in both
 * languages, at night in Paris at R121's instant (the glare pass in the list).
 * The polar chart is the view on wide, since it is the drawing that shows the
 * stars today (R122); the dome's dots are R124's.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR, type CaptureLocale } from './captureSet';
import { OPEN_GUIDE } from './captureSeeds';
import { domeDrawn } from './liveHelpers';
import { FIXTURE_DATE, PARIS } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const PREFS_KEY = 'wiys:prefs:v1';
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const GLARE_PASS = `25544-${String(Date.parse('2026-09-02T03:52:46.469Z'))}`;

async function homeAt(page: Page, viewport: { width: number; height: number }, locale: CaptureLocale, chartView: 'dome' | 'polar'): Promise<void> {
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, theme: 'dark', observer: PARIS, chartView })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
  await page.goto('/');
  await expect(page.locator(`article[data-pass-id="${GLARE_PASS}"]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
}

/** The paused clock holds React's lazy reveal (R32): run it until `testId` is up, then a second more for the stars chunk. */
async function settle(page: Page, testId: string): Promise<void> {
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.getByTestId(testId).count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await page.clock.runFor(1000);
}

/** The polar chart's star group, drawn once the page's `stars` chunk is in. */
async function polarStars(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.locator('[data-drawing="polar"] [data-star]').count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
}

test.describe('the live page', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`wide, polar, [ stars ] on the actions row, ${locale}`, async ({ page }) => {
      await homeAt(page, { width: 1280, height: 800 }, locale, 'polar');
      await page.getByTestId('live-link').click();
      await settle(page, 'sky-chart');
      await polarStars(page);
      await expect(page.getByTestId('live-actions').getByTestId('stars-toggle')).toHaveAttribute('aria-pressed', 'true');
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r123-live-1280-polar-dark-${locale}.png` });
    });

    test(`compact, dome, [ stars ] on the view row, ${locale}`, async ({ page }) => {
      await homeAt(page, { width: 390, height: 844 }, locale, 'dome');
      await page.getByTestId('live-link').click();
      await settle(page, 'sky-chart');
      await domeDrawn(page);
      const toggle = page.getByTestId('stars-toggle');
      await expect(toggle).toBeVisible();
      await expect(page.getByTestId('live-actions').getByTestId('stars-toggle')).toHaveCount(0);
      const row = await page.getByTestId('chart-view-row').boundingBox();
      const box = await page.getByTestId('chart-box').boundingBox();
      console.log(`R123 at 390 × 844 (${locale}): the view row is ${String(row?.height ?? 0)} px, the box ${String(box?.width ?? 0)} × ${String(box?.height ?? 0)} px`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r123-live-390-dome-dark-${locale}.png` });
    });
  }

  test('compact polar on the landscape phone, en', async ({ page }) => {
    await homeAt(page, { width: 844, height: 390 }, 'en', 'polar');
    await page.getByTestId('live-link').click();
    await settle(page, 'sky-chart');
    await polarStars(page);
    await expect(page.locator('[data-row="status"][data-action="true"]').getByTestId('stars-toggle')).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r123-live-844-polar-dark-en.png` });
  });
});

test.describe('the pass detail', () => {
  for (const [width, height, locale] of [
    [1280, 800, 'en'],
    [1280, 800, 'es'],
    [390, 844, 'es'],
  ] as const) {
    test(`polar at ${String(width)}, ${locale}`, async ({ page }) => {
      await homeAt(page, { width, height }, locale, 'polar');
      await page.locator(`article[data-pass-id="${GLARE_PASS}"]`).getByRole('button', { name: OPEN_GUIDE[locale] }).click();
      await settle(page, 'stars-toggle');
      await polarStars(page);
      await expect(page.getByTestId('chart-view-row').getByTestId('stars-toggle')).toBeVisible();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r123-detail-${String(width)}-polar-dark-${locale}.png` });
    });
  }
});
