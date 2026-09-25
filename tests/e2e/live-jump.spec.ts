/**
 * R101 (FR-JUMP-1, FR-JUMP-2; US-27 AC7; D-624): `[ see this pass ]` by day under a fixed clock. The reader opens
 * the live page at midday, the watching headline names tonight's first pass, and the one tap holds the page at
 * that pass's rise — FR-SPAN-4's landing, to the second — with the drawing showing its arc and the hash carrying
 * the held `t`; `[ back to live ]` (FR-LIVE-5's `now`) returns to watching and takes `t` off the URL.
 *
 * Two widths, one for each place `liveRows.ts` puts the control: a phone, where it is on the path line, and a
 * 1920 px desktop, where the path fills the rail's line and it stands beside `[ scrub the night ]`.
 */
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, NINE_DAYS_ON, recomputeEnded, seedStoredRun, stripFilled } from './liveHelpers';

/** Twelve hours after the seed's instant: 15:51 UTC, 12:51 at Neuquén — by day, with tonight's passes ahead. */
const MIDDAY = NINE_DAYS_ON + 12 * 3_600_000;
const iso = (t: number): string => new Date(t).toISOString().replace('.000Z', 'Z');

async function openLiveByDay(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.clock.setFixedTime(MIDDAY);
  // The reload at midday starts a recompute whose first batch replaces the list for a moment, and
  // with it the headline's pass: a control read then and clicked after lands on another rise. Let
  // it end on the home, where the list says it is busy, then move to the live page by the hash
  // alone, which starts no job.
  await page.reload();
  await recomputeEnded(page);
  await page.evaluate(() => {
    window.location.hash = '#live';
  });
  await domeDrawn(page);
  await stripFilled(page);
}

for (const [width, height, where] of [
  [390, 844, 'next-event-path'],
  [1920, 1080, 'live-actions'],
] as const) {
  test.describe(`${String(width)} × ${String(height)}`, () => {
    test.use({ viewport: { width, height }, hasTouch: false });

    test('by day, [ see this pass ] holds the page at the pass’s rise with its arc drawn, the hash carries t, and [ back to live ] returns (FR-JUMP-1, FR-JUMP-2)', async ({ page }) => {
      await openLiveByDay(page);
      // By day, watching: the sky word says so, and the headline counts to a rise hours ahead.
      await expect(page.getByTestId('live-sky')).toContainText(/day/i);
      await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
      await expect(page.getByTestId('next-event-label')).toHaveAttribute('data-kind', 'rise');
      const control = page.getByTestId('next-event-see');
      await expect(control).toBeVisible();
      await expect(control).toHaveText('see this pass');
      // Where `liveRows.ts` put it at this width (D-624).
      await expect(page.getByTestId(where).getByTestId('next-event-see')).toHaveCount(1);
      const rise = Number(await control.getAttribute('data-rise'));
      const passId = (await control.getAttribute('data-pass')) ?? '';
      expect(rise - MIDDAY, 'the rise is more than two minutes and less than a day ahead').toBeGreaterThan(120_000);
      expect(rise - MIDDAY).toBeLessThanOrEqual(24 * 3_600_000);
      // Nothing of the pass is drawn at midday.
      const arc = page.getByTestId('live-dome').locator(`[data-drawing] [data-pass-id="${passId}"]`);
      await expect(arc).toHaveCount(0);

      await control.click();
      // Scrubbing, held at the rise to the second: the stripe's instant, the hash, and the control gone with the state.
      await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'held');
      const stripe = page.getByTestId('time-stripe');
      await expect(stripe).toHaveAttribute('aria-valuenow', String(rise));
      await expect(page.getByTestId('next-event-see')).toHaveCount(0);
      await page.clock.runFor(1000);
      expect(await page.evaluate(() => window.location.hash)).toMatch(new RegExp(`^#live\\?.*&t=${iso(rise)}$`));
      // The drawing shows its arc.
      await expect.poll(() => arc.count(), { timeout: 30_000 }).toBeGreaterThan(0);
      // The same second `pass ▶|` lands on (FR-SPAN-4): one minute back, then the step to the next rise.
      await page.getByTestId('step-controls').locator('[data-step="-1m"]').click();
      await expect(stripe).toHaveAttribute('aria-valuenow', String(rise - 60_000));
      await page.getByTestId('step-controls').locator('[data-step="next-rise"]').click();
      await expect(stripe).toHaveAttribute('aria-valuenow', String(rise));

      // `[ back to live ]`: watching again, the stripe gone, the URL the bare route, and the control back.
      await page.getByTestId('live-now').click();
      await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
      await expect(stripe).toHaveCount(0);
      await page.clock.runFor(1000);
      expect(await page.evaluate(() => window.location.hash)).toBe('#live');
      await expect(page.getByTestId('next-event-see')).toBeVisible();
    });
  });
}
