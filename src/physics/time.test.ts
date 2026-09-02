import { describe, expect, it } from 'vitest';
import { loadReferenceValues } from '../../tests/support/reference';
import { JD_J2000, JD_UNIX_EPOCH, MS_PER_DAY, isoUtc, julianDateToMs, msToDate, msToJulianDate, parseOmmEpoch } from './time';

const ref = loadReferenceValues();

describe('time', () => {
  it('maps the J2000 epoch to JD 2451545.0', () => {
    expect(msToJulianDate(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(JD_J2000, 9);
  });

  it('maps 2026-09-01T00:00Z to JD 2461284.5', () => {
    // 2026-09-01 is 9740 days after 2000-01-01 (J2000 − 0.5 = 2451544.5).
    expect(msToJulianDate(Date.UTC(2026, 8, 1))).toBeCloseTo(2_461_284.5, 9);
  });

  it('maps the Unix epoch to JD 2440587.5 and one day to 86 400 000 ms', () => {
    expect(msToJulianDate(0)).toBe(JD_UNIX_EPOCH);
    expect(msToJulianDate(MS_PER_DAY)).toBe(JD_UNIX_EPOCH + 1);
  });

  it('round-trips ms → JD → ms', () => {
    const t = Date.UTC(2026, 8, 2, 3, 27, 20, 123);
    expect(julianDateToMs(msToJulianDate(t))).toBeCloseTo(t, 1); // JD doubles resolve ≈ 0.05 ms
  });

  it('parses a CelesTrak EPOCH (no zone suffix, six fractional digits) as UTC', () => {
    expect(parseOmmEpoch('2026-09-01T19:42:22.677120')).toBe(Date.UTC(2026, 8, 1, 19, 42, 22, 677));
  });

  it('honours an explicit zone and accepts whole seconds or a space separator', () => {
    expect(parseOmmEpoch('2026-09-01T19:42:22Z')).toBe(Date.UTC(2026, 8, 1, 19, 42, 22));
    expect(parseOmmEpoch('2026-09-01T19:42:22+02:00')).toBe(Date.UTC(2026, 8, 1, 17, 42, 22));
    expect(parseOmmEpoch('2026-09-01 19:42:22.5')).toBe(Date.UTC(2026, 8, 1, 19, 42, 22, 500));
  });

  it('rejects garbage and impossible dates', () => {
    expect(() => parseOmmEpoch('yesterday')).toThrow(/EPOCH/);
    expect(() => parseOmmEpoch('2026-13-45T25:61:61')).toThrow(/EPOCH/);
  });

  it('formats and wraps epoch ms as UTC Date / ISO', () => {
    expect(msToDate(ref.t).getTime()).toBe(ref.t);
    expect(isoUtc(Date.UTC(2026, 8, 2, 3, 51))).toBe('2026-09-02T03:51:00.000Z');
  });

  it('reproduces the reference capturedAt and ISS epoch (reference-values.json)', () => {
    expect(Date.parse(ref.capturedAt)).toBe(ref.t);
    expect(parseOmmEpoch(ref.iss.epoch)).toBe(ref.iss.epochMs);
    // The pinned t is a whole number of days plus a whole number of ms after the Unix epoch.
    expect(julianDateToMs(msToJulianDate(ref.t))).toBeCloseTo(ref.t, 1);
  });
});
