/**
 * R125 (FR-SKY-14, D-798): the zoom's gestures for the specs, shared by
 * `window-zoom.spec.ts` (the box on the live page and the stars page); R152
 * retired `sky-screen.spec.ts`, which pinched the screen under the sensor.
 *
 * Playwright drives one pointer, so the two-finger pinch is synthetic: pointer
 * events dispatched on the box in the page, two `touch` pointers going down
 * `fromPx` apart, moving to `toPx` apart in `steps`, and lifting. The window's
 * handler folds the moves into one zoom per animation frame, so the caller
 * runs the clock (or waits) for the frame after this returns. The wheel is
 * synthetic too where the spec needs to read whether the browser's default
 * was prevented, which a real wheel does not report.
 */
import type { Locator, Page } from '@playwright/test';

export async function pinch(within: Locator, fromPx: number, toPx: number, steps = 4): Promise<void> {
  await within.evaluate(
    (root, { fromPx, toPx, steps }) => {
      // The window's own box — the drawing's parent, where the handlers are — found from whatever the spec hands in.
      const el = root.querySelector('svg[data-drawing="window"]')?.parentElement ?? root;
      const rect = el.getBoundingClientRect();
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const fire = (type: string, pointerId: number, clientX: number, clientY: number): void => {
        el.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, clientX, clientY, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
      };
      fire('pointerdown', 1, cx - fromPx / 2, cy);
      fire('pointerdown', 2, cx + fromPx / 2, cy);
      for (let i = 1; i <= steps; i += 1) {
        const d = fromPx + ((toPx - fromPx) * i) / steps;
        fire('pointermove', 1, cx - d / 2, cy);
        fire('pointermove', 2, cx + d / 2, cy);
      }
      fire('pointerup', 1, cx - toPx / 2, cy);
      fire('pointerup', 2, cx + toPx / 2, cy);
    },
    { fromPx, toPx, steps },
  );
}

/**
 * R160 (FR-PHONE-10): the pinch on the whole sky — two `touch` pointers on the polar chart's drawing about `at` (client
 * px; the drawing's centre when absent), `fromPx` apart, closed to `toPx` in `steps`, and lifted. The chart hands the
 * view back on the lift where the fingers closed by more than `PINCH_HANDOFF_RATIO`, facing the sky under the midpoint.
 */
export async function pinchPolar(within: Locator, fromPx: number, toPx: number, at?: { x: number; y: number }, steps = 4): Promise<void> {
  await within.evaluate(
    (root, { fromPx, toPx, at, steps }) => {
      const el = root.matches('svg[data-drawing="polar"]') ? root : (root.querySelector('svg[data-drawing="polar"]') ?? root);
      const rect = el.getBoundingClientRect();
      const cx = at?.x ?? rect.x + rect.width / 2;
      const cy = at?.y ?? rect.y + rect.height / 2;
      const fire = (type: string, pointerId: number, clientX: number, clientY: number): void => {
        el.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', isPrimary: pointerId === 1, clientX, clientY, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true }));
      };
      fire('pointerdown', 1, cx - fromPx / 2, cy);
      fire('pointerdown', 2, cx + fromPx / 2, cy);
      for (let i = 1; i <= steps; i += 1) {
        const d = fromPx + ((toPx - fromPx) * i) / steps;
        fire('pointermove', 1, cx - d / 2, cy);
        fire('pointermove', 2, cx + d / 2, cy);
      }
      fire('pointerup', 1, cx - toPx / 2, cy);
      fire('pointerup', 2, cx + toPx / 2, cy);
    },
    { fromPx, toPx, at: at ?? null, steps },
  );
}

/**
 * R160: the sky under a client point of the polar chart — `SkyPolar.tsx`'s `skyAt` worked out from the drawing's box
 * here, since a spec cannot import the chart: the square viewBox (250 user units, the horizon at 100) sits centred in
 * the box (`xMidYMid meet`), the altitude is 90° at the centre and 0° on the ring, and the azimuth runs from north at
 * the top with east on the left (`looking-up`) or the right (`map`).
 */
export async function skyUnder(polar: Locator, at: { x: number; y: number }, orientation: 'looking-up' | 'map' = 'looking-up'): Promise<{ azDeg: number; altDeg: number }> {
  const rect = await polar.evaluate((el) => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number });
  const scale = Math.min(rect.width, rect.height) / 250;
  const x = (at.x - rect.x - rect.width / 2) / scale;
  const y = (at.y - rect.y - rect.height / 2) / scale;
  const east = orientation === 'map' ? 1 : -1;
  const r = Math.hypot(x, y) / 100;
  const az = r < 1e-9 ? 0 : (Math.atan2(east * x, -y) * 180) / Math.PI;
  return { azDeg: ((az % 360) + 360) % 360, altDeg: 90 - 90 * r };
}

/** A wheel event on the window's box, with or without ctrl; resolves to whether the page kept the browser's default (a plain wheel scrolls). */
export function wheel(within: Locator, deltaY: number, ctrlKey: boolean): Promise<boolean> {
  return within.evaluate(
    (root, { deltaY, ctrlKey }) => {
      const el = root.querySelector('svg[data-drawing="window"]')?.parentElement ?? root;
      return el.dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true }));
    },
    { deltaY, ctrlKey },
  );
}

/** A real ctrl + wheel from the mouse where it stands, one notch of `deltaY` px, as a trackpad pinch or a mouse with ctrl sends it. */
export async function ctrlWheel(page: Page, deltaY: number): Promise<void> {
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, deltaY);
  await page.keyboard.up('Control');
}

/** Where a positioned mark stands in the drawing, from its `translate(x y)`. */
export async function placedAt(mark: Locator): Promise<{ x: number; y: number }> {
  const transform = (await mark.getAttribute('transform')) ?? '';
  const match = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(transform);
  return { x: Number(match?.[1] ?? Number.NaN), y: Number(match?.[2] ?? Number.NaN) };
}
