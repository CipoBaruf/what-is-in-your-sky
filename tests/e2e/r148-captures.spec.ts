/**
 * R148 (FR-FULL-1..7, FR-FULL-10; US-43): the compact live page as the full sky, for the review. The stored run at
 * Neuquén under a clock at local midday (`live-tonight.spec.ts`'s seed), dark, both languages:
 *
 * - 390 × 844: the page as it opens — the sky, the head, `[ controls ]`, the hint and the card asking (FR-FULL-10).
 * - 390 × 844: after `[ see next pass ]`, paused a minute before tonight's first visible rise — the sheet closed,
 *   the whole screen sky, the head's chip saying how far ahead (FR-FULL-7).
 * - 390 × 844: the sheet open with the list open — the context line, the track and the taps, the view row, the
 *   facing row, `[ list (n) ] [ Share ]` and the list panel, over the sky (FR-FULL-4).
 * - 844 × 390: the landscape phone, the sheet closed and the side sheet open (FR-FULL-4).
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { closeSheet, domeDrawn, NINE_DAYS_ON, openSheet, recomputeEnded, seedStoredRun, stripFilled } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', hasTouch: true });

const MIDDAY = NINE_DAYS_ON + 12 * 3_600_000;

async function openAtMidday(page: Page, size: { width: number; height: number }, locale: 'en' | 'es'): Promise<void> {
  await page.setViewportSize(size);
  await seedStoredRun(page, { locale, settled: true });
  await page.clock.setFixedTime(MIDDAY);
  await page.reload();
  await recomputeEnded(page);
  await page.clock.install({ time: MIDDAY });
  await page.clock.pauseAt(MIDDAY + 1_000);
  await page.evaluate(() => {
    window.location.hash = '#live';
  });
  await domeDrawn(page);
  await stripFilled(page);
  await expect
    .poll(async () => {
      await page.clock.runFor(100);
      return page.getByTestId('live-card').getAttribute('data-kind');
    }, { timeout: 15_000 })
    .toBe('ask');
  await page.mouse.move(0, 0);
}

/** `[ see next pass ]`, then paused where it landed, so the capture is one instant. */
async function landed(page: Page): Promise<void> {
  await page.getByTestId('live-card-next').click();
  const play = page.getByTestId('live-play');
  await expect
    .poll(async () => {
      await page.clock.runFor(100);
      return play.getAttribute('data-playing');
    }, { timeout: 15_000 })
    .toBe('true');
  await openSheet(page);
  await play.click();
  await expect(play).toHaveAttribute('data-playing', 'false');
  // The sky word follows `t` at most once a second of wall time (FR-LIVE-5): a second and a half for it to catch up.
  await page.clock.runFor(1500);
  await closeSheet(page);
  await page.mouse.move(0, 0);
}

for (const locale of ['en', 'es'] as const) {
  test(`390 × 844, ${locale}: the card as the page opens`, async ({ page }) => {
    await openAtMidday(page, { width: 390, height: 844 }, locale);
    await page.screenshot({ path: `${CAPTURE_DIR}/r148-live-390-card-dark-${locale}.png` });
  });

  test(`390 × 844, ${locale}: after [ see next pass ], the sheet closed; then the sheet open with the list`, async ({ page }) => {
    await openAtMidday(page, { width: 390, height: 844 }, locale);
    await landed(page);
    await page.screenshot({ path: `${CAPTURE_DIR}/r148-live-390-closed-dark-${locale}.png` });
    await openSheet(page);
    await page.getByTestId('live-legend-toggle').click();
    await expect(page.getByTestId('live-list-head')).toBeVisible();
    await page.clock.runFor(300);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r148-live-390-sheet-dark-${locale}.png` });
  });

  test(`844 × 390, ${locale}: the landscape phone, the sheet closed and the side sheet open`, async ({ page }) => {
    await openAtMidday(page, { width: 844, height: 390 }, locale);
    await landed(page);
    await page.screenshot({ path: `${CAPTURE_DIR}/r148-live-844-landscape-closed-dark-${locale}.png` });
    await openSheet(page);
    await page.clock.runFor(300);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r148-live-844-landscape-sheet-dark-${locale}.png` });
  });
}
