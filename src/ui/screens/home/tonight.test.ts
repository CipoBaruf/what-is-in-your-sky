/**
 * R88 (FR-NIGHT-1, US-16 AC5 as amended v2.1): what the phone's when and what
 * steps call tonight. The split is on FR-NIGHT-1's night — local noon to local
 * noon — and never on the night the list happens to open on, so the count, the
 * cards and the list's headings cannot disagree about which night they mean.
 */
import { describe, expect, it } from 'vitest';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import type { EpochMs, Pass } from '../../../model';
import { splitTonight } from './tonight';

const ZONE = 'America/Argentina/Salta'; // UTC−3, no DST: local noon is 15:00 UTC
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** `local(11, 22, 0)` is 2026-09-11 22:00 in ZONE. */
const local = (day: number, hour: number, minute = 0): EpochMs => Date.UTC(2026, 8, day, hour + 3, minute);

function pass(id: string, startMs: number): Pass {
  return {
    id,
    noradId: 25544,
    name: id,
    start: { t: startMs, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: startMs + 2 * MINUTE, azDeg: 250, elDeg: 60, rangeKm: 800 },
    end: { t: startMs + 4 * MINUTE, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 240,
    peakMagnitude: -1.8,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: local(11, 0),
    ...NO_MOON_AT_PEAK,
  };
}

const ids = (passes: readonly Pass[]): string[] => passes.map((p) => p.id);

describe('splitTonight (FR-NIGHT-1, US-16 AC5)', () => {
  const tomorrow = [pass('t1', local(12, 20)), pass('t2', local(12, 21)), pass('t3', local(12, 22))];

  it('counts tonight as empty when tonight holds nothing, whatever the list opens on — failing on the first cut of R88', () => {
    // 15:00, after the noon cut: tonight is the 11th's night, and every pass is tomorrow evening's.
    const split = splitTonight(tomorrow, ZONE, local(11, 15));
    expect(ids(split.tonight)).toEqual([]);
    expect(split.tonightKey).toBe('2026-09-11');
    // The three are later nights, which is what the list heads "Tomorrow night".
    expect(split.laterNights.map((group) => group.key)).toEqual(['2026-09-12']);
    expect(ids(split.later)).toEqual(['t1', 't2', 't3']);
  });

  it('takes tonight from tonight when it holds one, and drops what is already over', () => {
    const over = pass('over', local(11, 19));
    const soon = pass('soon', local(11, 23));
    const split = splitTonight([over, soon, ...tomorrow], ZONE, local(11, 21));
    expect(ids(split.tonight)).toEqual(['soon']);
    expect(split.tonightKey).toBe('2026-09-11');
    expect(ids(split.later)).toEqual(['t1', 't2', 't3']);
  });

  it('before the noon cut, tonight is the night that is still running', () => {
    // 01:00 on the 12th belongs to the 11th's night, which is still live.
    const small = pass('small', local(12, 1) + HOUR);
    const split = splitTonight([small, ...tomorrow], ZONE, local(12, 1));
    expect(split.tonightKey).toBe('2026-09-11');
    expect(ids(split.tonight)).toEqual(['small']);
    expect(ids(split.later)).toEqual(['t1', 't2', 't3']);
  });
});
