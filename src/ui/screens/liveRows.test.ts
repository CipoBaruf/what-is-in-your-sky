/**
 * R77 (FR-WATCH-4, D-447): the live page's inventory, as one table. The exact
 * ordered list per state and mode, and the rules FR-WATCH-4 states in words —
 * checked here once, so the page's own test only has to hold `Live.tsx` to it.
 */
import { describe, expect, it } from 'vitest';
import { foldRows, LIVE_FOLD_NEEDS, LIVE_FOLD_ORDER } from '../../lib/layout';
import { COMPACT_CONDITIONAL, COMPACT_OVERLAY, COMPACT_SHEET, inventoryClip, jumpFitsOnPath, jumpPlacement, LIVE_ROW_TEST_ID, LIVE_ROWS, liveShape, rowsFor, type LiveRow } from './liveRows';

const TIMELINE: readonly LiveRow[] = ['time-row', 'stripe', 'steps', 'playback'];

/**
 * R144 (FR-TONIGHT-6, D-902) → R148 (FR-FULL-2, FR-FULL-3; D-920, D-928): what left the compact page — none of these
 * is in its list in either state, either shape or either sheet state. The top row and the headline are R148's: the
 * head over the sky carries `[ ← ]` and the shown time, and the mark is gone.
 */
const GONE_FROM_COMPACT: readonly LiveRow[] = ['top-row', 'headline', 'indicator', 'clock', 'time-row', 'next-event', 'conditions', 'overview', 'stripe', 'steps', 'playback', 'back-to-live', 'scrub', 'hidden'];

describe('rowsFor (FR-WATCH-4)', () => {
  /**
   * R148 (FR-FULL-3, FR-FULL-4, FR-WATCH-4 as amended v2.8; D-928): one compact inventory, split — the overlay with the
   * sheet closed, the overlay and the sheet with it open — the same in both states and both shapes.
   */
  it('compact: the box, the head, [ controls ], the hint and the card over the sky; the sheet’s rows in FR-FULL-4’s order with the sheet open — the same list watching and scrubbing, tall and short', () => {
    expect(COMPACT_OVERLAY).toEqual(['box', 'head', 'controls', 'hint', 'card']);
    // R150 (FR-GYRO-10, D-949): `list` (the button) is gone; the satellites, open, are the sheet's last row.
    expect(COMPACT_SHEET).toEqual(['context', 'track', 'taps', 'view-row', 'facing', 'actions', 'share', 'satellites']);
    expect(COMPACT_SHEET.at(-1)).toBe('satellites');
    expect(LIVE_ROWS).not.toContain('list');
    expect(COMPACT_CONDITIONAL).toEqual(['hint', 'card']);
    for (const row of COMPACT_CONDITIONAL) expect(COMPACT_OVERLAY).toContain(row);
    for (const shape of ['tall', 'short'] as const) {
      expect(rowsFor('watching', 'compact', shape, false)).toEqual(COMPACT_OVERLAY);
      expect(rowsFor('watching', 'compact', shape, true)).toEqual([...COMPACT_OVERLAY, ...COMPACT_SHEET]);
      // The page's own call, with no sheet state: everything it renders in both states (the sheet's rows stay mounted, D-932).
      expect(rowsFor('watching', 'compact', shape)).toEqual([...COMPACT_OVERLAY, ...COMPACT_SHEET]);
      for (const sheet of [false, true]) expect(rowsFor('scrubbing', 'compact', shape, sheet)).toEqual(rowsFor('watching', 'compact', shape, sheet));
    }
  });

  it('compact: the top row, the headline, the indicator’s word, the next event, the conditions, the overview, the stripe block, [ scrub ], [ back to live ] and the hidden toggle are not rows of it (D-902, D-905, D-928)', () => {
    for (const state of ['watching', 'scrubbing'] as const) {
      for (const shape of ['tall', 'short'] as const) {
        for (const sheet of [false, true]) {
          const rows = rowsFor(state, 'compact', shape, sheet);
          for (const row of GONE_FROM_COMPACT) expect(rows, `${state} ${shape}: ${row}`).not.toContain(row);
          for (const row of ['box', 'head', 'controls'] as const) expect(rows, `${state} ${shape}: ${row}`).toContain(row);
          for (const row of ['context', 'track', 'taps', 'view-row', 'facing', 'share', 'satellites'] as const) expect(rows.includes(row), `${state} ${shape} sheet ${String(sheet)}: ${row}`).toBe(sheet);
        }
      }
    }
    // The new ids have test ids of their own (D-928).
    expect(LIVE_ROW_TEST_ID.head).toBe('live-head');
    expect(LIVE_ROW_TEST_ID.controls).toBe('live-controls');
    expect(LIVE_ROW_TEST_ID.card).toBe('live-card');
    expect(LIVE_ROW_TEST_ID.facing).toBe('live-facing');
    expect(LIVE_ROW_TEST_ID.hint).toBe('sky-hint');
    expect(LIVE_ROW_TEST_ID['view-row']).toBe('live-view-row');
    expect(LIVE_ROW_TEST_ID.context).toBe('live-context');
    expect(LIVE_ROW_TEST_ID.track).toBe('live-track');
    expect(LIVE_ROW_TEST_ID.taps).toBe('live-taps');
    expect(LIVE_ROW_TEST_ID.satellites).toBe('live-satellites');
    // …and none of them is a wide row: wide is R77's and R78's, unchanged, the sheet state ignored.
    for (const state of ['watching', 'scrubbing'] as const) {
      for (const shape of ['tall', 'short'] as const) {
        for (const row of ['head', 'controls', 'hint', 'card', 'context', 'track', 'taps', 'view-row', 'facing', 'satellites'] as const) expect(rowsFor(state, 'wide', shape)).not.toContain(row);
        expect(rowsFor(state, 'wide', shape, false)).toEqual(rowsFor(state, 'wide', shape, true));
        expect(rowsFor(state, 'wide', shape)).toContain('top-row');
      }
    }
  });

  it('wide, watching: the box and the rail — the indicator with the clock, the next event, the conditions, the overview, [ scrub the night ] [ Hidden ] [ Share this sky ]', () => {
    expect(rowsFor('watching', 'wide', 'tall')).toEqual(['top-row', 'box', 'indicator', 'clock', 'next-event', 'conditions', 'overview', 'actions', 'scrub', 'hidden', 'share']);
  });

  it('wide, scrubbing: the scrub block under the box, and the rail with [ back to live ] beside the indicator', () => {
    expect(rowsFor('scrubbing', 'wide', 'tall')).toEqual(['top-row', 'box', 'time-row', 'playback', 'overview', 'stripe', 'steps', 'indicator', 'back-to-live', 'conditions', 'actions', 'hidden', 'share']);
  });

  it('wide renders no timeline but the overview while watching, and every one of them while scrubbing', () => {
    const watching = rowsFor('watching', 'wide', 'tall');
    const scrubbing = rowsFor('scrubbing', 'wide', 'tall');
    for (const row of TIMELINE) {
      expect(watching).not.toContain(row);
      expect(scrubbing).toContain(row);
    }
    expect(watching).toContain('overview');
    expect(scrubbing).toContain('overview');
    // The next event is watching's headline alone; `[ scrub ]` and `[ back to live ]` are the two states' ways out.
    expect(watching).toContain('next-event');
    expect(scrubbing).not.toContain('next-event');
    expect(watching).toContain('scrub');
    expect(watching).not.toContain('back-to-live');
    expect(scrubbing).toContain('back-to-live');
    expect(scrubbing).not.toContain('scrub');
  });

  it('keeps every wide capability in one state or the other (US-27 AC6): hidden objects, share, playback, steps', () => {
    const either = new Set([...rowsFor('watching', 'wide', 'tall'), ...rowsFor('scrubbing', 'wide', 'tall')]);
    for (const row of ['hidden', 'share', 'playback', 'steps', 'stripe', 'overview', 'conditions', 'indicator'] as const) expect(either).toContain(row);
    // The open satellites are compact's (R150, FR-GYRO-10): on wide the legend is in the rail at every width (FR-LEG-6).
    expect(rowsFor('watching', 'compact', 'tall')).toContain('satellites');
    expect(rowsFor('watching', 'wide', 'tall')).not.toContain('satellites');
    // R144 (FR-TONIGHT-4, FR-TONIGHT-6): compact keeps its capabilities as the track and the taps — playback is the taps' play glyph, the step is `next`.
    expect(rowsFor('watching', 'compact', 'tall')).toContain('track');
    expect(rowsFor('watching', 'compact', 'tall')).toContain('taps');
    expect(rowsFor('watching', 'compact', 'tall')).toContain('share');
  });

  it('the short wide window (R78, FR-WATCH-6): watching is the wide page’s; scrubbing, the bar is the time row, the stripe and the step row, and the overview stays in the rail', () => {
    expect(rowsFor('watching', 'wide', 'short')).toEqual(rowsFor('watching', 'wide', 'tall'));
    const scrubbing = rowsFor('scrubbing', 'wide', 'short');
    expect(scrubbing).toEqual(['top-row', 'box', 'time-row', 'playback', 'stripe', 'steps', 'indicator', 'back-to-live', 'conditions', 'overview', 'actions', 'hidden', 'share']);
    // The same rows as the tall page scrubbing — only where the overview stands differs.
    expect([...scrubbing].sort()).toEqual([...rowsFor('scrubbing', 'wide', 'tall')].sort());
    expect(scrubbing.indexOf('overview')).toBeGreaterThan(scrubbing.indexOf('conditions'));
  });

  it('reads the shape off the placement rule: under the box is the tall page, the rail and the overlay the short one (D-448)', () => {
    expect(liveShape('under')).toBe('tall');
    expect(liveShape('rail')).toBe('short');
    expect(liveShape('overlay')).toBe('short');
  });

  it('renders everything a fold re-cuts, in every wide state and shape, so the fold never names an absent row (D-447)', () => {
    for (const needed of Object.values(LIVE_FOLD_NEEDS).flat()) expect(LIVE_ROWS).toContain(needed);
    for (const state of ['watching', 'scrubbing'] as const) {
      for (const shape of ['tall', 'short'] as const) expect(foldRows(0, rowsFor(state, 'wide', shape))).toEqual(LIVE_FOLD_ORDER);
    }
  });

  it('keeps every wide capability at the short shape too (US-27 AC6)', () => {
    const either = new Set([...rowsFor('watching', 'wide', 'short'), ...rowsFor('scrubbing', 'wide', 'short')]);
    for (const row of ['hidden', 'share', 'playback', 'steps', 'stripe', 'overview', 'scrub', 'back-to-live'] as const) expect(either.has(row), row).toBe(true);
  });

  it('names every row once, and every row has a test id of its own', () => {
    for (const state of ['watching', 'scrubbing'] as const) {
      for (const mode of ['compact', 'wide'] as const) {
        for (const shape of ['tall', 'short'] as const) {
          const rows = rowsFor(state, mode, shape);
          expect(new Set(rows).size).toBe(rows.length);
        }
      }
    }
    expect(new Set(Object.values(LIVE_ROW_TEST_ID)).size).toBe(LIVE_ROWS.length);
  });
});

/** R85 (F-81, FR-CAP-5, D-549): the short wide inventory ends on a whole entry, with `+n` for the rest. */
describe('inventoryClip (F-81)', () => {
  // Three passes (two rows each), then the Sun and the Moon (one each): eight rows in all.
  const entries = [2, 2, 2, 1, 1];

  it('shows everything, with no line, when the entries fit', () => {
    expect(inventoryClip(entries, 8)).toEqual({ rows: 8, shown: 5, more: 0 });
    expect(inventoryClip(entries, 12)).toEqual({ rows: 8, shown: 5, more: 0 });
  });

  it('keeps a row for the +n line and stops at the last entry that fits whole', () => {
    // Seven rows: six for the list and one for the line. Three passes are six rows; the Sun and the Moon are left out.
    expect(inventoryClip(entries, 7)).toEqual({ rows: 6, shown: 3, more: 2 });
    // Six: five for the list — two passes whole, since the third would end past the fifth row.
    expect(inventoryClip(entries, 6)).toEqual({ rows: 4, shown: 2, more: 3 });
  });

  it('never cuts an entry: the rows shown are always a sum of whole entries', () => {
    for (let budget = 0; budget <= 10; budget += 1) {
      const clip = inventoryClip(entries, budget);
      expect(clip.rows).toBe(entries.slice(0, clip.shown).reduce((sum, rows) => sum + rows, 0));
      expect(clip.shown + clip.more).toBe(entries.length);
      expect(clip.rows + (clip.more > 0 ? 1 : 0)).toBeLessThanOrEqual(Math.max(budget, 1));
    }
  });

  it('an empty sky is its one line', () => {
    expect(inventoryClip([1], 3)).toEqual({ rows: 1, shown: 1, more: 0 });
  });
});

/** R101 (FR-JUMP-1, D-624): where `[ see this pass ]` rides — never a row of its own. */
describe('jumpPlacement (FR-JUMP-1)', () => {
  it('is the path line on compact whatever the fit, and on wide where the control fits after it', () => {
    expect(jumpPlacement('compact', true)).toBe('path');
    expect(jumpPlacement('compact', false)).toBe('path');
    expect(jumpPlacement('wide', true)).toBe('path');
    expect(jumpPlacement('wide', false)).toBe('actions');
  });

  it('fits when the last line, a cell of space and the control are inside the row, to half a pixel', () => {
    // A 44-cell rail at 9.63 px a cell, the control's 17 cells: a 26-cell last line fits, a 27-cell one does not.
    const cell = 9.63;
    const fit = (lastCells: number): boolean => jumpFitsOnPath({ lastLineEndPx: lastCells * cell, spacePx: cell, controlPx: 17 * cell, rowPx: 44 * cell });
    expect(fit(26)).toBe(true);
    expect(fit(27)).toBe(false);
    expect(jumpFitsOnPath({ lastLineEndPx: 100.4, spacePx: 0, controlPx: 0, rowPx: 100 })).toBe(true);
    expect(jumpFitsOnPath({ lastLineEndPx: 100.6, spacePx: 0, controlPx: 0, rowPx: 100 })).toBe(false);
  });

  it('is never a row of the inventory', () => {
    expect(LIVE_ROWS as readonly string[]).not.toContain('jump');
  });
});
