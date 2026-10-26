/**
 * FR-GUIDE-6 for the layered dome (R21), by the D-62 method: a 5 s real
 * pointer drag in Chromium under Chrome DevTools CPU throttling, counting
 * rasterisations — glyphcss rewrites the `<pre>`'s text on every camera
 * change, so a write to either layer is one rasterisation, counted once per
 * animation frame.
 *
 * This is a *measurement*, not a CI gate, and it is skipped unless
 * `DOME_PERF=1`: D-91 measured that nothing clears 30/s at 1280 px under a 6×
 * throttle (a phone's budget applied to a desktop panel), so a gate at that
 * width would fail by design. The gate FR-GUIDE-6 actually names is the phone
 * at the phone's width, which this file asserts, and the real gate is still
 * the on-device check in `docs/RELEASE.md` §3.
 *
 * Run it with `DOME_PERF=1 npx playwright test dome-perf` and put the printed
 * table in the PR, which is what R21 asks for.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { brailleDots } from '../support/braille';
import { withSettings } from './liveHelpers';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}
interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const DAY_MS = 86_400_000;

/** D-62: a phone's CPU budget, applied at both widths. */
const THROTTLE = 6;
const DRAG_SECONDS = 5;
/**
 * R124 (FR-SKY-5, D-817): one drag's rate swings by a fifth from drag to drag
 * on the same build (39 to 57/s in one run) — twice the tolerance FR-SKY-5
 * allows — and every swing is downward: another process taking the core slows
 * the page and nothing speeds it up. So a measurement is three drags on the
 * same page and the best of them is the number, as the rate the page can do.
 */
const DRAGS = 3;
/** FR-GUIDE-6, and D-91's "the gate stays the phone at the phone's width". */
const PHONE_TARGET_PER_SECOND = 30;
/**
 * FR-SKY-5 (R124, D-793): `v2.4.0`'s measure — the dome without stars at
 * `ece8bfd`, by this spec on the owner's machine (Apple silicon, Chromium
 * under a 6× throttle) on 2026-10-26, three runs each the best of three drags:
 * 390 px 59.8, 59.4, 58.8; 1280 px 51.3, 53.1, 53.5. The constant is the
 * middle run. (`ac8d195`, this branch's parent, draws the same picture and
 * measured 58.9 and 51.5.) The dome with the stars on must not fall below nine
 * tenths of it, and never below FR-GUIDE-6's 30; the number is the phone's,
 * the desktop's is reported (D-91).
 *
 * The constant is one machine's, as D-62's numbers are, so it holds only
 * where it was measured (D-817). On any other machine, measure `ece8bfd` by
 * this spec first and hand the phone's number in:
 * `DOME_PERF=1 DOME_PERF_ECE8BFD=<rate> npx playwright test dome-perf`.
 */
const ECE8BFD_PER_SECOND = { phone: phoneBaseline(process.env['DOME_PERF_ECE8BFD']) ?? 59.4, desktop: 53.1 };
const FLOOR_FRACTION = 0.9;
/** The dome's star and planet anchors (R119): one per dot the line layer draws, so their count says whether the stars are on. */
const STAR_ANCHORS = '[data-drawing="dome"] [data-star], [data-drawing="dome"] [data-planet]';

/** `DOME_PERF_ECE8BFD`, the runner's own `ece8bfd` measure at the phone width; unset is the committed constant. */
function phoneBaseline(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`DOME_PERF_ECE8BFD is not a rate: ${value}`);
  return rate;
}

interface Sample {
  rasterPerSecond: number;
  longestFrameGapMs: number;
  frames: number;
}

declare global {
  interface Window {
    __domePerf?: { stop: () => Sample };
  }
}

/** Counts writes to either layer's `<pre>`, one per animation frame, until `stop()`. */
function installCounter(): void {
  const drawing = document.querySelector('[data-drawing="dome"]');
  if (!drawing) throw new Error('no dome');
  let dirty = false;
  let rasterFrames = 0;
  let frames = 0;
  let longestGap = 0;
  let last = 0;
  const started = performance.now();
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  drawing.querySelectorAll('pre.glyph-output').forEach((pre) => observer.observe(pre, { characterData: true, childList: true, subtree: true }));
  let raf = requestAnimationFrame(function tick(t: number) {
    if (last) longestGap = Math.max(longestGap, t - last);
    last = t;
    frames++;
    if (dirty) {
      rasterFrames++;
      dirty = false;
    }
    raf = requestAnimationFrame(tick);
  });
  window.__domePerf = {
    stop() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      const seconds = (performance.now() - started) / 1000;
      return { rasterPerSecond: rasterFrames / seconds, longestFrameGapMs: longestGap, frames };
    },
  };
}

async function openDome(page: Page): Promise<void> {
  const pass = reference.firstGoldenPass;
  if (!pass) throw new Error('reference-values.json has no firstGoldenPass');
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('https://api.open-meteo.com/**', (route) => route.abort('failed'));
  await page.goto('/');
  await withSettings(page, async () => {
    await page.getByLabel('Coordinates · e.g. -38.93, -67.99').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  });
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in 72 h/, { timeout: 30_000 });
  await page.locator(`article[data-pass-id="25544-${String(pass.start.t)}"]`).getByRole('button', { name: /Open guide/ }).click();
  // FR-DOME-7: the guide opens on the dome, so there is nothing to toggle.
  await expect(guide(page).locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
}

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

/** One drag across the drawing, counted from the moment the pointer goes down to the moment it lifts. */
async function drag(page: Page, box: { x: number; y: number; width: number; height: number }): Promise<Sample> {
  await page.evaluate(installCounter);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const steps = DRAG_SECONDS * 60;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    // A slow circular drag: the camera changes every step, so every frame has something to redraw.
    const angle = (i / steps) * Math.PI * 4;
    await page.mouse.move(cx + Math.cos(angle) * box.width * 0.3, cy + Math.sin(angle) * box.height * 0.15);
  }
  await page.mouse.up();
  return page.evaluate(() => window.__domePerf?.stop() ?? { rasterPerSecond: 0, longestFrameGapMs: 0, frames: 0 });
}

/** `DRAGS` drags across the drawing at `THROTTLE`× CPU: the best rate (D-817), the longest frame of any, every rate for the log. */
async function measure(page: Page): Promise<Sample & { cols: number; dots: number; stars: number; rates: number[] }> {
  const drawing = guide(page).locator('[data-drawing="dome"]');
  await drawing.scrollIntoViewIfNeeded();
  const box = await drawing.boundingBox();
  if (!box) throw new Error('dome has no box');
  // R124: the bodies the dome draws and the braille dots the line layer holds before the drag — the record that the stars were on (FR-SKY-5), or not.
  const stars = await page.locator(STAR_ANCHORS).count();
  const text = await guide(page).locator('[data-layer="lines"] pre.glyph-output').evaluate((el) => el.textContent ?? '');
  const cols = text.split('\n')[0]?.length ?? 0;
  const dots = brailleDots(text);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const samples: Sample[] = [];
  for (let i = 0; i < DRAGS; i++) samples.push(await drag(page, box));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();

  const best = samples.reduce((a, b) => (b.rasterPerSecond > a.rasterPerSecond ? b : a), { rasterPerSecond: 0, longestFrameGapMs: 0, frames: 0 });
  return { ...best, longestFrameGapMs: Math.max(...samples.map((s) => s.longestFrameGapMs)), cols, dots, stars, rates: samples.map((s) => s.rasterPerSecond) };
}

const rates = (result: { rates: number[] }): string => result.rates.map((r) => r.toFixed(1)).join(' ');
/** FR-SKY-5's floor: nine tenths of `ece8bfd`'s measure, and never under FR-GUIDE-6's 30. */
const floor = (baseline: number): number => Math.max(PHONE_TARGET_PER_SECOND, baseline * FLOOR_FRACTION);

test.skip(process.env['DOME_PERF'] !== '1', 'measurement, not a gate: run with DOME_PERF=1');
test.describe.configure({ mode: 'serial' });

test('the drag rate at the phone width clears FR-GUIDE-6 under a 6x CPU throttle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDome(page);
  const result = await measure(page);
  console.log(
    `[FR-GUIDE-6] 390 px, ${String(result.cols)} cols, ${String(result.stars)} stars, ${String(result.dots)} dots, ${String(THROTTLE)}x CPU: ${result.rasterPerSecond.toFixed(1)}/s (drags ${rates(result)}), longest frame ${result.longestFrameGapMs.toFixed(0)} ms`,
  );
  expect(result.rasterPerSecond).toBeGreaterThanOrEqual(PHONE_TARGET_PER_SECOND);
});

/**
 * FR-SKY-5, US-40 AC4: the same drag on a dome that draws the stars. The pass
 * detail hands its dome the page's scene once R123 wires it (D-819); before
 * that the dome draws none, and a rate taken then is `ece8bfd`'s picture and
 * not the one this test names, so it is skipped rather than passed. The
 * stars' chunk loads after the page's, so the anchors are given a moment.
 */
test('with the stars on, the drag rate at the phone width stays within a tenth of ece8bfd and above FR-GUIDE-6 (FR-SKY-5)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDome(page);
  await page
    .locator(STAR_ANCHORS)
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .catch(() => undefined);
  test.skip((await page.locator(STAR_ANCHORS).count()) === 0, 'the dome draws no stars: the pass detail hands it no scene until R123 (D-819)');
  const result = await measure(page);
  console.log(
    `[FR-SKY-5] 390 px, ${String(result.cols)} cols, ${String(result.stars)} stars, ${String(result.dots)} dots, ${String(THROTTLE)}x CPU: ${result.rasterPerSecond.toFixed(1)}/s (drags ${rates(result)}), longest frame ${result.longestFrameGapMs.toFixed(0)} ms; ece8bfd ${ECE8BFD_PER_SECOND.phone.toFixed(1)}/s, floor ${floor(ECE8BFD_PER_SECOND.phone).toFixed(1)}/s`,
  );
  expect(result.stars).toBeGreaterThan(0);
  expect(result.rasterPerSecond).toBeGreaterThanOrEqual(floor(ECE8BFD_PER_SECOND.phone));
});

test('the drag rate at the desktop width is measured and reported against ece8bfd, capped at 120 columns (D-91)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDome(page);
  const result = await measure(page);
  console.log(
    `[FR-GUIDE-6] 1280 px, ${String(result.cols)} cols, ${String(result.stars)} stars, ${String(result.dots)} dots, ${String(THROTTLE)}x CPU: ${result.rasterPerSecond.toFixed(1)}/s (drags ${rates(result)}), longest frame ${result.longestFrameGapMs.toFixed(0)} ms; ece8bfd ${ECE8BFD_PER_SECOND.desktop.toFixed(1)}/s`,
  );
  // D-91's cap is the assertion here; the rate itself is a reported number, not a gate at this width.
  expect(result.cols).toBeLessThanOrEqual(120);
  expect(result.rasterPerSecond).toBeGreaterThan(0);
});
