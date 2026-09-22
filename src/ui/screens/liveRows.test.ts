/**
 * R77 (FR-WATCH-4, D-447): the live page's inventory, as one table. The exact
 * ordered list per state and mode, and the rules FR-WATCH-4 states in words —
 * checked here once, so the page's own test only has to hold `Live.tsx` to it.
 */
import { describe, expect, it } from 'vitest';
import { foldRows, LIVE_FOLD_NEEDS, LIVE_FOLD_ORDER } from '../../lib/layout';
import { inventoryClip, LIVE_ROW_TEST_ID, LIVE_ROWS, liveShape, rowsFor, type LiveRow } from './liveRows';

const TIMELINE: readonly LiveRow[] = ['time-row', 'stripe', 'steps', 'playback'];

describe('rowsFor (FR-WATCH-4)', () => {
  it('compact, watching: the indicator on the top row, the next event, the box, the conditions, the overview with its labels and [ scrub ] [ list (n) ] Share', () => {
    expect(rowsFor('watching', 'compact', 'tall')).toEqual(['top-row', 'indicator', 'next-event', 'box', 'conditions', 'overview', 'overview-labels', 'actions', 'scrub', 'list', 'share']);
  });

  it('compact, scrubbing: the held instant in the headline’s place, the timeline rows, and [ back to live ] [ hidden ] Share (V20-8)', () => {
    expect(rowsFor('scrubbing', 'compact', 'tall')).toEqual(['top-row', 'indicator', 'time-row', 'box', 'conditions', 'overview', 'stripe', 'steps', 'playback', 'actions', 'back-to-live', 'hidden', 'share']);
  });

  it('wide, watching: the box and the rail — the indicator with the clock, the next event, the conditions, the overview, [ scrub the night ] [ Hidden ] [ Share this sky ]', () => {
    expect(rowsFor('watching', 'wide', 'tall')).toEqual(['top-row', 'box', 'indicator', 'clock', 'next-event', 'conditions', 'overview', 'actions', 'scrub', 'hidden', 'share']);
  });

  it('wide, scrubbing: the scrub block under the box, and the rail with [ back to live ] beside the indicator', () => {
    expect(rowsFor('scrubbing', 'wide', 'tall')).toEqual(['top-row', 'box', 'time-row', 'playback', 'overview', 'stripe', 'steps', 'indicator', 'back-to-live', 'conditions', 'actions', 'hidden', 'share']);
  });

  it('renders no timeline but the overview while watching, and every one of them while scrubbing', () => {
    for (const mode of ['compact', 'wide'] as const) {
      const watching = rowsFor('watching', mode, 'tall');
      const scrubbing = rowsFor('scrubbing', mode, 'tall');
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
    }
  });

  it('keeps every capability in one state or the other (US-27 AC6): hidden objects, the list, share, playback, steps', () => {
    for (const mode of ['compact', 'wide'] as const) {
      const either = new Set([...rowsFor('watching', mode, 'tall'), ...rowsFor('scrubbing', mode, 'tall')]);
      for (const row of ['hidden', 'share', 'playback', 'steps', 'stripe', 'overview', 'conditions', 'indicator'] as const) expect(either).toContain(row);
    }
    // The list control is compact's: on wide the legend is in the rail at every width (FR-LEG-6).
    expect(rowsFor('watching', 'compact', 'tall')).toContain('list');
    expect(rowsFor('watching', 'wide', 'tall')).not.toContain('list');
  });

  it('the landscape phone (R78, FR-WATCH-5): the rail holds the indicator with the clock, the headline, the conditions and the overview; scrubbing adds the timeline rows and [ back to live ] at its head', () => {
    expect(rowsFor('watching', 'compact', 'short')).toEqual(['top-row', 'box', 'indicator', 'clock', 'next-event', 'conditions', 'overview', 'actions', 'scrub', 'list', 'share']);
    expect(rowsFor('scrubbing', 'compact', 'short')).toEqual(['top-row', 'box', 'indicator', 'back-to-live', 'time-row', 'conditions', 'overview', 'stripe', 'steps', 'playback', 'actions', 'hidden', 'share']);
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

  it('keeps every capability at the short shapes too (US-27 AC6)', () => {
    for (const mode of ['compact', 'wide'] as const) {
      const either = new Set([...rowsFor('watching', mode, 'short'), ...rowsFor('scrubbing', mode, 'short')]);
      for (const row of ['hidden', 'share', 'playback', 'steps', 'stripe', 'overview', 'scrub', 'back-to-live'] as const) expect(either.has(row), `${mode}: ${row}`).toBe(true);
    }
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
