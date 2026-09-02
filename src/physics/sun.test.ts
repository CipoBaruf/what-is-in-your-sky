import { describe, expect, it } from 'vitest';
import type { Observer } from '../model';
import { sunPos } from 'satellite.js';
import { lookAnglesFrom, norm, scale, unit } from './frames';
import { msToJulianDate } from './time';
import { sunAltitudeDeg, sunVectorEqd } from './sun';

const equator: Observer = { lat: 0, lon: 0, altM: 0, label: 'equator', source: 'coords', timeZone: null };
const neuquen: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquen', source: 'coords', timeZone: 'UTC' };
const greenwich: Observer = { lat: 51.4769, lon: 0, altM: 0, label: 'Greenwich', source: 'coords', timeZone: null };

describe('sun', () => {
  it('declination at the June 2026 solstice is +23.44°', () => {
    const v = sunVectorEqd(Date.UTC(2026, 5, 21, 8, 24)); // solstice instant
    expect((Math.asin(v.z) * 180) / Math.PI).toBeCloseTo(23.437, 2);
  });

  it('sun vector is a unit vector', () => {
    expect(norm(sunVectorEqd(Date.UTC(2026, 8, 2, 3, 27)))).toBeCloseTo(1, 12);
  });

  it('altitude at solar noon on the equator at the solstice is 90° − 23.44° (within 0.1°)', () => {
    // Equation of time on 2026-06-21 ≈ −1.5 min, so solar noon at lon 0 is ≈ 12:01:30 UTC.
    expect(sunAltitudeDeg(equator, Date.UTC(2026, 5, 21, 12, 1, 30))).toBeCloseTo(66.56, 1);
  });

  it('agrees with satellite.js sunPos pushed through our own frames within 0.02° (independent implementation)', () => {
    // astronomy-engine (VSOP87, topocentric, Horizon) vs satellite.js's low-precision Vallado sun placed at 1 AU
    // and converted with frames.ts. Two independent code paths for altitude; agreement checks Horizon() plumbing
    // and the observer sign conventions at once.
    const AU_KM = 149_597_870.7;
    for (const [obs, hms] of [
      [neuquen, '22:12:07'],
      [neuquen, '22:37:31'],
      [neuquen, '23:08:25'],
      [greenwich, '18:46:33'],
      [greenwich, '19:19:33'],
    ] as const) {
      const t = Date.parse(`2026-09-02T${hms}Z`);
      const viaSatelliteJs = lookAnglesFrom(obs, scale(unit(sunPos(msToJulianDate(t)).rsun), AU_KM), t).elDeg;
      expect(sunAltitudeDeg(obs, t)).toBeCloseTo(viaSatelliteJs, 1.7); // |Δ| < 0.02°
    }
  });

  it('matches sunrise-sunset.org (NOAA algorithm) twilight events on 2026-09-02 within 0.15°', () => {
    // Fetched 2026-09-02 (formatted=0): Neuquén civil twilight end 22:37:31Z (−6°), nautical end 23:08:25Z (−12°);
    // Greenwich civil twilight end 19:19:33Z (−6°), nautical end 20:02:04Z (−12°). The service is minute-precise,
    // which is ≈ 0.1–0.2° at these latitudes; its "sunset" instant differs from the geometric −0.833° by ~0.3°
    // and is deliberately not used as a reference.
    expect(Math.abs(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 22, 37, 31)) + 6)).toBeLessThan(0.15);
    expect(Math.abs(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 23, 8, 25)) + 12)).toBeLessThan(0.15);
    expect(Math.abs(sunAltitudeDeg(greenwich, Date.UTC(2026, 8, 2, 19, 19, 33)) + 6)).toBeLessThan(0.15);
    expect(Math.abs(sunAltitudeDeg(greenwich, Date.UTC(2026, 8, 2, 20, 2, 4)) + 12)).toBeLessThan(0.15);
  });

  it('is well below −12° at local midnight and well above 0° at local noon', () => {
    expect(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 3, 27))).toBeLessThan(-40);
    expect(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 16, 0))).toBeGreaterThan(30);
  });
});
