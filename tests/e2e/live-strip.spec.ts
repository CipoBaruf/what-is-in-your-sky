/**
 * R213 (FR-STRIP-1, FR-STRIP-2, FR-STRIP-3, FR-STRIP-5, FR-DARK-3; US-63 AC1..AC3, US-62 AC4; D-1232): the next-pass
 * strip on a phone and on a desk, by day at Neuquén with nothing up and tonight's passes ahead
 * (`live-tonight.spec.ts`'s seed).
 */
import { expect, test, type Page } from '@playwright/test';
import { TONIGHT_LEAD_MS } from '../../src/lib/tonightJump';
import { domeDrawn, NINE_DAYS_ON, openSheet, recomputeEnded, seedStoredRun, shownOnTrack, stripFilled } from './liveHelpers';

/** 15:51 UTC, 12:51 at Neuquén. */
const MIDDAY = NINE_DAYS_ON + 12 * 3_600_000;
const SIZES = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true, prefs: { chartView: 'dome' } });
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
      return page.getByTestId('live-strip').getAttribute('data-kind');
    }, { timeout: 15_000 })
    .toBe('next');
}

for (const viewport of SIZES) {
  const wide = viewport.width >= 964;
  test.describe(`${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport, hasTouch: !wide });

    const shown = async (page: Page): Promise<number> => (wide ? Number(await page.getByTestId('time-stripe').getAttribute('aria-valuenow')) : shownOnTrack(page));

    test('US-62 AC4 (FR-STRIP-1, FR-STRIP-5): opening, no card and no dialog covers the sky; the strip is there, whole', async ({ page }) => {
      await openLive(page);
      await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
      await expect(page.getByTestId('live-card')).toHaveCount(0);
      // What is under the middle of the box is the sky's own.
      const box = await page.getByTestId('chart-box').boundingBox();
      if (!box) throw new Error('no box');
      const onSky = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-testid="live-dome"]') !== null, [box.x + box.width / 2, box.y + box.height / 2] as const);
      expect(onSky, 'the middle of the box is the sky').toBe(true);

      const strip = await page.getByTestId('live-strip').boundingBox();
      if (!strip) throw new Error('no strip');
      expect(strip.x).toBeGreaterThanOrEqual(0);
      expect(strip.x + strip.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(strip.y + strip.height).toBeLessThanOrEqual(viewport.height + 0.5);
      if (wide) {
        await expect(page.getByTestId('live-rail-head').getByTestId('live-strip')).toBeVisible();
        expect(strip.x, 'in the rail, beside the box').toBeGreaterThanOrEqual(box.x + box.width - 0.5);
      } else {
        // One text row at the box's foot, its button a target that lies on the screen and is the top thing there.
        expect(strip.height).toBeLessThanOrEqual(25);
        expect(strip.y).toBeGreaterThan(box.y + box.height - 48);
        const watch = await page.getByTestId('live-watch').boundingBox();
        if (!watch) throw new Error('no watch');
        expect(watch.height).toBeGreaterThanOrEqual(43.5);
        expect(watch.y + watch.height).toBeLessThanOrEqual(viewport.height + 0.5);
      }
      await page.getByTestId('live-watch').click({ trial: true });
    });

    test('US-63 AC1, AC2 (FR-STRIP-2, FR-STRIP-3): ▶ watch plays the pass, ● back to live returns to now', async ({ page }) => {
      await openLive(page);
      const strip = page.getByTestId('live-strip');
      if (wide) await expect(strip.getByTestId('next-event-label')).toHaveText(/^Next up · in /);
      else await expect(strip.getByTestId('strip-text')).toHaveText(/^Next +.+ · \d\d:\d\d( UTC)? · in \d+ h \d\d$/);
      const watch = strip.getByTestId('live-watch');
      await expect(watch).toHaveText('▶ watch');
      // The rise the strip offers: the headline's `[ see this pass ]` on a desk, the track's first tick ahead on a phone.
      const ticks = wide ? [] : await page.locator('[data-pass-tick]').evaluateAll((els) => els.map((el) => Number((el.getAttribute('data-pass-tick') ?? '').split('-')[1])));
      const rise = wide ? Number(await page.getByTestId('next-event-see').getAttribute('data-rise')) : Math.min(...ticks.filter((t) => t > MIDDAY));

      await watch.click();
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'true');
      const before = await shown(page);
      expect(before).toBeGreaterThanOrEqual(rise - TONIGHT_LEAD_MS);
      expect(before).toBeLessThan(rise + 4 * 60_000);
      // Playing at 60×: a second of the clock is a minute of the pass, on both shells this near the rise.
      await page.clock.runFor(1000);
      const moved = (await shown(page)) - before;
      expect(moved).toBeGreaterThan(50_000);
      expect(moved).toBeLessThan(70_000);
      if (wide) await expect(page.getByRole('group', { name: 'Playback speed' }).locator('[aria-pressed="true"]')).toHaveText('60×');

      const back = strip.getByTestId('live-now');
      await expect(back).toHaveText('● back to live');
      await back.click();
      await page.clock.runFor(600);
      await expect(page).toHaveURL(/#live$/);
      await expect(back).toHaveCount(0);
      if (wide) {
        // Real time at 1×, running: the clock's seconds move and the line ends `● live`.
        await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
        await expect(page.getByTestId('live-mark')).toHaveText('● live');
        const clock = await page.getByTestId('live-clock').textContent();
        await page.clock.runFor(2000);
        await expect(page.getByTestId('live-clock')).not.toHaveText(clock ?? '');
      } else {
        // Real time, paused at now.
        await expect(page.getByTestId('shown-chip')).toHaveText('● live');
        await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
        expect(Math.abs((await shown(page)) - MIDDAY)).toBeLessThan(20_000);
      }
    });

    test('US-63 AC3: leaving and coming back shows the strip again, and the second time asks nothing either', async ({ page }) => {
      await openLive(page);
      await page.evaluate(() => {
        window.location.hash = '';
      });
      await expect(page.getByTestId('live-page')).toHaveCount(0);
      await page.evaluate(() => {
        window.location.hash = '#live';
      });
      await domeDrawn(page);
      await expect(page.getByTestId('live-watch')).toBeVisible();
      await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
    });

    test('FR-DARK-3: at noon the context says satellites show after dusk', async ({ page }) => {
      await openLive(page);
      if (!wide) await openSheet(page);
      await expect(page.getByTestId('daytime-line')).toHaveText('Daytime · satellites show after dusk');
      await expect(page.getByTestId('daytime-line')).toBeInViewport();
    });
  });
}
