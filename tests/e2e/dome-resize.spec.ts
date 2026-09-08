/**
 * FR-DOME-1 as amended (v1.2.1, D-316, F-60): the fit rule holds after a resize
 * as it does on a fresh load. Every one of the owner's four screenshots was one
 * tab resized, and after a resize the dome was drawn through the cell the
 * scene measured at mount — 107 % of the box across at 1280 x 800 after
 * 3840 x 2160, the compass labels off the dome; clipped at 100 % at 3840 after
 * 1920. The remount key carried the column count alone, which every desktop
 * box caps at 120, so on a desktop it never changed (D-316).
 *
 * One page is driven through four sizes and the painted extent at each is
 * compared with what a fresh load at that size gives, within one cell of the
 * raster: the two are the same picture or the resize is wrong. Fails on the
 * old key at the second size.
 */
import { expect, test, type Page } from '@playwright/test';
import { painted, type Painted } from './domeInk';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
  { width: 1280, height: 800 },
  { width: 2560, height: 1440 },
] as const;

async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

/** The extent once the box and the raster have stopped moving: two identical reads a frame apart. */
async function settledExtent(page: Page): Promise<Painted> {
  const dome = page.getByTestId('live-dome').locator('[data-drawing="dome"]');
  let last = '';
  let result: Painted | null = null;
  await expect
    .poll(async () => {
      const box = await page.getByTestId('chart-box').first().boundingBox();
      const current = await painted(dome);
      const key = [box?.width, box?.height, current.extent.x, current.extent.y, current.extent.width, current.extent.height].join(':');
      const settled = current.layers.length > 0 && key === last;
      last = key;
      if (settled) result = current;
      return settled;
    })
    .toBe(true);
  if (!result) throw new Error('the dome never settled');
  return result;
}

test('draws the same dome after a resize as a fresh load at that size gives', async ({ browser }) => {
  // Five page loads in one test: three times the budget, so a loaded CI box does not fail it on time alone.
  test.slow();
  // Fresh loads first, one page each, so the chain is compared against pictures no resize ever touched.
  const fresh = new Map<string, Painted>();
  for (const size of SIZES) {
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    await openLive(page);
    fresh.set(`${String(size.width)}x${String(size.height)}`, await settledExtent(page));
    await context.close();
  }

  const context = await browser.newContext({ viewport: SIZES[0] });
  const page = await context.newPage();
  await openLive(page);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    const key = `${String(size.width)}x${String(size.height)}`;
    const resized = await settledExtent(page);
    const reference = fresh.get(key);
    if (!reference) throw new Error(`no fresh load at ${key}`);
    const cell = Math.max(...resized.layers.map((layer) => layer.cellWidthPx));
    for (const side of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(resized.extent[side] - reference.extent[side]), `${side} of the extent at ${key} after a resize, against a fresh load`).toBeLessThanOrEqual(cell + 1);
    }
    // …and inside its box, which the old key also broke: the drawing ran past the box after growing the window.
    const box = await page.getByTestId('chart-box').first().boundingBox();
    if (!box) throw new Error('no box');
    expect(resized.extent.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(resized.extent.x + resized.extent.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  await context.close();
});
