/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314): the box rule. Height-bound where
 * the frame is wide, width-bound where the rail leaves less than the aspect
 * wants, whole pixels, never negative. R133 (FR-FLOW-9, D-850): without an
 * aspect the box is the room, and the compact dome's box is the bowl plus its
 * slack.
 */
import { describe, expect, it } from 'vitest';
import { bowlHeightPx } from '../ui/components/guide/skychart/dome/camera';
import { COMPACT_BOX_MIN_SHORT_PX, compactDomeBoxHeightPx, DOME_COMPACT_SLACK_PX, fitBox, RAIL_MIN_CELLS, viewportAspect } from './layout';

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

/** R133 (FR-FLOW-9, D-850): the compact dome's box hugs the bowl. */
describe('compactDomeBoxHeightPx', () => {
  it('is one --space-3 of slack above and below the bowl', () => {
    expect(DOME_COMPACT_SLACK_PX).toBe(24);
  });

  it('is the bowl plus the slack at the 390 px phone, over the floor', () => {
    // 390 / 2.4 = 162.5 px per unit; the bowl is 1.778 units — 288.9 px — so the box is 337, not the 390 square.
    expect(bowlHeightPx(390)).toBeCloseTo(288.9, 0);
    expect(compactDomeBoxHeightPx({ bowlHeightPx: bowlHeightPx(390), floorPx: COMPACT_BOX_MIN_SHORT_PX })).toBe(337);
    // …and on a 360 px phone 315.
    expect(compactDomeBoxHeightPx({ bowlHeightPx: bowlHeightPx(360), floorPx: COMPACT_BOX_MIN_SHORT_PX })).toBe(315);
  });

  it('never goes under the floor', () => {
    // A 300 px box: the bowl and its slack come to 270, under FR-LIVE-7's 280.
    expect(compactDomeBoxHeightPx({ bowlHeightPx: bowlHeightPx(300), floorPx: COMPACT_BOX_MIN_SHORT_PX })).toBe(COMPACT_BOX_MIN_SHORT_PX);
    expect(compactDomeBoxHeightPx({ bowlHeightPx: 0, floorPx: 0 })).toBe(2 * DOME_COMPACT_SLACK_PX);
  });
});
