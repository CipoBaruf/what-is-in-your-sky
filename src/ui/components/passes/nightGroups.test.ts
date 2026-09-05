/**
 * TASKS R27 (US-16 AC5, FR-OFF-2): the list's nights are the worker's nights.
 * The equality that matters is with `worker/nights.ts` (D-95), so the cases are
 * its cases: a pass on a boundary, a pass straddling one, an empty night, and a
 * window that is one night.
 */
import { describe, expect, it } from 'vitest';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import type { Pass, TimeWindow } from '../../../model';
import { NIGHT_MS } from '../../../state';
import { claimsPass, splitIntoNights } from '../../../worker/nights';
import { groupByNight } from './nightGroups';

const T0 = 1_789_120_000_000;
const WINDOW: TimeWindow = { startMs: T0, endMs: T0 + 3 * NIGHT_MS };

function pass(id: string, startMs: number, durationMs = 5 * 60_000): Pass {
  return {
    id,
    noradId: 25544,
    name: id,
    start: { t: startMs, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: startMs + durationMs / 2, azDeg: 250, elDeg: 60, rangeKm: 800 },
    end: { t: startMs + durationMs, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: durationMs / 1000,
    peakMagnitude: -1.8,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: T0,
    ...NO_MOON_AT_PEAK,
  };
}

const ids = (window: TimeWindow, passes: Pass[]): string[][] => groupByNight(passes, window).map((group) => group.passes.map((p) => p.id));

describe('groupByNight', () => {
  it('returns every night of the window, empty ones included', () => {
    expect(ids(WINDOW, [pass('b', T0 + NIGHT_MS + 1000)])).toEqual([[], ['b'], []]);
  });

  it('claims a pass by its start, so one straddling a boundary is listed once, under the night it began in', () => {
    // Starts ten minutes before the second night and runs into it: night 0's, exactly as the worker emitted it.
    const straddler = pass('straddler', T0 + NIGHT_MS - 600_000, 900_000);
    expect(ids(WINDOW, [straddler])).toEqual([['straddler'], [], []]);
  });

  it('a pass starting exactly on a boundary belongs to the night that opens there', () => {
    expect(ids(WINDOW, [pass('edge', T0 + NIGHT_MS)])).toEqual([[], ['edge'], []]);
  });

  it('agrees with the worker night for every pass, which is what makes the groups the computed ones (D-95)', () => {
    const nights = splitIntoNights(WINDOW);
    const passes = [pass('a', T0), pass('b', T0 + NIGHT_MS - 1), pass('c', T0 + NIGHT_MS), pass('d', T0 + 2 * NIGHT_MS + 5_000), pass('e', WINDOW.endMs - 1)];
    for (const p of passes) {
      const mine = groupByNight([p], WINDOW).findIndex((group) => group.passes.length === 1);
      const worker = nights.findIndex((night) => claimsPass(night, p.start.t));
      expect(mine, p.id).toBe(worker);
    }
  });

  it('keeps a pass outside the window at the near end rather than dropping it', () => {
    // A stored run read back after its own window has moved on is still the only offline answer (D-105).
    expect(ids(WINDOW, [pass('before', T0 - 60_000), pass('after', WINDOW.endMs + 60_000)])).toEqual([['before'], [], ['after']]);
  });

  it('a one-night window is one group, and no window at all is one group holding everything', () => {
    const oneNight: TimeWindow = { startMs: T0, endMs: T0 + NIGHT_MS };
    expect(ids(oneNight, [pass('a', T0), pass('b', T0 + 1000)])).toEqual([['a', 'b']]);
    expect(groupByNight([pass('a', T0)], null).map((g) => g.passes.map((p) => p.id))).toEqual([['a']]);
  });

  it('a night carries its own bounds, so the heading can be dated from them', () => {
    expect(groupByNight([], WINDOW).map((g) => [g.index, g.startMs, g.endMs])).toEqual([
      [0, T0, T0 + NIGHT_MS],
      [1, T0 + NIGHT_MS, T0 + 2 * NIGHT_MS],
      [2, T0 + 2 * NIGHT_MS, T0 + 3 * NIGHT_MS],
    ]);
  });
});
