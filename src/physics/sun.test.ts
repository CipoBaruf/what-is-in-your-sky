import { describe, expect, it } from 'vitest';
import type { Observer } from '../model';
import { sunPos } from 'satellite.js';
import { loadReferenceValues, referenceObserver } from '../../tests/support/reference';
import { lookAnglesFrom, norm, scale, unit } from './frames';
import { msToJulianDate } from './time';
import { sunAltitudeDeg, sunVectorEqd } from './sun';

const equator: Observer = { lat: 0, lon: 0, altM: 0, label: 'equator', source: 'coords', timeZone: null };
const neuquen: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquen', source: 'coords', timeZone: 'UTC' };
const greenwich: Observer = { lat: 51.4769, lon: 0, altM: 0, label: 'Greenwich', source: 'coords', timeZone: null };
const ref = loadReferenceValues();

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** NOAA solar calculator (spreadsheet) sun declination and equation of time for a Julian date. */
function noaaSun(jd: number): { declDeg: number; eotMin: number } {
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) +
    Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - 0.001813 * T))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const declDeg = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eotMin =
    4 *
    deg(
      y * Math.sin(2 * rad(L0)) -
        2 * e * Math.sin(rad(M)) +
        4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) -
        0.5 * y * y * Math.sin(4 * rad(L0)) -
        1.25 * e * e * Math.sin(2 * rad(M)),
    );
  return { declDeg, eotMin };
}

/** NOAA sunset (centre at −0.833°) on the UTC day starting at `dayUtcMs`, iterated to convergence. */
function noaaSunsetUtc(dayUtcMs: number, latDeg: number, lonDeg: number): number {
  let minutes = 720 - 4 * lonDeg; // first guess: local solar noon
  for (let i = 0; i < 3; i++) {
    const jd = (dayUtcMs + minutes * 60_000) / 86_400_000 + 2_440_587.5;
    const { declDeg, eotMin } = noaaSun(jd);
    const cosHa = Math.cos(rad(90.833)) / (Math.cos(rad(latDeg)) * Math.cos(rad(declDeg))) - Math.tan(rad(latDeg)) * Math.tan(rad(declDeg));
    minutes = 720 - 4 * lonDeg - eotMin + 4 * deg(Math.acos(cosHa));
  }
  return dayUtcMs + minutes * 60_000;
}

describe('sun', () => {
  it('declination at the June 2026 solstice is +23.44° and at the December solstice −23.44°', () => {
    const june = sunVectorEqd(Date.UTC(2026, 5, 21, 8, 24)); // solstice instant
    expect((Math.asin(june.z) * 180) / Math.PI).toBeCloseTo(23.437, 2);
    const december = sunVectorEqd(Date.UTC(2026, 11, 21, 20, 50));
    expect((Math.asin(december.z) * 180) / Math.PI).toBeCloseTo(-23.437, 2);
  });

  it('sun vector is a unit vector', () => {
    expect(norm(sunVectorEqd(Date.UTC(2026, 8, 2, 3, 27)))).toBeCloseTo(1, 12);
    expect(norm(sunVectorEqd(Date.UTC(2026, 2, 20)))).toBeCloseTo(1, 12);
  });

  it('altitude at solar noon on the equator at the solstice is 90° − 23.44° (within 0.1°)', () => {
    // Equation of time on 2026-06-21 ≈ −1.5 min, so solar noon at lon 0 is ≈ 12:01:30 UTC.
    expect(sunAltitudeDeg(equator, Date.UTC(2026, 5, 21, 12, 1, 30))).toBeCloseTo(66.56, 1);
  });

  it('NOAA solar calculator sunset: our altitude at the NOAA sunset instant is −0.833° within 0.1°', () => {
    // NOAA defines sunset as the geometric centre of the sun at −0.833° (upper limb on the horizon with
    // standard refraction). The instant comes from NOAA's published spreadsheet algorithm, reproduced in
    // `noaaSunsetUtc` below (Meeus low-precision sun; independent of astronomy-engine). sunrise-sunset.org's
    // "sunset" for the same site is ~2 min later (0.36° lower) and is deliberately not used as a reference.
    for (const [obs, day] of [
      [greenwich, Date.UTC(2026, 8, 2)],
      [neuquen, Date.UTC(2026, 8, 2)],
      [greenwich, Date.UTC(2026, 5, 21)],
      [neuquen, Date.UTC(2026, 11, 21)],
    ] as const) {
      const t = noaaSunsetUtc(day, obs.lat, obs.lon);
      expect(Math.abs(sunAltitudeDeg(obs, t) + 0.833)).toBeLessThan(0.1);
    }
    // Sanity anchor for the algorithm itself: Greenwich sunset on 2026-09-02 is 18:44 UTC.
    expect(new Date(noaaSunsetUtc(Date.UTC(2026, 8, 2), greenwich.lat, greenwich.lon)).toISOString().slice(11, 16)).toBe('18:44');
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
    // which is ≈ 0.1–0.2° at these latitudes.
    expect(Math.abs(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 22, 37, 31)) + 6)).toBeLessThan(0.15);
    expect(Math.abs(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 23, 8, 25)) + 12)).toBeLessThan(0.15);
    expect(Math.abs(sunAltitudeDeg(greenwich, Date.UTC(2026, 8, 2, 19, 19, 33)) + 6)).toBeLessThan(0.15);
    expect(Math.abs(sunAltitudeDeg(greenwich, Date.UTC(2026, 8, 2, 20, 2, 4)) + 12)).toBeLessThan(0.15);
  });

  it('is well below −12° at local midnight and well above 0° at local noon', () => {
    expect(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 3, 27))).toBeLessThan(-40);
    expect(sunAltitudeDeg(neuquen, Date.UTC(2026, 8, 2, 16, 0))).toBeGreaterThan(30);
  });

  it('reproduces the reference sun altitude and equator-of-date unit vector at capturedAt (reference-values.json)', () => {
    expect(sunAltitudeDeg(referenceObserver(ref), ref.t)).toBeCloseTo(ref.sunAltitudeDeg, 6);
    const v = sunVectorEqd(ref.t);
    expect(v.x).toBeCloseTo(ref.sunUnitVectorEqd.x, 9);
    expect(v.y).toBeCloseTo(ref.sunUnitVectorEqd.y, 9);
    expect(v.z).toBeCloseTo(ref.sunUnitVectorEqd.z, 9);
    // Early September: the sun is still north of the equator (declination ≈ +7.9°).
    expect((Math.asin(v.z) * 180) / Math.PI).toBeCloseTo(7.9, 0);
  });
});
