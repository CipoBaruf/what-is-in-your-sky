/**
 * R144 (FR-TONIGHT-1, FR-TONIGHT-2, FR-TONIGHT-4, FR-TONIGHT-9; US-42 AC1..AC5) → R148 (FR-FULL-7, FR-FULL-10 and
 * FR-TONIGHT-1, FR-TONIGHT-2, FR-TONIGHT-9 as amended v2.8; US-43 AC5): tonight on the phone, by day under a fixed
 * clock. At 390 × 844, in both languages, a phone opens `#live` at local midday on the fixture night with nothing
 * visible up and tonight's passes ahead: the page waits for the stored run and asks with the card — "Nothing visible
 * up now.", the first pass's name, its rise time and the chip, over `[ see next pass ]` `[ see now ]` — with `t` on
 * real time and nothing playing; `[ see next pass ]` lands one minute before the first visible rise, playing at the
 * automatic rate with the sheet closed (the time track's thumb moves, the hash is not written), and the head's chip
 * says how far that is from now; the sheet opened, a drag on the track to 03:00 pauses it there, with the hash
 * carrying `t`; `[ next ]` lands a minute before the next rise; `[ now ]` returns to real time and the bare route.
 * Under reduced motion `[ see next pass ]` lands paused. `[ see now ]` leaves real time alone and the card goes.
 *
 * The seed is `live-jump.spec.ts`'s: the stored run at Neuquén, the clock twelve hours after the run's instant
 * (15:51 UTC, 12:51 at Neuquén), the recompute let end on the home so the live page opens on the whole list.
 */
import { expect, test, type Page } from '@playwright/test';
import { TONIGHT_LEAD_MS } from '../../src/lib/tonightJump';
import { domeDrawn, NINE_DAYS_ON, openSheet, recomputeEnded, seedStoredRun, shownOnTrack, stripFilled, trackBar } from './liveHelpers';

const HOUR = 3_600_000;
/** Twelve hours after the seed's instant: 15:51 UTC, 12:51 at Neuquén — by day, with tonight's passes ahead. */
const MIDDAY = NINE_DAYS_ON + 12 * HOUR;
/** 03:00 at Neuquén (UTC−3) the next morning: 06:00 UTC, inside the span. */
const THREE_AM = Date.UTC(2026, 8, 12, 6, 0, 0);
const PHONE = { width: 390, height: 844 };
const WORDS = {
  en: { tonight: 'tonight', next: 'next', now: 'now', play: 'Play', pause: 'Pause', nothingUp: 'Nothing visible up now.', seeNext: 'see next pass', seeNow: 'see now' },
  es: { tonight: 'noche', next: 'próximo', now: 'ahora', play: 'Reproducir', pause: 'Pausa', nothingUp: 'Nada visible ahora.', seeNext: 'ver próximo pase', seeNow: 'ver ahora' },
} as const;

async function openLiveAtMidday(page: Page, locale: 'en' | 'es'): Promise<void> {
  await seedStoredRun(page, { locale, settled: true });
  await page.clock.setFixedTime(MIDDAY);
  // The reload at midday starts a recompute whose first batch replaces the list for a moment: let it end on the
  // home, where the list says it is busy, then move to the live page by the hash alone, which starts no job.
  await page.reload();
  await recomputeEnded(page);
  await page.clock.install({ time: MIDDAY });
  // A moment on, not at: the installed clock has already run for the install's own round trip.
  await page.clock.pauseAt(MIDDAY + 1_000);
  await page.evaluate(() => {
    window.location.hash = '#live';
  });
  await domeDrawn(page);
  await stripFilled(page);
}

/** A drag on the track from one instant to another: press, move in steps, release (FR-TONIGHT-3, D-909). */
async function dragTrack(page: Page, from: number, to: number): Promise<void> {
  const bar = trackBar(page);
  await bar.scrollIntoViewIfNeeded();
  const span = { start: Number(await bar.getAttribute('aria-valuemin')), end: Number(await bar.getAttribute('aria-valuemax')) };
  const box = await bar.boundingBox();
  if (!box) throw new Error('the time track has no box');
  const x = (t: number): number => box.x + (box.width * (t - span.start)) / (span.end - span.start);
  const y = box.y + box.height / 2;
  await page.mouse.move(x(from), y);
  await page.mouse.down();
  await page.mouse.move(x(to), y, { steps: 8 });
  await page.mouse.up();
}

/** The first visible rise after `now` in the span, read off the track's first tick (`<norad>-<rise ms>`, D-56). */
async function firstRise(page: Page): Promise<number> {
  const ticks = await trackBar(page).locator('[data-pass-tick]').evaluateAll((els) => els.map((el) => Number((el.getAttribute('data-pass-tick') ?? '').split('-')[1])));
  const ahead = ticks.filter((rise) => rise > MIDDAY).sort((a, b) => a - b);
  const first = ahead[0];
  if (first === undefined) throw new Error('the fixture night has no pass ahead of midday');
  return first;
}

/** The card, asked once the stored run's passes are known (FR-FULL-10); the clock is ticked until it stands. */
async function cardAsked(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      await page.clock.runFor(100);
      return page.getByTestId('live-card').getAttribute('data-kind');
    }, { timeout: 15_000 })
    .toBe('ask');
}

for (const locale of ['en', 'es'] as const) {
  test.describe(`FR-FULL-7, FR-FULL-10 at 390 × 844, ${locale}`, () => {
    test.use({ viewport: PHONE, hasTouch: true });

    test('opens by day on real time with the card; [ see next pass ] lands on the first visible rise less a minute and plays; a drag to 03:00 pauses; next and now land where the spec says', async ({ page }) => {
      await openLiveAtMidday(page, locale);
      const words = WORDS[locale];
      await cardAsked(page);
      const rise = await firstRise(page);
      const landing = rise - TONIGHT_LEAD_MS;
      test.info().annotations.push({ type: 'landing', description: `${locale}: the clock ${new Date(MIDDAY).toISOString()}, the first visible rise ${new Date(rise).toISOString()}, the landing ${new Date(landing).toISOString()}` });

      // FR-FULL-10 (US-43 AC5): the card over the sky — the sentence, the pass line, the two buttons — with `t` on real
      // time, nothing playing, the sheet closed, and focus on `[ see next pass ]`.
      const card = page.getByTestId('live-card');
      await expect(card).toContainText(words.nothingUp);
      await expect(card.getByTestId('live-card-pass')).toHaveText(/ · \d\d:\d\d · (in|en) \d+ h \d\d min$/);
      await expect(card.getByRole('button', { name: `[ ${words.seeNext} ]`, exact: true })).toBeFocused();
      await expect(card.getByRole('button', { name: `[ ${words.seeNow} ]`, exact: true })).toBeVisible();
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
      expect(Math.abs((await shownOnTrack(page)) - MIDDAY), 'real time, a few seconds of the clock on').toBeLessThan(10_000);
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
      await expect(page).toHaveURL(/#live$/);
      // The card stands above `[ controls ]`, centred across the box.
      const cardBox = await card.boundingBox();
      const controls = await page.getByTestId('live-controls').boundingBox();
      if (!cardBox || !controls) throw new Error('the card is not laid out');
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(controls.y + 0.5);
      expect(Math.abs(cardBox.x + cardBox.width / 2 - PHONE.width / 2)).toBeLessThanOrEqual(1);

      // FR-FULL-7 (US-43 AC5): `[ see next pass ]` — `t` one minute before the first visible rise, playing, the chip ahead,
      // the sheet still closed, and the focus on `[ controls ]` once the card is gone.
      await card.getByTestId('live-card-next').click();
      await expect(card).toHaveCount(0);
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
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'false');
      await expect(page.getByTestId('live-controls')).toBeFocused();
      // While playing the hash is not written (D-171).
      await expect(page).toHaveURL(/#live$/);
      // FR-TONIGHT-5 (US-42 AC4): a second of wall time near the pass is a minute of shown time.
      const before = await shownOnTrack(page);
      await page.clock.runFor(1000);
      const after = await shownOnTrack(page);
      expect(after - before).toBeGreaterThan(50_000);
      expect(after - before).toBeLessThan(70_000);

      // FR-FULL-4: the sheet, for the track and the taps. `[ now ]` is enabled while held; the play control reads Pause.
      await openSheet(page);
      await expect(page.getByTestId('live-tap-now')).toBeEnabled();
      await expect(page.getByRole('button', { name: words.pause })).toBeVisible();
      for (const id of ['live-context', 'live-track', 'live-taps', 'live-view-row', 'live-facing', 'live-actions']) await expect(page.getByTestId(id)).toBeVisible();
      for (const id of ['time-stripe', 'step-controls', 'playback-row', 'status-strip', 'next-event', 'live-scrub', 'live-now', 'live-headline', 'live-top-row']) await expect(page.getByTestId(id)).toHaveCount(0);

      // FR-TONIGHT-3 (US-42 AC3): a drag on the track to 03:00 pauses there, within the track's pixel, and the hash
      // carries `t`. A drag, not a press: 03:00 is inside the first pass's tick zone (44 px is three hours of the
      // track), where a press lands on that pass's lead instant (D-909). The drag starts an hour into the span, clear
      // of every tick, and every move past the slop sets `t` from x. The sheet stays open through it (FR-FULL-5).
      const ticks = await trackBar(page).locator('[data-pass-tick]').evaluateAll((els) => els.map((el) => Number((el.getAttribute('data-pass-tick') ?? '').split('-')[1])));
      const target = THREE_AM;
      await dragTrack(page, MIDDAY + HOUR, target);
      await page.clock.runFor(600);
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
      const dragged = await shownOnTrack(page);
      expect(Math.abs(dragged - target), 'within the track’s resolution (24 h in 390 px)').toBeLessThan(10 * 60_000);
      await expect(page).toHaveURL(/#live\?lat=-38\.93&lon=-67\.99&alt=0&t=2026-09-12T0[56]:/);
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
      await expect(page.getByTestId('shown-time')).toContainText(/0[56]:[0-5]\d/);

      // FR-TONIGHT-4: `[ next ]` lands a minute before the first rise after `t` — paused, as it was.
      const nextRise = ticks.filter((t) => t > dragged + TONIGHT_LEAD_MS).sort((a, b) => a - b)[0];
      await page.getByRole('button', { name: `[ ${words.next} ]`, exact: true }).click();
      await page.clock.runFor(100);
      if (nextRise === undefined) {
        await expect(page.getByTestId('live-tap-next')).toBeDisabled();
      } else {
        expect(await shownOnTrack(page)).toBe(nextRise - TONIGHT_LEAD_MS);
        await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      }

      // `[ tonight ]` goes to tonight's first visible pass and plays (FR-TONIGHT-4).
      await page.getByRole('button', { name: `[ ${words.tonight} ]`, exact: true }).click();
      await page.clock.runFor(100);
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'true');
      expect(await shownOnTrack(page)).toBeGreaterThanOrEqual(landing);
      expect(await shownOnTrack(page)).toBeLessThan(landing + 5 * 60_000);

      // FR-TONIGHT-4 as amended (US-42 AC2): `[ now ]` returns to real time, stopped, the bare route; the sheet stays open.
      await page.getByRole('button', { name: `[ ${words.now} ]`, exact: true }).click();
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
      await expect(page.getByTestId('live-tap-now')).toBeDisabled();
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      await expect(page.getByTestId('live-sheet')).toHaveAttribute('data-open', 'true');
      await page.clock.runFor(600);
      await expect(page).toHaveURL(/#live$/);
      // Nothing asks again: two ticks of real time on, the page is still on now with no card (the card is asked once per visit).
      await page.clock.runFor(21_000);
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
      await expect(page.getByTestId('live-card')).toHaveCount(0);
      // The context line by day with nothing up: the sky, the clouds and the next rise (FR-TONIGHT-7), in the sheet.
      await expect(page.getByTestId('context-line')).toHaveAttribute('data-kind', 'sky');
    });

    test('[ see now ] leaves real time alone and the card goes; Esc is the same answer', async ({ page }) => {
      await openLiveAtMidday(page, locale);
      const words = WORDS[locale];
      await cardAsked(page);
      await page.getByRole('button', { name: `[ ${words.seeNow} ]`, exact: true }).click();
      await expect(page.getByTestId('live-card')).toHaveCount(0);
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
      await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      await expect(page.getByTestId('live-controls')).toBeFocused();
      await page.clock.runFor(600);
      await expect(page).toHaveURL(/#live$/);
      // A fresh visit asks again (FR-FULL-10: never saved); `Esc` is `[ see now ]` and does not leave the page.
      await page.evaluate(() => {
        window.location.hash = '';
      });
      await expect(page.getByTestId('live-page')).toHaveCount(0);
      await page.evaluate(() => {
        window.location.hash = '#live';
      });
      await domeDrawn(page);
      await cardAsked(page);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('live-card')).toHaveCount(0);
      await expect(page.getByTestId('live-page')).toBeVisible();
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
    });
  });
}

test.describe('FR-TONIGHT-2 as amended: reduced motion', () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test('[ see next pass ] still sets t, and the page lands paused', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLiveAtMidday(page, 'en');
    await cardAsked(page);
    const rise = await firstRise(page);
    await page.getByTestId('live-card-next').click();
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
    await openSheet(page);
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });
});
