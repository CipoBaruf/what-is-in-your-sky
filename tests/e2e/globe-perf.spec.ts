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
import { seedThreePasses } from './threePasses';

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

async function prepare(page: Page, faint: boolean): Promise<void> {
  await openStarsPage(page);
  await showGlobe(page);
  for (const layer of LAYERS) await expect(page.locator(`[data-testid="stars-layers"] [data-layer="${layer}"]`)).toHaveAttribute('aria-pressed', 'true');
  if (faint) {
    const before = await dotLength(page);
    await page.getByRole('button', { name: 'faint' }).click();
    await expect(page.getByRole('button', { name: 'faint' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => dotLength(page), { timeout: 30_000 }).toBeGreaterThan(before);
  }
}

/**
 * R186 (FR-WIDE-11; D-1114 retired): the live page on a fresh desk — the globe it opens on, with `threePasses.ts`'s three
 * passes up as its arcs, a highlighted one's ticks and arrow, and the planets; the layers the page's stars toggle gives.
 */
async function prepareLive(page: Page): Promise<void> {
  await seedThreePasses(page);
  await page.goto('/#live');
  await page.reload();
  await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'globe', { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-globe] [data-arc-series]')].filter((path) => (path.getAttribute('d') ?? '') !== '').length), { timeout: 30_000 }).toBe(3);
}

/** The live page's ×3600: `[ scrub ]` shows the speeds (FR-WATCH-1), then `3600×` and play, for `SECONDS`. */
async function liveLapse(page: Page): Promise<Sample> {
  await page.getByTestId('live-scrub').click();
  await page.getByRole('button', { name: '3600×' }).click();
  await page.evaluate(installCounter);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(SECONDS * 1000);
  const sample = await stop(page);
  await page.getByRole('button', { name: 'Pause' }).click();
  return sample;
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
  // R187 (FR-WIDE-4): the time-lapse is the playback row's, shown once the instant is held (an hour on).
  await page.getByTestId('globe-steps').getByRole('button', { name: 'An hour later' }).click();
  const fast = page.getByTestId('stars-time').getByRole('button', { name: '3600×' });
  await fast.click();
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  const play = page.getByTestId('stars-time').getByTestId('live-play');
  await play.click();
  await expect(play).toHaveAttribute('data-playing', 'true');
  await page.evaluate(installCounter);
  await page.waitForTimeout(SECONDS * 1000);
  const sample = await stop(page);
  await play.click();
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

  // R186 (FR-WIDE-11, D-1114 retired): the live page's globe with its three passes' arcs, best of three drags and ×3600.
  test.describe(`the live page at ${String(viewport.width)} × ${String(viewport.height)}, three passes`, () => {
    test.use({ viewport });

    test('a drag with the arcs on, best of three, draws at ≥ 30 updates/s under a 4x CPU throttle (FR-WIDE-11)', async ({ page }) => {
      await prepareLive(page);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      const samples: Sample[] = [];
      for (let i = 0; i < DRAGS; i += 1) samples.push(await drag(page));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
      const best = samples.reduce((a, b) => (b.updatesPerSecond > a.updatesPerSecond ? b : a));
      console.log(`[FR-WIDE-11] live page drag ${String(viewport.width)} × ${String(viewport.height)}, three passes, ${String(THROTTLE)}x CPU: best of ${String(DRAGS)} ${line(best)} (runs ${samples.map((s) => s.updatesPerSecond.toFixed(1)).join(', ')})`);
      expect(best.updatesPerSecond).toBeGreaterThanOrEqual(TARGET_PER_SECOND);
    });

    test('the ×3600 time-lapse with the arcs on draws at ≥ 30 updates/s under a 4x CPU throttle (FR-WIDE-11)', async ({ page }) => {
      await prepareLive(page);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      const sample = await liveLapse(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
      console.log(`[FR-WIDE-11] live page ×3600 ${String(viewport.width)} × ${String(viewport.height)}, three passes, ${String(THROTTLE)}x CPU: ${line(sample)}`);
      expect(sample.updatesPerSecond).toBeGreaterThanOrEqual(TARGET_PER_SECOND);
    });
  });
}
