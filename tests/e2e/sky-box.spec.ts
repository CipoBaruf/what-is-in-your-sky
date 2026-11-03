/**
 * R133 (FR-FLOW-9, FR-FLOW-7's wide share; D-850; F4, D5): the boxes.
 *
 * - **Compact, 390 × 844:** the live page's and (R164, FR-CLEAN-1) the pass detail's box is the screen (FR-FULL-1),
 *   and the bowl inside it is checked; FR-FLOW-9's compact cut from the bowl (D-850, `DOME_COMPACT_SLACK_PX`) has no
 *   compact page left to bind (FR-CLEAN-8) and its constant leaves with R165.
 * - **Wide, 1280 × 800:** the box runs from under the header to the hint line for every view — the dome, the polar
 *   chart and the window on the live page, the window on the stars page — so no band under the drawing is taller
 *   than `--space-3`.
 * - **The pass panel, 1280 × 800:** the drawing is at least `DETAIL_DRAWING_MIN_SHARE` of the panel's body (R132's
 *   reading, D-866); its share of the whole panel is logged beside it for the record.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DETAIL_DRAWING_MIN_SHARE } from '../../src/lib/layout';
import { painted } from './domeInk';
import { bandUnderBox, domeDrawn, seedStoredRun, SPACE_3_PX } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';
import { onWindow } from './globeHelpers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const box = async (locator: Locator): Promise<Box> => {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`no box for ${String(locator)}`);
  return found;
};
const fmt = (b: Box): string => `${String(Math.round(b.width))} × ${String(Math.round(b.height))} at ${String(Math.round(b.x))},${String(Math.round(b.y))}`;

async function openLive(page: Page): Promise<Locator> {
  await seedStoredRun(page, { locale: 'en', settled: true });
  await page.goto('/#live');
  await page.reload();
  const layout = page.getByTestId('live-layout');
  await expect(layout).toBeVisible({ timeout: 30_000 });
  await domeDrawn(page);
  return layout;
}

async function openDetail(page: Page): Promise<Locator> {
  await seedStoredRun(page, { locale: 'en', settled: true });
  await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
  const layout = page.getByTestId('pass-layout');
  await expect(layout.locator('[data-drawing="dome"]')).toBeAttached({ timeout: 30_000 });
  await expect(layout.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  return layout;
}

/** The chart box settled: the frame writes its height in a layout effect and the scene remounts on it, so wait for the two to agree. */
async function settledBox(locator: Locator): Promise<Box> {
  let last = '';
  await expect
    .poll(async () => {
      const b = await box(locator);
      const now = [b.x, b.y, b.width, b.height].map((n) => Math.round(n)).join(':');
      const settled = now === last;
      last = now;
      return settled;
    })
    .toBe(true);
  return box(locator);
}

test.describe('the compact dome’s box hugs the bowl (FR-FLOW-9)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: false });

  // v2.8 (FR-FULL-1, FR-FLOW-9 as amended): the live page's box is the screen, not the bowl's cut; the bowl is drawn inside it.
  test('the live page at 390 × 844: the box is the screen, the bowl is inside it, and the page fits the screen', async ({ page }) => {
    const layout = await openLive(page);
    const chartBox = await settledBox(layout.getByTestId('chart-box'));
    expect(chartBox.width, `live: ${fmt(chartBox)}`).toBeCloseTo(390, 0);
    expect(chartBox.height, `live: ${fmt(chartBox)}`).toBeCloseTo(844, 0);
    const ink = await painted(layout.locator('[data-drawing="dome"]'));
    expect(ink.layers.length, 'live: no drawing').toBeGreaterThan(0);
    const inkTop = Math.min(...ink.layers.map((layer) => layer.ink.y));
    const inkBottom = Math.max(...ink.layers.map((layer) => layer.ink.y + layer.ink.height));
    expect(inkTop - chartBox.y, 'live: the bowl\'s top is inside the box').toBeGreaterThanOrEqual(-1);
    expect(chartBox.y + chartBox.height - inkBottom, 'live: the bowl\'s bottom is inside the box').toBeGreaterThanOrEqual(-1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
  });

  // R164 (FR-CLEAN-1, FR-CLEAN-8): the pass detail is the full form too, so FR-FLOW-9's compact cut binds it no more:
  // its box is the screen and only the bowl inside it is checked, as on the live page.
  test('the pass detail at 390 × 844: the box is the screen and the bowl is inside it', async ({ page }) => {
    const layout = await openDetail(page);
    const chartBox = await settledBox(layout.getByTestId('chart-box'));
    expect(chartBox.width, `detail: ${fmt(chartBox)}`).toBeCloseTo(390, 0);
    expect(chartBox.height, `detail: ${fmt(chartBox)}`).toBeCloseTo(844, 0);
    const ink = await painted(layout.locator('[data-drawing="dome"]'));
    expect(ink.layers.length, 'detail: no drawing').toBeGreaterThan(0);
    const inkTop = Math.min(...ink.layers.map((layer) => layer.ink.y));
    const inkBottom = Math.max(...ink.layers.map((layer) => layer.ink.y + layer.ink.height));
    expect(inkTop - chartBox.y, "detail: the bowl's top is inside the box").toBeGreaterThanOrEqual(-1);
    expect(chartBox.y + chartBox.height - inkBottom, "detail: the bowl's bottom is inside the box").toBeGreaterThanOrEqual(-1);
  });
});

test.describe('the wide box runs to the hint line (FR-FLOW-9) and the panel’s drawing takes its body (FR-FLOW-7)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test('the live page at 1280 × 800: no band taller than --space-3 under the box, in the three views', async ({ page }) => {
    const layout = await openLive(page);
    for (const view of ['Dome', 'Polar', 'Window'] as const) {
      if (view !== 'Dome') {
        await layout.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: view }).click();
        await expect(layout.locator(`[data-drawing="${view.toLowerCase()}"]`)).toBeAttached({ timeout: 30_000 });
      }
      const chartBox = await settledBox(layout.getByTestId('chart-box'));
      // Read with the box: a view that scrolls the page or moves the top row moves the layout too.
      const layoutBox = await box(layout);
      const band = await bandUnderBox(page, chartBox);
      const scrollY = await page.evaluate(() => window.scrollY);
      console.log(`live 1280 × 800 ${view}: box ${fmt(chartBox)}, layout ${fmt(layoutBox)}, scrollY ${String(scrollY)}, band under it ${band.toFixed(1)} px`);
      expect(band, `${view}: ${band.toFixed(1)} px under the box`).toBeLessThanOrEqual(SPACE_3_PX);
      // From under the header: the box's top is the layout's.
      expect(Math.abs(chartBox.y - layoutBox.y), `${view}: the box at the layout's top`).toBeLessThanOrEqual(1);
      expect(chartBox.y + chartBox.height).toBeLessThanOrEqual(800);
    }
  });

  test('the stars page at 1280 × 800: the window’s box down to the hint line', async ({ page }) => {
    await page.clock.setFixedTime(NINE_DAYS_ON);
    for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
    await page.addInitScript(
      ([key, value]: [string, string]) => {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      },
      [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
    );
    await page.goto('/#stars');
    await onWindow(page);
    const layout = page.getByTestId('stars-layout');
    await expect(layout.locator('[data-drawing="window"]')).toBeAttached();
    const sky = await settledBox(page.getByTestId('stars-sky'));
    const band = await bandUnderBox(page, sky, 'stars-layout');
    console.log(`stars 1280 × 800: box ${fmt(sky)}, band under it ${band.toFixed(1)} px`);
    expect(band).toBeLessThanOrEqual(SPACE_3_PX);
    expect(Math.abs(sky.y - (await box(layout)).y)).toBeLessThanOrEqual(1);
    expect(sky.y + sky.height).toBeLessThanOrEqual(800);
  });

  test('the pass panel at 1280 × 800: the drawing is most of the panel’s body', async ({ page }) => {
    const layout = await openDetail(page);
    const panel = await box(page.getByTestId('guide-panel'));
    const body = await box(page.getByTestId('guide-body'));
    const drawing = await settledBox(layout.getByTestId('chart-box'));
    const ofBody = (drawing.width * drawing.height) / (body.width * body.height);
    const ofPanel = (drawing.width * drawing.height) / (panel.width * panel.height);
    console.log(`detail 1280 × 800: panel ${fmt(panel)}, body ${fmt(body)}, drawing ${fmt(drawing)}; share of the body ${ofBody.toFixed(3)}, of the panel ${ofPanel.toFixed(3)}`);
    test.info().annotations.push({ type: 'share', description: `drawing / body ${ofBody.toFixed(3)}, drawing / panel ${ofPanel.toFixed(3)}` });
    expect(drawing.width).toBeGreaterThanOrEqual(body.width - 24);
    expect(ofBody).toBeGreaterThanOrEqual(DETAIL_DRAWING_MIN_SHARE);
  });
});
