/**
 * TASKS R27 (FR-OFF-4): readiness over the four states the line has to word —
 * ready, no forecast, no passes, no elements — plus the rule that decides the
 * date: the earliest of the last pass's end and the forecast's end.
 */
import { describe, expect, it } from 'vitest';
import type { Pass, WeatherSnapshot } from '../model';
import { NO_MOON_AT_PEAK } from '../../tests/support/moonFixtures';
import { forecastEnd, lastPassEnd, readiness } from './readiness';

const T0 = 1_789_120_000_000;
const HOUR = 3_600_000;

function pass(id: string, startOffsetH: number, durationMin: number): Pass {
  const start = T0 + startOffsetH * HOUR;
  const end = start + durationMin * 60_000;
  return {
    id,
    noradId: 25544,
    name: id,
    start: { t: start, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: (start + end) / 2, azDeg: 250, elDeg: 60, rangeKm: 800 },
    end: { t: end, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: durationMin * 60,
    peakMagnitude: -1.8,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: T0,
    ...NO_MOON_AT_PEAK,
  };
}

/** `hours` hourly samples from `T0`, the shape `weatherCache` hands back (FR-OFF-3). */
function snapshot(hours: number): WeatherSnapshot {
  return {
    provider: 'open-meteo',
    lat: -38.93,
    lon: -67.99,
    cellKey: '-38.9,-68.0',
    fetchedAt: T0,
    timeZone: 'America/Argentina/Salta',
    hourly: Array.from({ length: hours }, (_, i) => ({ t: T0 + i * HOUR, totalPct: 20 })),
  };
}

/** Three nights of passes: the last one ends 68 h out. */
const threeNights = [pass('night-1', 4, 6), pass('night-2', 30, 5), pass('night-3', 68, 4)];

describe('lastPassEnd', () => {
  it('is the latest end, not the last entry of the array', () => {
    // A long pass starting before a short one ends after it: the list is sorted by start (D-105).
    expect(lastPassEnd([pass('long', 4, 600), pass('short', 5, 1)])).toBe(T0 + 4 * HOUR + 600 * 60_000);
  });

  it('is null for an empty list', () => {
    expect(lastPassEnd([])).toBeNull();
  });
});

describe('forecastEnd', () => {
  it('is the last hourly sample, the last instant a badge can read anything but "unknown"', () => {
    expect(forecastEnd(snapshot(96))).toBe(T0 + 95 * HOUR);
  });

  it('is null with no snapshot, and null for one that carries no hours', () => {
    expect(forecastEnd(null)).toBeNull();
    expect(forecastEnd({ ...snapshot(1), hourly: [] })).toBeNull();
  });
});

describe('readiness', () => {
  it('ready: nothing missing, and the date is the earlier of the two ends', () => {
    // 96 h of forecast against passes reaching 68 h + 4 min: the passes run out first.
    expect(readiness({ passes: threeNights, storedAt: null, forecast: snapshot(96), hasElements: true })).toEqual({
      offlineUntil: T0 + 68 * HOUR + 4 * 60_000,
      storedAt: null,
      missing: [],
    });
  });

  it('ready: a forecast that stops before the last pass is what the date states', () => {
    // 48 h of forecast: the app can name a pass on the third night but nothing about its sky.
    expect(readiness({ passes: threeNights, storedAt: T0 - HOUR, forecast: snapshot(48), hasElements: true })).toEqual({
      offlineUntil: T0 + 47 * HOUR,
      storedAt: T0 - HOUR,
      missing: [],
    });
  });

  it('carries the storage time through untouched, so the line can say how old the run is', () => {
    expect(readiness({ passes: threeNights, storedAt: T0 - 20 * HOUR, forecast: snapshot(96), hasElements: true }).storedAt).toBe(T0 - 20 * HOUR);
  });

  it('no forecast: named as missing, and no date is promised even though the passes have one', () => {
    expect(readiness({ passes: threeNights, storedAt: T0, forecast: null, hasElements: true })).toEqual({
      offlineUntil: null,
      storedAt: T0,
      missing: ['forecast'],
    });
  });

  it('no passes: named as missing, and no date', () => {
    expect(readiness({ passes: [], storedAt: null, forecast: snapshot(96), hasElements: true })).toEqual({
      offlineUntil: null,
      storedAt: null,
      missing: ['passes'],
    });
  });

  it('no elements: named as missing even while the stored run still gives a date', () => {
    // The elements failed to load this session; the stored run is still on screen (D-108). The date is
    // true and the gap is true, and the line decides which of the two to say.
    expect(readiness({ passes: threeNights, storedAt: T0 - HOUR, forecast: snapshot(96), hasElements: false })).toEqual({
      offlineUntil: T0 + 68 * HOUR + 4 * 60_000,
      storedAt: T0 - HOUR,
      missing: ['elements'],
    });
  });

  it('a cold start with no signal is missing all three, in the order the line reads them', () => {
    expect(readiness({ passes: [], storedAt: null, forecast: null, hasElements: false }).missing).toEqual(['elements', 'forecast', 'passes']);
  });
});
