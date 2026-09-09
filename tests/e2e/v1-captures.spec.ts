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
 * **Two places, because the screens want different skies.** The chart screens
 * are `live-captures.spec.ts`'s Paris moment — the one instant in the committed
 * fixtures where a pass is under way, the Moon is 60° up and the Sun is inside
 * FR-DOME-6's twilight band at once — and everything else is the Neuquén
 * fixture the rest of the suite runs on, nine days on from its capture, where
 * the list has three nights in it. One place would have cost one of the two,
 * and a flat picture of a rich screen is worth less than a tidy postcode.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR, captureName, LOCALES, SCREENS, THEMES, VIEWPORTS, type CaptureLocale, type CaptureTheme, type CaptureWidth } from './captureSet';
import { domeDrawn, heading, hhmmss, openLegend, openSettings, stripFilled, stubCompass } from './liveHelpers';
// Both observers are at altitude 0, which is what typing a coordinate pair gives (FR-LOC-4) and what
// the committed pass ids were computed at: a seeded altitude would move every pass start by a second
// or two and the glare pass would no longer be found by its id. Only Paris is observed from; Neuquén
// is here to be the second row of the saved places.
import { FIXTURE_DATE, NEUQUEN, PARIS } from './observers';

const DAY_MS = 86_400_000;
const PREFS_KEY = 'wiys:prefs:v1';

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
 * The pass the Moon stands 8° from (`live-captures.spec.ts`, R22), and the
 * night the whole set is shot on: 2026-09-02 over Paris, the elements seven
 * hours old.
 *
 * The rest of the suite runs at Neuquén nine days on from the fixture capture,
 * because that is where the golden ISS pass is. A release capture cannot: nine
 * days puts the newest epoch past FR-SAT-4's five-day mark and the staleness
 * warning across the top of every home screen, and no earlier clock over
 * Neuquén has an ISS pass to put in the hero card — the visible season there
 * starts on the 11th. Over Paris the same fixtures have an ISS pass fifty
 * minutes ahead at `CLOCK`, so one place and one night carry every screen: the
 * list with its hero, the pass open on both charts, and the live page at the
 * moment it is overhead.
 *
 * What it costs is the weather. The only forecast in the fixtures is over
 * Neuquén, so every cloud badge here reads "weather unknown" — which is the
 * FR-WX-1 fallback doing its job, and cheaper than a staleness banner on the
 * front page. `r27-*.png` is the capture set with a forecast in it.
 */
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
/** Three minutes into a six-minute pass: the marker near the peak, half the arc behind it (FR-DOME-5's two colours). */
const SHOWN = GLARE_PASS_START + 180_000;
/** R53: the legend screen's instant, two minutes further on — see the `legend` route. */
const LEGEND_SHOWN = SHOWN + 120_000;
const TICK_MS = 10_000;

const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;

/** Neuquén saved but not in use, Paris in use: the "in use" mark is on one row and not the other. Two screens seed them (R53: the settings page lists them too, FR-COMP-2). */
const SAVED_PLACES = [
  { cellKey: '-38.93,-67.99', observer: NEUQUEN, addedAt: CLOCK - 2 * DAY_MS, lastUsedAt: CLOCK - 2 * DAY_MS },
  { cellKey: '48.86,2.35', observer: PARIS, addedAt: CLOCK - DAY_MS, lastUsedAt: CLOCK - 60_000 },
];

/**
 * The screens whose point is everything on them, so the capture is the whole
 * document and not the first 844 px of it. R53 adds the settings page, which is
 * seven sections and a footer on a phone.
 */
const FULL_PAGE = new Set(['location', 'home', 'settings']);

/**
 * R53 (FR-WIN-4): the window is offered where the presence test passes — a
 * touch device with the constructor — and that is a property of the device, not
 * of the width, so its two profiles are the phone and a wide screen that has a
 * touch panel. Playwright grants touch per context, so these tests need a
 * `test.use` of their own and the rest of the set must not have it.
 */
const TOUCH = new Set(['window', 'sky-screen-sky', 'sky-screen-ground', 'sky-screen-buried', 'sky-screen-portrait', 'sky-screen-turned']);

const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;
const WINDOW_OPTION = { en: 'Window', es: 'Ventana' } as const;
const VIEW_OPTION_WINDOW = { en: 'Window', es: 'Ventana' } as const;
const FRAME_MS = 16;

/** The two states R56 added to the window: `state` is how far below the horizon the phone points, in a square 60° box (R56's own numbers). */
const GROUND_STATE: Record<'window-ground' | 'window-buried', { altDeg: number; state: 'ground' | 'buried' }> = {
  'window-ground': { altDeg: -10, state: 'ground' },
  'window-buried': { altDeg: -60, state: 'buried' },
};

interface SeedPrefs {
  locale: CaptureLocale;
  theme: CaptureTheme;
  observer?: Observer;
  chartView?: 'dome' | 'polar';
  favourites?: { cellKey: string; observer: Observer; addedAt: number; lastUsedAt: number }[];
}

/** The elements from the fixtures, and nothing else: no forecast over Paris, and no geocoder, since every observer here is a coordinate pair. */
async function stubNetwork(page: Page): Promise<void> {
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
}

/** A page at `width` on the paused clock, with the preferences already in storage and the network stubbed. Called once per test. */
async function open(page: Page, width: CaptureWidth, prefs: SeedPrefs, time = CLOCK): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as [string, string],
  );
  await stubNetwork(page);
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

/**
 * The list, settled, asked in neither language: the ISS hero card is up, the
 * 72 h search has stopped (nothing is left `aria-busy`) and the passes are
 * grouped by night. Every wait here is on a `data-testid` or an ARIA state, so
 * the English and the Spanish run take the same path.
 */
async function listSettled(page: Page): Promise<void> {
  await expect(page.getByTestId('iss-hero')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  expect(await page.getByTestId('night-group').count()).toBeGreaterThan(0);
  // The readiness line appears once the finished run has been stored (FR-OFF-4), which is a
  // beat after the search itself ends: without this wait two runs of the same capture
  // disagree about whether the location block has a line under it.
  await expect(page.getByTestId('readiness')).toBeVisible({ timeout: 60_000 });
  // The pointer is wherever the last action left it, and a cloud badge under it opens its tooltip over the capture.
  await page.mouse.move(0, 0);
}

/**
 * F-48 (R37): every capture is shot at `SHOWN`, on the dot.
 *
 * Waiting for a drawn chart means ticking the paused clock (`domeDrawn`), and
 * how many ticks that takes is a property of the run, not of the picture: R36's
 * live captures were shot wherever the last tick left the clock, so the time
 * field and the marker moved between two runs of the same file. So the waiting
 * is done first and the clock is only then put where the capture wants it —
 * one tick short of the instant, then a tick, which is how the page arrives at
 * a new `now` in the app as well (`NOW_TICK_MS`).
 */
async function pinnedAt(page: Page, t: number): Promise<void> {
  await page.clock.setSystemTime(t - TICK_MS);
  await page.clock.runFor(TICK_MS);
}

/** The chart screens: the glare pass open on `view`, three minutes in. */
async function openChart(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, view: 'dome' | 'polar'): Promise<void> {
  await open(page, width, { locale, theme, observer: PARIS, chartView: view });
  await page.goto('/');

  const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  // The wide layout keeps the list beside the guide, so the capture would otherwise carry
  // "Computing passes… 17 of 93" next to a finished chart. The search is let finish first.
  await listSettled(page);
  await card.getByRole('button', { name: OPEN_GUIDE[locale] }).click();
  const figure = guide(page).getByRole('figure');
  // The view came from the seeded preference (US-6 AC5), so there is no toggle to click and no frame drawn on the other one.
  await expect(figure).toHaveAttribute('data-view', view);
  // The chart chunk, the raster font and glyphcss's first rasterisation all wait on timers the paused clock is holding.
  await page.clock.runFor(1000);
  if (view === 'dome') await expect(figure.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });

  // …and then into the pass, arriving on the tick the sheet lives by rather than through three hundred of them.
  await pinnedAt(page, SHOWN);
  // R45 (FR-DOME-6 as amended): the two bodies are legend lines, not captions in the drawing.
  await expect(figure.getByTestId('chart-legend').locator('[data-body="sun"]')).toHaveCount(1);
  await expect(figure.getByTestId('chart-legend').locator('[data-body="moon"]')).toHaveCount(1);
  if (view === 'polar') await expect(figure.locator('[data-marker="now"]')).toHaveCount(1);
  await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
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
async function liveAt(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale): Promise<void> {
  await open(page, width, { locale, theme, observer: PARIS }, SHOWN);
  await page.goto('/');
  await listSettled(page);
  // The router listens for `hashchange`, so setting the hash in the page navigates without
  // reloading it — which is the point: a reload would start the search again.
  await page.evaluate(() => {
    location.hash = '#live';
  });
  // The place is asserted after the dome, not before: the route is lazy, and its Suspense
  // reveal is one of the timers the paused clock is holding until `domeDrawn` ticks it.
  await domeDrawn(page);
  await expect(page.getByTestId('live-place')).toHaveText(PARIS.label);
  // The strip settled: five fields, each visible and none still on its pending ellipsis (F-47:
  // `liveHelpers.ts` owns that check, and this file had been carrying a copy without the visibility half).
  await stripFilled(page);
  // F-48: `domeDrawn` left the clock wherever its last tick fell, so the shown instant is put back
  // on `SHOWN` before the picture — and the strip is read to prove the page went there with it.
  await pinnedAt(page, SHOWN);
  // …to the ten-second tick the strip reads the clock at (FR-VIS-5), and in neither language's words:
  // the zone is unknown over Paris, so both of them print the UTC time of `SHOWN`.
  await expect(page.getByTestId('live-time')).toContainText(hhmmss(SHOWN).slice(0, 7));
  await page.mouse.move(0, 0);
}

/**
 * R53 (FR-WIN-3): a reading from the phone — the W3C alpha for a back facing
 * `azDeg`, tilted `altDeg` up — and then one frame, which the installed clock
 * is holding. `sky-window.spec.ts` has the same two helpers; they are four
 * lines each and copying them keeps this file's clock discipline in one place.
 */
async function point(page: Page, azDeg: number, altDeg: number): Promise<void> {
  await page.evaluate(
    ([alpha, beta]) => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha, beta, gamma: 0, absolute: true }));
    },
    [(360 - azDeg) % 360, 90 + altDeg] as [number, number],
  );
  await page.clock.runFor(FRAME_MS);
}

/** Frames until the FR-WIN-3 smoothing has settled on the last reading. */
async function settle(page: Page): Promise<void> {
  await page.clock.runFor(40 * FRAME_MS);
}

/**
 * R64 (FR-FSC-1, FR-FSC-7), R66 (V13-6): the sky screen, in the state its own
 * screen name carries. The route is the reader's: the live page, the view
 * control's "window", and the reading with a north in it that the tap waits for
 * (D-350) — the layer opens on that reading and not on the click.
 *
 * `sky` is turned to where the pass is, as `live-following` was: a picture with
 * an arc in it is worth more than an empty sky. The two ground states are swept
 * down the look's own azimuth.
 *
 * R73 (FR-FSC-4 as rewritten, FR-FSC-7 as amended, FR-FSC-10, FR-FSC-11):
 * `portrait` is the phone held upright, which since v1.4.1 is a picture and not
 * a note — the same aim as `sky`, in the portrait box, with the advice line
 * over it — and `turned` is the phone held sideways while the viewport stays
 * upright, which is what a rotation lock does: the pose says 90, the layer
 * turns, and the picture is landscape inside a portrait viewport.
 */
type FollowState = 'sky' | 'ground' | 'buried' | 'portrait' | 'turned';

async function followScreen(page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale, state: FollowState): Promise<void> {
  await stubCompass(page);
  await liveAt(page, width, theme, locale);
  await page.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: VIEW_OPTION_WINDOW[locale] }).click();
  await expect
    .poll(
      async () => {
        await heading(page, 270);
        return page.getByTestId('sky-screen').count();
      },
      { timeout: 15_000 },
    )
    .toBe(1);
  // The paused clock holds the lazy chunk's Suspense reveal (R32).
  await page.clock.runFor(1000);
  // FR-FSC-1: none of the live page is under the layer any more — the rows are not rendered at all.
  await expect(page.getByTestId('stripe-block')).toHaveCount(0);
  await expect(page.getByTestId('sky-screen-close')).toBeVisible();
  const drawing = page.locator('[data-look-az]');
  await expect(drawing).toBeAttached();
  if (state === 'turned') {
    /*
     * The pose of a phone held sideways on a viewport that never reflows — a rotation lock. `gamma: -90` puts
     * the room's up along the device's +X, which is its top to the reader's left and the browser's angle 90 on
     * a phone that is free to turn; the extra 20° raises the look that far above the horizon, as `point` does
     * for the upright poses. `alpha` is swept for the same reason `sky` sweeps the azimuth: a picture with an
     * arc in it is worth more than an empty sky.
     */
    for (const alpha of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
      await page.evaluate((a) => {
        window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: a, beta: 0, gamma: -110, absolute: true }));
      }, alpha);
      await settle(page);
      if ((await page.locator('[data-drawing="window"] [data-pass-id]').count()) > 0) break;
    }
    await expect(page.getByTestId('sky-screen')).toHaveAttribute('data-turn', '90');
    await expect(drawing).toHaveAttribute('data-orientation', 'landscape');
    await expect(drawing).toHaveAttribute('data-ground', 'sky');
    await page.mouse.move(0, 0);
    return;
  }
  if (state === 'sky' || state === 'portrait') {
    for (const azDeg of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
      await point(page, azDeg, 20);
      await settle(page);
      if ((await page.locator('[data-drawing="window"] [data-pass-id]').count()) > 0) break;
    }
    await expect(drawing).toHaveAttribute('data-ground', 'sky');
    // FR-FSC-11: upright, the advice stands over that picture — which is what the portrait shot is of.
    if (state === 'portrait') await expect(page.getByTestId('window-turn-note')).toBeVisible();
  } else {
    // Down the look's own azimuth, so the sky the `ground` state still holds is the sky the reader was in.
    const azDeg = Number(await drawing.getAttribute('data-look-az'));
    await point(page, azDeg, GROUND_STATE[state === 'ground' ? 'window-ground' : 'window-buried'].altDeg);
    await settle(page);
    await expect(drawing).toHaveAttribute('data-ground', state);
  }
  await page.mouse.move(0, 0);
}

type Reach = (page: Page, width: CaptureWidth, theme: CaptureTheme, locale: CaptureLocale) => Promise<void>;

/** Every screen's route to itself, by the name it carries in `captureSet.ts`. */
const REACH: Record<string, Reach> = {
  async location(page, width, theme, locale) {
    await open(page, width, { locale, theme });
    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  },

  async home(page, width, theme, locale) {
    await open(page, width, { locale, theme, observer: PARIS });
    await page.goto('/');
    await listSettled(page);
    // The nights are closed so the whole screen fits in one picture. Paris in September has
    // tens of visible passes a night, and the open default made the phone capture 20 000 px
    // tall — a file nobody can review. Closed, the capture carries every part of the home
    // screen at once (the location block, the saved places, the elements line, the Now panel,
    // the Moon, the hero card, the sort toggle, the three nights with their counts, the
    // footer), and the cards themselves are what `guide` and `polar` are for.
    await page.getByTestId('night-group').evaluateAll((nights) => {
      for (const night of nights) (night as HTMLDetailsElement).open = false;
    });
    await expect(page.locator('[data-testid="night-group"][open]')).toHaveCount(0);
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
    await open(page, width, { locale, theme, observer: PARIS, favourites: SAVED_PLACES });
    await page.goto('/');
    // The form's fields are the observer's, and the readiness line above them is the settled run's.
    await listSettled(page);
    await page.evaluate(() => {
      location.hash = '#settings';
    });
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
   * R53 (FR-WIN-1..5): the sky window, on the same pass as the dome and the
   * polar captures. `sky-window.spec.ts` is where the view is tested; here it
   * only has to be aimed somewhere worth photographing, which is the peak of
   * the pass the whole set is shot on.
   *
   * Aiming is two readings, as it is in that spec: the placeholder already
   * points at the peak (D-241), and the second reading takes off the local
   * declination the window applies (FR-WIN-3), so the look lands exactly where
   * the placeholder promised rather than a couple of degrees beside it.
   */
  async window(page, width, theme, locale) {
    await stubCompass(page);
    await openChart(page, width, theme, locale, 'dome');
    const figure = guide(page).getByRole('figure');
    // R66 (V13-6, V13-9): the option opens the sky screen over the sheet, and the reading is what opens it (D-350).
    await figure.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: WINDOW_OPTION[locale] }).click();
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 90, gamma: 0, absolute: true }));
    });
    // The paused clock holds the lazy chunk's Suspense reveal (R32), as it does for the dome.
    await page.clock.runFor(1000);
    const layer = page.getByTestId('sky-screen');
    await expect(layer).toHaveCount(1);
    const drawing = layer.locator('[data-look-az]');
    await expect(drawing).toBeAttached();
    const aim = { az: Number(await drawing.getAttribute('data-look-az')), alt: Number(await drawing.getAttribute('data-look-alt')) };
    await point(page, aim.az, aim.alt);
    await settle(page);
    await expect(drawing).toHaveAttribute('data-state', 'on');
    const declination = Number(await layer.getByTestId('window-heading').getAttribute('data-declination'));
    await point(page, aim.az - declination, aim.alt);
    await settle(page);
    await expect(layer.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
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
    await liveAt(page, width, theme, locale);
    await page.getByTestId('live-hidden-toggle').click();
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
    await open(page, width, { locale, theme, observer: PARIS, favourites: SAVED_PLACES });
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
    await open(page, width, { locale, theme, observer: PARIS });
    await page.goto('/');
    await listSettled(page);
    // FR-DESK-4: the keys are the page's only while nothing has the caret. Nothing here typed, so the body still has focus.
    await page.keyboard.press('?');
    const overlay = page.getByTestId('shortcuts-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('kbd')).toHaveCount(8);
    await expect(page.getByRole('main')).toHaveAttribute('inert', '');
  },

  async live(page, width, theme, locale) {
    await liveAt(page, width, theme, locale);
  },

  /** R64 (FR-FSC-1, FR-FSC-4, FR-FSC-7): the four states of the screen `[ follow phone ]` opens. */
  async 'sky-screen-sky'(page, width, theme, locale) {
    await followScreen(page, width, theme, locale, 'sky');
  },

  async 'sky-screen-ground'(page, width, theme, locale) {
    await followScreen(page, width, theme, locale, 'ground');
  },

  async 'sky-screen-buried'(page, width, theme, locale) {
    await followScreen(page, width, theme, locale, 'buried');
  },

  async 'sky-screen-portrait'(page, width, theme, locale) {
    await followScreen(page, width, theme, locale, 'portrait');
  },

  /** R73 (FR-FSC-7 as amended, FR-FSC-10): the rotation-locked phone held sideways, with the layer turned. */
  async 'sky-screen-turned'(page, width, theme, locale) {
    await followScreen(page, width, theme, locale, 'turned');
  },
};

/** One test per capture: reach the screen, prove the seed took, shoot the file. */
function shoot(screen: (typeof SCREENS)[number]): void {
  const reach = REACH[screen.name];
  if (!reach) throw new Error(`no route to the ${screen.name} screen`);
  for (const width of screen.widths) {
    // R73 (FR-FSC-7 as amended): a screen may name fewer variants than there are; all of them is the default.
    for (const theme of screen.themes ?? THEMES) {
      for (const locale of screen.locales ?? LOCALES) {
        test(`${screen.name} at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
          await reach(page, width, theme, locale);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('html')).toHaveAttribute('lang', locale);
          await page.screenshot({ path: `${CAPTURE_DIR}/${captureName(screen.name, width, theme, locale)}`, fullPage: FULL_PAGE.has(screen.name) });
        });
      }
    }
  }
}

for (const screen of SCREENS) {
  if (TOUCH.has(screen.name)) {
    // `test.use` is per file or per describe, and touch belongs to the browser context, so the
    // screens that need a touch device are grouped rather than the whole set being given one:
    // every other capture is of the app on the device the reader of that width really has.
    test.describe(`${screen.name} (a touch device, FR-WIN-4)`, () => {
      test.use({ hasTouch: true });
      shoot(screen);
    });
  } else {
    shoot(screen);
  }
}
