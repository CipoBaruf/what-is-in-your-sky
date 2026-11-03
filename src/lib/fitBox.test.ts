/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314): the box rule, whole pixels, never
 * negative. R133 (FR-FLOW-9, D-850): the box is the room, with no aspect cut.
 * (The compact dome's bowl cut and its test went with the column, R165.)
 */
import { describe, expect, it } from 'vitest';
import { fitBox, RAIL_MIN_CELLS, viewportAspect } from './layout';

describe('fitBox', () => {
  it('never goes negative in a frame the rows have used up', () => {
    expect(fitBox({ frameWidthPx: 400, frameHeightPx: 100, aboveHeightPx: 60, belowHeightPx: 120, besideWidthPx: 451 })).toEqual({ widthPx: 0, heightPx: 0 });
  });

  /** R133 (FR-FLOW-9, D-850): the wide box is the room — down to the hint line and across to the rail, whatever its shape. */
  it('is the whole room without an aspect', () => {
    // The 1280 × 800 live page: the drawing slot is 644 × 732 (the layout less the hint's row), nothing above or below inside the frame.
    expect(fitBox({ frameWidthPx: 644, frameHeightPx: 732, aboveHeightPx: 0, belowHeightPx: 0, besideWidthPx: 0 })).toEqual({ widthPx: 644, heightPx: 732 });
    // The scrubbing page at 1920 × 1080: the stripe row under the box is paid, the rest is the box's.
    expect(fitBox({ frameWidthPx: 1882, frameHeightPx: 950, aboveHeightPx: 60, belowHeightPx: 120, besideWidthPx: 451 })).toEqual({ widthPx: 1431, heightPx: 770 });
    // Whole pixels.
    expect(fitBox({ frameWidthPx: 644.6, frameHeightPx: 732.4, aboveHeightPx: 0, belowHeightPx: 0, besideWidthPx: 0 })).toEqual({ widthPx: 644, heightPx: 732 });
  });

  it('states the rail minimum once', () => {
    expect(RAIL_MIN_CELLS).toBe(44);
  });
});

/** R121 (FR-SKY-2; D-789): the pass detail's wide window takes the browser window's shape as a ratio. */
describe('viewportAspect', () => {
  it('takes a viewport with no size yet as square', () => {
    expect(viewportAspect(0, 0)).toBe(1);
    expect(viewportAspect(1280, 0)).toBe(1);
    expect(viewportAspect(1920, 1080)).toBeCloseTo(16 / 9, 9);
  });
});
