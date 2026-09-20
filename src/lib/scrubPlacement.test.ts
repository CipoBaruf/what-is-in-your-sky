/**
 * R78 (FR-WATCH-5, FR-WATCH-6; D-448): where the scrub block goes, pure. The
 * walk is FR-SHP-4's matrix in both states: the landscape phone's rows answer
 * `rail`, the short wide rows `overlay`, and every other row `under` — and the
 * answer does not read the state, which is what keeps the box one height in
 * the two where it must be (FR-WATCH-7).
 */
import { describe, expect, it } from 'vitest';
import { LANDSCAPE_PHONE_MAX_HEIGHT_PX, LANDSCAPE_PHONE_QUERY, layoutMode, LIVE_BOX_MIN_PX, LIVE_SCRUB_BLOCK_PX, liveKeptPx, pageShape, scrubPlacement, WIDE_MIN_PX, type LiveState, type ScrubPlacement } from './layout';

type Size = readonly [width: number, height: number];

/** FR-SHP-4, row by row, with the placement FR-WATCH-5 gives each group. */
const MATRIX: readonly (readonly [group: string, placement: ScrubPlacement, sizes: readonly Size[]])[] = [
  ['compact portrait', 'under', [[360, 640], [390, 667], [390, 844], [430, 932]]],
  ['landscape phone', 'rail', [[740, 360], [844, 390], [932, 430]]],
  ['short and wide', 'overlay', [[964, 420], [1024, 450], [1200, 450], [1400, 480], [1920, 500]]],
  ['desktop', 'under', [[964, 700], [1024, 768], [1280, 800], [1660, 900], [1920, 1080], [2560, 1440]]],
];
const BOUNDARIES: readonly (readonly [Size, ScrubPlacement])[] = [
  [[963, 700], 'under'],
  [[964, 700], 'under'],
  [[844, 500], 'rail'],
  [[844, 501], 'under'],
];
const STATES: readonly LiveState[] = ['watching', 'scrubbing'];

/** What a browser gives the rule at a viewport: the two media queries, and the box the unfolded watching page leaves. */
function at([width, height]: Size): Parameters<typeof scrubPlacement>[0] {
  return {
    mode: layoutMode(width >= WIDE_MIN_PX),
    shape: pageShape(width > height && height <= LANDSCAPE_PHONE_MAX_HEIGHT_PX),
    boxHeightPx: height - liveKeptPx('watching'),
  };
}

describe('scrubPlacement (FR-WATCH-5, FR-WATCH-6)', () => {
  it('names the landscape phone as D-173 does', () => {
    expect(LANDSCAPE_PHONE_QUERY).toBe('(orientation: landscape) and (max-height: 500px)');
  });

  for (const [group, placement, sizes] of MATRIX) {
    for (const size of sizes) {
      it(`${group} ${String(size[0])} × ${String(size[1])}: ${placement}, in both states`, () => {
        // The rule takes no state: the walk is over both to say so, since the box must not move on it (FR-WATCH-7).
        for (const state of STATES) expect(scrubPlacement(at(size)), state).toBe(placement);
      });
    }
  }

  it('holds at the boundaries: the mode at 963 and 964 px, the shape at 500 and 501 px', () => {
    for (const [size, placement] of BOUNDARIES) expect(scrubPlacement(at(size)), size.join('x')).toBe(placement);
  });

  it('turns to the overlay on a wide page exactly where the block under the box would take it under the floor', () => {
    const floor = LIVE_BOX_MIN_PX + LIVE_SCRUB_BLOCK_PX;
    const wide = { mode: 'wide', shape: 'portrait' } as const;
    expect(scrubPlacement({ ...wide, boxHeightPx: floor + 1 })).toBe('under');
    expect(scrubPlacement({ ...wide, boxHeightPx: floor })).toBe('under');
    expect(scrubPlacement({ ...wide, boxHeightPx: floor - 1 })).toBe('overlay');
    expect(scrubPlacement({ ...wide, boxHeightPx: 0 })).toBe('overlay');
    // The mode is asked first: a short wide window is landscape and under 500 px too, and it is not a phone (FR-SHP-1).
    expect(scrubPlacement({ mode: 'wide', shape: 'landscape-phone', boxHeightPx: floor })).toBe('under');
    expect(scrubPlacement({ mode: 'wide', shape: 'landscape-phone', boxHeightPx: floor - 1 })).toBe('overlay');
  });

  it('is under the box until the frame has measured, and never reads a height on compact', () => {
    expect(scrubPlacement({ mode: 'wide', shape: 'portrait', boxHeightPx: null })).toBe('under');
    expect(scrubPlacement({ mode: 'compact', shape: 'portrait', boxHeightPx: 0 })).toBe('under');
    expect(scrubPlacement({ mode: 'compact', shape: 'landscape-phone', boxHeightPx: null })).toBe('rail');
    expect(scrubPlacement({ mode: 'compact', shape: 'landscape-phone', boxHeightPx: 2000 })).toBe('rail');
  });
});
