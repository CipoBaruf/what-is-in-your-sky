/**
 * R36: the v1 capture set (SPEC §9 Phase 2 — "Desktop and phone captures for
 * every screen in both languages and both themes"). `captureSet.ts` says what
 * the set is and `tests/docs/captures.test.ts` checks the directory against it;
 * this file is what fills it, off one build, in one naming scheme.
 *
 *   npx playwright test v1-captures --project=chromium
 *
 * Evidence for the release, not a test: every assertion here is only there so
 * a file cannot end up being a picture of a page that had not finished loading.
 *
 * **One capture per test, and never two on one page.** `page.clock.install`
 * may be called once per page and `addInitScript` accumulates, so a test that
 * shot two themes would be relying on the second seed running last. Sixty
 * tests each doing one load cost nothing extra — Playwright runs them across
 * its workers — and each one either produces its file or fails saying so.
 *
 * **The theme and the language are seeded, never clicked.** Both live in
 * `wiys:prefs:v1`, and `main.tsx` writes `lang` and `data-theme` from them
 * before the first render (D-70), so an init script gets the whole 2 × 2
 * without a toggle, without the localised names of the toggles, and without a
 * half-switched frame. The observer and the saved places are seeded the same
 * way where the screen needs them (the R28 precedent): the round trip through
 * the panel is another spec's job, and a capture run that waited for three
 * recomputes to photograph a list would be paying a minute for a picture.
 *
 * R80 (SPEC §9 Phase 2g): the set is re-shot for v2.0 and gains one route —
 * `live-scrubbing`, the live page after a `[ scrub ]`. Every other screen the
 * redesign changed is reached the way it already was, because what moved is the
 * page and not the way in: the cold open and the home are board 1B's three
 * readings, the settings page is inverted, and the sky screen's legend strip is
 * a compass gutter.
 *
 * R94 (SPEC §4.39, FR-CAP-1, FR-CAP-5; F-80, F-66, F-70; D-547): a capture is
 * the screen as the reader opens it, and the set comes out the same twice. The
 * home's full-page file keeps its closed nights and says so in `captureSet.ts`;
 * its `-view` twin leaves tonight open and is shot cropped to the viewport
 * once the doors' lines have arrived (`doorsFilled`; R130 removed the Where
 * pane's dome R94 waited for). And every shot waits
 * for a settled frame: two ticks of the clock with identical document text,
 * so a drawing still being rasterised (the glyph or two F-66 and F-70 measured)
 * is not what the file shows.
 *
 * P8 (SPEC FR-SHOW-9, FR-SHOW-10; PLAN D-684): **one place and one night,
 * the showcase's.** Every screen is Bariloche on 5 to 6 September 2026 over
 * the committed elements, with the recorded forecast for its cell served by
 * `stubNetwork(page, 'fixtures', 'showcase')` and the observer's own zone, so
 * the set reads cloud badges and `GMT-3` clocks where D-179's Paris night read
 * "weather unknown" and UTC. The routes are unchanged; only the seeds moved.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { WINDOW_FOV_MIN_DEG } from '../../src/ui/components/guide/skychart/window/projection';
import { CAPTURE_DIR, captureSet, SCREENS, VIEWPORTS, type CaptureLocale, type CaptureTheme, type CaptureWidth } from './captureSet';
// P4 (D-653): the night, the seed and the two waits are `captureSeeds.ts`'s, shared with the recording run.
import { CLOCK, DAY_MS, SHOWN_PASS, guide, listSettled as settledList, readinessShown, OPEN_GUIDE, pinnedAt, seedPage, SHOWN, TICK_MS, type SeedPrefs } from './captureSeeds';
import { closeSheet, domeDrawn, enterScrubbing, openLegend, openSettings, openSheet, shownOnTrack, stripFilled, stubNetwork } from './liveHelpers';
// Bariloche is the place picker's observer for the geocoder's first answer, at its 839 m (FR-SHOW-9), which is
// what the stored Bariloche run and `SHOWN_PASS`'s id were computed at. Neuquén is only the second row of the
// saved places.
import { BARILOCHE, FIXTURE_DATE, NEUQUEN } from './observers';

/** `hh:mm:ss` in the observer's zone: the page's clocks read local time now that the observer has one (D-36). */
const localHhmmss = (t: number): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: BARILOCHE.timeZone ?? 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(t);

/**
 * FR-CI-2 (R37, F-46): sixty captures off one build take about 8.5 min, which
 * was most of FR-CI-1's ten-minute budget on every pull request that had
 * nothing to do with them. The set is a release artefact, so it is shot where
 * release artefacts are shot: `.github/workflows/captures.yml` on `main`, and
 * here on demand, the way `dome-perf.spec.ts` is run.
 *
 *   CAPTURES=1 npx playwright test v1-captures
 */
test.skip(process.env['CAPTURES'] !== '1', 'the release capture set: run with CAPTURES=1 (FR-CI-2)');

/**
 * The night the whole set is shot on — `CLOCK`, `SHOWN` and the night's brightest pass —
 * is `captureSeeds.ts`'s, with the reasons (D-684: the showcase night, and
 * what it does not hold).
 */
/**
 * R135 (FR-FLOW-2, D-844): the folded Where's ready line, in both languages (`i18n/{en,es}/home.ts`'s `whereFold`).
 * On the compact home the readiness line is inside the folded Where's closed panel and not in the document, so the
 * "finished run stored" signal `captureSeeds.ts`'s wait reads is this line's `Ready offline` instead — the same
 * readiness, worded for the fold, which says `Elements … old` until it has an answer.
 */
const WHERE_READY = /^(Ready offline · |Listo sin red · )/;

/**
 * The list, settled (`captureSeeds.ts`'s `listSettled`), on either home: the readiness line where it is drawn, the
 * folded Where's ready line where it is folded. The promo recording's copy of the wait is not this file's (Follow-ups).
 */
async function listSettled(page: Page): Promise<void> {
  await settledList(page, readyOrFolded);
}

/** The finished run stored: the readiness line where it is drawn, else the folded Where's `Ready offline` line. */
async function readyOrFolded(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="readiness"], [data-testid="where-status"]').first()).toBeVisible({ timeout: 60_000 });
  if ((await page.getByTestId('where-status').count()) === 0) await readinessShown(page);
  else await expect(page.getByTestId('where-status')).toHaveText(WHERE_READY, { timeout: 60_000 });
}

/** R53: the legend screen's instant, two minutes further on — see the `legend` route. */
const LEGEND_SHOWN = SHOWN + 120_000;
/** Neuquén saved but not in use, Bariloche in use: the "in use" mark is on one row and not the other. Two screens seed them (R53: the settings page lists them too, FR-COMP-2). */
const SAVED_PLACES = [
  { cellKey: '-38.93,-67.99', observer: NEUQUEN, addedAt: CLOCK - 2 * DAY_MS, lastUsedAt: CLOCK - 2 * DAY_MS },
  { cellKey: '-41.15,-71.31', observer: BARILOCHE, addedAt: CLOCK - DAY_MS, lastUsedAt: CLOCK - 60_000 },
];

/**
 * The screens whose point is everything on them, so the capture is the whole
 * document and not the first 844 px of it. R53 adds the settings page, which is
 * seven sections and a footer on a phone. R94: a `-view` twin is never full
 * page — the viewport is what it is a picture of (FR-CAP-1).
 */
const FULL_PAGE = new Set(['location', 'home', 'settings']);

/**
 * R94 (FR-CAP-5, F-66, F-70; D-547, D-611): the frame has settled when two
 * ticks of the paused clock leave the document's text as it was. The two
 * findings are a glyph or two inside a drawing, and glyphcss draws in text, so
 * a `<pre>` still being rasterised when the file is written is the shape of
 * defect this catches; a frame that has not settled fails the capture instead
 * of producing a file that is right half the time.
 *
 * Exactly two ticks, never "until it settles": the first cut of this loop
 * returned as soon as two readings agreed, so how many frames it ran was a
 * property of the run, the shown instant drifted by a frame between two runs,
 * and everything that moves with the instant — a marker, an arc's end, the
 * stripe's cursor — landed a fraction of a pixel elsewhere and anti-aliased
 * differently. A fixed count is the F-48 rule again: the clock arrives where
 * the picture wants it by the same number of ticks every time. Two frames keep
 * a pinned instant well inside its one-second countdown tick and its
 * ten-second strip tick.
 */
async function settled(page: Page): Promise<void> {
  const text = () => page.evaluate(() => document.documentElement.textContent ?? '');
  await page.clock.runFor(FRAME_MS);
  const first = await text();
  await page.clock.runFor(FRAME_MS);
  const second = await text();
  if (first !== second) throw new Error('the frame did not settle: the document text changed between two ticks');
}

/**
 * R53 (FR-WIN-4): the window is offered where the presence test passes — a
 * touch device with the constructor — and that is a property of the device, not
 * of the width, so its two profiles are the phone and a wide screen that has a
 * touch panel. Playwright grants touch per context, so these tests need a
 * `test.use` of their own and the rest of the set must not have it.
 */
// R152 (FR-GYRO-6, D-958): the sky screen's shots, which filled this set, are retired; the stars page's touch widths stay below.
const TOUCH = new Set<string>();

/**
 * R118 (FR-STAR-3, FR-WIN-4 as amended): the stars page is shot on the device each width's reader has —
 * a touch phone at 360 and 390, where `[ hold up to the sky ]` is on the page, and a desk without touch at
 * 1280 and 1920, where it is not. So touch is a property of the capture, not only of the screen.
 * R135 (FR-FLOW-15): the page at 844 × 390 is the same phone turned, so it has touch too.
 */
const isTouch = (screen: string, width: CaptureWidth): boolean => TOUCH.has(screen) || ((screen === 'stars' || screen === 'stars-passes') && (VIEWPORTS[width].width <= 390 || width === 844));

const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;
const WINDOW_OPTION = { en: 'Window', es: 'Ventana' } as const;
/** R128: the stars page's layer and its facing picker, by their names (R126's). */
const PASSES = { en: 'passes', es: 'pases' } as const;
const FACING = { en: 'Facing', es: 'Mirando' } as const;
const FRAME_MS = 16;

/**
 * A page at `width` on the paused clock, with the preferences already in storage (`seedPage`) and the showcase
 * network: the elements from the fixtures, Bariloche's recorded forecast and geocoder answer, anything else
 * refused (P8, D-684). Called once per test.
 */
async function open(page: Page, width: CaptureWidth, prefs: SeedPrefs, time = CLOCK): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  await seedPage(page, prefs, time);
  await stubNetwork(page, 'fixtures', 'showcase');
}

/**
 * R128 (FR-CAP-5, FR-SKY-3; D-830): the stars under the arcs, arrived. `[ stars ]` is on by default and the
 * catalogue is the lazy `stars` chunk, whose load is a timer and a fetch the paused clock does not order against
 * the chart's own reveal — the first local run of the set shot `v1-polar-390-dark-es` with no star on it and the
 * second with them. Every view marks a placed star `data-star` (the polar chart's glyph, the dome's hotspot, the
 * window's mark), so the wait is that, ticking the clock by `tickMs`; then a second for the drawing to take them,
 * before the caller pins its instant (F-48). `stars` narrows the match where a view draws marks it hides — the
 * window's out-of-field stars are `visibility="hidden"`.
 */
const PLACED_STAR = '[data-star]';
const SHOWN_WINDOW_STAR = '[data-star]:not([visibility="hidden"])';
async function starsDrawn(page: Page, scope: Locator, stars = PLACED_STAR, tickMs = 200): Promise<void> {
  await expect
    .poll(async () => {
      await page.clock.runFor(tickMs);
      return scope.locator(stars).count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await page.clock.runFor(1000);
}

/** A click or a focus left a ring on a control; the picture is of the page, not of a focused control. */
async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
}

/**
 * R128 (FR-CAP-5; D-830): whether the `stars` chunk has been fetched, from a listener attached before the page's
 * first navigation — so a fetch made before the route asks (a prefetch, a precache hit) is counted, not missed.
 */
function starsChunkWatch(page: Page): () => boolean {
  let fetched = false;
  page.on('response', (response) => {
    if (/\/assets\/Stars-[^/]*\.js$/.test(response.url())) fetched = true;
  });
  return () => fetched;
}

/**
 * R128 (FR-CAP-5; D-830): the `stars` chunk in hand before a chart mounts, fetched by the reader's own prefetch.
 * Since R135 (D-860) that is the home's idle prefetch for the doors, which the poll's ticks run, at every width;
 * on wide the header's `[ stars ]` is focused as well, which loads it ahead of the tap (`starsChunk.ts`). The
 * When pane's `[ look up ]` that compact used to focus is gone. Not for the dome's size: that was F-103, fixed in the app, and a cold page draws the same
 * dome. For the order the dome's meshes mount in: where the stars' points mesh mounts after the arcs, a braille
 * cell an arc and a star share takes one colour or the other by when the chunk landed, which two cold runs of the
 * set disagreed on (a few cells at a channel step of about 30 on four wide live files).
 */
async function starsChunkLoaded(page: Page, fetched: () => boolean): Promise<void> {
  // R135 (D-860): the home prefetches the chunk on idle for the doors, so the poll's ticks fetch it; the header's
  // `[ stars ]` (wide, R129's nav) is focused where it is drawn, as it was before the doors.
  const link = page.locator('[data-testid="stars-link"]:visible');
  if (!fetched() && (await link.count()) > 0) await link.first().focus();
  await expect
    .poll(async () => {
      await page.clock.runFor(100);
      return fetched();
    }, { timeout: 30_000 })
    .toBe(true);
  await page.clock.runFor(200);
  await blurFocus(page);
}

/** The chart screens: the night's brightest pass open on `view`, three minutes in (D-684; the night has no glare pass). */
async function openChart(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, view: 'dome' | 'polar'): Promise<void> {
  await open(page, width, { locale, theme, observer: BARILOCHE, chartView: view });
  const starsFetched = starsChunkWatch(page);
  await page.goto('/');

  const card = page.locator(`article[data-pass-id="${SHOWN_PASS}"]`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  // The wide layout keeps the list beside the guide, so the capture would otherwise carry
  // "Computing passes… 17 of 93" next to a finished chart. The search is let finish first.
  await listSettled(page);
  await starsChunkLoaded(page, starsFetched);
  await card.getByRole('button', { name: OPEN_GUIDE[locale] }).click();
  const figure = guide(page).getByRole('figure');
  // The view came from the seeded preference (US-6 AC5), so there is no toggle to click and no frame drawn on the other one.
  await expect(figure).toHaveAttribute('data-view', view);
  // The chart chunk, the raster font and glyphcss's first rasterisation all wait on timers the paused clock is holding.
  await page.clock.runFor(1000);
  if (view === 'dome') await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await starsDrawn(page, figure);

  // …and then into the pass, arriving on the tick the sheet lives by rather than through three hundred of them.
  await pinnedAt(page, SHOWN);
  // R45 (FR-DOME-6 as amended): the two bodies are legend lines, not captions in the drawing.
  await expect(guide(page).getByTestId('chart-legend').locator('[data-body="sun"]')).toHaveCount(1);
  await expect(guide(page).getByTestId('chart-legend').locator('[data-body="moon"]')).toHaveCount(1);
  if (view === 'polar') await expect(figure.locator('[data-marker="now"]')).toHaveCount(1);
  await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
}

/**
 * R135 (FR-FLOW-14, D-876): the live page drawn, in whichever view it opened on. Since R136 a phone with nothing
 * saved opens on the window and a desk on the dome, so `domeDrawn`'s wait for the dome's glyphs holds only on wide;
 * on compact the wait is the window's camera in the box. Returns the view, so the caller waits for its stars.
 */
async function liveDrawn(page: Page): Promise<'dome' | 'window'> {
  const chart = page.getByTestId('sky-chart');
  // The page's chunk and the chart's are lazy, and the paused clock holds their reveals (R32).
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return (await chart.count()) === 0 ? null : chart.getAttribute('data-view');
    }, { timeout: 30_000 })
    .not.toBeNull();
  if ((await chart.getAttribute('data-view')) !== 'window') {
    await domeDrawn(page);
    return 'dome';
  }
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return (await page.getByTestId('live-page').getAttribute('data-state')) === 'live' && (await chart.locator('[data-look-az]').count()) > 0;
    }, { timeout: 30_000 })
    .toBe(true);
  return 'window';
}

/**
 * R145 (FR-TONIGHT-1, D-898): the live page opened through the home on a finished search (`liveAt`'s note), drawn,
 * and on compact past the opening jump's decision. The passes are in the store before the hash changes, so the
 * page decides on its first render with them; the track's pass ticks are drawn from the same passes, so once they
 * are attached and the clock has ticked, the decision has been taken — jumped or not — and nothing after this
 * meets it half-way.
 */
async function liveOpened(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, shown: number, prefs: Partial<SeedPrefs> = {}): Promise<'dome' | 'window'> {
  await open(page, width, { locale, theme, observer: BARILOCHE, ...prefs }, shown);
  const starsFetched = starsChunkWatch(page);
  await page.goto('/');
  await listSettled(page);
  await starsChunkLoaded(page, starsFetched);
  // The router listens for `hashchange`, so setting the hash in the page navigates without
  // reloading it — which is the point: a reload would start the search again.
  await page.evaluate(() => {
    location.hash = '#live';
  });
  // The place is asserted after the drawing, not before: the route is lazy, and its Suspense
  // reveal is one of the timers the paused clock is holding until `liveDrawn` ticks it.
  const view = await liveDrawn(page);
  // R149 (FR-FULL-2, FR-FULL-4): on compact the place is the sheet head's, in the tree with the sheet closed (D-932).
  const place = (await page.getByTestId('live-place').count()) > 0 ? page.getByTestId('live-place') : page.getByTestId('sheet-place');
  await expect(place).toHaveText(BARILOCHE.label);
  if ((await page.getByTestId('time-track').count()) > 0) {
    await expect(page.getByTestId('time-track').locator('[data-pass-tick]').first()).toBeAttached({ timeout: 30_000 });
    await page.clock.runFor(200);
  }
  return view;
}

/**
 * The live page, settled, at `SHOWN` (R36; lifted out of the `live` route by
 * R53 so the `legend` screen photographs the same page rather than a second
 * route to it).
 *
 * The one screen reached through the home page rather than through a URL. A
 * `#live?…t=` link (FR-LIVE-9) opens the page in one step, but it opens it on a
 * search that has only just started, and the strip's "visible" count then keeps
 * climbing as the passes stream in — two runs of the same capture disagreed
 * about how many satellites were up. Going through the home page and waiting
 * for the list to settle first means the live page inherits a finished search,
 * and the count is the count. The clock is at the shown instant from the start,
 * so the page opens on real time and needs no scrubbing.
 */
async function liveAt(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, shown: number = SHOWN, prefs: Partial<SeedPrefs> = {}): Promise<void> {
  const view = await liveOpened(page, width, theme, locale, shown, prefs);
  /*
   * R149 (FR-FULL-10, D-937): with nothing visible up at `shown` the compact page asks with the card once the stored
   * run's passes are known. Every capture here is of its own instant, so the reader's `[ see now ]` answers it and
   * keeps real time — which is how the sky screen's chip is still the one 2.7.0 drew, as R145's `[ now ]` was. The
   * card is asked on every visit and never saved, so it cannot be seeded away: `liveOpened` waits for the decision
   * (the track's pass ticks), the clock ticks once more, and the answer comes after it, never in a race with it.
   */
  await page.clock.runFor(200);
  const card = page.getByTestId('live-card');
  if ((await card.count()) > 0) {
    await card.getByTestId('live-card-now').click();
    await expect(card).toHaveCount(0);
    await blurFocus(page);
  }
  const chip = page.getByTestId('shown-chip');
  if ((await chip.count()) > 0) await expect(chip).toHaveAttribute('data-kind', 'now');
  // The strip settled: five fields, each visible and none still on its pending ellipsis (F-47:
  // `liveHelpers.ts` owns that check, and this file had been carrying a copy without the visibility half).
  await stripFilled(page);
  await starsDrawn(page, page.getByTestId('sky-chart'), view === 'window' ? SHOWN_WINDOW_STAR : PLACED_STAR);
  // F-48: `domeDrawn` left the clock wherever its last tick fell, so the shown instant is put back
  // on `shown` before the picture — and the strip is read to prove the page went there with it.
  await pinnedAt(page, shown);
  // …to the ten-second tick the strip reads the clock at (FR-VIS-5), and in neither language's words:
  // both of them print the local time of `SHOWN` in Bariloche's zone (P8; over Paris it was UTC).
  // R77 (FR-WATCH-3, FR-WATCH-5, D-474, D-476): the clock is a field of the conditions line on compact and
  // the rail's own `live-clock` on wide, where the line gave it up. Either way it is the page's shown instant.
  // R145 (FR-TONIGHT-6, FR-TONIGHT-7): on compact it is the headline's shown time, with its seconds at real time.
  const shownClock = (await page.getByTestId('shown-time').count()) > 0 ? page.getByTestId('shown-time') : page.getByTestId('live-clock');
  // F-99: to the second, so a clock left on its own interval's phase fails here rather than in a diff of two runs.
  await expect(shownClock).toContainText(localHhmmss(shown));
  await page.mouse.move(0, 0);
}

/** R149 (FR-FULL-10): the card's pass line, in both languages (`i18n/{en,es}/live.ts`'s card words): the name, the rise and the chip. */
const CARD_PASS = / · \d\d:\d\d · (in|en) \d+ h \d\d min$/;

/**
 * R149 (FR-FULL-10, US-43 AC5): v2.8's opening state on the phone — `#live` opened at `DAYLIGHT`, with nothing up and
 * the evening's first pass ahead, so the page stays on real time and asks with the card over the sky: "Nothing
 * visible up now", the pass line, `[ see next pass ]` and `[ see now ]`. Nothing plays and nothing has moved, so the
 * picture is the instant the reader opened; the real clock is put back on `DAYLIGHT` so the card's chip reads the
 * same minute in every run. The focus is where the card put it, on `[ see next pass ]`, as the reader finds it.
 */
async function liveCard(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale): Promise<void> {
  const view = await liveOpened(page, width, theme, locale, DAYLIGHT);
  const card = page.getByTestId('live-card');
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return (await card.count()) > 0 ? card.getAttribute('data-kind') : null;
    }, { timeout: 30_000 })
    .toBe('ask');
  await expect(card.getByTestId('live-card-pass')).toHaveText(CARD_PASS);
  await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
  await stripFilled(page);
  if (view === 'window') await expect(page.getByTestId('sky-chart').locator('[data-look-az]').first()).toBeAttached({ timeout: 30_000 });
  await page.clock.runFor(1000);
  await pinnedAt(page, DAYLIGHT);
  await expect(card).toHaveAttribute('data-kind', 'ask');
  await expect(card.getByTestId('live-card-pass')).toHaveText(CARD_PASS);
  await expect(page.getByTestId('shown-time')).toContainText(localHhmmss(DAYLIGHT));
  await page.mouse.move(0, 0);
}

/**
 * R149 (FR-FULL-4, FR-FULL-9): the compact live page at `SHOWN` with `[ controls ]` pressed — the sheet over the
 * bottom of the sky (the side at 844 × 390) with its head, the context line, the track and the taps, the view row,
 * the facing row, `[ list (n) ]` and Share — and, with `list`, `[ list (n) ]` pressed too, the list open inside the
 * sheet's body and the body scrolled to it. The sky behind is the same box as `live-watching`'s (FR-FULL-1: nothing resizes it).
 */
async function liveSheet(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, list: boolean): Promise<void> {
  await liveAt(page, width, theme, locale);
  await openSheet(page);
  if (list) {
    const toggle = page.getByTestId('live-legend-toggle');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('chart-legend').locator('button[data-pass-id]').first()).toBeVisible();
  }
  // The sheet's body at its top, where the reader's eye starts — or, with the list, scrolled to its end, where the
  // list the reader just opened stands (the body scrolls and the page does not, FR-FULL-4).
  await page.getByTestId('sheet-body').evaluate((body, end) => {
    body.scrollTop = end ? body.scrollHeight : 0;
  }, list);
  await page.clock.runFor(1000);
  await pinnedAt(page, SHOWN);
  await expect(page.getByTestId('shown-time')).toContainText(localHhmmss(SHOWN));
  await blurFocus(page);
  await page.mouse.move(0, 0);
}

/**
 * R135 (FR-FLOW-1, FR-FLOW-12; D-843, D-860): the home's three doors, every line arrived. The Stars door's second
 * line and the wide lines are the `stars` chunk's, which the home prefetches on idle (`useDoorSky`); until it lands
 * a line is drawn empty at its height and marked `data-pending`, so the wait is for none left, ticking the paused
 * clock that holds the idle callback and the fetch. R130 removed the Where pane's dome (`WhereDome`) that R94's
 * wait was for, so this is the home's one wait after the list.
 */
async function doorsFilled(page: Page): Promise<void> {
  const doors = page.getByTestId('home-doors');
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      if ((await doors.count()) === 0) return -1;
      return doors.locator('[data-pending]').count();
    }, { timeout: 30_000 })
    .toBe(0);
}

/**
 * R135 (FR-FLOW-12): the elements answer for the doors' `no pass` state — the fixtures' catalogue cut to
 * inclinations under 32°, four of the `visual` group's objects (HST, Hitomi, XRISM and an Atlas Centaur stage)
 * and none of the `stations` group's. The orbits alone do not keep them out of a 41° S sky: all four rise over
 * Bariloche, and XRISM (31°, about 575 km) climbs 20° and more. What leaves the 72 h search empty is these
 * fixtures' lighting and brightness: in the set's three days none of the four is sunlit above the horizon in a
 * dark enough sky and bright enough to pass the visibility rule (FR-PASS-*). So the state belongs to the
 * fixtures' date, not to the cut: a refresh of `tests/fixtures/omm/` (new epochs, or a new `FIXTURE_DATE`) can
 * give one of them a visible pass, and then `home-no-pass` fails on the Satellites door's `No visible pass in
 * 72 h`, not on anything this cut says. The fix then is a lower bound on the cut, or fewer objects. The rest of
 * the home — the forecast, the zone, the elements' age — is the set's night.
 */
const NO_PASS_MAX_INCLINATION_DEG = 32;
async function noPassCatalogue(page: Page): Promise<void> {
  // Registered after `stubNetwork`'s, so it answers first (Playwright tries the newest route first).
  await page.route('https://celestrak.org/**', async (route) => {
    const group = new URL(route.request().url()).searchParams.get('GROUP') ?? 'unknown';
    const all = JSON.parse(readFileSync(`tests/fixtures/omm/${FIXTURE_DATE}-${group}.json`, 'utf8')) as { INCLINATION: number }[];
    await route.fulfill({
      body: JSON.stringify(all.filter((omm) => omm.INCLINATION < NO_PASS_MAX_INCLINATION_DEG)),
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
}

/** The doors' four states (FR-FLOW-12): the home at the instant, or over the catalogue, that puts the doors there. */
type DoorState = 'later' | 'up-now' | 'no-pass' | 'daylight';
/** 13:00 local on the 6th: the Sun up, so the Stars door names when the stars come out and no star; the Satellites door the evening's first pass. */
const DAYLIGHT = CLOCK + 480 * 60_000;
const DOOR_TIME: Record<DoorState, number> = { later: CLOCK, 'up-now': SHOWN, 'no-pass': CLOCK, daylight: DAYLIGHT };
/** What proves each state took, in the door's own words (`i18n/{en,es}/home.ts`'s `doors`). */
const DOOR_WORDS = {
  upNow: { en: /^Up now · /, es: /^Arriba · / },
  noPass: { en: /^No visible pass in 72 h$/, es: /^Ningún pase visible en 72 h$/ },
  starsFrom: { en: /^Stars from /, es: /^Estrellas desde las / },
} as const;

/**
 * The home, settled, at `time`: the list (or, with no pass, the finished search and the readiness line), the doors
 * filled, and the instant put back where the capture wants it (F-48).
 */
async function homeAt(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, time: number, noPass = false): Promise<void> {
  await open(page, width, { locale, theme, observer: BARILOCHE }, time);
  if (noPass) await noPassCatalogue(page);
  await page.goto('/');
  if (noPass) {
    await expect(page.locator('[data-testid="readiness"], [data-testid="where-status"]').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
    // A finished search with nothing in it stores no run, so the readiness answer is not-ready ("no passes stored
    // yet") — the state a reader with no pass is in, and a finding in RELEASE §18 — and the fold shows that fault.
    if ((await page.getByTestId('where-status').count()) > 0) await expect(page.getByTestId('where-status')).toHaveAttribute('data-fault', 'not-ready', { timeout: 60_000 });
    else await expect(page.getByTestId('readiness')).toBeVisible({ timeout: 60_000 });
    // The search finished: the Satellites door reads `none` only once the run is `done` (`usePassContext`'s
    // `pending`, `doorLines`); before and during it the door reads its pending line, and every check above holds
    // before the search starts as well.
    await expect(page.getByTestId('door-satellites-line').first()).toHaveText(DOOR_WORDS.noPass[locale], { timeout: 60_000 });
    await expect(page.locator('article[data-pass-card]')).toHaveCount(0);
  } else {
    await listSettled(page);
  }
  await doorsFilled(page);
  await pinnedAt(page, time);
  await page.mouse.move(0, 0);
}

/**
 * R118 (FR-STAR-3, FR-STAR-8; D-786): the `#stars` page, settled, at `CLOCK`. Reached the way `liveAt`
 * reaches the live page — the home first, the search let finish, then the hash — so nothing the
 * background run streams in can change the document between the two ticks `settled` reads. The page
 * draws the catalogue and the clock (FR-STAR-8), so what it waits for is its own: the lazy chunk's and
 * the window's Suspense reveals, which the paused clock holds (R32), and a star in the field. Then the
 * instant is put back on `CLOCK` (F-48), since the positions move with it.
 */
async function starsAt(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, time = CLOCK): Promise<void> {
  await open(page, width, { locale, theme, observer: BARILOCHE }, time);
  await page.goto('/');
  await listSettled(page);
  await page.evaluate(() => {
    location.hash = '#stars';
  });
  await starsDrawn(page, page.getByTestId('stars-sky').locator('[data-drawing="window"]'), SHOWN_WINDOW_STAR, 500);
  await pinnedAt(page, time);
  // The opening facing is the pole side, which over Bariloche is south, 35° up (FR-STAR-3).
  await expect(page.getByTestId('stars-page')).toHaveAttribute('data-look-az', '180');
  await expect(page.getByTestId('stars-page')).toHaveAttribute('data-look-alt', '35');
  await page.mouse.move(0, 0);
}

/**
 * R128 (FR-SKY-2, FR-SKY-9; D-829): a chart's view control turned to `Window`, by the reader's click rather than
 * a seeded `chartView` — on compact the choice is not saved (FR-SKY-2), so a seed would be a state no compact
 * reader opens in, and the click is the same route at every width. With no touch panel the window is laid out
 * in the box under the hand camera (the compact reader without a sensor, which is what a headless capture is);
 * then the stars are waited for, since the `stars` chunk is lazy and the paused clock holds its reveal (R32),
 * and the instant is put back where the capture wants it (F-48).
 */
async function windowInTheBox(page: Page, scope: Locator, locale: CaptureLocale, shown: number): Promise<Locator> {
  // R132 (D-864): the view control is the layout's view row, outside the figure.
  await scope.locator('xpath=ancestor::*[@data-sky-layout][1]').getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: WINDOW_OPTION[locale] }).click();
  await page.clock.runFor(1000);
  const w = scope.locator('[data-look-az]');
  await expect(w).toHaveAttribute('data-state', 'hand');
  await starsDrawn(page, w, SHOWN_WINDOW_STAR);
  await pinnedAt(page, shown);
  await blurFocus(page);
  return w;
}

/**
 * R128 (FR-SKY-6, D-829): the stars page at `SHOWN` with `[ passes ]` on, faced to the first of the eight points
 * whose field lists a pass — R126's route (`r126-captures.spec.ts`) on the set's night. At `CLOCK` no pass is up or
 * near, so the page is shot three minutes into the night's brightest pass, the instant the chart screens are of.
 * Returns the azimuth faced, which the screen is then aimed at.
 */
async function starsWithPasses(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale): Promise<number> {
  await starsAt(page, width, theme, locale, SHOWN);
  await page.getByTestId('stars-layers').getByRole('button', { name: PASSES[locale] }).click();
  const picker = page.getByTestId('stars-page').getByRole('group', { name: FACING[locale] });
  let azDeg = 0;
  for (const [index, name] of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].entries()) {
    azDeg = index * 45;
    await picker.getByRole('button', { name, exact: true }).click();
    let found = 0;
    for (let step = 0; step < 10 && found === 0; step += 1) {
      await page.clock.runFor(100);
      found = await page.getByTestId('field-list').locator('[data-kind="pass"]').count();
    }
    if (found > 0) break;
  }
  await expect(page.getByTestId('field-list').locator('[data-kind="pass"]').first()).toBeAttached();
  await pinnedAt(page, SHOWN);
  await expect(page.getByTestId('stars-sky').locator('[data-drawing="window"] [data-pass-id]').first()).toBeAttached();
  await blurFocus(page);
  await page.mouse.move(0, 0);
  return azDeg;
}

type Reach = (page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, view: boolean) => Promise<void>;

/** Every screen's route to itself, by the name it carries in `captureSet.ts`. */
const REACH: Record<string, Reach> = {
  async location(page, width, theme, locale) {
    await open(page, width, { locale, theme });
    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  },

  async home(page, width, theme, locale, view) {
    await homeAt(page, width, theme, locale, DOOR_TIME.later);
    if (view) {
      // The `-view` twin is the home as it opens — tonight open (FR-NIGHT-1's default) — cropped to the viewport.
      await expect(page.locator('[data-testid="night-group"][data-open="true"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="night-toggle"][aria-expanded="true"]')).toHaveCount(1);
      await page.mouse.move(0, 0);
      return;
    }
    // The nights are closed so the whole screen fits in one picture. Paris in September, where
    // the set was shot until P8, had tens of visible passes a night, and the open default made the phone capture 20 000 px
    // tall — a file nobody can review. P8 (D-684): Bariloche's night has five, so the rule is
    // no longer forced by the count; the route is kept so the set's shape and its `-view`
    // pairing are unchanged (FR-SHOW-10). Closed, the capture carries every part of the home
    // screen at once (the location block, the saved places, the elements line, the Now panel,
    // the Moon, the hero card, the sort toggle, the three nights with their counts, the
    // footer), and the cards themselves are what `guide` and `polar` are for.
    // R81 (FR-FIRST-10): a night closes through its toggle under the cards.
    const openNights = page.locator('[data-testid="night-toggle"][aria-expanded="true"]');
    while ((await openNights.count()) > 0) await openNights.first().click();
    await expect(page.locator('[data-testid="night-group"]:not([hidden])')).toHaveCount(0);
  },

  /**
   * R135 (FR-FLOW-1, FR-FLOW-12): the doors' three other states, each the home as it opens at that state's instant
   * (or over the catalogue that puts it there), cropped to the viewport like the `-view` twin — which is the fourth,
   * the later pass, at `CLOCK`.
   */
  async 'home-up-now'(page, width, theme, locale) {
    await homeAt(page, width, theme, locale, DOOR_TIME['up-now']);
    await expect(page.getByTestId('door-satellites-line').first()).toHaveText(DOOR_WORDS.upNow[locale]);
  },

  async 'home-no-pass'(page, width, theme, locale) {
    await homeAt(page, width, theme, locale, DOOR_TIME['no-pass'], true);
    await expect(page.getByTestId('door-satellites-line').first()).toHaveText(DOOR_WORDS.noPass[locale]);
    // The Satellites door opens the What reading in place: there is no pass to link to.
    await expect(page.getByTestId('door-satellites')).toHaveAttribute('href', '#what');
  },

  async 'home-daylight'(page, width, theme, locale) {
    await homeAt(page, width, theme, locale, DOOR_TIME.daylight);
    // The Sun is up, so the Stars door says when they come out rather than naming one.
    await expect(page.getByTestId('door-stars-line').nth(1)).toHaveText(DOOR_WORDS.starsFrom[locale]);
  },

  /**
   * R135 (FR-FLOW-2, FR-FLOW-12; D-844): the compact Where opened by its `[ details ]` — the place, the status line's
   * button pressed and the panel in FR-FIRST-11's order under it. The folded Where is the top of the home's own
   * 360 and 390 files, and of their `-view` twins.
   */
  async 'where-opened'(page, width, theme, locale) {
    await homeAt(page, width, theme, locale, CLOCK);
    const details = page.getByTestId('where-details');
    await details.click();
    await expect(details).toHaveAttribute('aria-expanded', 'true');
    // The panel mounts its readiness and elements lines only on open (`WherePlace`'s `details`), and each draws
    // nothing until its store answers, so the clock is ticked until both are there, then put back (F-48).
    const panel = page.getByTestId('where-details-panel');
    await expect
      .poll(async () => {
        await page.clock.runFor(FRAME_MS);
        return (await panel.getByTestId('readiness').count()) + (await panel.getByTestId('elements-line').count());
      }, { timeout: 15_000 })
      .toBe(2);
    await expect(panel.getByTestId('readiness')).toBeVisible();
    await expect(panel.getByTestId('elements-line')).toBeVisible();
    await pinnedAt(page, CLOCK);
    await blurFocus(page);
    await page.mouse.move(0, 0);
  },

  async guide(page, width, theme, locale) {
    await openChart(page, width, theme, locale, 'dome');
  },

  async polar(page, width, theme, locale) {
    await openChart(page, width, theme, locale, 'polar');
  },

  /**
   * R53 (FR-COMP-2, V11-16): the settings page, reached by the hash at both
   * widths — on compact the header links to it, on wide nothing does and the
   * route still exists. The browser is made to offer an install first, so the
   * row FR-OFF-6 as amended puts between the saved places and the clear action
   * is in the picture; without the event there is nothing to offer and the
   * section is rightly absent.
   */
  async settings(page, width, theme, locale) {
    await open(page, width, { locale, theme, observer: BARILOCHE, favourites: SAVED_PLACES });
    await page.goto('/');
    // The form's fields are the observer's, and the readiness line above them is the settled run's.
    await listSettled(page);
    await page.evaluate(() => {
      location.hash = '#settings';
    });
    // R93 made the settings page a lazy chunk, and the paused clock holds its Suspense reveal (R32).
    await page.clock.runFor(1000);
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
    });
    await expect(page.getByTestId('settings-install')).toBeVisible();
    await expect(page.getByTestId('clear-saved-location')).toBeVisible();
    await expect(page.getByTestId('favourite')).toHaveCount(2);
    await page.mouse.move(0, 0);
  },


  /**
   * R60 (FR-FOL-5, R56): the window swept down out of the sky, at whichever of
   * the two states its own screen name carries. The look direction is down the
   * pass's own azimuth, as R56's captures do it, so the `ground` state still
   * has an arc left to show above the hatch.
   */

  /**
   * R53 (FR-LEG-2..4): the legend with something in every column. The live page
   * is the only screen that has all of it at once — the drawn passes in their
   * FR-TRAJ-1 states (`up`, `soon`, `gone`) and, with the FR-LIVE-6 toggle on,
   * the hidden objects with their reasons — and the first row is activated, so
   * the picture also carries FR-LEG-4: one arc at full weight, the others dim.
   * Under the drawing at 390, beside it at 1280 (FR-LEG-2), which is why the
   * screen is shot at both widths and not only where the column is.
   */
  async legend(page, width, theme, locale) {
    // R77 (FR-WATCH-4, D-478): on compact the hidden-objects toggle is the scrubbing row's, so a watching
    // page has none to click. Its state is a saved preference (FR-LIVE-6) and applies in both states, so the
    // screen seeds it on and stays where it was — the legend with the hidden rows under the drawn ones.
    await liveAt(page, width, theme, locale, SHOWN, { liveHidden: true });
    // The hidden objects are a `computeAt` request, throttled to one per 250 ms of wall time (FR-LIVE-6).
    await page.clock.runFor(1000);
    // Two minutes past the instant the search ran, which is what makes this screen the legend's:
    // at `SHOWN` every drawn arc has just been clipped to `now` and every row reads `soon`, and
    // two minutes on the same rows are `up`, one has run out to `gone`, and the FR-LIVE-6 rows
    // underneath say why they are not drawn. Deterministic, like every other instant here (F-48).
    await pinnedAt(page, LEGEND_SHOWN);
    // R71 (FR-LEG-7, FR-LEG-9): at 390 the legend is behind `[ list (n) ]` and is not in the
    // document until the reader opens it, so this screen opens it — the compact picture of the
    // legend is now the open panel, two `--tap` rows scrolling inside itself. A no-op at 1280,
    // where the legend stands in the rail at every wide width (FR-LEG-6).
    await openLegend(page);
    const legend = page.getByTestId('chart-legend');
    const rows = legend.locator('button[data-pass-id]');
    await expect(rows.first()).toBeVisible();
    // The row is activated *after* the instant is set, not before: a new `shown` rebuilds the rows
    // and drops the pin, so a click and then a scrub photographs a legend with nothing highlighted.
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(0, 0);
  },

  async favourites(page, width, theme, locale) {
    await open(page, width, { locale, theme, observer: BARILOCHE, favourites: SAVED_PLACES });
    await page.goto('/');
    // The list is beside the places on the wide layout, and the readiness line is right above
    // them on both, so this screen waits for the same settled state the others do.
    await listSettled(page);
    /*
     * R53 (FR-COMP-2, FR-COMP-3): on compact the saved places are no longer on the home screen —
     * R52 moved the whole location block to `#settings` — so the route to them is the header's
     * link, and this is what the re-shoot caught: the committed `v1-favourites-390-*` files were
     * pictures of a home screen the app has not had since R52. The capture stays a viewport shot
     * of the places in place, which is what makes it a different picture from the settings page's
     * full-page one.
     */
    await openSettings(page);
    await expect(page.getByTestId('favourite')).toHaveCount(2);
    await page.getByTestId('favourites').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
  },

  async shortcuts(page, width, theme, locale) {
    await open(page, width, { locale, theme, observer: BARILOCHE });
    await page.goto('/');
    await listSettled(page);
    // FR-DESK-4: the keys are the page's only while nothing has the caret. Nothing here typed, so the body still has focus.
    await page.keyboard.press('?');
    const overlay = page.getByTestId('shortcuts-overlay');
    await expect(overlay).toBeVisible();
    // R115 (FR-DESK-4 as amended v2.4): `s` for the stars page and that page's two key rows, 8 → 11.
    // R127 (FR-DESK-4 as amended v2.5): `f`, the window turned to the pass, 11 → 12.
    await expect(overlay.locator('kbd')).toHaveCount(12);
    await expect(page.getByRole('main')).toHaveAttribute('inert', '');
  },

  /**
   * R80 (FR-WATCH-1, FR-WATCH-4, FR-WATCH-9 f): the live page's two states, one
   * screen each. `live-watching` is the page as it opens — `liveAt` already
   * leaves it there, since the clock is at the shown instant from the start and
   * nothing has scrubbed.
   */
  async 'live-watching'(page, width, theme, locale) {
    await liveAt(page, width, theme, locale);
  },

  /** R149 (FR-FULL-10): the phone's live page as it opens in the day — the sky at real time and the card asking. */
  async 'live-tonight'(page, width, theme, locale) {
    await liveCard(page, width, theme, locale);
  },

  /** R149 (FR-FULL-9): the sheet open over the sky, and the sheet with the list open. */
  async 'live-sheet'(page, width, theme, locale) {
    await liveSheet(page, width, theme, locale, false);
  },
  async 'live-sheet-list'(page, width, theme, locale) {
    await liveSheet(page, width, theme, locale, true);
  },

  /**
   * `live-scrubbing` is the same page one `[ scrub ]` on. The instant is held at
   * `SHOWN`, which is where the page already was, so the pair of pictures
   * differs by the state and by nothing else — which is what makes them
   * readable side by side (FR-WATCH-7).
   */
  async 'live-scrubbing'(page, width, theme, locale) {
    await liveAt(page, width, theme, locale);
    await enterScrubbing(page);
    // The stripe's chunk, its 24 h overview and the playback row all draw on timers the paused clock is holding.
    await page.clock.runFor(1000);
    /*
     * R145 (FR-TONIGHT-4, FR-TONIGHT-6): on compact the page has one inventory in both states, so the scrubbing
     * picture is the watching one held and moved off real time by the reader's `next` — the first visible pass
     * rising after `SHOWN`, one minute before it, held: the chip the offset, the thumb on the pass's tick. The held
     * instant is the pass's, not the clock's, so it is the same in every run. R149 (FR-FULL-4, FR-FULL-9): the
     * track and the taps are the sheet's, which `enterScrubbing` opened; the picture is the sky with the sheet
     * closed again by its `[ close ]`, the head's time and chip off real time.
     */
    if ((await page.getByTestId('live-track').count()) > 0) {
      for (const row of ['live-context', 'live-track', 'live-taps']) await expect(page.getByTestId(row)).toBeVisible();
      await page.getByTestId('live-tap-next').click();
      await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'ahead');
      expect(await shownOnTrack(page)).toBeGreaterThan(SHOWN + TICK_MS);
      await closeSheet(page);
      await page.clock.runFor(1000);
      await blurFocus(page);
      await page.mouse.move(0, 0);
      return;
    }
    // FR-WATCH-4's scrubbing inventory, so a picture cannot be of a half-revealed block.
    for (const row of ['time-row', 'time-stripe', 'step-controls', 'playback-row']) await expect(page.getByTestId(row)).toBeVisible();
    // `[ scrub ]` holds the instant the page was showing, so the pair differs by the state and nothing else.
    expect(Math.abs(Number(await page.getByTestId('time-stripe').getAttribute('aria-valuenow')) - SHOWN)).toBeLessThanOrEqual(TICK_MS);
    await page.mouse.move(0, 0);
  },

  /**
   * R118 (FR-STAR-3, D-786): the page as it opens. A touch phone at 360 and 390 has `[ follow the phone ]`
   * on it (FR-WIN-4; R152, FR-GYRO-1, in place of `[ hold up to the sky ]`); a desk has the rail and `In this field` beside the box.
   */
  async stars(page, width, theme, locale) {
    await starsAt(page, width, theme, locale);
    if (isTouch('stars', width)) await expect(page.getByTestId('follow-toggle')).toBeVisible();
    else await expect(page.getByTestId('field-list').getByRole('button').first()).toBeVisible();
  },

  /**
   * R128 (FR-SKY-2, FR-SKY-9; US-41 AC1, AC4): the live page watching at `SHOWN`, its view control on `Window`.
   * Wide: the window-shaped box and the picker in the rail; compact: the square box by hand, the picker in its row.
   */
  async 'live-window'(page, width, theme, locale) {
    await liveAt(page, width, theme, locale);
    const chart = page.getByTestId('sky-chart');
    await windowInTheBox(page, chart, locale, SHOWN);
    await expect(chart).toHaveAttribute('data-view', 'window');
    // R132 (D-864): the facing row is the layout's `picker` slot, outside the figure.
    const picker = page.getByTestId('live-layout').locator('[data-slot="picker"]');
    await expect(picker.getByTestId('window-facing')).toBeVisible();
    if (width >= 1280) {
      // FR-SKY-13: the rail's picker carries the highlighted pass's key after `up`, as the screen's `what` says.
      const norad = SHOWN_PASS.split('-')[0] ?? '';
      const options = picker.locator('[data-option]');
      const names = await options.evaluateAll((els) => els.map((el) => el.getAttribute('data-option') ?? ''));
      const key = names.findIndex((name) => name.startsWith(`pass:${norad}-`));
      expect(key, "the highlighted pass's key is in the picker").toBeGreaterThan(-1);
      expect(key, '…after `up`').toBeGreaterThan(names.indexOf('up'));
    }
    await page.mouse.move(0, 0);
  },

  /**
   * R128 (FR-SKY-13, FR-DESK-4 as amended v2.5; US-41 AC5): the same page at 1280 with `f` pressed — the window
   * turned to the highlighted pass, which at `SHOWN` is the one three minutes in, and the key pressed in the rail.
   */
  async 'live-window-follow'(page, width, theme, locale) {
    await liveAt(page, width, theme, locale);
    const chart = page.getByTestId('sky-chart');
    await windowInTheBox(page, chart, locale, SHOWN);
    await page.keyboard.press('f');
    await page.clock.runFor(FRAME_MS);
    // The live page's set starts a pass already up at the instant it computed (`CHIP_SHOWN`'s note), so the
    // pass is known by its catalogue number here and not by `SHOWN_PASS`'s start.
    const norad = SHOWN_PASS.split('-')[0] ?? '';
    const readout = page.getByTestId('window-readout');
    await expect(readout).toHaveAttribute('data-following', new RegExp(`^${norad}-`));
    await expect(page.getByTestId('live-layout').locator('[data-slot="picker"]').locator(`[data-option^="pass:${norad}-"]`)).toHaveAttribute('aria-pressed', 'true');
    // The look is re-aimed each tick while it follows; put the instant back on `SHOWN` so the aim is the instant's.
    await pinnedAt(page, SHOWN);
    await expect(chart.locator(`[data-pass-id^="${norad}-"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
    await page.mouse.move(0, 0);
  },

  /**
   * R128 (FR-SKY-2, FR-SKY-7; US-41 AC2, AC4): the `guide` screen's pass on the window, facing the peak.
   */
  async 'guide-window'(page, width, theme, locale) {
    await openChart(page, width, theme, locale, 'dome');
    const figure = guide(page).getByRole('figure');
    await windowInTheBox(page, figure, locale, SHOWN);
    await expect(figure).toHaveAttribute('data-view', 'window');
    // R132 (D-864): the facing picker is the layout's `picker` slot, outside the figure.
    await expect(guide(page).locator('[data-slot="picker"] [data-option="peak"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(figure.locator(`[data-pass-id="${SHOWN_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
    // The box's foot to the panel's edge, as `sky-window.spec.ts` does: on wide the sheet scrolls on its own.
    await figure.getByTestId('chart-box').evaluate((el) => {
      el.scrollIntoView({ block: 'end' });
    });
    await page.mouse.move(0, 0);
  },

  /** R128 (FR-SKY-6; US-40 AC5): the stars page with `[ passes ]` on, faced to the pass. */
  async 'stars-passes'(page, width, theme, locale) {
    await starsWithPasses(page, width, theme, locale);
  },

  /**
   * R128 (FR-SKY-14 as FR-SKY-9 names it; US-41 AC6): the stars page as it opens at 1280, zoomed to the narrowest
   * field by the box's `+`. The page opens with the box focused (FR-A11Y-1..3), so the keys reach it at once; one
   * press more than 60 / 1.25ⁿ needs is held at the minimum.
   */
  async 'stars-zoom'(page, width, theme, locale) {
    await starsAt(page, width, theme, locale);
    const w = page.getByTestId('stars-sky').locator('[data-look-az]');
    await w.locator('div[data-dragging]').focus();
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('+');
    await page.clock.runFor(FRAME_MS);
    await expect(w).toHaveAttribute('data-fov', String(WINDOW_FOV_MIN_DEG));
    await expect(w).toHaveAttribute('data-look-az', '180');
    await expect(page.getByTestId('window-readout')).toContainText(`${String(WINDOW_FOV_MIN_DEG)}°`);
    await pinnedAt(page, CLOCK);
    await blurFocus(page);
    await page.mouse.move(0, 0);
  },

};

/**
 * P8 (US-36 AC8, FR-SHOW-9 b and c, FR-SAT-4): what no file of the set may read, in either language — a `UTC`
 * clock, a cloud badge with no forecast behind it, the readiness line or the failure line about the forecast, and
 * the staleness warning. Read off the document's text before the shot, so a seed that drifted fails the capture.
 */
const NOT_ON_THE_NIGHT = /\bUTC\b|Weather unknown|Clima desconocido|cloud forecast|pronóstico de nubes|lose accuracy|pierden precisión/;

/** One test per capture: reach the screen, prove the seed took, wait for a settled frame, shoot the file. */
function shoot(screen: (typeof SCREENS)[number], captures: ReturnType<typeof captureSet>): void {
  const reach = REACH[screen.name];
  if (!reach) throw new Error(`no route to the ${screen.name} screen`);
  for (const { width, theme, locale, view, file } of captures) {
    test(`${screen.name} at ${String(width)} px${view ? ' (view)' : ''}, ${theme}, ${locale}`, async ({ page }) => {
      await reach(page, width, theme, locale, view);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await settled(page);
      expect(await page.evaluate(() => document.body.innerText)).not.toMatch(NOT_ON_THE_NIGHT);
      await page.screenshot({ path: `${CAPTURE_DIR}/${file}`, fullPage: FULL_PAGE.has(screen.name) && !view });
    });
  }
}

for (const screen of SCREENS) {
  // R152 (FR-GYRO-6, D-958): a retired screen has no route; its files stay named until R153 takes them out of the set.
  if (screen.retired) continue;
  // R73 (FR-FSC-7 as amended): a screen may name fewer variants than there are; `captureSet` applies the
  // default. R94 (FR-CAP-1): a screen with `view` has each file twice, and the twin is the viewport.
  const captures = captureSet().filter((capture) => capture.screen === screen);
  const touch = captures.filter((capture) => isTouch(screen.name, capture.width));
  // `test.use` is per file or per describe, and touch belongs to the browser context, so the
  // captures that need a touch device are grouped rather than the whole set being given one:
  // every other capture is of the app on the device the reader of that width really has.
  if (touch.length > 0) {
    test.describe(`${screen.name} (a touch device, FR-WIN-4)`, () => {
      test.use({ hasTouch: true });
      shoot(screen, touch);
    });
  }
  shoot(screen, captures.filter((capture) => !isTouch(screen.name, capture.width)));
}
