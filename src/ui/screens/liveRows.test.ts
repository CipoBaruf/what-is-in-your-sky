/**
 * R77 (FR-WATCH-4, D-447): the live page's inventory, as one table. The exact
 * ordered list per state and mode, and the rules FR-WATCH-4 states in words —
 * checked here once, so the page's own test only has to hold `Live.tsx` to it.
 */
import { describe, expect, it } from 'vitest';
import { LIVE_ROW_TEST_ID, LIVE_ROWS, rowsFor, type LiveRow } from './liveRows';

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

  it('gives the short shapes their mode’s tall inventory until R78 re-cuts them (FR-WATCH-5, FR-WATCH-6)', () => {
    for (const state of ['watching', 'scrubbing'] as const) {
      for (const mode of ['compact', 'wide'] as const) expect(rowsFor(state, mode, 'short')).toEqual(rowsFor(state, mode, 'tall'));
    }
  });

  it('names every row once, and every row has a test id of its own', () => {
    for (const state of ['watching', 'scrubbing'] as const) {
      for (const mode of ['compact', 'wide'] as const) {
        const rows = rowsFor(state, mode, 'tall');
        expect(new Set(rows).size).toBe(rows.length);
      }
    }
    expect(new Set(Object.values(LIVE_ROW_TEST_ID)).size).toBe(LIVE_ROWS.length);
  });
});
