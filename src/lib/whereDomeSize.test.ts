/**
 * R93 (FR-HOME-3, D-607; F-79): the Where pane's dome takes the height the pane
 * has left, square, never wider than the pane, and is not drawn under
 * `LIVE_BOX_MIN_PX`. The rule is pure so the two states it is measured in — the
 * dome drawn, the dome not drawn — can be shown to agree on the same room.
 */
import { describe, expect, it } from 'vitest';
import { LIVE_BOX_MIN_PX, whereDomeSize } from './layout';

/** A pane 530 px high whose other blocks take 230 px, at a reading gap of 12 px, 395 px wide. */
const PANE = { paneClientHeightPx: 530, gapPx: 12, widthPx: 395 };
const OTHERS = 230;

describe('whereDomeSize (FR-HOME-3)', () => {
  it('is the room the pane has left, less the gap the row costs and a pixel for rounding, when the width does not bind', () => {
    expect(whereDomeSize({ ...PANE, contentHeightPx: OTHERS, slotHeightPx: 0 })).toBe(530 - 230 - 12 - 1);
  });

  it('is the pane’s width when that is the smaller', () => {
    expect(whereDomeSize({ ...PANE, paneClientHeightPx: 1000, contentHeightPx: OTHERS, slotHeightPx: 0 })).toBe(395);
  });

  it('reads the same room with the dome drawn as without it, so the observer never feeds itself', () => {
    const drawn = whereDomeSize({ ...PANE, contentHeightPx: OTHERS, slotHeightPx: 0 });
    expect(drawn).not.toBeNull();
    // Drawn, the pane's content is the others, the gap and the dome; the room is the same number.
    expect(whereDomeSize({ ...PANE, contentHeightPx: OTHERS + PANE.gapPx + (drawn ?? 0), slotHeightPx: drawn ?? 0 })).toBe(drawn);
  });

  it('draws no dome under LIVE_BOX_MIN_PX, eight rows (FR-SHP-3)', () => {
    expect(LIVE_BOX_MIN_PX).toBe(192);
    expect(whereDomeSize({ ...PANE, paneClientHeightPx: OTHERS + 12 + 1 + 191, contentHeightPx: OTHERS, slotHeightPx: 0 })).toBeNull();
    expect(whereDomeSize({ ...PANE, paneClientHeightPx: OTHERS + 12 + 1 + 192, contentHeightPx: OTHERS, slotHeightPx: 0 })).toBe(192);
  });

  it('draws no dome in a pane its other blocks already overflow (1024 × 768, the two columns)', () => {
    expect(whereDomeSize({ ...PANE, paneClientHeightPx: 545, contentHeightPx: 630, slotHeightPx: 0 })).toBeNull();
  });
});
