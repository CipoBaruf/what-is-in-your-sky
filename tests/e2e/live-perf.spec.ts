/**
 * R33 (FR-LIVE-5): the playback rate, by the D-62 method — Chromium under a
 * 6× CPU throttle, counting the dome's rasterisations per second while the
 * live page plays at 3600× for five seconds. glyphcss rewrites the `<pre>`'s
 * text on every change of the scene, so a write to either layer is one
 * rasterisation, counted once per animation frame.
 *
 * A *measurement*, not a CI gate, like `dome-perf.spec.ts`: it is skipped
 * unless `DOME_PERF=1`, and the number goes in the PR. The target is ≥ 30
 * updates/s at the phone width; if it is short, the FR-DOME-8 fallback order
 * (`colorTolerance`, `interactiveDownscale`, dropping the base layer) is what
 * is tried, in that order.
 */
import { expect, test, type Page } from '@playwright/test';
import { ha, stubNetwork, T } from './liveHelpers';

const THROTTLE = 6;
const PLAY_SECONDS = 5;
const PHONE_TARGET_PER_SECOND = 30;

interface Sample {
  rasterPerSecond: number;
  longestFrameGapMs: number;
  frames: number;
}

declare global {
  interface Window {
    __livePerf?: { stop: () => Sample };
  }
}

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
  window.__livePerf = {
    stop() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      const seconds = (performance.now() - started) / 1000;
      return { rasterPerSecond: rasterFrames / seconds, longestFrameGapMs: longestGap, frames };
    },
  };
}

/** The live page at `T` on real timers: `setFixedTime` fixes the date and leaves the frames running. */
async function openLive(page: Page): Promise<void> {
  await page.clock.setFixedTime(T);
  await stubNetwork(page);
  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 72 h/, { timeout: 60_000 });
  await page.getByTestId('live-link').click();
  await expect(page.getByTestId('live-dome').locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('live-sky')).not.toContainText('…', { timeout: 30_000 });
}

async function measure(page: Page): Promise<Sample & { cols: number }> {
  const cols = await page.getByTestId('live-dome').locator('[data-layer="lines"] pre.glyph-output').evaluate((el) => (el.textContent ?? '').split('\n')[0]?.length ?? 0);
  await page.getByRole('button', { name: '3600×' }).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.evaluate(installCounter);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(PLAY_SECONDS * 1000);
  const sample = await page.evaluate(() => window.__livePerf?.stop() ?? { rasterPerSecond: 0, longestFrameGapMs: 0, frames: 0 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();
  return { ...sample, cols };
}

test.skip(process.env['DOME_PERF'] !== '1', 'measurement, not a gate: run with DOME_PERF=1');

test('playback at 3600× at the phone width clears FR-LIVE-5 under a 6x CPU throttle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLive(page);
  const result = await measure(page);
  console.log(`[FR-LIVE-5] 390 px, ${String(result.cols)} cols, ${String(THROTTLE)}x CPU, 3600×: ${result.rasterPerSecond.toFixed(1)}/s, longest frame ${result.longestFrameGapMs.toFixed(0)} ms, ${String(result.frames)} frames`);
  expect(result.rasterPerSecond).toBeGreaterThanOrEqual(PHONE_TARGET_PER_SECOND);
});

test('playback at 3600× at the desktop width is measured and reported', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLive(page);
  const result = await measure(page);
  console.log(`[FR-LIVE-5] 1280 px, ${String(result.cols)} cols, ${String(THROTTLE)}x CPU, 3600×: ${result.rasterPerSecond.toFixed(1)}/s, longest frame ${result.longestFrameGapMs.toFixed(0)} ms, ${String(result.frames)} frames`);
  expect(result.frames).toBeGreaterThan(0);
});
