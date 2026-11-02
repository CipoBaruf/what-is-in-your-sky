/**
 * R163 (FR-CLEAN-1..4, FR-CLEAN-6, FR-CLEAN-7, FR-CLEAN-11; US-49 AC1..AC6; PLAN D-997, D-999, D-1001, D-1004): the
 * stars page in the full form on the production build, at 390 × 844, 390 × 667, 360 × 640, 844 × 390 and 667 × 375
 * in both languages, on a touch phone (so `[ follow ]` stands in the bottom row, FR-PHONE-3).
 *
 * - The box is the screen: `chart-box`'s edges within 1 px of the viewport's, and no page scroll, with the sheet
 *   closed, open, open with the picker, after a handoff to the whole sky and after a turn (FR-CLEAN-1, FR-CLEAN-6).
 * - With the sheet closed the head (`[ ← ]` and the door's line), the corner readout, `[ follow ]`, `[ controls ]` and
 *   the hint together cover at most `FULL_OVERLAY_MAX_SHARE` of the box at 390 × 844 and 390 × 667 (FR-CLEAN-2,
 *   FR-CLEAN-3); the numbers at every size are the Done note's.
 * - `[ controls ]` opens the bottom sheet in both shapes, at most `SHEET_MAX_SHARE` of the height, holding the view
 *   row, the follow row, the facing row, the layer rows and `In this field` open, in that order; a tap on the readout
 *   opens the picker under it and a pick turns the camera and keeps the sheet; a tap on a row of the list names the
 *   star on the readout's second line (FR-CLEAN-4); the sheet closes on the `×`, on `[ controls ]` and on `Esc`, and a
 *   second `Esc` leaves the page (FR-CLEAN-6).
 * - No `[ passes ]` toggle and no pass on the sky (FR-CLEAN-11).
 * - Turning 390 × 844 → 844 × 390 → 390 × 844 with the sheet and the picker open keeps the view, the camera, the sheet
 *   and the picker (FR-CLEAN-7).
 *
 * R164 appends the pass detail's `describe` after this one (D-1001).
 *
 *   npx playwright test clean-sky --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { FULL_OVERLAY_MAX_SHARE, SHEET_MAX_SHARE } from '../../src/lib/layout';
import { closeSheet, openSheet } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';
import { pinch } from './windowZoom';

type Locale = 'en' | 'es';
const LOCALES: readonly Locale[] = ['en', 'es'];
const PORTRAIT = [
  { width: 390, height: 844 },
  { width: 390, height: 667 },
  { width: 360, height: 640 },
] as const;
const TURNED = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
] as const;

const WORDS = {
  en: { window: 'Window', wholeSky: 'Whole sky', field: 'In this field', orientationGroup: 'Chart orientation', facing: 'Facing', headLine: /^(Dark \d\d:\d\d → \d\d:\d\d( UTC)?( · .+)?|No full dark( · .+)?|Stars from \d\d:\d\d.*|No dark sky tonight|Weather unknown)$/ },
  es: { window: 'Ventana', wholeSky: 'Cielo entero', field: 'En este campo', orientationGroup: 'Orientación del gráfico', facing: 'Mirando', headLine: /^(Oscuro \d\d:\d\d → \d\d:\d\d( UTC)?( · .+)?|Sin oscuridad total( · .+)?|Estrellas desde las \d\d:\d\d.*|Sin cielo oscuro esta noche|Sin datos)$/ },
} as const;

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error(`no box for ${String(locator)}`);
  return found;
}

/** The corner readout's drawn line — its paragraph, the surface — and not the target-tall row it is centred in (R157). */
const lineBox = (page: Page): Promise<Box> => box(page.getByTestId('sky-corner-readout').locator('p').first());

const scrolls = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

/** A reader with a place and no stored run, which is all the stars page needs (`flowPages.ts`'s seed). */
async function seedReader(page: Page, locale: Locale): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN })] as [string, string],
  );
}

/** The stars page in the full form, its window drawn by hand. */
async function openStars(page: Page, locale: Locale): Promise<Locator> {
  await seedReader(page, locale);
  await page.goto('/#stars');
  const layout = page.getByTestId('stars-layout');
  await expect(layout).toBeVisible();
  await expect(layout).toHaveAttribute('data-shape', 'full');
  await expect(windowRoot(page)).toHaveAttribute('data-state', 'hand', { timeout: 15_000 });
  return layout;
}

const windowRoot = (page: Page): Locator => page.getByTestId('stars-sky').locator('[data-look-az][data-fov]');
const chart = (page: Page): Locator => page.getByTestId('sky-chart');
const viewRow = (page: Page): Locator => page.getByTestId('stars-view-row');
const sheetOrder = (page: Page): Promise<(string | null)[]> => page.getByTestId('sheet-body').evaluate((el) => [...el.children].map((child) => child.getAttribute('data-testid')));

/** FR-CLEAN-1: `chart-box` is the viewport, inside 1 px, and the page does not scroll. */
async function expectBoxIsScreen(page: Page, size: { width: number; height: number }, what: string): Promise<Box> {
  const found = await box(page.getByTestId('chart-box'));
  expect(Math.abs(found.x), `${what}: left edge`).toBeLessThanOrEqual(1);
  expect(Math.abs(found.y), `${what}: top edge`).toBeLessThanOrEqual(1);
  expect(Math.abs(found.x + found.width - size.width), `${what}: right edge`).toBeLessThanOrEqual(1);
  expect(Math.abs(found.y + found.height - size.height), `${what}: bottom edge`).toBeLessThanOrEqual(1);
  expect(await scrolls(page), `${what}: the page scrolls`).toBe(false);
  return found;
}

/** FR-CLEAN-4, FR-CLEAN-7: the sheet open — the full width, at most `SHEET_MAX_SHARE` of the height, its bottom edge on the viewport's. */
async function expectSheetShape(page: Page, size: { width: number; height: number }): Promise<Box> {
  const sheet = await box(page.getByTestId('live-sheet'));
  expect(Math.abs(sheet.width - size.width), 'the full width').toBeLessThanOrEqual(1);
  expect(sheet.height, `the sheet is ${String(Math.round(sheet.height))} px of ${String(size.height)}`).toBeLessThanOrEqual(SHEET_MAX_SHARE * size.height + 1);
  expect(Math.abs(sheet.y + sheet.height - size.height), 'its bottom edge on the viewport’s').toBeLessThanOrEqual(1);
  return sheet;
}

for (const locale of LOCALES) {
  for (const size of [...PORTRAIT, ...TURNED]) {
    test.describe(`the stars page in the full form at ${String(size.width)} × ${String(size.height)}, ${locale}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

      test('the box is the screen, the overlay under its share, the sheet in order with In this field open, the picker, a named star, the closes and Esc twice (FR-CLEAN-1..4, FR-CLEAN-6, FR-CLEAN-11)', async ({ page }) => {
        const words = WORDS[locale];
        const layout = await openStars(page, locale);
        const chartBox = await expectBoxIsScreen(page, size, 'closed');
        test.info().annotations.push({ type: 'chart-box', description: `${locale} ${String(size.width)}×${String(size.height)}: ${String(Math.round(chartBox.width))}×${String(Math.round(chartBox.height))}` });

        // FR-CLEAN-2: the h1 in the document, hidden; the head over the sky with `[ ← ]` and the door's line.
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveAttribute('data-visually-hidden', '');
        const head = page.getByTestId('live-head');
        await expect(head.getByTestId('live-back')).toBeVisible();
        await expect(head.getByTestId('stars-head-line')).toHaveText(words.headLine);
        const headBox = await box(head);
        expect(headBox.y).toBeLessThan(size.height / 4);
        expect(headBox.x).toBeLessThan(size.width / 4);
        expect(headBox.x + headBox.width).toBeLessThanOrEqual(size.width + 0.5);
        // The readout in the top-right corner, clear of the head, one line while nothing is named.
        await expect(page.getByTestId('sky-corner-readout')).toHaveText(locale === 'en' ? /^Facing / : /^Hacia /);
        const readout = await lineBox(page);
        expect(readout.x, 'clear of the head').toBeGreaterThanOrEqual(headBox.x + headBox.width - 0.5);
        expect(readout.x + readout.width).toBeLessThanOrEqual(size.width + 0.5);
        // FR-CLEAN-3: `[ follow ]` then `[ controls ]` at the bottom-right, each a target; the touch hint drawn whole at the bottom-left.
        await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
        const row = page.getByTestId('live-bottom-row');
        expect(await row.evaluate((el) => [...el.children].map((child) => child.getAttribute('data-testid')))).toEqual(['live-follow-control', 'live-controls']);
        const follow = await box(page.getByTestId('live-follow-control'));
        const controls = await box(page.getByTestId('live-controls'));
        for (const part of [follow, controls]) {
          expect(part.width).toBeGreaterThanOrEqual(43.5);
          expect(part.height).toBeGreaterThanOrEqual(43.5);
          expect(part.y + part.height).toBeLessThanOrEqual(size.height + 0.5);
          expect(part.y + part.height).toBeGreaterThan(size.height - 60);
        }
        expect(controls.x + controls.width).toBeLessThanOrEqual(size.width + 0.5);
        expect(controls.x).toBeGreaterThan(size.width / 2);
        const hint = page.getByTestId('sky-hint');
        await expect(hint).toHaveAttribute('data-pointer', 'coarse');
        const hintBox = await box(hint);
        expect(hintBox.x).toBeLessThan(size.width / 4);
        expect(hintBox.y).toBeGreaterThan(size.height / 2);
        expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(size.height + 0.5);
        const fits = await hint.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
        expect(fits.scrollWidth, 'no clause cut').toBe(fits.clientWidth);
        // The overlay's share: the head, the readout's line, the two controls and the hint.
        const parts = [headBox, readout, follow, controls, hintBox];
        const share = parts.reduce((sum, part) => sum + part.width * part.height, 0) / (size.width * size.height);
        const overlayNote = `${locale} ${String(size.width)}×${String(size.height)}: ${share.toFixed(3)} of the box (head ${String(Math.round(headBox.width))}×${String(Math.round(headBox.height))}, readout ${String(Math.round(readout.width))}×${String(Math.round(readout.height))}, row ${String(Math.round(follow.width + controls.width))}×${String(Math.round(controls.height))}, hint ${String(Math.round(hintBox.width))}×${String(Math.round(hintBox.height))})`;
        test.info().annotations.push({ type: 'overlay', description: overlayNote });
        console.log(`[FR-CLEAN-3] ${overlayNote}`);
        if (size.width === 390) expect(share, `the overlay covers ${share.toFixed(3)} of the box`).toBeLessThanOrEqual(FULL_OVERLAY_MAX_SHARE);
        // FR-CLEAN-11: no passes toggle, no pass.
        await expect(page.locator('[data-layer="passes"]')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /passes$|pases$/ })).toHaveCount(0);
        await expect(page.locator('[data-pass-id]')).toHaveCount(0);

        // FR-CLEAN-4: the sheet, its rows in order, `In this field` open at its end, the box unmoved (FR-CLEAN-6).
        await openSheet(page);
        expect(await sheetOrder(page)).toEqual(['stars-view-row', 'stars-follow', 'stars-facing', 'stars-layer-rows', 'stars-field']);
        await expect(page.getByTestId('sheet-place')).toHaveText(NEUQUEN.label);
        await expect(viewRow(page).getByRole('button')).toHaveText([words.window, words.wholeSky]);
        await expect(page.getByTestId('stars-layers-row')).toHaveCount(2);
        await expect(page.getByTestId('stars-layers').getByRole('button')).toHaveCount(4);
        const list = page.getByRole('list', { name: words.field });
        await expect(list).toBeVisible();
        await expect(list.getByRole('listitem').first()).toBeAttached();
        await expect(page.getByTestId('sheet-body').getByRole('heading', { name: words.field })).toBeAttached();
        const sheet = await expectSheetShape(page, size);
        const body = await page.getByTestId('sheet-body').evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
        const sheetNote = `${locale} ${String(size.width)}×${String(size.height)}: ${String(Math.round(sheet.height))} px with In this field open (${(sheet.height / size.height).toFixed(2)} of ${String(size.height)}), the body ${body.scrollHeight > body.clientHeight + 1 ? 'scrolling' : 'whole'}`;
        test.info().annotations.push({ type: 'sheet', description: sheetNote });
        console.log(`[FR-CLEAN-4] ${sheetNote}`);
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        expect(await scrolls(page), 'the page scrolls with the sheet open').toBe(false);
        // The readout left the corner for the facing row; its tap opens the picker under it; a pick turns the camera and keeps the sheet.
        await expect(page.getByTestId('sky-corner-readout')).toHaveCount(0);
        const facing = page.getByTestId('stars-facing');
        await expect(facing.getByTestId('window-readout')).toBeVisible();
        const toggle = page.getByTestId('sky-readout-toggle');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const picker = page.getByTestId('stars-facing-picker');
        await picker.scrollIntoViewIfNeeded();
        await expect(picker.getByRole('group', { name: words.facing })).toBeVisible();
        const toggleBox = await box(toggle);
        expect((await box(picker)).y).toBeGreaterThanOrEqual(toggleBox.y + toggleBox.height - 1);
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        await picker.getByRole('button', { name: 'NE' }).click();
        await expect(page.getByTestId('stars-page')).toHaveAttribute('data-look-az', '45');
        await expect(picker).toHaveCount(0);
        await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
        // A row of the list names its star on the readout's second line, the page never scrolling.
        const first = list.getByRole('button').first();
        await first.scrollIntoViewIfNeeded();
        const named = (await first.getAttribute('aria-label')) ?? '';
        expect(named).not.toBe('');
        await first.click();
        // The row's words are the readout's second line's (FR-STAR-7): "Canopus · mag −0.7 · 28° up · S".
        await expect(facing.getByTestId('window-named')).toHaveText(named);
        expect(await scrolls(page)).toBe(false);
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);

        // FR-CLEAN-6: the closes — the `×`, `[ controls ]`, `Esc` — and the box the same after each; then `Esc` leaves.
        await closeSheet(page);
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        await openSheet(page);
        // `[ controls ]` stays a toggle for assistive technology while the sheet covers it (FR-FULL-5): by the keyboard.
        await page.getByTestId('live-controls').focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
        await openSheet(page);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
        await expect(page.getByTestId('live-controls')).toBeFocused();
        await expect(page).toHaveURL(/#stars$/);
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        await page.keyboard.press('Escape');
        await expect(page).not.toHaveURL(/#stars/);
        await expect(layout).toHaveCount(0);
      });
    });
  }

  test.describe(`the whole sky from the sheet and the handoff at 390 × 844, ${locale}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('Whole sky from the sheet keeps the sheet and the box; the convention line and its toggle take the facing row; a pinch past the end hands over with the sheet closed (FR-CLEAN-4, FR-CLEAN-6)', async ({ page }) => {
      const words = WORDS[locale];
      await openStars(page, locale);
      const size = { width: 390, height: 844 };
      const chartBox = await expectBoxIsScreen(page, size, 'window');
      await openSheet(page);
      await viewRow(page).getByRole('button', { name: words.wholeSky }).click();
      await expect(chart(page)).toHaveAttribute('data-view', 'polar');
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
      await expect
        .poll(async () => {
          await page.clock.runFor(200);
          return page.getByTestId('stars-sky').locator('svg[data-drawing="polar"] [data-layer="stars"] [data-star]').count();
        }, { timeout: 30_000 })
        .toBeGreaterThan(0);
      expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
      expect(await scrolls(page)).toBe(false);
      // The polar chart's own rows in the sheet's facing row: the convention line, and the looking-up / map toggle on a tap.
      const facing = page.getByTestId('stars-facing');
      await expect(facing.getByTestId('chart-convention')).toBeVisible();
      await expect(page.getByTestId('sky-corner-readout')).toHaveCount(0);
      await page.getByTestId('sky-readout-toggle').click();
      const picker = page.getByTestId('stars-facing-picker');
      await picker.scrollIntoViewIfNeeded();
      await expect(picker.getByRole('group', { name: words.orientationGroup })).toBeVisible();
      await expect(page.getByRole('group', { name: words.facing })).toHaveCount(0);
      // `In this field` lists the whole sky's twelve brightest, stars and planets only.
      const list = page.getByRole('list', { name: words.field });
      await expect(list.getByRole('listitem')).toHaveCount(12);
      await expect(list.locator('[data-kind="pass"]')).toHaveCount(0);
      // Back to the window from the row, the sheet closed by the `×`: the readout is the corner's again.
      await viewRow(page).getByRole('button', { name: words.window }).click();
      await expect(chart(page)).toHaveAttribute('data-view', 'window');
      await closeSheet(page);
      await expect(windowRoot(page)).toHaveAttribute('data-state', 'hand');
      await expect(page.getByTestId('sky-corner-readout')).toBeVisible();
      expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
      // The handoff (FR-PHONE-10): a pinch past the window's widest field opens the whole sky with the sheet as it was, closed.
      await pinch(page.getByTestId('stars-sky').locator('div[data-dragging]'), 200, 100);
      await expect(chart(page)).toHaveAttribute('data-view', 'polar');
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
      await expect(page.getByTestId('sky-corner-readout')).toHaveCount(0);
      expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
      expect(await scrolls(page)).toBe(false);
    });
  });
}

test.describe('the turn with the sheet open (FR-CLEAN-6, FR-CLEAN-7)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('turning 390 × 844 → 844 × 390 → 390 × 844 keeps the view, the camera, the sheet and the picker, the box the viewport each time', async ({ page }) => {
    const layout = await openStars(page, 'en');
    await openSheet(page);
    await page.getByTestId('sky-readout-toggle').click();
    const picker = page.getByTestId('stars-facing-picker');
    await picker.scrollIntoViewIfNeeded();
    await picker.getByRole('button', { name: 'W', exact: true }).click();
    await expect(page.getByTestId('stars-page')).toHaveAttribute('data-look-az', '270');
    await page.getByTestId('sky-readout-toggle').click();
    await expect(picker).toBeVisible();
    const camera = async (): Promise<(string | null)[]> => [await windowRoot(page).getAttribute('data-look-az'), await windowRoot(page).getAttribute('data-look-alt'), await windowRoot(page).getAttribute('data-fov')];
    const before = await camera();
    for (const size of [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect(layout).toHaveAttribute('data-shape', 'full');
      await expectBoxIsScreen(page, size, `${String(size.width)} × ${String(size.height)}`);
      await expect(chart(page)).toHaveAttribute('data-view', 'window');
      expect(await camera()).toEqual(before);
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
      await expect(picker).toBeAttached();
      await expectSheetShape(page, size);
      await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    }
  });
});
