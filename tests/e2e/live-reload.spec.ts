/**
 * R58 (FR-LIVE-11, F-56, D-280): a `#live` link for the place the store
 * already holds is not a new observer, so the drawn set survives a click on
 * the stripe and a reload of the link it writes into the hash (FR-LIVE-9).
 *
 * The saved observer here is geocoded — a real label, a real zone — rather
 * than the coordinates-only kind: a coordinates-sourced saved observer at the
 * same place rebuilds identically to the one a `#live?lat=…` link would set
 * (`observerFromLink`'s shape), so it could never show the defect.
 *
 * The click lands on a pass the seeded run actually has in the first 24 h
 * (`tests/fixtures/stored-run-neuquen.json`), by the fraction *read off the
 * stripe itself* rather than assumed from the fixed clock — the chart chunk's
 * own loading timers (`liveHelpers.domeDrawn`'s doc) can nudge `now` on by an
 * unpredictable amount before the page settles, and a fraction computed
 * against the wrong span would miss the pass's few-minute window.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { HASH_EVERY_MS } from '../../src/lib/playback';
import { isoInstant } from '../../src/lib/shareLinks';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

const GEOCODED = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquén, Argentina', source: 'geocode' as const, timeZone: 'America/Argentina/Buenos_Aires' };
const DAY_MS = 86_400_000;

interface StoredPass {
  noradId: number;
  start: { t: number };
  end: { t: number };
}
const storedPasses = (JSON.parse(readFileSync('tests/fixtures/stored-run-neuquen.json', 'utf8')) as { passes: StoredPass[] }).passes;

/** Presses a row `fraction` of the way along and lets go (`live-playback.spec.ts`'s helper). */
async function press(page: Page, testId: string, fraction: number): Promise<void> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

/**
 * R70 (FR-SPAN-1): the window the stripe actually draws — the four hours that hold the shown
 * instant, clipped to the span — which is what its segments are drawn from and what a click on it
 * is a fraction of. The whole span is the overview's row (`stripe-overview`) and `aria-valuemin`.
 */
async function drawnWindow(page: Page): Promise<{ start: number; end: number }> {
  const stripe = page.getByTestId('time-stripe');
  return { start: Number(await stripe.getAttribute('data-drawn-start')), end: Number(await stripe.getAttribute('data-drawn-end')) };
}

/** The stripe's own span start (`aria-valuemin`), whatever `now` actually settled on. */
async function spanStart(page: Page): Promise<number> {
  return Number(await page.getByTestId('time-stripe').getAttribute('aria-valuemin'));
}

/**
 * The recompute the stored run kicks off (R24) replaces the list with one object's passes at a
 * time, which drops the stripe's segment count for a beat after the dome and the strip first
 * report ready and only recovers it over several real round trips to the worker — a plain
 * `for`-loop of fake-clock ticks returns almost immediately in real time and never gives those
 * round trips a chance to land (they run on the real clock regardless of the installed one).
 * `expect.poll` retries on the real clock instead, the same way `domeDrawn` waits out the chart
 * chunk's own timers, and nudges the fake clock forward on each turn so nothing sat behind it stalls.
 */
async function settledSegmentCount(page: Page): Promise<number> {
  const segments = page.getByTestId('time-stripe').locator('[data-pass-segment]');
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      // R70 (FR-SPAN-1): the stripe draws a chunk of the span, so what it has settled at is the set
      // inside the drawn window and not the day's — the set itself is FR-LIVE-11's and unchanged.
      const window_ = await drawnWindow(page);
      const expected = storedPasses.filter((pass) => pass.start.t <= window_.end && pass.end.t >= window_.start).length;
      return (await segments.count()) === expected;
    }, { timeout: 30_000 })
    .toBe(true);
  return segments.count();
}

/** The seeded run's earliest pass with the whole of its live window still ahead of `min` — comfortable click room either side of its rise. */
function firstFullPassAfter(min: number): StoredPass {
  const candidates = storedPasses.filter((pass) => pass.start.t > min + 60_000 && pass.end.t <= min + DAY_MS).sort((a, b) => a.start.t - b.start.t);
  const found = candidates[0];
  if (!found) throw new Error(`no pass with a full live window between ${String(min)} and +24 h`);
  return found;
}

interface Counts {
  arcId: string | null;
  segmentCount: number;
  satellites: number;
}

/** The pass id at the dome's one live arc (there is only ever one at a time for one ground station), the stripe's segment count, and the strip's count. */
async function counts(page: Page, passId: string): Promise<Counts> {
  const dome = page.getByTestId('live-dome');
  const arc = dome.locator(`[data-drawing] [data-pass-id="${passId}"]`);
  const arcId = (await arc.count()) > 0 ? passId : null;
  const segmentCount = await page.getByTestId('time-stripe').locator('[data-pass-segment]').count();
  const satellites = Number(await page.getByTestId('live-count').locator('[data-count]').getAttribute('data-count'));
  return { arcId, segmentCount, satellites };
}

test.use({ viewport: { width: 390, height: 844 } });

test('a click on the stripe, and a reload of the link it writes, keep the same passes on screen (F-56)', async ({ page }) => {
  // `settled`: the recompute the stored run kicks off (R24) must be finished before anything here
  // is measured, or its objects streaming in one at a time would look exactly like the drift this
  // test is trying to rule out.
  await seedStoredRun(page, { prefs: { observer: GEOCODED }, settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);

  const segmentsAtOpen = await settledSegmentCount(page);
  // R70: the count at open is the first chunk's, which at real time is minutes long and can hold no
  // pass at all; that the seeded run has one in the day is the span's own question, asked here.
  const min = await spanStart(page);
  expect(storedPasses.filter((pass) => pass.start.t <= min + DAY_MS && pass.end.t >= min).length, 'the seeded run should have at least one pass in the first 24 h for this to test anything').toBeGreaterThan(0);

  // The click-without-reload half of F-56, reproduced first: a click near the instant already
  // shown must not drop the set the segments are drawn from. The press is at the drawn window's
  // own left edge, which is inside the same chunk, so the stripe draws the same window after it.
  await press(page, 'time-stripe', 0.001);
  await page.clock.runFor(200);
  expect(await page.getByTestId('time-stripe').locator('[data-pass-segment]').count()).toBe(segmentsAtOpen);
  await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live');

  // Now the click that matters: onto a pass the seeded run actually has, mid-way through its live
  // window, read off the stripe's own span rather than assumed. R70 (FR-SPAN-2): the whole day is
  // the overview's row now, so the aim is a click there — the stripe below redraws around what it
  // sets — and the count to compare is the drawn window's, which the aim has just changed.
  const target = firstFullPassAfter(min);
  const targetId = `${String(target.noradId)}-${String(target.start.t)}`;
  const midT = (target.start.t + target.end.t) / 2;
  await press(page, 'stripe-overview', (midT - min) / DAY_MS);
  await page.clock.runFor(200);
  const window_ = await drawnWindow(page);
  expect(window_.start, `the pass at ${String(midT)} should be inside the chunk the click drew`).toBeLessThanOrEqual(midT);
  expect(window_.end).toBeGreaterThanOrEqual(midT);
  // …and a click on the stripe itself lands the instant on the pass, at the chunk's own resolution.
  await press(page, 'time-stripe', (midT - window_.start) / (window_.end - window_.start));
  await page.clock.runFor(200);
  const clicked = await counts(page, targetId);
  expect(clicked.arcId, `pass ${targetId} should be the live arc after the click`).toBe(targetId);
  expect(clicked.satellites).toBe(1);
  expect(clicked.segmentCount).toBe(await settledSegmentCount(page));

  // FR-LIVE-9: the click wrote the shown instant into the hash, which is what turns an ordinary
  // session into a link on its next reload (D-280). The write is debounced to at most twice a
  // second (`HASH_EVERY_MS`) and the first click above already used up part of that window, so the
  // clock has to clear the whole debounce again before the second click's own write lands — read
  // off the stripe's own `aria-valuenow` rather than `midT`, which the click's pixel rounding may miss by a beat.
  await page.clock.runFor(HASH_EVERY_MS);
  const shownAtClick = await page.getByTestId('time-stripe').getAttribute('aria-valuenow');
  // `isoInstant`, not `toISOString`: the app leaves out zero milliseconds and `Date` always renders
  // them, so the two agree on 999 instants in 1000 and this would fail on the thousandth.
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#live?lat=-38.93&lon=-67.99&alt=0&t=${isoInstant(Number(shownAtClick))}`);

  await page.reload();
  await domeDrawn(page);
  await stripFilled(page);
  await settledSegmentCount(page); // the reload starts its own recompute (R24); let it settle before reading anything
  // The observer, its zone and its stored run survived the reload: the same pass is still the
  // live arc, the same segment count, the same satellite count as right after the click — failing
  // on the old code, which rebuilds a fresh `source: 'coords'` observer here and starts a search
  // instead (D-280).
  expect(await counts(page, targetId)).toEqual(clicked);
  await expect(page.getByTestId('live-place')).toHaveText(GEOCODED.label);
});
