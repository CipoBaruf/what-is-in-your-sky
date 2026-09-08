/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314): the box rule. Height-bound where
 * the frame is wide, width-bound where the rail leaves less than the aspect
 * wants, whole pixels, never negative.
 */
import { describe, expect, it } from 'vitest';
import { fitBox, RAIL_MIN_CELLS } from './layout';

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
