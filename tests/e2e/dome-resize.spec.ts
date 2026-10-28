/**
 * FR-DOME-1 as amended (v1.2.1, D-316, F-60): the fit rule holds after a resize
 * as it does on a fresh load. Every one of the owner's four screenshots was one
 * tab resized, and after a resize the dome was drawn through the cell the
 * scene measured at mount — 107 % of the box across at 1280 x 800 after
 * 3840 x 2160, the compass labels off the dome; clipped at 100 % at 3840 after
 * 1920. The remount key carried the column count alone, which every desktop
 * box caps at 120, so on a desktop it never changed (D-316).
 *
 * One page is driven through four sizes. At each the painted extent must be
 * inside its box and cover it as FR-DOME-1 asks — the old key ran it past the
 * box at the second size — and at 1280 x 800 after 3840 x 2160, the worst
 * case the owner saw (107 % across, the labels off the dome), it is compared
 * with a fresh load at that size within one cell of the raster: the two are
 * the same picture or the resize is wrong. Two page loads in all (FR-CI-1).
 *
 * R128 (F-103): the same on a phone, where a box that changes height alone — the landmark line arriving
 * with the `stars` chunk takes 23 px from it (D-838) — changes the grid's rows and neither its columns nor
 * its font size. The key carried those two, so the scene kept the projection it mounted with: the drawing
 * of the taller box. The key now carries the rows too, and the rasters after the change are a fresh load's.
 */
import { expect, test, type Page } from '@playwright/test';
import { fitFloor, painted, type Painted } from './domeInk';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
  { width: 1280, height: 800 },
  { width: 2560, height: 1440 },
] as const;
/** The size compared against a fresh load: the one the owner's screenshots showed worst. */
const REFERENCE = SIZES[2];

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
  // The fresh reference first, on a page of its own, so the chain is compared against a picture no resize touched.
  const referenceContext = await browser.newContext({ viewport: REFERENCE });
  const referencePage = await referenceContext.newPage();
  await openLive(referencePage);
  const reference: Painted = await settledExtent(referencePage);
  await referenceContext.close();

  const context = await browser.newContext({ viewport: SIZES[0] });
  const page = await context.newPage();
  await openLive(page);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    const key = `${String(size.width)}x${String(size.height)}`;
    const resized = await settledExtent(page);
    const box = await page.getByTestId('chart-box').first().boundingBox();
    if (!box) throw new Error('no box');
    // Inside its box on both axes, and covering it as a fresh load would — the old key ran the drawing past the box after growing the window.
    expect(resized.extent.x, `${key}: the drawing starts inside the box`).toBeGreaterThanOrEqual(box.x - 1);
    expect(resized.extent.x + resized.extent.width, `${key}: the drawing ends inside the box`).toBeLessThanOrEqual(box.x + box.width + 1);
    expect(resized.extent.y, `${key}: the drawing's top is inside the box`).toBeGreaterThanOrEqual(box.y - 1);
    expect(resized.extent.y + resized.extent.height, `${key}: the drawing's bottom is inside the box`).toBeLessThanOrEqual(box.y + box.height + 1);
    expect(resized.extent.width / box.width, `${key}: the drawing over the box's width`).toBeGreaterThanOrEqual(fitFloor(resized.layers, box));
    if (size.width === REFERENCE.width && size.height === REFERENCE.height) {
      const cell = Math.max(...resized.layers.map((layer) => layer.cellWidthPx));
      for (const side of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs(resized.extent[side] - reference.extent[side]), `${side} of the extent at ${key} after a resize, against a fresh load`).toBeLessThanOrEqual(cell + 1);
      }
    }
  }
  await context.close();
});

/** Each layer's raster text and its row count: what the scene drew, character for character. */
async function rasters(page: Page): Promise<string[]> {
  const dome = page.getByTestId('live-dome').locator('[data-drawing="dome"]');
  let last = '';
  await expect
    .poll(async () => {
      const now = (await dome.locator('pre.glyph-output').allTextContents()).join('\u0000');
      const settled = now.length > 0 && now === last;
      last = now;
      return settled;
    })
    .toBe(true);
  return last.split('\u0000');
}

test('redraws the dome when the box changes height alone, as a fresh load at that height draws it (F-103)', async ({ browser }) => {
  const SHORT = { width: 390, height: 780 };
  const referenceContext = await browser.newContext({ viewport: SHORT });
  const referencePage = await referenceContext.newPage();
  await openLive(referencePage);
  const reference = await rasters(referencePage);
  await referenceContext.close();

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openLive(page);
  const tall = await rasters(page);
  await page.setViewportSize(SHORT);
  const resized = await rasters(page);
  // R132 (FR-FLOW-4, D-864): the compact box is its floor at both heights now — the column scrolls instead — so the rows
  // are the same and what F-103 asks is that the resized page draws what a fresh load at that size draws.
  expect(tall.length).toBeGreaterThan(0);
  expect(resized, 'the rasters after the resize, against a fresh load at that size').toEqual(reference);
  await context.close();
});
