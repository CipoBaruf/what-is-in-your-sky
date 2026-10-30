/**
 * R150 (FR-GYRO-7, FR-GYRO-8, FR-GYRO-10, FR-GYRO-11; US-44 AC5, AC6): the compact live sheet, for the review. The
 * stored run at Neuquén under a clock at local midday, landed by `[ see next pass ]` a minute before tonight's first
 * visible rise, dark, both languages:
 *
 * - 390 × 844: the sheet open — the head with the `×`, the context line, the track and the taps, the view row
 *   `[Window] Polar Dome`, the facing row, `[ Share ]`; and scrolled to its end, "Satellites (n)" with the hidden
 *   toggle at its end and the list open under it.
 * - 844 × 390: the same bottom sheet on the landscape phone, at most `SHEET_MAX_SHARE` of the height, at its top and
 *   scrolled to the satellites.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { closeSheet, domeDrawn, NINE_DAYS_ON, openSheet, recomputeEnded, seedStoredRun, stripFilled } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', hasTouch: true });

const MIDDAY = NINE_DAYS_ON + 12 * 3_600_000;

async function landedAtMidday(page: Page, size: { width: number; height: number }, locale: 'en' | 'es'): Promise<void> {
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
  await page.clock.runFor(1500);
  await closeSheet(page);
  await openSheet(page);
  await page.clock.runFor(300);
  await page.mouse.move(0, 0);
}

async function toTheEnd(page: Page): Promise<void> {
  await page.getByTestId('sheet-body').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(page.getByTestId('live-satellites-head')).toBeInViewport();
  await page.clock.runFor(100);
}

for (const locale of ['en', 'es'] as const) {
  for (const [name, size] of [
    ['390', { width: 390, height: 844 }],
    ['844-landscape', { width: 844, height: 390 }],
  ] as const) {
    test(`${name}, ${locale}: the sheet open, at its top and at its end`, async ({ page }) => {
      await landedAtMidday(page, size, locale);
      await page.screenshot({ path: `${CAPTURE_DIR}/r150-live-${name}-sheet-dark-${locale}.png` });
      await toTheEnd(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r150-live-${name}-satellites-dark-${locale}.png` });
    });
  }
}
