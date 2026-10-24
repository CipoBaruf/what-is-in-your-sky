/**
 * R116 (FR-STAR-9; US-38 AC6; D-744, D-751, D-758): the stars page's rate
 * with every layer on, by `dome-perf.spec.ts`'s method (D-62): a 5 s real
 * pointer drag in Chromium at the phone's width under Chrome DevTools CPU
 * throttling, counting the animation frames in which the star field was
 * written — the marks, the lines and the names are all written by ref inside
 * the field's group, so a mutation there is one update, counted once per
 * frame.
 *
 * The page opens over Neuquén facing south, the pole side (FR-STAR-3): the
 * dense southern field the spike measured at 19 draws/s through React and
 * about 100 by ref (D-744). Unlike the dome's measurement this one is a gate
 * — FR-STAR-9's ≥ 30 at 4× — since the ref path leaves it three times the
 * headroom; the printed line goes in the task's Done note.
 */
import { expect, test, type Page } from '@playwright/test';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
/** FR-STAR-9: the FR-GUIDE-6 device's budget, by D-62's proxy. */
const THROTTLE = 4;
const DRAG_SECONDS = 5;
const TARGET_PER_SECOND = 30;
const LAYERS = ['stars', 'figures', 'planets', 'names'] as const;

interface Sample {
  updatesPerSecond: number;
  longestFrameGapMs: number;
  frames: number;
}

declare global {
  interface Window {
    __starsPerf?: { stop: () => Sample };
  }
}

/** Counts the frames in which anything in the star field's group was written, until `stop()`. */
function installCounter(): void {
  const field = document.querySelector('[data-layer="stars"]');
  if (!field) throw new Error('no star field');
  let dirty = false;
  let updates = 0;
  let frames = 0;
  let longestGap = 0;
  let last = 0;
  const started = performance.now();
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  observer.observe(field, { attributes: true, characterData: true, childList: true, subtree: true });
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
  window.__starsPerf = {
    stop() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      const seconds = (performance.now() - started) / 1000;
      return { updatesPerSecond: updates / seconds, longestFrameGapMs: longestGap, frames };
    },
  };
}

async function openStars(page: Page): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
  );
  await page.goto('/#stars');
  await expect(page.getByTestId('stars-page')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-layer="stars"] [data-star]').first()).toBeAttached();
}

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 390, height: 844 } });

test('with every layer on, a drag draws at ≥ 30 updates/s at the phone width under a 4x CPU throttle (FR-STAR-9)', async ({ page }) => {
  await openStars(page);
  // Every layer on: the page's default, asserted rather than assumed.
  for (const layer of LAYERS) await expect(page.locator(`[data-testid="stars-rail"] [data-layer="${layer}"]`)).toHaveAttribute('aria-pressed', 'true');
  const sky = page.getByTestId('stars-sky').locator('[tabindex="0"]');
  await sky.scrollIntoViewIfNeeded();
  const box = await sky.boundingBox();
  if (!box) throw new Error('the drawing has no box');
  // The names are drawn: a figure's spaced capitals and at least one star's name are in the field.
  await expect(page.locator('[data-figure-name][visibility="visible"]').first()).toBeAttached();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.evaluate(installCounter);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const steps = DRAG_SECONDS * 60;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    // A slow circular drag, as the dome's: the camera changes every step, so every frame has something to write.
    const angle = (i / steps) * Math.PI * 4;
    await page.mouse.move(cx + Math.cos(angle) * box.width * 0.3, cy + Math.sin(angle) * box.height * 0.15);
  }
  await page.mouse.up();
  const sample = await page.evaluate(() => window.__starsPerf?.stop() ?? { updatesPerSecond: 0, longestFrameGapMs: 0, frames: 0 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();

  console.log(`[FR-STAR-9] 390 px, every layer on, ${String(THROTTLE)}x CPU: ${sample.updatesPerSecond.toFixed(1)} updates/s over ${String(sample.frames)} frames, longest frame ${sample.longestFrameGapMs.toFixed(0)} ms`);
  expect(sample.updatesPerSecond).toBeGreaterThanOrEqual(TARGET_PER_SECOND);
});
