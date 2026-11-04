/**
 * R170 (FR-GLOBE-15; US-50 AC10; D-62, D-817, D-1042): the globe's rate, by `stars-perf.spec.ts`'s method — Chromium
 * under a 4× CDP CPU throttle (FR-GUIDE-6's device as that spec stands for it), counting the animation frames in
 * which the globe's SVG was written (the renderer writes it by ref, D-744, so a mutation in it is one update, counted
 * once per frame). Every layer on, with the faint stars off and on, at 1280 × 800 and 1920 × 1080: a 5 s drag, the
 * best of three on the same page (D-817), and a 5 s run of the ×3600 time-lapse. FR-GLOBE-15's floor is ≥ 30
 * updates/s; the printed lines go in the task's Done note. A measurement, not a CI gate, as the other perf specs are:
 * run with `DOME_PERF=1`.
 */
import { expect, test, type Page } from '@playwright/test';
import { openStarsPage, showGlobe } from './globeHelpers';

const THROTTLE = 4;
const SECONDS = 5;
const DRAGS = 3;
const TARGET_PER_SECOND = 30;
const LAYERS = ['stars', 'figures', 'planets', 'names'] as const;

interface Sample {
  updatesPerSecond: number;
  longestFrameGapMs: number;
  frames: number;
}

declare global {
  interface Window {
    __globePerf?: { stop: () => Sample };
  }
}

/** Counts the frames in which anything in the globe's SVG was written, until `stop()`. */
function installCounter(): void {
  const svg = document.querySelector('[data-globe]');
  if (!svg) throw new Error('no globe');
  let dirty = false;
  let updates = 0;
  let frames = 0;
  let longestGap = 0;
  let last = 0;
  const started = performance.now();
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  observer.observe(svg, { attributes: true, characterData: true, childList: true, subtree: true });
  let raf = requestAnimationFrame(function tick(t: number) {
    if (last) longestGap = Math.max(longestGap, t - last);
    last = t;
    frames++;
    if (dirty) {
      updates++;
      dirty = false;
    }
    raf = requestAnimationFrame(tick);
  });
  window.__globePerf = {
    stop() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      const seconds = (performance.now() - started) / 1000;
      return { updatesPerSecond: updates / seconds, longestFrameGapMs: longestGap, frames };
    },
  };
}

const stop = (page: Page): Promise<Sample> => page.evaluate(() => window.__globePerf?.stop() ?? { updatesPerSecond: 0, longestFrameGapMs: 0, frames: 0 });

/** The dot paths' total length: the faint stars are appended to them (FR-GLOBE-10), no node added. */
const dotLength = (page: Page): Promise<number> => page.evaluate(() => [...document.querySelectorAll('[data-globe] [data-dots] path')].reduce((sum, path) => sum + (path.getAttribute('d')?.length ?? 0), 0));

/**
 * R184 (FR-WIDE-11, D-1114): three passes over the page's instant, the second highlighted, put where `SkyGlobe`'s
 * harness reads them before the page loads — east to west through Neuquén's southern sky, so the opening view draws them,
 * with the ticks and the arrow. Built in the page from its own clock (the fixed suite night).
 */
function installPasses(): void {
  // Read on the globe's first render, after `openStarsPage`'s own init script has fixed the clock.
  let made: unknown = null;
  Object.defineProperty(window, '__globeHarness', {
    get() {
      if (made !== null) return made;
      const now = Date.now();
      const passes = [0, 1, 2].map((k) => {
        const start = now - 60_000 * (k + 1);
        const track = Array.from({ length: 37 }, (_, i) => ({ t: start + i * 10_000, azDeg: 110 + 140 * (i / 36) + k * 12, elDeg: 25 + 55 * Math.sin((Math.PI * i) / 36) - k * 8, rangeKm: 900 }));
        return { id: `perf-${String(k)}`, name: `PERF ${String(k)}`, track, start: track[0], peak: track[18], end: track[36] };
      });
      made = { passes, highlightedPassId: 'perf-1' };
      return made;
    },
  });
}

async function prepare(page: Page, faint: boolean, arcs = false): Promise<void> {
  if (arcs) await page.addInitScript(installPasses);
  await openStarsPage(page);
  await showGlobe(page);
  if (arcs) {
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-globe] [data-arc-series]')].filter((path) => (path.getAttribute('d') ?? '') !== '').length)).toBe(3);
    await expect(page.locator('[data-globe] [data-arc-ticks]')).not.toHaveAttribute('d', '');
  }
  for (const layer of LAYERS) await expect(page.locator(`[data-testid="stars-layers"] [data-layer="${layer}"]`)).toHaveAttribute('aria-pressed', 'true');
  if (faint) {
    const before = await dotLength(page);
    await page.getByRole('button', { name: 'faint' }).click();
    await expect(page.getByRole('button', { name: 'faint' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => dotLength(page), { timeout: 30_000 }).toBeGreaterThan(before);
  }
}

async function drag(page: Page): Promise<Sample> {
  const box = await page.getByTestId('globe-box').boundingBox();
  if (!box) throw new Error('the globe has no box');
  await page.evaluate(installCounter);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const steps = SECONDS * 60;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    // A slow circular drag, as the window's: the view changes every step, so every frame has something to write.
    const angle = (i / steps) * Math.PI * 4;
    await page.mouse.move(cx + Math.cos(angle) * box.width * 0.3, cy + Math.sin(angle) * box.height * 0.15);
  }
  await page.mouse.up();
  return stop(page);
}

async function lapse(page: Page): Promise<Sample> {
  const fast = page.getByTestId('globe-speeds').getByRole('button', { name: 'Time-lapse at 3600 times real time' });
  await fast.click();
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(installCounter);
  await page.waitForTimeout(SECONDS * 1000);
  const sample = await stop(page);
  await fast.click();
  return sample;
}

const line = (sample: Sample): string => `${sample.updatesPerSecond.toFixed(1)} updates/s over ${String(sample.frames)} frames, longest frame ${sample.longestFrameGapMs.toFixed(0)} ms`;

test.describe.configure({ mode: 'serial' });

test.skip(process.env['DOME_PERF'] !== '1', 'measurement, not a gate: run with DOME_PERF=1');

const DESKS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

for (const viewport of DESKS) {
  for (const faint of [false, true]) {
    test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}, faint ${faint ? 'on' : 'off'}`, () => {
      test.use({ viewport });

      test(`a drag, best of three, draws at ≥ 30 updates/s under a 4x CPU throttle (FR-GLOBE-15)`, async ({ page }) => {
        await prepare(page, faint);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
        const samples: Sample[] = [];
        for (let i = 0; i < DRAGS; i += 1) samples.push(await drag(page));
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await cdp.detach();
        const best = samples.reduce((a, b) => (b.updatesPerSecond > a.updatesPerSecond ? b : a));
        console.log(`[FR-GLOBE-15] drag ${String(viewport.width)} × ${String(viewport.height)}, every layer on, faint ${faint ? 'on' : 'off'}, ${String(THROTTLE)}x CPU: best of ${String(DRAGS)} ${line(best)} (runs ${samples.map((s) => s.updatesPerSecond.toFixed(1)).join(', ')})`);
        expect(best.updatesPerSecond).toBeGreaterThanOrEqual(TARGET_PER_SECOND);
      });

      test(`the ×3600 time-lapse draws at ≥ 30 updates/s under a 4x CPU throttle (FR-GLOBE-15)`, async ({ page }) => {
        await prepare(page, faint);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
        const sample = await lapse(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await cdp.detach();
        console.log(`[FR-GLOBE-15] ×3600 ${String(viewport.width)} × ${String(viewport.height)}, every layer on, faint ${faint ? 'on' : 'off'}, ${String(THROTTLE)}x CPU: ${line(sample)}`);
        expect(sample.updatesPerSecond).toBeGreaterThanOrEqual(TARGET_PER_SECOND);
      });
    });
  }

  // R184 (FR-WIDE-11, D-1114): the same drag with three arcs, the highlighted one's ticks and arrow, and the planets' discs, the faint stars on.
  test.describe(`at ${String(viewport.width)} × ${String(viewport.height)}, three passes, faint on`, () => {
    test.use({ viewport });

    test('a drag with the arcs on, best of three, draws at ≥ 30 updates/s under a 4x CPU throttle (FR-WIDE-11)', async ({ page }) => {
      await prepare(page, true, true);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      const samples: Sample[] = [];
      for (let i = 0; i < DRAGS; i += 1) samples.push(await drag(page));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
      const best = samples.reduce((a, b) => (b.updatesPerSecond > a.updatesPerSecond ? b : a));
      console.log(`[FR-WIDE-11] drag ${String(viewport.width)} × ${String(viewport.height)}, three passes, faint on, ${String(THROTTLE)}x CPU: best of ${String(DRAGS)} ${line(best)} (runs ${samples.map((s) => s.updatesPerSecond.toFixed(1)).join(', ')})`);
      expect(best.updatesPerSecond).toBeGreaterThanOrEqual(TARGET_PER_SECOND);
    });

    test('the ×3600 time-lapse with the arcs on draws at ≥ 30 updates/s under a 4x CPU throttle (FR-WIDE-11)', async ({ page }) => {
      await prepare(page, true, true);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      const sample = await lapse(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
      console.log(`[FR-WIDE-11] ×3600 ${String(viewport.width)} × ${String(viewport.height)}, three passes, faint on, ${String(THROTTLE)}x CPU: ${line(sample)}`);
      expect(sample.updatesPerSecond).toBeGreaterThanOrEqual(TARGET_PER_SECOND);
    });
  });
}
