/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314): the box rule. Height-bound where
 * the frame is wide, width-bound where the rail leaves less than the aspect
 * wants, whole pixels, never negative.
 */
import { describe, expect, it } from 'vitest';
import { fitBox, RAIL_MIN_CELLS, viewportAspect, windowBox } from './layout';

const ASPECT = 2.4 / 1.7;

describe('fitBox', () => {
  it('is as tall as the frame leaves and as wide as the aspect says where the width allows it', () => {
    // A 1920 × 1080 window: the page leaves the frame about 1882 × 950; the controls row and the stripe row cost 60 and 120.
    const box = fitBox({ frameWidthPx: 1882, frameHeightPx: 950, aboveHeightPx: 60, belowHeightPx: 120, besideWidthPx: 451, aspect: ASPECT });
    expect(box).toEqual({ heightPx: 770, widthPx: Math.floor(770 * ASPECT) });
    expect(box.widthPx).toBeLessThanOrEqual(1882 - 451);
  });

  it('is as wide as the space beside the rail where that binds first, and the height follows', () => {
    const box = fitBox({ frameWidthPx: 1000, frameHeightPx: 950, aboveHeightPx: 60, belowHeightPx: 0, besideWidthPx: 451, aspect: ASPECT });
    expect(box).toEqual({ widthPx: 549, heightPx: Math.floor(549 / ASPECT) });
  });

  it('never goes negative in a frame the rows have used up', () => {
    expect(fitBox({ frameWidthPx: 400, frameHeightPx: 100, aboveHeightPx: 60, belowHeightPx: 120, besideWidthPx: 451, aspect: ASPECT })).toEqual({ widthPx: 0, heightPx: 0 });
  });

  it('states the rail minimum once', () => {
    expect(RAIL_MIN_CELLS).toBe(44);
  });
});

/** R121 (FR-SKY-2, FR-STAR-3; D-789): the window's box is `fitBox` at the browser window's shape — the stars page's rule, shared. */
describe('windowBox', () => {
  it('is fitBox at the viewport’s aspect', () => {
    const room = { frameWidthPx: 1882, frameHeightPx: 668, aboveHeightPx: 48, belowHeightPx: 0, besideWidthPx: 451 };
    // A 1920 × 800 browser window at 2.4 : 1: the height binds — 620 tall, 1488 wide, beside a 451 px rail in 1882 px.
    expect(windowBox({ ...room, viewportWidthPx: 1920, viewportHeightPx: 800 })).toEqual(fitBox({ ...room, aspect: 2.4 }));
    expect(windowBox({ ...room, viewportWidthPx: 1920, viewportHeightPx: 800 })).toEqual({ widthPx: 1488, heightPx: 620 });
    // A 1280 × 800 window (1.6 : 1) whose page leaves the frame 1242 px: the width binds at 791, and the height follows the shape.
    expect(windowBox({ ...room, frameWidthPx: 1242, viewportWidthPx: 1280, viewportHeightPx: 800 })).toEqual({ widthPx: 791, heightPx: Math.floor(791 / 1.6) });
  });

  it('takes a viewport with no size yet as square', () => {
    expect(viewportAspect(0, 0)).toBe(1);
    expect(viewportAspect(1280, 0)).toBe(1);
    expect(viewportAspect(1920, 1080)).toBeCloseTo(16 / 9, 9);
    expect(windowBox({ frameWidthPx: 500, frameHeightPx: 400, aboveHeightPx: 0, belowHeightPx: 0, besideWidthPx: 0, viewportWidthPx: 0, viewportHeightPx: 0 })).toEqual({ widthPx: 400, heightPx: 400 });
  });
});
