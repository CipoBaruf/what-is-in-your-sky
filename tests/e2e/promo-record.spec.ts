/**
 * P4 (SPEC §4.43, FR-SHOW-6, FR-SHOW-7; US-36 AC5; PLAN D-652..D-654): the
 * recording run. `npm run promo:record` builds the app as `npm run e2e` does
 * and runs this file alone, under the `promo` project of the one config; every
 * other project ignores it, so `npm run e2e` and CI never record.
 *
 *   npm run promo:record
 *
 * Material, not evidence: one test per flow, each writing a video to
 * `promo/media/<flow>-<device>.webm` (an `.mp4` beside it when `ffmpeg` is on
 * `PATH`) and the stills the flow names as `promo/media/<flow>-<device>-<still>.png`.
 * Nothing under `promo/` is tracked (`.gitignore`, FR-SHOW-3) and nothing
 * here asserts what a frame looks like: every expectation is there so a file
 * cannot be of a page that had not finished loading.
 *
 * **The showcase night, moved by the clock (D-653, D-683; FR-SHOW-9).** Every
 * flow is seeded on one place and one night, from `observers.ts`: Bariloche,
 * picked as a reader picks it — `bariloche` typed into the place search and
 * the first result taken — at `SHOWCASE_NIGHT` (2026-09-06 05:00 local, D-690), 48
 * minutes before the night's first bright pass, so the countdown runs on camera. The
 * elements are a little over four days old, under FR-SAT-4's five, and no
 * flow's clock runs past `SHOWCASE_UNTIL`, where the staleness warning would
 * appear; the observer has its zone, so every clock reads local time. The
 * finished run `tests/fixtures/stored-run-bariloche.json` is in IndexedDB
 * before the place is set, so the list is on screen the moment it is
 * (FR-OFF-2, the R82 method). Nothing in a recording is live data: the
 * elements are the fixtures, and `stubNetwork(page, 'fixtures', 'showcase')`
 * answers the forecast for Bariloche's cell and the geocoder for `bariloche`
 * with the recorded bodies and refuses anything else, so the cloud badges read
 * the night's forecast. `page.clock` is installed at the flow's instant
 * (`promoFlows.ts`'s `at`) and paused; between actions `watch` runs it forward
 * in small steps at wall-clock pace, so the countdown ticks and the mark's bead
 * moves in the file while the instant every screen shows is the fixture's
 * whatever the box's speed. (P4 ran every flow over Paris with the forecast
 * refused, D-673; the capture set stays there until P8.)
 *
 * **The frame (D-652).** A phone flow is 390 × 844 at a device pixel ratio of
 * 3 and asks for a 1170 × 2532 recording, a reel's shape; a desktop flow is
 * 1440 × 900 and asks for that. Chromium's screencast may cap the phone frame
 * below what is asked; the size a run produced is in P4's Done note. Two
 * frames in one file is more than `test.use` allows — Playwright refuses a
 * `video` option inside a `describe`, since it would force a new worker — so
 * each flow opens its own context with its device's `recordVideo` and closes
 * it when it is done, which is also what finishes the file. The project's own
 * `video` option is the same phone frame, for any page the fixture would open.
 */
import { execFileSync } from 'node:child_process';
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { guide, OPEN_GUIDE, type SeedPrefs } from './captureSeeds';
import { domeDrawn, enterScrubbing, stripFilled, stubNetwork, type StoredRun } from './liveHelpers';
import { BARILOCHE, BARILOCHE_QUERY, LONDON, STORED_RUN_BARILOCHE_FILE, STORED_RUN_LONDON_FILE } from './observers';
import { DEVICES, MEDIA_DIR, PROMO_FLOWS, promoStill, promoVideo, type PromoFlow } from './promoFlows';

/** The list is `promoFlows.ts`'s, so `tests/docs/promo.test.ts` can read it without loading this file; it is the spec's export all the same. */
export { PROMO_FLOWS };

const flow = (name: string): PromoFlow => {
  const found = PROMO_FLOWS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no flow named ${name}`);
  return found;
};

/** The finished 72 h run over Bariloche at `SHOWCASE_NIGHT`, computed by `scripts/build-stored-run.ts` from the same fixtures the page loads. */
const SHOWCASE_RUN = JSON.parse(readFileSync(STORED_RUN_BARILOCHE_FILE, 'utf8')) as StoredRun;
/** The dome flows' run over London at `DOME_NIGHT` (D-696). */
const LONDON_RUN = JSON.parse(readFileSync(STORED_RUN_LONDON_FILE, 'utf8')) as StoredRun;

/** The place search and its result list, named in the flow's language (FR-LOC-2). */
const PLACE = {
  en: { field: 'Place name', results: 'Matching places' },
  es: { field: 'Nombre del lugar', results: 'Lugares coincidentes' },
} as const;

const PREFS_KEY = 'wiys:prefs:v1';

/** How far the clock runs per step of `watch`: twenty steps a second, so a bead on an animation frame moves rather than jumps. */
const STEP_MS = 50;

/**
 * The paused clock, run forward `ms` at wall-clock pace: each step advances
 * the page's time and then waits as long for real, so the frames the screencast
 * takes meanwhile show the countdown ticking and the bead moving (D-653).
 * `runFor` alone would move the instant in one frame, and `resume` would let
 * the clock drift with the box; this is the one way the file carries the
 * motion and the instant is still the fixture's.
 */
async function watch(page: Page, ms: number): Promise<void> {
  for (let run = 0; run < ms; run += STEP_MS) {
    await page.clock.runFor(STEP_MS);
    await page.waitForTimeout(STEP_MS);
  }
}

/** Ticks the paused clock until `ready` says so: lazy chunks, fonts and glyphcss all wait on timers the clock is holding (R32). */
async function tickUntil(page: Page, ready: () => Promise<boolean>, timeout = 60_000): Promise<void> {
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return ready();
    }, { timeout })
    .toBe(true);
}

/** The stills a test shot, checked against the flow's list at its end so the two cannot drift; keyed by flow and device, since the dome flows share a name (D-696). */
const shot = new Map<string, string[]>();
const shotKey = (of: PromoFlow): string => `${of.name}-${of.device}`;

/** One still, by the name the flow gives it (D-654): a frame of the flow, into `promo/media/`. */
async function still(page: Page, of: PromoFlow, name: string): Promise<void> {
  if (!of.stills.includes(name)) throw new Error(`${of.name} names no still "${name}"`);
  await page.screenshot({ path: promoStill(of, name) });
  shot.set(shotKey(of), [...(shot.get(shotKey(of)) ?? []), name]);
}

/** The videos the file produced, moved by `afterAll`: where Playwright wrote each, and where it goes. */
const recorded: { source: string; target: string; device: PromoFlow['device'] }[] = [];

/** The contexts still open, closed by `afterEach` if a flow failed before `done` (a failed take is still finished, in Playwright's output). */
const open = new Set<BrowserContext>();

/**
 * A flow's page: its own context, on its device, recording at the device's
 * frame into the test's output directory (where Playwright would have put it),
 * with the project's `baseURL` and action timeout.
 */
async function record(browser: Browser, of: PromoFlow): Promise<Page> {
  const device = DEVICES[of.device];
  const { baseURL, actionTimeout } = test.info().project.use;
  const context = await browser.newContext({
    ...(baseURL === undefined ? {} : { baseURL }),
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    hasTouch: device.hasTouch,
    recordVideo: { dir: test.info().outputPath('video'), size: device.frame },
  });
  if (actionTimeout !== undefined) context.setDefaultTimeout(actionTimeout);
  open.add(context);
  return context.newPage();
}

/** The end of a flow: every still it names was shot, the context is closed — which finishes the video — and the file is on the list to move. */
async function done(page: Page, of: PromoFlow): Promise<void> {
  expect(shot.get(shotKey(of)) ?? []).toEqual([...of.stills]);
  const video = page.video();
  if (!video) throw new Error(`${of.name}: no video was recorded`);
  const context = page.context();
  await context.close();
  open.delete(context);
  recorded.push({ source: await video.path(), target: promoVideo(of), device: of.device });
}

test.afterEach(async () => {
  for (const context of open) await context.close();
  open.clear();
});

/**
 * The finished 72 h run for Bariloche at `SHOWCASE_NIGHT`, written into IndexedDB from
 * inside the page (`liveHelpers.seedStoredRun` and R84's
 * `first-run-controls.spec.ts` do the same), so a flow that types the place or
 * opens with it saved shows the list at once rather than the worker's progress.
 */
async function storeRun(page: Page, stored: StoredRun = SHOWCASE_RUN): Promise<void> {
  await page.evaluate(async (run: unknown) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('wiys', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('elementGroups')) db.createObjectStore('elementGroups', { keyPath: 'group' });
        if (!db.objectStoreNames.contains('passRuns')) db.createObjectStore('passRuns', { keyPath: 'cellKey' });
      };
      request.onerror = () => {
        reject(new Error('could not open the wiys database'));
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('passRuns', 'readwrite');
        tx.objectStore('passRuns').put(run);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          reject(new Error('could not store the run'));
        };
      };
    });
  }, stored);
}

/**
 * A page on the flow's paused clock with the preferences already in storage
 * (D-70, as `captureSeeds.seedPage` seeds them) and the showcase network: the
 * elements from the fixtures, the forecast for Bariloche's cell and the
 * geocoder for `bariloche` from the recorded bodies, anything else refused
 * (D-682). Called once per flow, before the first `goto`.
 */
async function seedShowcase(page: Page, of: PromoFlow, prefs: SeedPrefs): Promise<void> {
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as [string, string],
  );
  await stubNetwork(page, 'fixtures', 'showcase');
  await page.clock.install({ time: of.at });
  await page.clock.pauseAt(of.at);
}

/** A first visit on the showcase night: no place, the run for the place the flow will pick already stored. */
async function coldAtBariloche(page: Page, of: PromoFlow): Promise<void> {
  await seedShowcase(page, of, { locale: of.locale, theme: of.theme });
  await page.goto('/');
  await storeRun(page);
  await expect(page.getByTestId('cold-open')).toBeVisible();
}

/**
 * A returning reader in Bariloche on the showcase night: the place saved and
 * the finished run stored, so the reload boots the app the way their browser
 * does — the stored list on screen before the first request goes out
 * (FR-OFF-2), and the recompute that follows finding the same passes.
 */
async function homeAtBariloche(page: Page, of: PromoFlow): Promise<void> {
  await seedShowcase(page, of, { locale: of.locale, theme: of.theme, observer: BARILOCHE });
  await page.goto('/');
  await storeRun(page);
  await page.reload();
  await expect(page.locator('article[data-pass-card]').first()).toBeVisible({ timeout: 30_000 });
}

/** The recompute a new place starts has come and gone: nothing on the page is `aria-busy` (`liveHelpers.recomputeEnded`, with the clock ticking). */
async function recomputed(page: Page): Promise<void> {
  await page
    .locator('[aria-busy="true"]')
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .catch(() => undefined);
  await tickUntil(page, async () => (await page.locator('[aria-busy="true"]').count()) === 0);
}

/**
 * The place, typed as a reader types it — `bariloche`, a character at a time —
 * into the cold open's place search, and the result list on screen: the paused
 * clock holds the picker's 500 ms debounce, so it is run on until the recorded
 * answer is listed (D-683). Returns the first result, for the flow to pick.
 */
async function searchPlace(page: Page, locale: 'en' | 'es'): Promise<Locator> {
  const field = page.getByTestId('cold-open').getByRole('combobox', { name: PLACE[locale].field });
  await field.click();
  await field.pressSequentially(BARILOCHE_QUERY, { delay: 70 });
  const first = page.getByRole('listbox', { name: PLACE[locale].results }).getByRole('option').first();
  await tickUntil(page, () => first.isVisible(), 30_000);
  await expect(first).toContainText(BARILOCHE.label.split(',')[0] ?? BARILOCHE.label);
  return first;
}

/**
 * The first result picked, and the pointer taken off the page: the tap lands
 * where the next screen puts a cloud badge, and a badge under the pointer opens
 * its tooltip over the frame and over the control the flow taps next.
 */
async function pick(page: Page, result: Locator): Promise<void> {
  await result.click();
  await page.mouse.move(0, 0);
}

/**
 * The home with its place saved, settled: a card up, the 72 h search stopped
 * (nothing `aria-busy`), the passes grouped by night and the readiness line
 * written once the run is stored (FR-OFF-4). `captureSeeds.listSettled` also
 * waits for the ISS's `Next` tag, which the showcase night does not hold
 * (FR-SHOW-9), so the recordings wait on the rest of it here.
 */
async function homeSettled(page: Page): Promise<void> {
  await expect(page.locator('article[data-pass-card]').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  expect(await page.getByTestId('night-group').count()).toBeGreaterThan(0);
  await expect(page.getByTestId('readiness')).toBeVisible({ timeout: 60_000 });
  await page.mouse.move(0, 0);
}

/** The pass's guide open with its dome drawn: the sheet on a phone, the panel on a desk, and the chart chunk revealed by the clock. */
async function guideDrawn(page: Page): Promise<Locator> {
  const figure = guide(page).getByRole('figure');
  await expect(figure).toBeVisible({ timeout: 30_000 });
  await tickUntil(page, () => figure.locator('[data-layer="lines"] pre.glyph-output').isVisible(), 30_000);
  // The sheet opens on its heading; the drawing is what the frame is for.
  await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
  return figure;
}

/** The live page from the home's header link, its dome drawn and its conditions line filled. */
async function openLive(page: Page): Promise<void> {
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

/**
 * The phone's first run (FR-FIRST-1..3): the cold open, `bariloche` typed and
 * the recorded answer listed, the first result picked — which moves the page
 * on to the when step with its count, a place from the list being settled —
 * `[ see what ]` to the cards, and the first card's pass opened to its guide.
 * The `where` still is of the result list, the search on screen.
 */
async function firstRun(browser: Browser, of: PromoFlow): Promise<void> {
  const page = await record(browser, of);
  await coldAtBariloche(page, of);
  await watch(page, 1_500);
  const result = await searchPlace(page, of.locale);
  await watch(page, 1_500);
  await still(page, of, 'where');
  await pick(page, result);

  const when = page.getByTestId('step-when');
  await expect(when).toBeVisible();
  await expect(when.getByTestId('when-passes')).toHaveText(/\d+/, { timeout: 60_000 });
  await recomputed(page);
  await watch(page, 4_000);
  await still(page, of, 'when');
  await when.getByTestId('see-what').click();

  const what = page.getByTestId('step-what');
  await expect(what).toBeVisible();
  const first = what.getByTestId('next-event');
  await expect(first).toHaveAttribute('data-form', 'card');
  await watch(page, 3_000);
  await still(page, of, 'what');
  await first.getByRole('button', { name: OPEN_GUIDE[of.locale] }).click();
  await guideDrawn(page);
  await watch(page, 4_000);
  await still(page, of, 'guide');
  await done(page, of);
}

test.describe('phone', () => {
  for (const name of ['first-run-en-dark', 'first-run-en-night', 'first-run-es-dark']) {
    const of = flow(name);
    test(`${of.name}: the first run, ${of.locale} ${of.theme}`, async ({ browser }) => {
      await firstRun(browser, of);
    });
  }

  test('list-and-card: the list with tonight open, and a card opened to its guide', async ({ browser }) => {
    const of = flow('list-and-card');
    const page = await record(browser, of);
    await homeAtBariloche(page, of);
    await recomputed(page);
    await expect(page.locator('[data-testid="night-group"][data-open="true"]')).toHaveCount(1);
    await watch(page, 3_000);
    // Down to the cards, as a reader thumbs the page, and the still is of them.
    const card = page.locator('article[data-pass-card]').first();
    await card.scrollIntoViewIfNeeded();
    await watch(page, 3_000);
    await still(page, of, 'list');
    await card.getByRole('button', { name: OPEN_GUIDE[of.locale] }).click();
    await guideDrawn(page);
    await watch(page, 6_000);
    await still(page, of, 'guide');
    await done(page, of);
  });

  test('live-see-this-pass: the live page watching, [ see this pass ], the held pass, and [ back to live ]', async ({ browser }) => {
    const of = flow('live-see-this-pass');
    const page = await record(browser, of);
    await seedShowcase(page, of, { locale: of.locale, theme: of.theme, observer: BARILOCHE });
    await page.goto('/');
    await homeSettled(page);
    await openLive(page);
    const see = page.getByTestId('next-event-see');
    await expect(see).toBeVisible();
    await watch(page, 4_000);
    await still(page, of, 'watching');
    const passId = (await see.getAttribute('data-pass')) ?? '';
    await see.click();
    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'held');
    // The paused clock holds the stripe chunk's reveal, and the arc is drawn once the held instant's set is computed.
    const arc = page.getByTestId('live-dome').locator(`[data-drawing] [data-pass-id="${passId}"]`);
    await tickUntil(page, async () => (await arc.count()) > 0, 30_000);
    // No minute steps: Tiangong's 05:48 pass lasts 40 s, so a step would leave it behind and the still would read `0 up` (D-690).
    await watch(page, 6_000);
    await still(page, of, 'held');
    await page.getByTestId('live-now').click();
    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
    await watch(page, 3_000);
    await still(page, of, 'back-to-live');
    await done(page, of);
  });

  test('settings-language: the settings page, and the switch to Spanish', async ({ browser }) => {
    const of = flow('settings-language');
    const page = await record(browser, of);
    await homeAtBariloche(page, of);
    await recomputed(page);
    await watch(page, 2_000);
    // R93 (D-545): the settings page is a lazy chunk and the paused clock holds its reveal, so the chunk is
    // fetched on the hover the header prefetches on, and the click then lands at once (`liveHelpers.openSettings`).
    const link = page.getByTestId('settings-link');
    const chunk = page.waitForResponse((response) => /\/Settings-[^/]*\.js$/.test(response.url()), { timeout: 5_000 }).catch(() => undefined);
    await link.hover();
    await chunk;
    await link.click();
    await page.clock.runFor(1000);
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await watch(page, 3_000);
    await still(page, of, 'settings');
    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Español' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await watch(page, 3_000);
    await still(page, of, 'spanish');
    await page.getByTestId('settings-back').click();
    await expect(page.getByTestId('settings-back')).toHaveCount(0);
    await watch(page, 3_000);
    await done(page, of);
  });
});

test.describe('desktop', () => {
  test('cold-open-to-pass: the three panes, a place set and the countdown, a pass opened in the first two', async ({ browser }) => {
    const of = flow('cold-open-to-pass');
    const page = await record(browser, of);
    await coldAtBariloche(page, of);
    await watch(page, 2_000);
    await still(page, of, 'cold-open');
    const result = await searchPlace(page, of.locale);
    await watch(page, 1_500);
    await pick(page, result);
    // No steps on a desk (D-513): the picked place fills the panes, the stored list first and the recompute after it.
    const card = page.locator('article[data-pass-card]').first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    await recomputed(page);
    await watch(page, 6_000);
    await still(page, of, 'after-place');
    await card.getByRole('button', { name: OPEN_GUIDE[of.locale] }).click();
    await guideDrawn(page);
    await watch(page, 6_000);
    await still(page, of, 'pass-open');
    await done(page, of);
  });

  test('live-scrubbing: the live page watching the night’s brightest pass, Tiangong at 07:20, then scrubbing with the rail', async ({ browser }) => {
    const of = flow('live-scrubbing');
    const page = await record(browser, of);
    await seedShowcase(page, of, { locale: of.locale, theme: of.theme, observer: BARILOCHE });
    await page.goto('/');
    await homeSettled(page);
    await openLive(page);
    await watch(page, 6_000);
    await still(page, of, 'watching');
    await enterScrubbing(page);
    // The stripe's chunk, its 24 h overview and the playback row all draw on timers the paused clock is holding.
    await page.clock.runFor(1000);
    for (const row of ['time-row', 'time-stripe', 'step-controls', 'playback-row']) await expect(page.getByTestId(row)).toBeVisible();
    await watch(page, 2_000);
    // Along the pass a minute at a time, and no jump to the next rise: that is the evening's, past SHOWCASE_UNTIL (D-690).
    const steps = page.getByTestId('step-controls');
    for (let step = 0; step < 4; step += 1) {
      await steps.locator('[data-step="+1m"]').click();
      await watch(page, 1_500);
    }
    await watch(page, 1_500);
    await still(page, of, 'scrubbing');
    await page.getByTestId('live-now').click();
    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
    await watch(page, 2_500);
    await done(page, of);
  });
});

/**
 * P9 (FR-SHOW-6 as amended, V22-20, D-696): the dome over London on the evening of the 6th, the sky played
 * forward at 60× so a second of video is a minute of sky. From 21:18 local eleven passes cross in half an
 * hour and up to five are up at once, where Bariloche's dome holds one at a time. The run is stored and
 * the page reloaded, as `homeAtBariloche` does, so the live page opens on the finished list.
 */
for (const device of ['phone', 'desktop'] as const) {
  // One group per device, named as the others are, so `-g phone` and `-g desktop` each take their own (the P9 review).
  test.describe(device, () => {
  for (const of of PROMO_FLOWS.filter((candidate) => candidate.name === 'dome-playback' && candidate.device === device)) {
  test(`dome-playback: the live dome over London playing at 60×, ${of.device}`, async ({ browser }) => {
    const page = await record(browser, of);
    await seedShowcase(page, of, { locale: of.locale, theme: of.theme, observer: LONDON });
    await page.goto('/');
    await storeRun(page, LONDON_RUN);
    await page.reload();
    await homeSettled(page);
    await openLive(page);
    await watch(page, 1_500);
    await enterScrubbing(page);
    // The playback row draws on a timer the paused clock is holding.
    await page.clock.runFor(1000);
    const play = page.getByTestId('live-play');
    await expect(play).toBeVisible();
    await play.click();
    await expect(play).toHaveAttribute('data-playing', 'true');
    await watch(page, 5_000);
    await still(page, of, 'crowded');
    await watch(page, 24_000);
    await still(page, of, 'overhead');
    await play.click();
    await expect(play).toHaveAttribute('data-playing', 'false');
    await watch(page, 1_500);
    await done(page, of);
  });
}
  });
}

/** `ffmpeg` on `PATH`, the way a shell would find it — an optional external binary, like `openssl` for the window spike (D-652). */
function ffmpegOnPath(): boolean {
  const names = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg'];
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (dir === '') continue;
    for (const name of names) {
      try {
        accessSync(join(dir, name), constants.X_OK);
        return true;
      } catch {
        // not here
      }
    }
  }
  return false;
}

const kb = (path: string): string => `${String(Math.round(statSync(path).size / 1024))} KB`;

/** A move that survives the source and the target being on different volumes. */
function move(source: string, target: string): void {
  try {
    renameSync(source, target);
  } catch {
    copyFileSync(source, target);
    unlinkSync(source);
  }
}

test.beforeAll(() => {
  mkdirSync(MEDIA_DIR, { recursive: true });
});

/**
 * One `.webm` to `.mp4`, or the reason it did not happen. `ffmpeg` is run with
 * its own errors on stderr; a conversion that fails is reported by name and
 * does not throw, so the `.webm` it was given stays where it is and the flows
 * after it are still converted — `afterAll` runs once for the whole file, and
 * one throw in it would leave every later video in `test-results/`, which the
 * next run wipes.
 */
function convert(webm: string, mp4: string, device: (typeof DEVICES)[keyof typeof DEVICES]): boolean {
  const { viewport, frame } = device;
  // Chromium's screencast captures the page at its CSS size and ignores the device pixel ratio, so a
  // phone's 1170 × 2532 file carries the page in its top-left 390 × 844 and grey padding in the rest
  // (D-690). Where the frame is larger than the viewport, the page is cropped out and scaled up to the
  // frame; otherwise libx264 with yuv420p only needs even dimensions.
  const filter =
    frame.width === viewport.width && frame.height === viewport.height
      ? 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
      : `crop=${String(viewport.width)}:${String(viewport.height)}:0:0,scale=${String(frame.width)}:${String(frame.height)}:flags=lanczos`;
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', filter, '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log(`promo: ffmpeg failed on ${webm} (${error instanceof Error ? error.message : String(error)}); the .webm is the record, no ${mp4}`);
    return false;
  }
}

/**
 * Where the files go (D-652). Playwright writes a video where it keeps a test's
 * output and finishes it when the context closes, so the move waits for the
 * whole file; each goes to `promo/media/<flow>-<device>.webm`, then `ffmpeg`
 * makes the `.mp4` LinkedIn and Instagram take when it is on `PATH`, and one
 * line per file says what was written. A `.webm` alone is still the record,
 * and each conversion is on its own: one that fails costs its `.mp4` and
 * nothing of the other flows.
 */
test.afterAll(() => {
  const ffmpeg = ffmpegOnPath();
  for (const { source, target, device } of recorded) {
    if (!existsSync(source)) {
      console.log(`promo: no video at ${source}, nothing written for ${target}`);
      continue;
    }
    move(source, target);
    console.log(`promo: wrote ${target} (${kb(target)})`);
    const mp4 = target.replace(/\.webm$/, '.mp4');
    if (!ffmpeg) {
      console.log(`promo: ffmpeg is not on PATH, so no ${mp4}`);
      continue;
    }
    if (convert(target, mp4, DEVICES[device])) console.log(`promo: wrote ${mp4} (${kb(mp4)})`);
  }
  for (const of of PROMO_FLOWS) {
    for (const name of shot.get(shotKey(of)) ?? []) console.log(`promo: wrote ${promoStill(of, name)} (${kb(promoStill(of, name))})`);
  }
});
