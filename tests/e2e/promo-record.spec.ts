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
 * **Seeded like a capture, moved by the clock (D-653).** The seeds are the
 * capture set's, from `captureSeeds.ts` and `observers.ts`: the Neuquén
 * fixture nine days on for the lists, with the finished run
 * `tests/fixtures/stored-run-neuquen.json` already in IndexedDB so the list is
 * on screen the moment the place is typed (FR-OFF-2, the R82 method), and the
 * Paris night for the charts. Nothing in a recording is live data: the
 * elements are the fixtures, the forecast and the geocoder are refused.
 * `page.clock` is installed at the fixture instant and paused; between actions
 * `watch` runs it forward in small steps at wall-clock pace, so the countdown
 * ticks and the mark's bead moves in the file while the instant every screen
 * shows is the fixture's whatever the box's speed.
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
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { CLOCK, guide, listSettled, OPEN_GUIDE, seedPage, SHOWN, type SeedPrefs } from './captureSeeds';
import { domeDrawn, enterScrubbing, LABEL, STORED_RUN, stripFilled } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON, PARIS } from './observers';
import { DEVICES, MEDIA_DIR, PROMO_FLOWS, promoStill, promoVideo, type PromoFlow } from './promoFlows';

/** The list is `promoFlows.ts`'s, so `tests/docs/promo.test.ts` can read it without loading this file; it is the spec's export all the same. */
export { PROMO_FLOWS };

const flow = (name: string): PromoFlow => {
  const found = PROMO_FLOWS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no flow named ${name}`);
  return found;
};

const TYPED = `${String(NEUQUEN.lat)}, ${String(NEUQUEN.lon)}`;
/**
 * The phone's live flow wants `[ see this pass ]`, which the headline offers
 * only while nothing is up and the next rise is between two minutes and a day
 * ahead (FR-JUMP-1). Three minutes into the overhead pass it is not there, so
 * the flow opens the same Paris night by day — twelve hours on from `CLOCK`,
 * 15:00 UTC, with the evening's first pass hours ahead — and the one tap holds
 * the page at that rise with the arc drawn. The desktop's live flow is at
 * `SHOWN`, the ISS overhead.
 */
const PARIS_BY_DAY = CLOCK + 12 * 3_600_000;

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

/** The stills a test shot, checked against the flow's list at its end so the two cannot drift. */
const shot = new Map<string, string[]>();

/** One still, by the name the flow gives it (D-654): a frame of the flow, into `promo/media/`. */
async function still(page: Page, of: PromoFlow, name: string): Promise<void> {
  if (!of.stills.includes(name)) throw new Error(`${of.name} names no still "${name}"`);
  await page.screenshot({ path: promoStill(of, name) });
  shot.set(of.name, [...(shot.get(of.name) ?? []), name]);
}

/** The videos the file produced, moved by `afterAll`: where Playwright wrote each, and where it goes. */
const recorded: { source: string; target: string }[] = [];

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
  expect(shot.get(of.name) ?? []).toEqual([...of.stills]);
  const video = page.video();
  if (!video) throw new Error(`${of.name}: no video was recorded`);
  const context = page.context();
  await context.close();
  open.delete(context);
  recorded.push({ source: await video.path(), target: promoVideo(of) });
}

test.afterEach(async () => {
  for (const context of open) await context.close();
  open.clear();
});

/**
 * The finished 72 h run for Neuquén at `NINE_DAYS_ON`, written into IndexedDB
 * from inside the page (`liveHelpers.seedStoredRun` and R84's
 * `first-run-controls.spec.ts` do the same), so a flow that types the place or
 * opens with it saved shows the list at once rather than the worker's progress.
 */
async function storeRun(page: Page): Promise<void> {
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
  }, STORED_RUN);
}

/** A first visit at Neuquén nine days on: no place, the run for the place the flow will type already stored. */
async function coldAtNeuquen(page: Page, prefs: SeedPrefs): Promise<void> {
  await seedPage(page, prefs, NINE_DAYS_ON);
  await page.goto('/');
  await storeRun(page);
  await expect(page.getByTestId('cold-open')).toBeVisible();
}

/**
 * A returning reader at Neuquén nine days on: the place saved and the finished
 * run stored, so the reload boots the app the way their browser does — the
 * stored list on screen before the first request goes out (FR-OFF-2), and the
 * recompute that follows finding the same passes.
 */
async function homeAtNeuquen(page: Page, prefs: SeedPrefs): Promise<void> {
  await seedPage(page, { ...prefs, observer: NEUQUEN }, NINE_DAYS_ON);
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

/** The place, typed as a reader types it — a character at a time — into the where step's coordinate field. */
async function typePlace(page: Page, locale: 'en' | 'es'): Promise<void> {
  const coords = page.getByTestId('cold-open').getByLabel(LABEL[locale].coords);
  await coords.click();
  await coords.pressSequentially(TYPED, { delay: 70 });
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
 * The phone's first run (FR-FIRST-1..3): the cold open, the place typed,
 * `[ continue ]` to the when step with its count, `[ see what ]` to the cards,
 * and the first card's pass opened to its guide.
 */
async function firstRun(browser: Browser, of: PromoFlow): Promise<void> {
  const page = await record(browser, of);
  await coldAtNeuquen(page, { locale: of.locale, theme: of.theme });
  await watch(page, 1_500);
  await still(page, of, 'where');
  await typePlace(page, of.locale);
  const next = page.getByTestId('step-continue');
  await expect(next).toBeVisible();
  await watch(page, 1_500);
  await next.click();

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
    await homeAtNeuquen(page, { locale: of.locale, theme: of.theme });
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

  test('live-see-this-pass: the live page watching, [ see this pass ], the held instant stepped, and [ back to live ]', async ({ browser }) => {
    const of = flow('live-see-this-pass');
    const page = await record(browser, of);
    await seedPage(page, { locale: of.locale, theme: of.theme, observer: PARIS }, PARIS_BY_DAY);
    await page.goto('/');
    await listSettled(page);
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
    await watch(page, 3_000);
    // Along the pass a minute at a time, so the marker moves up its arc.
    for (let step = 0; step < 4; step += 1) {
      await page.getByTestId('step-controls').locator('[data-step="+1m"]').click();
      await watch(page, 1_500);
    }
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
    await homeAtNeuquen(page, { locale: of.locale, theme: of.theme });
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
    await coldAtNeuquen(page, { locale: of.locale, theme: of.theme });
    await watch(page, 2_000);
    await still(page, of, 'cold-open');
    await typePlace(page, of.locale);
    // No steps on a desk (D-513): the pair fills the panes, the stored list first and the recompute after it.
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

  test('live-scrubbing: the live page watching the ISS overhead, then scrubbing with the rail', async ({ browser }) => {
    const of = flow('live-scrubbing');
    const page = await record(browser, of);
    await seedPage(page, { locale: of.locale, theme: of.theme, observer: PARIS }, SHOWN);
    await page.goto('/');
    await listSettled(page);
    await openLive(page);
    await watch(page, 6_000);
    await still(page, of, 'watching');
    await enterScrubbing(page);
    // The stripe's chunk, its 24 h overview and the playback row all draw on timers the paused clock is holding.
    await page.clock.runFor(1000);
    for (const row of ['time-row', 'time-stripe', 'step-controls', 'playback-row']) await expect(page.getByTestId(row)).toBeVisible();
    await watch(page, 2_000);
    // Along the pass a minute at a time, then to the next rise.
    const steps = page.getByTestId('step-controls');
    for (let step = 0; step < 3; step += 1) {
      await steps.locator('[data-step="+1m"]').click();
      await watch(page, 1_500);
    }
    await steps.locator('[data-step="next-rise"]').click();
    await watch(page, 3_000);
    await still(page, of, 'scrubbing');
    await page.getByTestId('live-now').click();
    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
    await watch(page, 2_500);
    await done(page, of);
  });
});

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
 * Where the files go (D-652). Playwright writes a video where it keeps a test's
 * output and finishes it when the context closes, so the move waits for the
 * whole file; each goes to `promo/media/<flow>-<device>.webm`, then `ffmpeg`
 * makes the `.mp4` LinkedIn and Instagram take when it is on `PATH`, and one
 * line per file says what was written. A `.webm` alone is still the record.
 */
test.afterAll(() => {
  const ffmpeg = ffmpegOnPath();
  for (const { source, target } of recorded) {
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
    // libx264 with yuv420p wants even dimensions; the scale keeps them so whatever frame the screencast produced.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', target, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    console.log(`promo: wrote ${mp4} (${kb(mp4)})`);
  }
  for (const of of PROMO_FLOWS) {
    for (const name of shot.get(of.name) ?? []) console.log(`promo: wrote ${promoStill(of, name)} (${kb(promoStill(of, name))})`);
  }
});
