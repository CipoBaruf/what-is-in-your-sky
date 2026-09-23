/**
 * FR-NIGHT-1 (D-534, F-90): a night is local noon to local noon. The fixture
 * run is computed at 01:00 local: its 05:00 pass is last evening's, its 21:00
 * pass the coming night's — in a zone east of UTC and one west of it — and a
 * null zone is the device's, never UTC by default.
 */
import { describe, expect, it } from 'vitest';
import { deviceZone, nextNight, nightAt, nightOf } from './nights';

const HOUR = 3_600_000;

/** A run computed at 01:00 local on 2026-09-11, with a pass at 05:00 and one at 21:00 that day. */
function fixtureRun(offsetHours: number): { computedAt: number; dawn: number; evening: number } {
  // Local 2026-09-11 01:00 is UTC 2026-09-11 01:00 less the zone's offset.
  const local = (hour: number): number => Date.UTC(2026, 8, 11, hour) - offsetHours * HOUR;
  return { computedAt: local(1), dawn: local(5), evening: local(21) };
}

describe('nightOf', () => {
  it('east of UTC: the 05:00 pass is under last evening’s night and the 21:00 pass under the coming one', () => {
    const zone = 'Europe/Madrid'; // UTC+2 in September
    const run = fixtureRun(2);
    expect(nightOf(run.computedAt, zone)).toBe('2026-09-10');
    expect(nightOf(run.dawn, zone)).toBe('2026-09-10');
    expect(nightOf(run.evening, zone)).toBe('2026-09-11');
    // The instant itself is on the 11th, before noon: the night under way is the 10th's.
    expect(nightAt(run.computedAt, zone)).toEqual({ key: '2026-09-10', date: '2026-09-11', beforeNoon: true });
  });

  it('west of UTC: the same three instants file the same way on that zone’s clock', () => {
    const zone = 'America/Argentina/Salta'; // UTC−3, no DST
    const run = fixtureRun(-3);
    expect(nightOf(run.computedAt, zone)).toBe('2026-09-10');
    expect(nightOf(run.dawn, zone)).toBe('2026-09-10');
    expect(nightOf(run.evening, zone)).toBe('2026-09-11');
    // The 21:00 pass is past UTC midnight (00:00 on the 12th UTC), which is not what decides its night.
    expect(new Date(run.evening).toISOString()).toBe('2026-09-12T00:00:00.000Z');
    expect(nightAt(run.evening, zone)).toEqual({ key: '2026-09-11', date: '2026-09-11', beforeNoon: false });
  });

  it('cuts exactly on local noon: 11:59 is yesterday’s night, 12:00 is today’s', () => {
    const zone = 'Europe/Madrid';
    const noon = Date.UTC(2026, 8, 11, 10); // 12:00 local
    expect(nightOf(noon - 60_000, zone)).toBe('2026-09-10');
    expect(nightOf(noon, zone)).toBe('2026-09-11');
  });

  it('a null zone falls back to the device’s, never to UTC', () => {
    const zone = deviceZone();
    const run = fixtureRun(0);
    for (const t of [run.computedAt, run.dawn, run.evening, Date.UTC(2026, 8, 11, 12), Date.UTC(2026, 11, 31, 23, 30)]) {
      expect(nightOf(t, null)).toBe(nightOf(t, zone));
    }
    // A zone the engine does not know is treated as none.
    expect(nightOf(run.dawn, 'Mars/Olympus_Mons')).toBe(nightOf(run.dawn, zone));
  });

  it('crosses a month and a year end on the zone’s calendar', () => {
    // 00:30 on 1 January local, Tokyo: the night is 31 December’s.
    expect(nightOf(Date.UTC(2026, 11, 31, 15, 30), 'Asia/Tokyo')).toBe('2026-12-31');
    // 13:00 on 1 January local: the new year’s first night.
    expect(nightOf(Date.UTC(2027, 0, 1, 4), 'Asia/Tokyo')).toBe('2027-01-01');
    // 00:30 on 1 March local in a leap year is the 29th's night; in a common year the 28th's.
    expect(nightOf(Date.UTC(2028, 1, 29, 15, 30), 'Asia/Tokyo')).toBe('2028-02-29');
    expect(nightOf(Date.UTC(2027, 1, 28, 15, 30), 'Asia/Tokyo')).toBe('2027-02-28');
  });
});

describe('nextNight', () => {
  it('is the next calendar date, so a 23 h spring-forward day still has one night (F-26)', () => {
    expect(nextNight('2026-09-05')).toBe('2026-09-06');
    expect(nextNight('2026-09-30')).toBe('2026-10-01');
    expect(nextNight('2026-12-31')).toBe('2027-01-01');
    // Santiago springs forward into 2026-09-06, a 23 h day: 23:30 on the 5th (UTC−4) and 23:30 on the 6th (UTC−3)
    // are 23 h apart on the clock and one night apart on the calendar.
    const zone = 'America/Santiago';
    const late = Date.UTC(2026, 8, 6, 3, 30);
    expect(nightOf(late, zone)).toBe('2026-09-05');
    expect(nightOf(late + 23 * HOUR, zone)).toBe('2026-09-06');
    expect(nextNight(nightOf(late, zone))).toBe(nightOf(late + 23 * HOUR, zone));
  });
});
