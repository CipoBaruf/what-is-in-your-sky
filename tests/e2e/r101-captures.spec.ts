/**
 * R101 captures (FR-JUMP-1, FR-JUMP-2; US-27 AC7): the live page watching by day, with `[ see this pass ]` on
 * the headline — at 390 × 844 on the path line, at 1280 × 800 on the path line of the 44-cell rail — in both
 * themes and both languages; and, in English on the dark theme, the page the tap opens: held at the rise.
 *
 *   CAPTURES=1 npx playwright test r101-captures --project=chromium
 *
 * Evidence for the PR, not a test. Off the pull-request path (FR-CI-1's budget), like every other capture spec.
 * The theme and the language are seeded in `wiys:prefs:v1` and never clicked (D-70).
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { domeDrawn, NINE_DAYS_ON, seedStoredRun, stripFilled } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

/** 12:51 at Neuquén, as `live-jump.spec.ts` opens it: by day, with tonight's first pass hours ahead. */
const MIDDAY = NINE_DAYS_ON + 12 * 3_600_000;

async function openLiveByDay(page: Page, locale: 'en' | 'es', theme: 'dark' | 'night'): Promise<void> {
  await seedStoredRun(page, { locale, prefs: { theme }, settled: true });
  await page.clock.setFixedTime(MIDDAY);
  await page.goto('/#live');
  await page.reload();
  await domeDrawn(page);
  await stripFilled(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByTestId('next-event-see')).toBeVisible();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
}

for (const [label, size] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
] as const) {
  test.describe(label, () => {
    test.use({ viewport: size, hasTouch: false });

    for (const theme of ['dark', 'night'] as const) {
      for (const locale of ['en', 'es'] as const) {
        test(`watching with [ see this pass ] at ${label}, ${theme}, ${locale}`, async ({ page }) => {
          await openLiveByDay(page, locale, theme);
          await page.screenshot({ path: `${CAPTURE_DIR}/r101-watching-${label}-${theme}-${locale}.png` });
        });
      }
    }

    test(`held at the rise at ${label}, dark, en`, async ({ page }) => {
      await openLiveByDay(page, 'en', 'dark');
      const rise = await page.getByTestId('next-event-see').getAttribute('data-rise');
      await page.getByTestId('next-event-see').click();
      await expect(page.getByTestId('time-stripe')).toHaveAttribute('aria-valuenow', rise ?? '');
      await page.clock.runFor(1000);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r101-held-at-rise-${label}-dark-en.png` });
    });
  });
}
