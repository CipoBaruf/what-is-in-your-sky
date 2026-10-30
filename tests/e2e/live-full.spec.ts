/**
 * R148 (FR-FULL-1, FR-FULL-3, FR-FULL-4, FR-FULL-6; US-43 AC1..AC4; D-918, D-919, D-921): the compact live page is
 * the sky. At 390 × 844, 390 × 667 and 360 × 640, in every view and both languages: `chart-box`'s edges are within
 * 1 px of the viewport's and the page does not scroll; with the sheet closed the head, `[ controls ]` and the hint
 * together cover at most `FULL_OVERLAY_MAX_SHARE` of the box (the card, which goes on the reader's first pick, is not
 * counted); the sheet, open with the list open on a run of twenty passes, is at or under `SHEET_MAX_SHARE` of the
 * viewport's height, its body scrolls where its rows are taller than that, and the page never scrolls. The numbers
 * are the Done note's.
 *
 * R150 (FR-GYRO-7, FR-GYRO-8, FR-GYRO-10; US-44 AC5, AC6): at 844 × 390 the sheet is the same bottom sheet — its
 * bottom edge on the viewport's, the full width, at most `SHEET_MAX_SHARE` of the height, its body scrolling; the
 * sheet ends with "Satellites (n)", `n` the drawn passes the open list holds, inside the scrolling body; and touch
 * drags on the head row: 40 px snaps back, 80 px closes, a short fast flick closes.
 *
 * The seed is `seedStoredRun`'s stored run at Neuquén with the elements refused (FR-OFF-8), so the run is the
 * page's and no recompute replaces it; the twenty passes are the run's first-day passes and copies two minutes on.
 *
 *   npx playwright test live-full --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { FULL_OVERLAY_MAX_SHARE, SHEET_FLICK_PX_PER_MS, SHEET_MAX_SHARE, SHEET_SWIPE_CLOSE_PX } from '../../src/lib/layout';
import { closeSheet, domeDrawn, openSheet, seedStoredRun, STORED_RUN, stripFilled, type StoredRun } from './liveHelpers';

const SIZES = [
  [390, 844],
  [390, 667],
  [360, 640],
] as const;
const VIEWS = ['polar', 'dome', 'window'] as const;
const LOCALES = ['en', 'es'] as const;
const DAY = 86_400_000;

interface RunPass {
  id: string;
  noradId: number;
  start: { t: number };
  peak: { t: number };
  end: { t: number };
  track: { t: number }[];
}

/** The run's passes inside the page's 24 h, and copies two and four minutes on until there are twenty. */
const TWENTY: StoredRun = (() => {
  const passes = STORED_RUN.passes as RunPass[];
  const shift = (pass: RunPass, ms: number): RunPass => ({
    ...pass,
    id: `${String(pass.noradId)}-${String(pass.start.t + ms)}`,
    start: { ...pass.start, t: pass.start.t + ms },
    peak: { ...pass.peak, t: pass.peak.t + ms },
    end: { ...pass.end, t: pass.end.t + ms },
    track: pass.track.map((point) => ({ ...point, t: point.t + ms })),
  });
  const firstDay = passes.filter((pass) => pass.start.t <= STORED_RUN.computedAt + DAY);
  const out = [...firstDay];
  for (let ms = 120_000; out.length < 20; ms += 120_000) for (const pass of firstDay) if (out.length < 20) out.push(shift(pass, ms));
  return { ...STORED_RUN, passes: [...out, ...passes.filter((pass) => pass.start.t > STORED_RUN.computedAt + DAY)].sort((a, b) => a.start.t - b.start.t) };
})();

/** `seedStoredRun`'s prefs for a view: the window seeds no `chartView` (a fresh profile), the others the saved one. */
const viewPrefs = (view: (typeof VIEWS)[number]): Record<string, unknown> => ({ chartView: view === 'window' ? undefined : view });

async function openLive(page: Page, locale: (typeof LOCALES)[number], view: (typeof VIEWS)[number]): Promise<void> {
  await seedStoredRun(page, { locale, prefs: viewPrefs(view), run: TWENTY, elements: 'down' });
  await page.goto('/#live');
  await page.reload();
  const layout = page.getByTestId('live-layout');
  await expect(layout).toBeVisible({ timeout: 30_000 });
  await expect(layout).toHaveAttribute('data-shape', 'full');
  await expect(layout.locator(`[data-drawing="${view}"]`)).toBeAttached({ timeout: 30_000 });
  if (view === 'dome') await domeDrawn(page);
  await stripFilled(page);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function box(page: Page, testId: string): Promise<Box> {
  const found = await page.getByTestId(testId).boundingBox();
  if (!found) throw new Error(`${testId} has no box`);
  return found;
}

/**
 * R150 (FR-GYRO-8): the satellites' heading reads "Satellites (n)" / "Satélites (n)" with `n` the drawn passes, the
 * rows of the open list that carry a pass, and the list stands inside the sheet's body, its last group.
 */
async function satellitesCounted(page: Page, locale: (typeof LOCALES)[number]): Promise<number> {
  const satellites = page.getByTestId('live-satellites');
  await expect(satellites.getByTestId('chart-legend-slot')).toHaveCount(1);
  const n = await satellites.locator('[data-testid="chart-legend"] [data-pass-id]').count();
  await expect(satellites.getByRole('heading', { level: 2 })).toHaveText(`${locale === 'en' ? 'Satellites' : 'Satélites'} (${String(n)})`);
  await expect(page.getByTestId('sheet-body').getByTestId('live-satellites')).toHaveCount(1);
  return n;
}

/**
 * R150 (FR-GYRO-8): a touch drag on the sheet's head row, `dy` px down in `steps` moves `stepMs` apart, through the
 * DevTools protocol's touch events (the page has touch, so the browser makes them pointer events).
 */
async function touchDrag(page: Page, dy: number, steps: number, stepMs: number): Promise<void> {
  const place = await box(page, 'sheet-place');
  const x = place.x + Math.min(place.width / 2, 40);
  const y = place.y + place.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', at: number): Promise<void> => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: at }] });
  };
  await touch('touchStart', y);
  for (let step = 1; step <= steps; step += 1) {
    if (stepMs > 0) await page.waitForTimeout(stepMs);
    await touch('touchMove', y + (dy * step) / steps);
  }
  if (stepMs > 0) await page.waitForTimeout(stepMs);
  await touch('touchEnd', y + dy);
  await cdp.detach();
}

const scrolls = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

for (const locale of LOCALES) {
  for (const [width, height] of SIZES) {
    test.describe(`FR-FULL at ${String(width)} × ${String(height)}, ${locale}`, () => {
      test.use({ viewport: { width, height }, hasTouch: true });

      for (const view of VIEWS) {
        test(`the ${view}: the box is the screen, the overlay under its share, the sheet under its share with the list open and the page never scrolls (FR-FULL-1, FR-FULL-3, FR-FULL-4)`, async ({ page }) => {
          await openLive(page, locale, view);
          // FR-FULL-1: `chart-box`'s edges within a pixel of the viewport's, no page scroll.
          const chart = await box(page, 'chart-box');
          expect(Math.abs(chart.x), 'left edge').toBeLessThanOrEqual(1);
          expect(Math.abs(chart.y), 'top edge').toBeLessThanOrEqual(1);
          expect(Math.abs(chart.x + chart.width - width), 'right edge').toBeLessThanOrEqual(1);
          expect(Math.abs(chart.y + chart.height - height), 'bottom edge').toBeLessThanOrEqual(1);
          expect(await scrolls(page), 'the page scrolls').toBe(false);
          test.info().annotations.push({ type: 'chart-box', description: `${locale} ${view} ${String(width)}×${String(height)}: ${String(Math.round(chart.x))},${String(Math.round(chart.y))} ${String(Math.round(chart.width))}×${String(Math.round(chart.height))}` });

          // FR-FULL-10: nothing visible is up at the seed's instant, so the card asks; it is not the overlay's share.
          const card = page.getByTestId('live-card');
          await expect(card).toHaveAttribute('data-kind', 'ask');
          const cardBox = await box(page, 'live-card');
          expect(cardBox.x).toBeGreaterThanOrEqual(0);
          expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(width + 0.5);
          // FR-FULL-3: with the sheet closed, the head, the button and the hint cover at most FULL_OVERLAY_MAX_SHARE.
          await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
          const parts = [await box(page, 'live-head'), await box(page, 'live-controls')];
          const hint = page.getByTestId('sky-hint');
          if ((await hint.count()) > 0) parts.push(await box(page, 'sky-hint'));
          else expect(view, 'only the polar chart has no hint').toBe('polar');
          const covered = parts.reduce((sum, part) => sum + part.width * part.height, 0);
          const share = covered / (width * height);
          expect(share, `the overlay covers ${share.toFixed(3)} of the box`).toBeLessThanOrEqual(FULL_OVERLAY_MAX_SHARE);
          test.info().annotations.push({ type: 'overlay', description: `${locale} ${view} ${String(width)}×${String(height)}: ${share.toFixed(3)} of the box` });
          // The head at the top-left, the button at the bottom-right, each inside the box; the hint at the bottom-left.
          const [head, controls] = parts;
          if (!head || !controls) throw new Error('no head or controls');
          expect(head.y).toBeLessThan(height / 4);
          expect(head.x).toBeLessThan(width / 4);
          expect(controls.y + controls.height).toBeLessThanOrEqual(height + 0.5);
          expect(controls.x + controls.width).toBeLessThanOrEqual(width + 0.5);
          expect(controls.x).toBeGreaterThan(width / 2);
          expect(controls.width).toBeGreaterThanOrEqual(43.5);
          expect(controls.height).toBeGreaterThanOrEqual(43.5);
          const hintBox = parts[2];
          if (hintBox) {
            expect(hintBox.x).toBeLessThan(width / 4);
            expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(height + 0.5);
            expect(hintBox.y).toBeGreaterThan(height / 2);
            expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(width + 0.5);
          }
          // Every line of the head and the card fits: nothing is cut past the box.
          expect(head.x + head.width).toBeLessThanOrEqual(width + 0.5);

          // `[ see now ]`: the card goes, the sky stays, the box is the same.
          await card.getByTestId('live-card-now').click();
          await expect(card).toHaveCount(0);
          expect(await box(page, 'chart-box')).toEqual(chart);

          // FR-FULL-4: the sheet, open with the list open, at or under SHEET_MAX_SHARE of the height; its body scrolls
          // where the rows are taller than that; the page does not scroll; the box is unchanged (FR-FULL-6).
          await openSheet(page);
          // R150 (FR-GYRO-10): the list is open with no tap, under "Satellites (n)" — the passes drawn at the shown instant.
          const n = await satellitesCounted(page, locale);
          const sheet = await box(page, 'live-sheet');
          expect(sheet.height, `the sheet is ${String(Math.round(sheet.height))} px of ${String(height)}`).toBeLessThanOrEqual(SHEET_MAX_SHARE * height + 1);
          expect(Math.abs(sheet.width - width), 'the full width').toBeLessThanOrEqual(1);
          expect(Math.abs(sheet.y + sheet.height - height), 'at the bottom').toBeLessThanOrEqual(1);
          const body = await page.getByTestId('sheet-body').evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
          const rowsTaller = body.scrollHeight > body.clientHeight + 1;
          if (rowsTaller) expect(Math.abs(sheet.height - SHEET_MAX_SHARE * height), 'the sheet at its share, its body scrolling').toBeLessThanOrEqual(1);
          test.info().annotations.push({ type: 'sheet', description: `${locale} ${view} ${String(width)}×${String(height)}: ${String(Math.round(sheet.height))} px with the list open (${(sheet.height / height).toFixed(2)} of ${String(height)}), the body ${rowsTaller ? 'scrolling' : 'whole'}, the heading's count ${String(n)}` });
          expect(await scrolls(page), 'the page scrolls with the sheet open').toBe(false);
          expect(await box(page, 'chart-box')).toEqual(chart);
          // The sheet's head stays while the body scrolls.
          await page.getByTestId('sheet-body').evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          });
          await expect(page.getByTestId('sheet-head')).toBeInViewport({ ratio: 1 });
          await expect(page.getByTestId('sheet-close')).toBeVisible();
          // Every row of FR-GYRO-10 is in the sheet, in order, the satellites last; the satellites' heading in view at the body's end.
          const order = await page.getByTestId('sheet-body').evaluate((el) => [...el.children].map((child) => child.getAttribute('data-testid')));
          expect(order).toEqual(['live-context', 'live-timeline', 'live-view-row', 'live-facing', 'live-actions', 'live-satellites']);
          await expect(page.getByTestId('live-satellites-head')).toBeInViewport();
          await closeSheet(page);
          expect(await box(page, 'chart-box')).toEqual(chart);
        });
      }
    });
  }

  test.describe(`FR-FULL at 844 × 390, ${locale}`, () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

    test('the box is the screen and the sheet the bottom sheet, at most SHEET_MAX_SHARE of the height, its body scrolling (FR-FULL-1, FR-GYRO-7)', async ({ page }) => {
      await openLive(page, locale, 'window');
      const chart = await box(page, 'chart-box');
      expect(Math.abs(chart.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(chart.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(chart.x + chart.width - 844)).toBeLessThanOrEqual(1);
      expect(Math.abs(chart.y + chart.height - 390)).toBeLessThanOrEqual(1);
      expect(await scrolls(page)).toBe(false);
      await page.getByTestId('live-card-now').click();
      await openSheet(page);
      await expect(page.getByTestId('live-sheet')).not.toHaveAttribute('data-form');
      const sheet = await box(page, 'live-sheet');
      expect(Math.abs(sheet.y + sheet.height - 390), 'its bottom edge on the viewport’s').toBeLessThanOrEqual(1);
      expect(Math.abs(sheet.x), 'from the left edge').toBeLessThanOrEqual(1);
      expect(Math.abs(sheet.width - 844), 'the full width').toBeLessThanOrEqual(1);
      expect(sheet.height, `the sheet is ${String(Math.round(sheet.height))} px of 390`).toBeLessThanOrEqual(SHEET_MAX_SHARE * 390 + 1);
      // At 390 px tall the rows never fit: the sheet at its share, the body scrolling, the head staying.
      const body = await page.getByTestId('sheet-body').evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
      expect(body.scrollHeight, 'the body scrolls').toBeGreaterThan(body.clientHeight + 1);
      expect(Math.abs(sheet.height - SHEET_MAX_SHARE * 390), 'the sheet at its share').toBeLessThanOrEqual(1);
      const n = await satellitesCounted(page, locale);
      await page.getByTestId('sheet-body').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(page.getByTestId('sheet-head')).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId('live-satellites-head')).toBeInViewport();
      expect(await scrolls(page)).toBe(false);
      expect(await box(page, 'chart-box')).toEqual(chart);
      test.info().annotations.push({ type: 'bottom sheet', description: `${locale}: ${String(Math.round(sheet.width))} × ${String(Math.round(sheet.height))} at 844 × 390 (${(sheet.height / 390).toFixed(2)} of the height), bottom at ${String(Math.round(sheet.y + sheet.height))}, the heading's count ${String(n)}` });
    });
  });

  /**
   * R150 (FR-GYRO-8, US-44 AC5): touch drags on the head row. 40 px slowly snaps back; 80 px slowly closes, past
   * `SHEET_SWIPE_CLOSE_PX`; 30 px in one quick move closes, faster than `SHEET_FLICK_PX_PER_MS`. The `×` closes too.
   */
  test.describe(`the swipe at 390 × 844, ${locale}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('the × closes, 40 px snaps back, 80 px closes, a short fast flick closes (FR-GYRO-8)', async ({ page }) => {
      expect(40).toBeLessThan(SHEET_SWIPE_CLOSE_PX);
      expect(80).toBeGreaterThan(SHEET_SWIPE_CLOSE_PX);
      // Slow: 4 px every 30 ms is about 0.13 px/ms, well under the flick's speed.
      expect(4 / 30).toBeLessThan(SHEET_FLICK_PX_PER_MS);
      await openLive(page, locale, 'polar');
      await page.getByTestId('live-card-now').click();
      const sheet = page.getByTestId('live-sheet');
      // The `×` first: a tap right after the protocol's instant flick is swallowed by the browser's own tap
      // suppression after a fling, which is the browser's and not the page's.
      await openSheet(page);
      const close = page.getByRole('button', { name: locale === 'en' ? 'Close controls' : 'Cerrar controles' });
      const closeBox = await close.boundingBox();
      expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(43.5);
      expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(43.5);
      await expect(close).toHaveText('×');
      await close.tap();
      await expect(sheet).toHaveAttribute('data-open', 'false');
      await openSheet(page);
      const before = await box(page, 'live-sheet');
      await touchDrag(page, 40, 10, 30);
      await expect(sheet).toHaveAttribute('data-open', 'true');
      await expect.poll(async () => Math.round((await box(page, 'live-sheet')).y)).toBe(Math.round(before.y));
      await touchDrag(page, 80, 20, 30);
      await expect(sheet).toHaveAttribute('data-open', 'false');
      await expect(sheet).toBeHidden();
      await expect(page.getByTestId('live-controls')).toBeFocused();
      await openSheet(page);
      await touchDrag(page, 30, 1, 0);
      await expect(sheet).toHaveAttribute('data-open', 'false');
    });
  });
}
