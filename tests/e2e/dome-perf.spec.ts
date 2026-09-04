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
/** FR-GUIDE-6, and D-91's "the gate stays the phone at the phone's width". */
const PHONE_TARGET_PER_SECOND = 30;

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
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 30_000 });
  await page.locator(`article[data-pass-id="25544-${String(pass.start.t)}"]`).getByRole('button', { name: /Open guide/ }).click();
  // FR-DOME-7: the guide opens on the dome, so there is nothing to toggle.
  await expect(guide(page).locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
}

/** R23 (D-72): the guide is a modal sheet on a phone and a column beside the list on a wide screen. */
const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

/** One drag across the drawing, at `THROTTLE`× CPU, reported as rasterisations per second. */
async function measure(page: Page): Promise<Sample & { cols: number }> {
  const drawing = guide(page).locator('[data-drawing="dome"]');
  await drawing.scrollIntoViewIfNeeded();
  const box = await drawing.boundingBox();
  if (!box) throw new Error('dome has no box');
  const cols = await guide(page).locator('[data-layer="lines"] pre.glyph-output').evaluate((el) => (el.textContent ?? '').split('\n')[0]?.length ?? 0);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
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

  const sample = await page.evaluate(() => window.__domePerf?.stop() ?? { rasterPerSecond: 0, longestFrameGapMs: 0, frames: 0 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();
  return { ...sample, cols };
}

test.skip(process.env['DOME_PERF'] !== '1', 'measurement, not a gate: run with DOME_PERF=1');
test.describe.configure({ mode: 'serial' });

test('the drag rate at the phone width clears FR-GUIDE-6 under a 6x CPU throttle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDome(page);
  const result = await measure(page);
  console.log(`[FR-GUIDE-6] 390 px, ${String(result.cols)} cols, ${String(THROTTLE)}x CPU: ${result.rasterPerSecond.toFixed(1)}/s, longest frame ${result.longestFrameGapMs.toFixed(0)} ms`);
  expect(result.rasterPerSecond).toBeGreaterThanOrEqual(PHONE_TARGET_PER_SECOND);
});

test('the drag rate at the desktop width is measured and reported, capped at 120 columns (D-91)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openDome(page);
  const result = await measure(page);
  console.log(`[FR-GUIDE-6] 1280 px, ${String(result.cols)} cols, ${String(THROTTLE)}x CPU: ${result.rasterPerSecond.toFixed(1)}/s, longest frame ${result.longestFrameGapMs.toFixed(0)} ms`);
  // D-91's cap is the assertion here; the rate itself is a reported number, not a gate at this width.
  expect(result.cols).toBeLessThanOrEqual(120);
  expect(result.rasterPerSecond).toBeGreaterThan(0);
});
