/**
 * R144 (FR-TONIGHT-1, FR-TONIGHT-2, FR-TONIGHT-4, FR-TONIGHT-9; US-42 AC1..AC5): tonight on the phone, by day
 * under a fixed clock. At 390 × 844, in both languages, a phone opens `#live` at local midday on the fixture night
 * with nothing visible up and tonight's passes ahead: the page waits for the stored run and lands one minute
 * before the first visible rise, playing at the automatic rate (the time track's thumb moves, the hash is not
 * written); a drag on the track to 03:00 pauses it there, with the hash carrying `t`; `[ next ]` lands a minute
 * before the next rise; `[ now ]` returns to real time, the bare route, and the visit stays on now. Under
 * reduced motion the jump lands paused. The rows are FR-TONIGHT-6's, the same throughout.
 *
 * The seed is `live-jump.spec.ts`'s: the stored run at Neuquén, the clock twelve hours after the run's instant
 * (15:51 UTC, 12:51 at Neuquén), the recompute let end on the home so the live page opens on the whole list.
 */
import { expect, test, type Page } from '@playwright/test';
import { TONIGHT_LEAD_MS } from '../../src/lib/tonightJump';
import { domeDrawn, NINE_DAYS_ON, pressTrackAt, recomputeEnded, seedStoredRun, shownOnTrack, stripFilled, trackBar } from './liveHelpers';

const HOUR = 3_600_000;
/** Twelve hours after the seed's instant: 15:51 UTC, 12:51 at Neuquén — by day, with tonight's passes ahead. */
const MIDDAY = NINE_DAYS_ON + 12 * HOUR;
/** 03:00 at Neuquén (UTC−3) the next morning: 06:00 UTC, inside the span. */
const THREE_AM = Date.UTC(2026, 8, 12, 6, 0, 0);
const PHONE = { width: 390, height: 844 };
const WORDS = {
  en: { tonight: 'tonight', next: 'next', now: 'now', play: 'Play', pause: 'Pause' },
  es: { tonight: 'noche', next: 'próximo', now: 'ahora', play: 'Reproducir', pause: 'Pausar' },
} as const;

async function openLiveAtMidday(page: Page, locale: 'en' | 'es'): Promise<void> {
  await seedStoredRun(page, { locale, settled: true });
  await page.clock.setFixedTime(MIDDAY);
  // The reload at midday starts a recompute whose first batch replaces the list for a moment: let it end on the
  // home, where the list says it is busy, then move to the live page by the hash alone, which starts no job.
  await page.reload();
  await recomputeEnded(page);
  await page.clock.install({ time: MIDDAY });
  await page.clock.pauseAt(MIDDAY);
  await page.evaluate(() => {
    window.location.hash = '#live';
  });
  await domeDrawn(page);
  await stripFilled(page);
}

/** The first visible rise after `now` in the span, read off the track's first tick (`<norad>-<rise ms>`, D-56). */
async function firstRise(page: Page): Promise<number> {
  const ticks = await trackBar(page).locator('[data-pass-tick]').evaluateAll((els) => els.map((el) => Number((el.getAttribute('data-pass-tick') ?? '').split('-')[1])));
  const ahead = ticks.filter((rise) => rise > MIDDAY).sort((a, b) => a - b);
  const first = ahead[0];
  if (first === undefined) throw new Error('the fixture night has no pass ahead of midday');
  return first;
}

for (const locale of ['en', 'es'] as const) {
  test.describe(`FR-TONIGHT at 390 × 844, ${locale}`, () => {
    test.use({ viewport: PHONE, hasTouch: true });

    test('opens by day on the first visible rise less a minute and plays; a drag to 03:00 pauses; next and now land where the spec says', async ({ page }) => {
      await openLiveAtMidday(page, locale);
      const words = WORDS[locale];
      const rise = await firstRise(page);
      const landing = rise - TONIGHT_LEAD_MS;

      // FR-TONIGHT-1 (US-42 AC1): the jump — `t` one minute before the first visible rise, playing, the chip ahead.
      await expect
        .poll(async () => {
          await page.clock.runFor(100);
          return page.getByTestId('live-play').getAttribute('data-playing');
        }, { timeout: 15_000 })
        .toBe('true');
      const shown = await shownOnTrack(page);
      // Playing at 60× near the pass: a second of the clock the poll ran is a minute of shown time at most.
      expect(shown - landing, `landed ${String(shown - landing)} ms after the lead instant`).toBeGreaterThanOrEqual(0);
      expect(shown - landing).toBeLessThan(5 * 60_000);
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
      await expect(page.getByTestId('live-state-mark')).toHaveAttribute('data-state', 'held');
      // While playing the hash is not written (D-171).
      await expect(page).toHaveURL(/#live$/);
      // FR-TONIGHT-5 (US-42 AC4): a second of wall time near the pass is a minute of shown time.
      const before = await shownOnTrack(page);
      await page.clock.runFor(1000);
      const after = await shownOnTrack(page);
      expect(after - before).toBeGreaterThan(50_000);
      expect(after - before).toBeLessThan(70_000);
      // `[ now ]` is enabled while held; the play control reads Pause.
      await expect(page.getByTestId('live-tap-now')).toBeEnabled();
      await expect(page.getByRole('button', { name: words.pause })).toBeVisible();
      // FR-TONIGHT-6 (US-42 AC5): the page's rows, the same list as watching renders (`live-compact.spec.ts` measures them).
      for (const id of ['live-headline', 'live-context', 'live-track', 'live-taps', 'live-actions', 'sky-readout-toggle']) await expect(page.getByTestId(id)).toBeVisible();
      for (const id of ['time-stripe', 'step-controls', 'playback-row', 'status-strip', 'next-event', 'live-scrub', 'live-now']) await expect(page.getByTestId(id)).toHaveCount(0);

      // FR-TONIGHT-3 (US-42 AC3): a drag on the track to 03:00 pauses there, within the track's pixel, and the hash carries `t`.
      await pressTrackAt(page, THREE_AM);
      await page.clock.runFor(600);
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      const dragged = await shownOnTrack(page);
      expect(Math.abs(dragged - THREE_AM), 'within the track’s resolution (24 h in 390 px)').toBeLessThan(10 * 60_000);
      await expect(page).toHaveURL(/#live\?lat=-38\.93&lon=-67\.99&alt=0&t=2026-09-12T0[56]:/);
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
      await expect(page.getByTestId('shown-time')).toContainText(/0[23]:[0-5]\d/);

      // FR-TONIGHT-4: `[ next ]` lands a minute before the first rise after `t` — paused, as it was.
      const ticks = await trackBar(page).locator('[data-pass-tick]').evaluateAll((els) => els.map((el) => Number((el.getAttribute('data-pass-tick') ?? '').split('-')[1])));
      const nextRise = ticks.filter((t) => t > dragged + TONIGHT_LEAD_MS).sort((a, b) => a - b)[0];
      await page.getByRole('button', { name: words.next, exact: true }).click();
      await page.clock.runFor(100);
      if (nextRise === undefined) {
        await expect(page.getByTestId('live-tap-next')).toBeDisabled();
      } else {
        expect(await shownOnTrack(page)).toBe(nextRise - TONIGHT_LEAD_MS);
        await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      }

      // `[ tonight ]` goes to tonight's first visible pass and plays (FR-TONIGHT-4).
      await page.getByRole('button', { name: words.tonight, exact: true }).click();
      await page.clock.runFor(100);
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'true');
      expect(await shownOnTrack(page)).toBeGreaterThanOrEqual(landing);
      expect(await shownOnTrack(page)).toBeLessThan(landing + 5 * 60_000);

      // FR-TONIGHT-4 (US-42 AC2): `[ now ]` returns to real time, stopped, the bare route, and the visit stays on now.
      await page.getByRole('button', { name: words.now, exact: true }).click();
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
      await expect(page.getByTestId('live-state-mark')).toHaveAttribute('data-state', 'live');
      await expect(page.getByTestId('live-tap-now')).toBeDisabled();
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      await page.clock.runFor(600);
      await expect(page).toHaveURL(/#live$/);
      // Nothing jumps again: two ticks of real time on, the page is still on now.
      await page.clock.runFor(21_000);
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
      // The context line by day with nothing up: the sky, the clouds and the next rise (FR-TONIGHT-7).
      await expect(page.getByTestId('context-line')).toHaveAttribute('data-kind', 'sky');
    });
  });
}

test.describe('FR-TONIGHT-2: reduced motion', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('the jump still sets t, and the page lands paused', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLiveAtMidday(page, 'en');
    const rise = await firstRise(page);
    await expect
      .poll(async () => {
        await page.clock.runFor(100);
        return shownOnTrack(page);
      }, { timeout: 15_000 })
      .toBe(rise - TONIGHT_LEAD_MS);
    await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
    await page.clock.runFor(1000);
    expect(await shownOnTrack(page)).toBe(rise - TONIGHT_LEAD_MS);
    // Paused, the hash carries the instant (FR-TONIGHT-1).
    await expect(page).toHaveURL(/#live\?lat=-38\.93&lon=-67\.99&alt=0&t=/);
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });
});
