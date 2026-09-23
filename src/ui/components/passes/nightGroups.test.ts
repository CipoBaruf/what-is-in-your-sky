/**
 * R88 (US-16 AC5 as amended v2.1, FR-NIGHT-1, D-534): the list's nights are
 * local noon to local noon in the observer's zone. The cases are the rule's:
 * a pass before dawn under the evening before it, a pass on the noon
 * boundary, a pass straddling it, the order of the groups, and only the
 * nights that hold a pass.
 */
import { describe, expect, it } from 'vitest';
import { NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { deviceZone } from '../../../lib/nights';
import type { Pass } from '../../../model';
import { groupByNight } from './nightGroups';

const ZONE = 'America/Argentina/Salta'; // UTC−3, no DST
/** `hour` on `day` September 2026, on Salta's clock. */
const local = (day: number, hour: number, minute = 0): number => Date.UTC(2026, 8, day, hour + 3, minute);

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
    elementsEpochMs: startMs,
    ...NO_MOON_AT_PEAK,
  };
}

const shape = (passes: Pass[], zone: string | null = ZONE): [string, string[]][] => groupByNight(passes, zone).map((group) => [group.key, group.passes.map((p) => p.id)]);

describe('groupByNight', () => {
  it('files a pass before dawn under the night that began the evening before it (F-90)', () => {
    // A run computed at 01:00 on the 11th: the 05:00 pass is the 10th's night, the 21:00 pass the 11th's.
    expect(shape([pass('dawn', local(11, 5)), pass('evening', local(11, 21))])).toEqual([
      ['2026-09-10', ['dawn']],
      ['2026-09-11', ['evening']],
    ]);
  });

  it('claims a pass by its start: one straddling noon is listed once, under the night it began in', () => {
    const straddler = pass('straddler', local(11, 11, 55), 10 * 60_000);
    expect(shape([straddler])).toEqual([['2026-09-10', ['straddler']]]);
  });

  it('a pass starting exactly at noon belongs to the night that opens there', () => {
    expect(shape([pass('edge', local(11, 12))])).toEqual([['2026-09-11', ['edge']]]);
  });

  it('returns the nights in order whatever order the passes came in, each night’s passes as given (the list sorts them itself)', () => {
    const passes = [pass('c', local(13, 22)), pass('a', local(11, 22)), pass('b2', local(13, 4)), pass('b1', local(12, 21))];
    expect(shape(passes)).toEqual([
      ['2026-09-11', ['a']],
      ['2026-09-12', ['b2', 'b1']],
      ['2026-09-13', ['c']],
    ]);
    expect(groupByNight(passes, ZONE).map((group) => group.index)).toEqual([0, 1, 2]);
  });

  it('draws only the nights that hold a pass (FR-NIGHT-2), and nothing from no passes', () => {
    expect(shape([pass('a', local(11, 22)), pass('c', local(13, 22))]).map(([key]) => key)).toEqual(['2026-09-11', '2026-09-13']);
    expect(groupByNight([], ZONE)).toEqual([]);
  });

  it('cuts on the observer’s noon, not UTC’s: the same instant can be one night east and another west', () => {
    // 13:30 UTC is 10:30 in Salta (the 10th's night) and 15:30 in Madrid (the 11th's).
    const t = Date.UTC(2026, 8, 11, 13, 30);
    expect(shape([pass('p', t)], 'America/Argentina/Salta')[0]?.[0]).toBe('2026-09-10');
    expect(shape([pass('p', t)], 'Europe/Madrid')[0]?.[0]).toBe('2026-09-11');
  });

  it('a null zone groups on the device’s clock, never UTC by default (D-534)', () => {
    const passes = [pass('a', local(11, 5)), pass('b', local(11, 21)), pass('c', Date.UTC(2026, 8, 12, 12) + 30 * 60_000)];
    expect(shape(passes, null)).toEqual(shape(passes, deviceZone()));
  });
});
