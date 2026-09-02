import { describe, expect, it } from 'vitest';
import { JD_J2000, julianDateToMs, msToJulianDate, parseOmmEpoch } from './time';

describe('time', () => {
  it('maps the J2000 epoch to JD 2451545.0', () => {
    expect(msToJulianDate(Date.UTC(2000, 0, 1, 12))).toBeCloseTo(JD_J2000, 9);
  });

  it('maps 2026-09-01T00:00Z to JD 2461284.5', () => {
    // 2026-09-01 is 9740 days after 2000-01-01 (J2000 − 0.5 = 2451544.5).
    expect(msToJulianDate(Date.UTC(2026, 8, 1))).toBeCloseTo(2_461_284.5, 9);
  });

  it('round-trips ms → JD → ms', () => {
    const t = Date.UTC(2026, 8, 2, 3, 27, 20, 123);
    expect(julianDateToMs(msToJulianDate(t))).toBeCloseTo(t, 1); // JD doubles resolve ≈ 0.05 ms
  });

  it('parses a CelesTrak EPOCH (no zone suffix, six fractional digits) as UTC', () => {
    expect(parseOmmEpoch('2026-09-01T19:42:22.677120')).toBe(Date.UTC(2026, 8, 1, 19, 42, 22, 677));
  });

  it('honours an explicit zone and accepts whole seconds', () => {
    expect(parseOmmEpoch('2026-09-01T19:42:22Z')).toBe(Date.UTC(2026, 8, 1, 19, 42, 22));
    expect(parseOmmEpoch('2026-09-01T19:42:22+02:00')).toBe(Date.UTC(2026, 8, 1, 17, 42, 22));
  });

  it('rejects garbage', () => {
    expect(() => parseOmmEpoch('yesterday')).toThrow(/EPOCH/);
  });
});
