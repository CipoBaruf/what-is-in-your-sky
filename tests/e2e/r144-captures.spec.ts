/**
 * R144 (FR-TONIGHT-1, FR-TONIGHT-6, FR-TONIGHT-9, FR-FLOW-15; US-42): the compact live page's one inventory, for
 * the review. The stored run at Neuquén under a clock at local midday (`live-tonight.spec.ts`'s seed), dark:
 *
 * - 390 × 844, en and es: the page after the jump, paused a minute before tonight's first visible rise — the shown
 *   time and its chip, the context line, the view row, the drawing with the readout in its corner, the hint, the
 *   track, the taps and `[ list (n) ] Share`.
 * - 390 × 667, en and es: the same rows, the box at least 280 px (FR-TONIGHT-9).
 * - 390 × 844, en: the list open, the hidden-objects toggle in its head (D-905); the window with the facing picker
 *   opened from the corner readout (D-904).
 * - 844 × 390, en: the landscape phone, the same slots in its rail (FR-FLOW-15).
 * - 1280 × 800, en: wide, unchanged (FR-TONIGHT-10).
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { closeSheet, domeDrawn, NINE_DAYS_ON, openSheet, recomputeEnded, seedStoredRun, stripFilled } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', hasTouch: true });

const MIDDAY = NINE_DAYS_ON + 12 * 3_600_000;
const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;

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
  if (size.width < 900) {
    await stripFilled(page);
    // R153: since v2.8 the day's page asks with its card rather than jumping (FR-FULL-10); `landed` answers it.
    await expect
      .poll(async () => {
        await page.clock.runFor(100);
        return page.getByTestId('live-card').getAttribute('data-kind');
      }, { timeout: 15_000 })
      .toBe('ask');
  }
}

/**
 * After the jump: paused where it landed, so the capture is one instant. R153: the jump is the card's
 * `[ see next pass ]` since v2.8 (FR-FULL-10), and the pause is in the sheet (FR-FULL-4), closed again for the shot
 * (`r148-captures.spec.ts`'s route).
 */
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
  for (const height of [844, 667] as const) {
    test(`390 × ${String(height)}, ${locale}: after the jump`, async ({ page }) => {
      await openAtMidday(page, { width: 390, height }, locale);
      await landed(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r144-live-390x${String(height)}-tonight-dark-${locale}.png` });
    });
  }
}

test('390 × 844, en: the list open, the hidden toggle in its head', async ({ page }) => {
  await openAtMidday(page, { width: 390, height: 844 }, 'en');
  await landed(page);
  // R153 (FR-GYRO-10): the list is the sheet's open satellites now, with no `[ list (n) ]` to press (R150).
  await openSheet(page);
  await page.getByTestId('live-satellites').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('live-satellites-head')).toBeVisible();
  await page.clock.runFor(300);
  await page.screenshot({ path: `${CAPTURE_DIR}/r144-live-390-list-dark-en.png` });
});

test('390 × 844, en: the window, the picker opened from the corner readout', async ({ page }) => {
  await openAtMidday(page, { width: 390, height: 844 }, 'en');
  await landed(page);
  // R153: the view row and the facing row are the sheet's since v2.8 (FR-FULL-4).
  await openSheet(page);
  await page.getByRole('group', { name: VIEW_GROUP.en }).getByRole('button', { name: 'Window' }).click();
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.getByTestId('window-readout').count();
    }, { timeout: 30_000 })
    .toBe(1);
  await page.getByTestId('sky-readout-toggle').click();
  // R153: the facing row, its readout and the picker it opens are the sheet's `live-facing` since v2.8.
  await expect(page.getByTestId('sky-readout-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.getByTestId('live-facing').scrollIntoViewIfNeeded();
  await page.clock.runFor(300);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${CAPTURE_DIR}/r144-live-390-picker-window-dark-en.png` });
});

test('844 × 390, en: the landscape phone', async ({ page }) => {
  await openAtMidday(page, { width: 844, height: 390 }, 'en');
  await landed(page);
  // R153: no rail to scroll back since v2.8 — the turned phone is all sky with the sheet closed (FR-FULL-1, FR-GYRO-7).
  await page.screenshot({ path: `${CAPTURE_DIR}/r144-live-844-landscape-dark-en.png` });
});

test('1280 × 800, en: wide, unchanged', async ({ page }) => {
  await openAtMidday(page, { width: 1280, height: 800 }, 'en');
  await page.clock.runFor(1000);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${CAPTURE_DIR}/r144-live-1280-dark-en.png` });
});
