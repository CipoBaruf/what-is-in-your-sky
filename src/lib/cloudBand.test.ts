import { describe, expect, it } from 'vitest';
import type { HourlyCloud } from '../model';
import { CLOUD_STEPS, cloudBandOf, cloudCells, cloudRuns } from './cloudBand';

const H = 3_600_000;
const T0 = Date.parse('2026-01-15T22:00Z');
const at = (h: number, totalPct: number, layers?: [number, number, number]): HourlyCloud =>
  layers ? { t: T0 + h * H, totalPct, lowPct: layers[0], midPct: layers[1], highPct: layers[2] } : { t: T0 + h * H, totalPct };

describe('cloudBandOf', () => {
  it('FR-WIDE-8: CLOUD_STEPS cut effective cover into four bands', () => {
    expect(CLOUD_STEPS).toEqual([20, 50, 80]);
    expect([0, 19.9, 20, 49.9, 50, 80, 80.1, 100].map(cloudBandOf)).toEqual(['clear', 'clear', 'some', 'some', 'mostly', 'mostly', 'overcast', 'overcast']);
  });
});

describe('cloudCells and cloudRuns', () => {
  // A fixed forecast: clear 22–23, mostly cloudy 23–02 (one hour by its layers, high cloud at 0.7), clear 02–04,
  // no sample at 04, overcast 05.
  const forecast: HourlyCloud[] = [at(0, 5), at(1, 60), at(2, 10, [0, 0, 100]), at(3, 75), at(4, 10), at(5, 0), at(7, 95)];

  it('FR-WIDE-8: one cell per hour, banded by the effective cover, the hour with no forecast a gap', () => {
    const cells = cloudCells(forecast, T0 + 30 * 60_000, T0 + 8 * H);
    expect(cells.map((c) => c.t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((h) => T0 + h * H));
    expect(cells.map((c) => c.band)).toEqual(['clear', 'mostly', 'mostly', 'mostly', 'clear', 'clear', null, 'overcast']);
  });

  it('FR-WIDE-8: runs of equal bands joined, a gap its own run, never clear', () => {
    const runs = cloudRuns(cloudCells(forecast, T0, T0 + 8 * H));
    expect(runs).toEqual([
      { band: 'clear', from: T0, to: T0 + H },
      { band: 'mostly', from: T0 + H, to: T0 + 4 * H },
      { band: 'clear', from: T0 + 4 * H, to: T0 + 6 * H },
      { band: null, from: T0 + 6 * H, to: T0 + 7 * H },
      { band: 'overcast', from: T0 + 7 * H, to: T0 + 8 * H },
    ]);
  });

  it('FR-WIDE-8: past the forecast every hour is a gap', () => {
    expect(cloudRuns(cloudCells([], T0, T0 + 3 * H))).toEqual([{ band: null, from: T0, to: T0 + 3 * H }]);
  });
});
