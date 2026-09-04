/**
 * TASKS R8: verdict boundaries at 29.9 / 30 / 70 / 70.1 %, the layered vs
 * total formula, midpoint interpolation, and `unknown` without a snapshot or
 * outside the covered hours.
 */
import { describe, expect, it } from 'vitest';
import type { HourlyCloud, WeatherSnapshot } from '../model';
import { CLEAR_BELOW_PCT, OBSCURED_ABOVE_PCT, cloudState, cloudVerdict, effectiveCloudPct, interpolateCloud } from './cloudVerdict';

const HOUR = 3_600_000;
const T0 = Date.parse('2026-09-02T00:00:00Z');
const snapshot = (hourly: HourlyCloud[]): WeatherSnapshot => ({ provider: 'open-meteo', lat: -38.9, lon: -68, cellKey: '-38.9,-68.0', fetchedAt: T0, timeZone: 'America/Argentina/Salta', hourly });

describe('cloudState', () => {
  it('splits at < 30 / 30–70 / > 70 % (US-7 AC2)', () => {
    expect(CLEAR_BELOW_PCT).toBe(30);
    expect(OBSCURED_ABOVE_PCT).toBe(70);
    expect(cloudState(0)).toBe('clear');
    expect(cloudState(29.9)).toBe('clear');
    expect(cloudState(30)).toBe('partly');
    expect(cloudState(70)).toBe('partly');
    expect(cloudState(70.1)).toBe('obscured');
    expect(cloudState(100)).toBe('obscured');
  });
});

describe('effectiveCloudPct', () => {
  it('weights 0.6·low + 0.3·mid + 0.1·high when all three layers are present (FR-WX-4)', () => {
    expect(effectiveCloudPct({ t: T0, totalPct: 90, lowPct: 10, midPct: 20, highPct: 100 })).toBeCloseTo(6 + 6 + 10, 10);
    // Thin cirrus alone barely counts: 100 % high cloud reads as 10 %.
    expect(effectiveCloudPct({ t: T0, totalPct: 100, lowPct: 0, midPct: 0, highPct: 100 })).toBeCloseTo(10, 10);
  });

  it('falls back to the total when any layer is missing', () => {
    expect(effectiveCloudPct({ t: T0, totalPct: 55 })).toBe(55);
    expect(effectiveCloudPct({ t: T0, totalPct: 55, lowPct: 0, midPct: 0 })).toBe(55);
  });
});

describe('interpolateCloud', () => {
  const hourly: HourlyCloud[] = [
    { t: T0, totalPct: 20, lowPct: 10, midPct: 0, highPct: 40 },
    { t: T0 + HOUR, totalPct: 60, lowPct: 50, midPct: 20, highPct: 0 },
    { t: T0 + 2 * HOUR, totalPct: 100 },
  ];

  it('returns each layer at the midpoint between two hours', () => {
    expect(interpolateCloud(hourly, T0 + HOUR / 2)).toEqual({ t: T0 + HOUR / 2, totalPct: 40, lowPct: 30, midPct: 10, highPct: 20 });
  });

  it('returns the sample itself on the hour, and drops the layers when a neighbour lacks them', () => {
    expect(interpolateCloud(hourly, T0 + HOUR)).toEqual(hourly[1]);
    expect(interpolateCloud(hourly, T0 + 1.25 * HOUR)).toEqual({ t: T0 + 1.25 * HOUR, totalPct: 70 });
    expect(interpolateCloud(hourly, T0 + 2 * HOUR)).toEqual({ t: T0 + 2 * HOUR, totalPct: 100 });
  });

  it('is null outside the covered range or without data', () => {
    expect(interpolateCloud(hourly, T0 - 1)).toBeNull();
    expect(interpolateCloud(hourly, T0 + 2 * HOUR + 1)).toBeNull();
    expect(interpolateCloud([], T0)).toBeNull();
  });
});

describe('cloudVerdict', () => {
  it('interpolates per layer to the instant and weights the result (FR-WX-2, FR-WX-4)', () => {
    const s = snapshot([
      { t: T0, totalPct: 0, lowPct: 0, midPct: 0, highPct: 0 },
      { t: T0 + HOUR, totalPct: 100, lowPct: 100, midPct: 100, highPct: 0 },
    ]);
    // Midpoint: low 50, mid 50, high 0 → 0.6·50 + 0.3·50 = 45 → partly.
    expect(cloudVerdict(s, T0 + HOUR / 2)).toEqual({ state: 'partly', effectivePct: 45, at: T0 + HOUR / 2 });
    expect(cloudVerdict(s, T0)).toMatchObject({ state: 'clear', effectivePct: 0 });
    expect(cloudVerdict(s, T0 + HOUR)).toMatchObject({ state: 'obscured', effectivePct: 90 });
  });

  it('uses the total when the provider gave no layers', () => {
    const s = snapshot([
      { t: T0, totalPct: 20 },
      { t: T0 + HOUR, totalPct: 40 },
    ]);
    expect(cloudVerdict(s, T0 + HOUR / 2)).toEqual({ state: 'partly', effectivePct: 30, at: T0 + HOUR / 2 });
  });

  it('is unknown without a snapshot, and outside the hours the snapshot covers (US-7 AC4)', () => {
    expect(cloudVerdict(null, T0)).toEqual({ state: 'unknown', effectivePct: null, at: T0 });
    const s = snapshot([{ t: T0, totalPct: 20 }]);
    expect(cloudVerdict(s, T0 + 1)).toEqual({ state: 'unknown', effectivePct: null, at: T0 + 1 });
  });

  it('reads unknown for the hours of the 72 h window past the end of a stored forecast (FR-OFF-3)', () => {
    // What an offline session sees: a snapshot fetched a day ago, still in use, covering four days from its own start.
    const stored = snapshot(Array.from({ length: 96 }, (_, i) => ({ t: T0 + i * HOUR, totalPct: 20 })));
    expect(cloudVerdict(stored, T0 + 95 * HOUR)).toEqual({ state: 'clear', effectivePct: 20, at: T0 + 95 * HOUR });
    expect(cloudVerdict(stored, T0 + 96 * HOUR)).toEqual({ state: 'unknown', effectivePct: null, at: T0 + 96 * HOUR });
  });
});
