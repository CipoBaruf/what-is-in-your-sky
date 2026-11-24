/**
 * R163 (FR-CLEAN-1..4, FR-CLEAN-6, FR-CLEAN-7, FR-CLEAN-11; PLAN D-997, D-999, D-1001, D-1004): the full form on the
 * production build. The stars page's cases went with the page in R222 (FR-LAND-3, D-1240); the Spanish layers
 * (D-1249) are read on the live page's sheet, and R164's pass detail `describe` follows: see its note further down.
 *
 *   npx playwright test clean-sky --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SHEET_MAX_SHARE } from '../../src/lib/layout';
import { openSheet, seedStoredRun } from './liveHelpers';
import { openLiveSky } from './globeHelpers';

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

/**
 * R164: the pass detail stands over the home, which stays in the document under it, inert (D-117), so the document's
 * height is the home's, and its scroll offset is the home's, kept for the return; the page does not scroll because
 * the root is locked (`overflow: hidden`) and the detail is fixed to the viewport — what is read is that lock, the
 * offset where it was when the detail opened (`openDetail` writes it on the root) and no overflow across.
 */
const detailScrolls = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const root = document.documentElement;
    return getComputedStyle(root).overflow !== 'hidden' || String(window.scrollY) !== root.dataset['detailY'] || root.scrollWidth > root.clientWidth + 1;
  });

/** FR-CLEAN-1: `chart-box` is the viewport, inside 1 px, and the page does not scroll. */
async function expectBoxIsScreen(page: Page, size: { width: number; height: number }, what: string, scrolled = scrolls): Promise<Box> {
  const found = await box(page.getByTestId('chart-box'));
  expect(Math.abs(found.x), `${what}: left edge`).toBeLessThanOrEqual(1);
  expect(Math.abs(found.y), `${what}: top edge`).toBeLessThanOrEqual(1);
  expect(Math.abs(found.x + found.width - size.width), `${what}: right edge`).toBeLessThanOrEqual(1);
  expect(Math.abs(found.y + found.height - size.height), `${what}: bottom edge`).toBeLessThanOrEqual(1);
  expect(await scrolled(page), `${what}: the page scrolls`).toBe(false);
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

for (const width of [320, 360]) {
  test.describe(`the Spanish layers at ${String(width)} px (FR-CLEAN-11, D-1249)`, () => {
    test.use({ viewport: { width, height: 640 }, hasTouch: true });

    test(`three stand on the first row and never widen the sheet's body (${width === 360 ? 'one line' : 'wrapped'})`, async ({ page }) => {
      // R222 (FR-LAND-3): the layers are the live page's now; its sheet holds them.
      await openLiveSky(page, { locale: 'es' });
      await openSheet(page);
      const first = page.getByTestId('stars-layers-row').first();
      await expect(first.getByRole('button')).toHaveText(['estrellas', 'figuras', 'planetas']);
      const body = await page.getByTestId('sheet-body').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(body, 'the sheet scrolls sideways').toBeLessThanOrEqual(0);
      const lines = await first.evaluate((el) => new Set([...el.children].map((child) => Math.round(child.getBoundingClientRect().top))).size);
      expect(lines).toBe(width === 360 ? 1 : 2);
    });
  });
}

/*
 * R164 (FR-CLEAN-1..3, FR-CLEAN-5..7; US-49 AC1..AC5; PLAN D-998, D-999, D-1001, D-1012..D-1014): the pass detail in
 * the full form, at the same five sizes in both languages, on a touch phone. Opened from the first card of the stored
 * run; the stored run has a place and so a run of passes, the forecast down (UTC stamps).
 *
 * - The box is the screen with the sheet closed, open, open with the picker and on the dome (FR-CLEAN-1, FR-CLEAN-6).
 * - The head reads `[ ← ]`, the countdown in the head's phase words and the pass's name as its chip; the h1 is hidden;
 *   the corner readout stands under the head's row with the landmark line; the overlay sums under its share at the
 *   two 390 sizes (FR-CLEAN-2, FR-CLEAN-3).
 * - The sheet holds FR-CLEAN-5's groups in order, the times row and the table's `Among` column inside its scrolling
 *   body, the dome picked from the view row with the sheet kept open; `Esc` closes the sheet, a second closes the guide.
 */
/**
 * FR-CLEAN-3 as amended (D-1014): the pass detail's overlay — a head as wide as the box (the countdown at the heading
 * size and the name's chip) and the readout's two lines — is measured against its own ceiling, 0.17 of the box at
 * 390 × 844 and 390 × 667, not `FULL_OVERLAY_MAX_SHARE`'s 0.12, which binds the live page.
 */
const DETAIL_OVERLAY_MAX_SHARE = 0.17;

const DETAIL_WORDS = {
  en: { head: /^(Appears in|Peak in|Ends in) \d+:\d\d(:\d\d)?$/, among: 'Among', dome: 'Dome', facing: 'Facing' },
  es: { head: /^(Aparece en|Máximo en|Termina en) \d+:\d\d(:\d\d)?$/, among: 'Entre', dome: 'Domo', facing: 'Mirando' },
} as const;

/** The first card's guide, on the stored run (`seedStoredRun`), its window drawn. */
async function openDetail(page: Page, locale: Locale): Promise<Locator> {
  // A fresh profile's view (`chartView: undefined`): the phone opens on the window (FR-FLOW-14).
  await seedStoredRun(page, { locale, settled: true, prefs: { chartView: undefined } });
  await page.locator('article[data-pass-id]').first().getByRole('button').first().click();
  const layout = page.getByTestId('pass-layout');
  await expect(layout).toHaveAttribute('data-shape', 'full');
  await expect(page.locator('[role="dialog"][data-pass-id]').locator('[data-look-az][data-fov]')).toBeAttached({ timeout: 15_000 });
  await page.evaluate(() => {
    document.documentElement.dataset['detailY'] = String(window.scrollY);
  });
  return layout;
}

for (const locale of LOCALES) {
  for (const size of [...PORTRAIT, ...TURNED]) {
    test.describe(`the pass detail in the full form at ${String(size.width)} × ${String(size.height)}, ${locale}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

      test('the box is the screen, the head with the countdown, the overlay under its share, the sheet in order with the times and the table, the dome, and Esc twice (FR-CLEAN-1..3, FR-CLEAN-5, FR-CLEAN-6)', async ({ page }) => {
        const words = DETAIL_WORDS[locale];
        await openDetail(page, locale);
        const dialog = page.locator('[role="dialog"][data-pass-id]');
        await expect(chart(page)).toHaveAttribute('data-view', 'window');
        const chartBox = await expectBoxIsScreen(page, size, 'closed', detailScrolls);

        // FR-CLEAN-2: the h1 hidden, the head over the sky.
        const h1 = dialog.locator('h1');
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveAttribute('data-visually-hidden', '');
        const name = (await h1.textContent()) ?? '';
        const head = page.getByTestId('live-head');
        await expect(head.getByTestId('live-back')).toBeVisible();
        await expect(head.getByRole('timer')).toHaveText(words.head);
        await expect(head.getByTestId('pass-head-chip')).toHaveText(name);
        const headBox = await box(head);
        expect(headBox.x).toBeLessThan(size.width / 4);
        expect(headBox.x + headBox.width).toBeLessThanOrEqual(size.width + 0.5);
        // The countdown is drawn whole: only the chip gives.
        const count = await head.getByRole('timer').evaluate((el) => el.getBoundingClientRect().right);
        expect(count).toBeLessThanOrEqual(headBox.x + headBox.width + 0.5);
        // The corner readout under the head's row, at the right, with the landmark line.
        const corner = page.getByTestId('sky-corner-readout');
        await expect(corner.getByTestId('window-readout')).toBeVisible();
        const readout = await lineBox(page);
        expect(readout.y, 'under the head').toBeGreaterThanOrEqual(headBox.y + headBox.height - 0.5);
        expect(readout.x + readout.width).toBeLessThanOrEqual(size.width + 0.5);
        const landmark = corner.getByTestId('pass-corner-landmark');
        const landmarkBox = (await landmark.count()) > 0 ? await box(landmark) : null;
        // FR-CLEAN-3: `[ follow ]` then `[ controls ]`, and the hint.
        const row = page.getByTestId('live-bottom-row');
        expect(await row.evaluate((el) => [...el.children].map((child) => child.getAttribute('data-testid')))).toEqual(['live-follow-control', 'live-controls']);
        const follow = await box(page.getByTestId('live-follow-control'));
        const controls = await box(page.getByTestId('live-controls'));
        const hintBox = await box(page.getByTestId('sky-hint'));
        const parts = [headBox, readout, follow, controls, hintBox, ...(landmarkBox ? [landmarkBox] : [])];
        const share = parts.reduce((sum, part) => sum + part.width * part.height, 0) / (size.width * size.height);
        const dims = (part: Box): string => `${String(Math.round(part.width))}×${String(Math.round(part.height))}`;
        const overlayNote = `${locale} ${String(size.width)}×${String(size.height)}: ${share.toFixed(3)} of the box (head ${dims(headBox)}, readout ${dims(readout)}, landmark ${landmarkBox ? dims(landmarkBox) : 'none'}, row ${String(Math.round(follow.width + controls.width))}×${String(Math.round(controls.height))}, hint ${dims(hintBox)})`;
        test.info().annotations.push({ type: 'overlay', description: overlayNote });
        console.log(`[FR-CLEAN-3 detail] ${overlayNote}`);
        if (size.width === 390) expect(share, `the overlay covers ${share.toFixed(3)} of the box`).toBeLessThanOrEqual(DETAIL_OVERLAY_MAX_SHARE);

        // FR-CLEAN-5: the sheet's groups in order, the box unmoved.
        await openSheet(page);
        expect(await sheetOrder(page)).toEqual(['pass-head', 'pass-times-row', 'pass-view-row', 'pass-follow', 'pass-facing', 'pass-share', 'pass-prose', 'app-footer']);
        // FR-CLEAN-5, FR-CTRL-2: where `stars` wraps under the views the row grows by its line, so the option's block is over no row under it.
        const spill = await page.getByTestId('pass-view-row').evaluate((el) => Math.max(...[...el.children].map((child) => child.getBoundingClientRect().bottom)) - el.getBoundingClientRect().bottom);
        expect(spill, 'the view row holds its wrapped line').toBeLessThanOrEqual(0.5);
        await expect(page.getByTestId('pass-name-line')).toHaveText(new RegExp(`^${name.replace(/[()]/g, '\\$&')} · \\d{4}-\\d\\d-\\d\\d · UTC$`));
        await expect(dialog.getByRole('timer')).toHaveCount(1);
        const sheet = await expectSheetShape(page, size);
        const body = page.getByTestId('sheet-body');
        await expect(body.getByTestId('pass-times')).toBeAttached();
        await expect(body.getByRole('columnheader', { name: words.among })).toBeAttached();
        const sheetNote = `${locale} ${String(size.width)}×${String(size.height)}: ${String(Math.round(sheet.height))} px with the table (${(sheet.height / size.height).toFixed(2)} of ${String(size.height)})`;
        test.info().annotations.push({ type: 'sheet', description: sheetNote });
        console.log(`[FR-CLEAN-5] ${sheetNote}`);
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        expect(await detailScrolls(page)).toBe(false);
        // The facing row opens the window's picker under it; a pick closes it and keeps the sheet.
        await page.getByTestId('sky-readout-toggle').click();
        const picker = page.getByTestId('pass-facing-picker');
        await picker.scrollIntoViewIfNeeded();
        await expect(picker.getByRole('group', { name: words.facing })).toBeVisible();
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        await picker.getByRole('button', { name: 'NE' }).click();
        await expect(picker).toHaveCount(0);
        await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
        // The dome from the view row, the sheet kept open, the box unmoved.
        await page.getByTestId('pass-view-row').getByRole('button', { name: words.dome }).click();
        await expect(chart(page)).toHaveAttribute('data-view', 'dome');
        await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
        await expect(dialog.locator('[data-drawing="dome"]')).toBeAttached({ timeout: 30_000 });
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        expect(await detailScrolls(page)).toBe(false);

        // FR-CLEAN-6: `Esc` closes the sheet and keeps the guide; a second closes the guide.
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
        await expect(page.getByTestId('live-controls')).toBeFocused();
        await expect(page).toHaveURL(/#pass=/);
        expect(await box(page.getByTestId('chart-box'))).toEqual(chartBox);
        await page.keyboard.press('Escape');
        await expect(page).not.toHaveURL(/#pass=/);
        await expect(dialog).toHaveCount(0);
      });
    });
  }
}

test.describe('the pass detail turned with the sheet open (FR-CLEAN-6, FR-CLEAN-7)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('turning 390 × 844 → 844 × 390 → 390 × 844 keeps the view, the sheet and the picker, the box the viewport each time', async ({ page }) => {
    const layout = await openDetail(page, 'en');
    await openSheet(page);
    await page.getByTestId('pass-view-row').getByRole('button', { name: 'Polar' }).click();
    await expect(chart(page)).toHaveAttribute('data-view', 'polar');
    await page.getByTestId('sky-readout-toggle').click();
    const picker = page.getByTestId('pass-facing-picker');
    await expect(picker).toBeAttached();
    for (const size of [
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect(layout).toHaveAttribute('data-shape', 'full');
      // The home under the detail re-lays out at the new size and its kept offset moves with it: the lock is what is read.
      await page.evaluate(() => {
        document.documentElement.dataset['detailY'] = String(window.scrollY);
      });
      await expectBoxIsScreen(page, size, `${String(size.width)} × ${String(size.height)}`, detailScrolls);
      await expect(chart(page)).toHaveAttribute('data-view', 'polar');
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
      await expect(picker).toBeAttached();
      await expectSheetShape(page, size);
    }
  });
});
