/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314): the ladder's arithmetic. Every
 * step is 2.4 : 1.7 — `zoomFor`'s divisors, so the drawing fills the box both
 * ways — each fits the viewport it was cut for on both sides with room to
 * spare, the steps are strictly larger one to the next, and the viewport a
 * step fits from is the box plus the page's rows, not a number typed twice.
 */
import { describe, expect, it } from 'vitest';
import { ZOOM_HEIGHT_DIVISOR, ZOOM_WIDTH_DIVISOR } from '../ui/components/guide/skychart/dome/camera';
import { DOME_ROWS_ABOVE_PX, DOME_ROWS_BELOW_PX, DOME_STEPS, domeStepFor, domeStepQuery, STRIPE_BLOCK_PX, STRIPE_UNDER_BOX_FROM_STEP } from './layout';

describe('DOME_STEPS', () => {
  it('has four steps at the fit rule’s own aspect, each larger than the last', () => {
    expect(DOME_STEPS.map((entry) => entry.step)).toEqual([1, 2, 3, 4]);
    for (const [i, entry] of DOME_STEPS.entries()) {
      expect(entry.box.widthPx / entry.box.heightPx).toBeCloseTo(ZOOM_WIDTH_DIVISOR / ZOOM_HEIGHT_DIVISOR, 2);
      const previous = DOME_STEPS[i - 1];
      if (previous) {
        expect(entry.box.widthPx).toBeGreaterThan(previous.box.widthPx);
        expect(entry.from.widthPx).toBeGreaterThan(previous.from.widthPx);
        expect(entry.from.heightPx).toBeGreaterThan(previous.from.heightPx);
      }
    }
  });

  it('fits its reference viewport on both sides, with at most 40 px to spare in the binding direction', () => {
    for (const entry of DOME_STEPS) {
      expect(entry.from.widthPx, `step ${String(entry.step)} across`).toBeLessThanOrEqual(entry.reference.widthPx);
      expect(entry.from.heightPx, `step ${String(entry.step)} down`).toBeLessThanOrEqual(entry.reference.heightPx);
      const spare = Math.min(entry.reference.widthPx - entry.from.widthPx, entry.reference.heightPx - entry.from.heightPx);
      expect(spare, `step ${String(entry.step)} is the largest box its reference fits`).toBeLessThanOrEqual(40);
    }
  });

  it('counts the stripe block in the height from the step the stripe stands under the box', () => {
    for (const entry of DOME_STEPS) {
      const stripe = entry.step >= STRIPE_UNDER_BOX_FROM_STEP ? STRIPE_BLOCK_PX : 0;
      expect(entry.from.heightPx).toBe(entry.box.heightPx + DOME_ROWS_ABOVE_PX + DOME_ROWS_BELOW_PX + stripe);
      expect(domeStepQuery(entry)).toBe(`(min-width: ${String(entry.from.widthPx)}px) and (min-height: ${String(entry.from.heightPx)}px)`);
    }
  });

  it('picks the highest matching step, or none', () => {
    expect(domeStepFor(() => false)).toBeNull();
    expect(domeStepFor((entry) => entry.step <= 2)?.step).toBe(2);
    expect(domeStepFor(() => true)?.step).toBe(4);
  });
});
