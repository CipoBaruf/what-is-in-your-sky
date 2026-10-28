/**
 * R133 (FR-FLOW-9, FR-FLOW-7's wide share; D-850; F4, D5): the boxes.
 *
 * - **Compact, 390 × 844, at the opening tilt:** the dome's box is cut from the bowl (`ChartFrame`, `data-bowl`):
 *   its height is the bowl's drawn height at the box's full-bleed width plus `DOME_COMPACT_SLACK_PX` above and
 *   below, never under FR-LIVE-7's compact floor, and the blank between the box's top edge and the bowl's highest
 *   drawn cell, and between its lowest drawn cell and the box's bottom edge, is each at most that slack. Read from
 *   the scene's measured box — the raster's drawn cells (`domeInk`), the labels aside — on the live page and on the
 *   pass detail. The rows around the box (the readout above, the hint below) stand a row gap from its edges, so
 *   the reader's blank is the slack and a `--space-1`. Where the platform's glyph advance rounds down (Linux
 *   Chromium, D-293) the raster paints the bowl short of the zoom the box asked for, and the blank that adds is the
 *   platform's, allowed for the way `fitFloor` allows for it.
 * - **Wide, 1280 × 800:** the box runs from under the header to the hint line for every view — the dome, the polar
 *   chart and the window on the live page, the window on the stars page — so no band under the drawing is taller
 *   than `--space-3`.
 * - **The pass panel, 1280 × 800:** the drawing is at least `DETAIL_DRAWING_MIN_SHARE` of the panel's body (R132's
 *   reading, D-866); its share of the whole panel is logged beside it for the record.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { COMPACT_BOX_MIN_SHORT_PX, DETAIL_DRAWING_MIN_SHARE, DOME_COMPACT_SLACK_PX } from '../../src/lib/layout';
import { compactBowlBoxPx, DRAWING_HEIGHT_UNITS, zoomFor } from '../../src/ui/components/guide/skychart/dome/camera';
import { painted, platformZoom } from './domeInk';
import { bandUnderBox, domeDrawn, seedStoredRun, SPACE_3_PX } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
/** A row gap, `--space-1` (6 px), with a pixel of rounding: how far the rows around the box may stand from its edges. */
const ROW_GAP_PX = 8;

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

/**
 * FR-FLOW-9's compact check on a page: the box the bowl's rule, the blank over and under the drawn cells at most the
 * slack (plus what the platform's rounding adds), the readout a row gap over the box and the hint a row gap under it.
 */
async function expectBowlCut(layout: Locator, label: string): Promise<void> {
  const chartBox = await settledBox(layout.getByTestId('chart-box'));
  // The frame cut the box: full-bleed, at the rule's height, over the floor.
  expect(chartBox.width, `${label}: full-bleed`).toBeCloseTo(390, 0);
  const rule = compactBowlBoxPx(chartBox.width);
  expect(Math.abs(chartBox.height - rule), `${label}: the box is ${fmt(chartBox)}, the rule says ${String(rule)} px tall`).toBeLessThanOrEqual(1);
  expect(chartBox.height).toBeGreaterThanOrEqual(COMPACT_BOX_MIN_SHORT_PX);
  await expect(layout.getByTestId('chart-frame')).toHaveAttribute('data-bowl', 'true');

  // The drawn cells: the layers' ink, top and bottom, read from the scene's raster.
  const ink = await painted(layout.locator('[data-drawing="dome"]'));
  expect(ink.layers.length, `${label}: no drawing`).toBeGreaterThan(0);
  const inkTop = Math.min(...ink.layers.map((layer) => layer.ink.y));
  const inkBottom = Math.max(...ink.layers.map((layer) => layer.ink.y + layer.ink.height));
  const above = inkTop - chartBox.y;
  const below = chartBox.y + chartBox.height - inkBottom;
  // D-293: a raster whose advance rounded down paints the bowl short of the box's zoom; the blank that adds is the platform's.
  const zoomAsked = zoomFor(chartBox.width, chartBox.height);
  const platform = ((zoomAsked - platformZoom(ink.layers, chartBox)) * DRAWING_HEIGHT_UNITS) / 2;
  const allowed = DOME_COMPACT_SLACK_PX + Math.max(0, platform) + 1;
  console.log(`${label}: box ${fmt(chartBox)}; blank over the bowl ${above.toFixed(1)} px, under it ${below.toFixed(1)} px (slack ${String(DOME_COMPACT_SLACK_PX)}, platform ${platform.toFixed(1)})`);
  expect(above, `${label}: ${above.toFixed(1)} px of blank over the bowl`).toBeLessThanOrEqual(allowed);
  expect(below, `${label}: ${below.toFixed(1)} px of blank under the bowl`).toBeLessThanOrEqual(allowed);
  expect(above, `${label}: the bowl's top is inside the box`).toBeGreaterThanOrEqual(-1);
  expect(below, `${label}: the bowl's bottom is inside the box`).toBeGreaterThanOrEqual(-1);

  // The rows: the readout a row gap over the box, and under it the hint, past the dome's empty picker row and its gap
  // — two row gaps — so nothing but the slack and the rhythm stands between the rows and the bowl.
  const readout = await box(layout.locator('[data-slot="readout"]'));
  expect(chartBox.y - (readout.y + readout.height), `${label}: the readout over the box`).toBeLessThanOrEqual(ROW_GAP_PX);
  const hint = await box(layout.locator('[data-slot="hint"]'));
  expect(hint.y - (chartBox.y + chartBox.height), `${label}: the hint under the box`).toBeLessThanOrEqual(2 * ROW_GAP_PX);
}

test.describe('the compact dome’s box hugs the bowl (FR-FLOW-9)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: false });

  test('the live page at 390 × 844: the box is the bowl plus one slack above and below, and the page fits the screen', async ({ page }) => {
    const layout = await openLive(page);
    await expectBowlCut(layout, 'live 390 × 844');
    // What the cut buys: the watching page, hint and actions included, is one screen.
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
  });

  test('the pass detail at 390 × 844: the same cut', async ({ page }) => {
    const layout = await openDetail(page);
    await expectBowlCut(layout, 'detail 390 × 844');
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
