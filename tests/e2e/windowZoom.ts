/**
 * R125 (FR-SKY-14, D-798): the zoom's gestures for the specs, shared by
 * `window-zoom.spec.ts` (the box on the live page and the stars page) and
 * `sky-screen.spec.ts` (the screen under the sensor).
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
