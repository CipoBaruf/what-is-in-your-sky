/**
 * R121 (FR-SKY-2, FR-FSC-6 as amended v2.5; V25-17, D-834): the review
 * captures of the owner's call on the block — the wide live page's status slot
 * in the box's top-left corner for every view, so the row above the box is the
 * view control alone at every wide width; and the landscape phone's control
 * wrapping to two lines inside its 48 px row. The window's own captures are
 * `sky-window.spec.ts`'s. Paris at that spec's instant (the glare pass in the
 * list), the live page watching.
 */
import { expect, test, type Page } from '@playwright/test';
import { LIVE_BOX_MIN_PX, TAP_PX } from '../../src/lib/layout';
import { CAPTURE_DIR, type CaptureLocale } from './captureSet';
import { domeDrawn } from './liveHelpers';
import { FIXTURE_DATE, PARIS } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const PREFS_KEY = 'wiys:prefs:v1';
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const GLARE_PASS = `25544-${String(Date.parse('2026-09-02T03:52:46.469Z'))}`;
const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;

async function liveAt(page: Page, viewport: { width: number; height: number }, locale: CaptureLocale, chartView: 'dome' | 'polar'): Promise<void> {
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
  await page.getByTestId('live-link').click();
  // The paused clock holds React's lazy reveal (R32): the live chunk lands only as the clock runs.
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.getByTestId('sky-chart').count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await page.clock.runFor(1000);
  if (chartView === 'dome') await domeDrawn(page);
  await page.mouse.move(0, 0);
}

const rectOf = async (page: Page, testId: string): Promise<{ x: number; y: number; width: number; height: number }> => (await page.getByTestId(testId).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

test.describe('the wide live page: the status slot in the box\'s corner, the control alone on its row', () => {
  for (const [width, height, locale, chartView] of [
    [1280, 800, 'en', 'dome'],
    [1280, 800, 'en', 'polar'],
    [1024, 768, 'es', 'dome'],
    [1200, 450, 'en', 'dome'],
  ] as const) {
    test(`${chartView} at ${String(width)} × ${String(height)}, ${locale}`, async ({ page }) => {
      await liveAt(page, { width, height }, locale, chartView);
      const toggle = await page.getByRole('group', { name: VIEW_GROUP[locale] }).boundingBox();
      const box = await rectOf(page, 'chart-box');
      const slot = await rectOf(page, 'chart-status');
      // One line of control: the group's own height is the tap row and no more.
      expect(toggle?.height ?? 0).toBeLessThanOrEqual(TAP_PX + 1);
      // The slot stands in the box's top-left corner, over the drawing.
      expect(Math.abs(slot.x - box.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(slot.y - box.y)).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('chart-status').getByTestId(chartView === 'dome' ? 'dome-readout' : 'chart-convention')).toBeVisible();
      await page.screenshot({ path: `${CAPTURE_DIR}/r121-live-${String(width)}-${chartView}-dark-${locale}.png` });
    });
  }
});

test.describe('the landscape phone: the control wraps inside its 48 px row', () => {
  for (const locale of ['en', 'es'] as const) {
    test(`the dome at 740 × 360, ${locale}`, async ({ page }) => {
      await liveAt(page, { width: 740, height: 360 }, locale, 'dome');
      const toggle = await page.getByRole('group', { name: VIEW_GROUP[locale] }).boundingBox();
      const options = await page.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button').all();
      const tops = new Set<number>();
      for (const option of options) tops.add(Math.round((await option.boundingBox())?.y ?? 0));
      const box = await rectOf(page, 'chart-box');
      // Two lines of options in one tap row; the box keeps its floor.
      expect(tops.size).toBe(2);
      expect(toggle?.height ?? 0).toBeLessThanOrEqual(TAP_PX + 1);
      expect(box.height).toBeGreaterThanOrEqual(LIVE_BOX_MIN_PX);
      console.log(`R121 at 740 × 360 (${locale}): the view control is ${String(toggle?.height ?? 0)} px over ${String(tops.size)} lines; the box is ${String(box.width)} × ${String(box.height)} px`);
      await page.screenshot({ path: `${CAPTURE_DIR}/r121-live-740-dome-dark-${locale}.png` });
    });
  }
});
