import { describe, expect, it } from 'vitest';
import { declinationDeg } from './declination';

/**
 * R44 (FR-WIN-3, US-21 AC6; D-185): the World Magnetic Model through
 * `geomagnetism`, checked at three places against the reference values below.
 *
 * The references are WMM2025 declinations — the model NOAA's own calculator
 * serves — at three observers spread over both hemispheres and both signs, to
 * a tenth of a degree, with the ±0.2° tolerance the task asks for. A tenth is
 * also all the strip prints, so a drift larger than this is a drift the user
 * would see.
 */
const site = (lat: number, lon: number, altM = 0) => ({ lat, lon, altM });

describe('declinationDeg', () => {
  it.each([
    // Neuquén, the R1 fixtures' observer: a degree east, the value D-185 records.
    { name: 'Neuquén', at: site(-38.93, -67.99), date: '2026-09-05T00:00:00Z', expected: 1.12 },
    // New York: the largest westerly declination of the three, and the one that proves the sign is carried.
    { name: 'New York', at: site(40.7128, -74.006), date: '2026-01-01T00:00:00Z', expected: -12.49 },
    // Sydney: the southern hemisphere at the other extreme, twelve degrees east.
    { name: 'Sydney', at: site(-33.8688, 151.2093), date: '2026-01-01T00:00:00Z', expected: 12.81 },
  ])('is $expected° at $name', ({ at, date, expected }) => {
    expect(declinationDeg(at, new Date(date))).toBeCloseTo(expected, 1);
    // The tolerance the task states, stated once more as the number it is.
    expect(Math.abs(declinationDeg(at, new Date(date)) - expected)).toBeLessThanOrEqual(0.2);
  });

  it('follows the secular variation within a model epoch', () => {
    const at = site(-38.93, -67.99);
    const start = declinationDeg(at, new Date('2025-01-01T00:00:00Z'));
    const later = declinationDeg(at, new Date('2029-01-01T00:00:00Z'));
    // Four years apart is a tenth of a degree at least, and never the same number.
    expect(Math.abs(later - start)).toBeGreaterThan(0.1);
  });

  it('takes the altitude in metres', () => {
    const ground = declinationDeg(site(-38.93, -67.99, 0), new Date('2026-09-05T00:00:00Z'));
    const high = declinationDeg(site(-38.93, -67.99, 100_000), new Date('2026-09-05T00:00:00Z'));
    // 100 km up the field has moved a measurable amount; 100 m — the range an observer's altitude
    // covers — has not, which is why the strip's tenth of a degree never depends on it.
    expect(Math.abs(high - ground)).toBeGreaterThan(0.001);
    expect(declinationDeg(site(-38.93, -67.99, 100), new Date('2026-09-05T00:00:00Z'))).toBeCloseTo(ground, 3);
  });

  it('falls back to the nearest model rather than throwing outside the WMM epochs', () => {
    const at = site(-38.93, -67.99);
    expect(declinationDeg(at, new Date('2000-01-01T00:00:00Z'))).toBeTypeOf('number');
    expect(declinationDeg(at, new Date('2040-01-01T00:00:00Z'))).toBeTypeOf('number');
  });
});
