import { MakeTime } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import type { MoonGlareThresholds, MoonState, Observer, PassPoint } from '../model';
import { MOON_PHASES, signAtLongitude } from '../data/moon';
import { DEFAULT_MOON_GLARE_THRESHOLDS, MOON_PHASE_BAND_HALF_WIDTH_DEG } from './constants';
import { angularSeparationDeg, moonAt, moonGlare, phaseName } from './moon';

/**
 * PLAN §9.2 / TASKS R19. Everything here is checked against Jean Meeus,
 * *Astronomical Algorithms* (2nd ed.), reimplemented below so the reference is
 * a second, independent code path — the same arrangement `sun.test.ts` has with
 * the NOAA solar calculator. Two published worked examples anchor it:
 *
 *  - **47.a / 48.a**, the Moon on 1992 April 12 at 0h TD: apparent ecliptic
 *    longitude 133.167265°, latitude −3.229126°, distance 368409.7 km, true
 *    obliquity 23.440636°, nutation in longitude +16.595″; illuminated fraction
 *    0.6786 at phase angle 69.0756°.
 *  - **49.a**, the new Moon of 1977 February 18 at 3h37m40s TD.
 *
 * The first is used directly (the published λ, β, Δ are converted to
 * topocentric altitude and azimuth here, by hand, and compared with `moonAt`);
 * the second validates the chapter-49 phase-instant series transcribed below,
 * which then supplies a new and a full Moon to test the illumination at.
 */

const DEG = Math.PI / 180;
const sin = (deg: number): number => Math.sin(deg * DEG);
const cos = (deg: number): number => Math.cos(deg * DEG);
const normalize = (deg: number): number => ((deg % 360) + 360) % 360;

const neuquen: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquen', source: 'coords', timeZone: 'UTC' };
const greenwich: Observer = { lat: 51.4769, lon: 0, altM: 0, label: 'Greenwich', source: 'coords', timeZone: null };
const singapore: Observer = { lat: 1.35, lon: 103.82, altM: 0, label: 'Singapore', source: 'coords', timeZone: null };

/**
 * The UTC instant whose Terrestrial Time is `jde`. Meeus works in TD and the
 * app in UTC, and in 1992 the two are 58 s apart — 0.009° of the Moon's motion,
 * which matters at the tolerances below. `astronomy-engine` owns the ΔT model,
 * so the conversion is a two-step solve against its own `tt` rather than a
 * second ΔT table to keep correct.
 */
function utMsForJde(jde: number): number {
  const ttDays = jde - 2_451_545;
  let ms = (jde - 2_440_587.5) * 86_400_000;
  for (let i = 0; i < 4; i++) ms -= (makeTt(ms) - ttDays) * 86_400_000;
  return ms;
}

/** TT of a UTC instant, in days from J2000. The one astronomy-engine call the reference makes, and only for ΔT. */
function makeTt(ms: number): number {
  return MakeTime(new Date(ms)).tt;
}

/** Greenwich apparent sidereal time, Meeus 12.4 plus the nutation term. `jdUt` is the Julian day of the UT instant, not the TD one. */
function apparentSiderealTimeDeg(jdUt: number, nutationArcsec: number, trueObliquityDeg: number): number {
  const T = (jdUt - 2_451_545) / 36_525;
  const mean = 280.460_618_37 + 360.985_647_366_29 * (jdUt - 2_451_545) + 0.000_387_933 * T * T - (T * T * T) / 38_710_000;
  return normalize(mean) + (nutationArcsec / 3600) * cos(trueObliquityDeg);
}

/** Apparent ecliptic λ, β to apparent right ascension and declination, Meeus 13.3/13.4. */
function eclipticToEquatorial(lonDeg: number, latDeg: number, obliquityDeg: number): { raDeg: number; decDeg: number } {
  const raDeg = normalize(Math.atan2(sin(lonDeg) * cos(obliquityDeg) - Math.tan(latDeg * DEG) * sin(obliquityDeg), cos(lonDeg)) / DEG);
  const decDeg = Math.asin(sin(latDeg) * cos(obliquityDeg) + cos(latDeg) * sin(obliquityDeg) * sin(lonDeg)) / DEG;
  return { raDeg, decDeg };
}

/**
 * Geocentric equatorial position to topocentric horizontal, Meeus 11.1 (the
 * observer's ρ sin φ′ and ρ cos φ′ on the IAU-76 ellipsoid), 40.6 (the parallax
 * in right ascension and declination) and 13.5/13.6 (altitude and azimuth,
 * converted from Meeus's south-based azimuth to the north-based one the app
 * uses). Parallax is a degree for the Moon, so it cannot be skipped.
 */
function topocentricHorizon(
  observer: Observer,
  siderealTimeDeg: number,
  raDeg: number,
  decDeg: number,
  distanceKm: number,
): { azDeg: number; elDeg: number } {
  const phi = observer.lat;
  const u = Math.atan(0.996_647_19 * Math.tan(phi * DEG));
  const rhoSinPhi = 0.996_647_19 * Math.sin(u) + (observer.altM / 6_378_140) * sin(phi);
  const rhoCosPhi = Math.cos(u) + (observer.altM / 6_378_140) * cos(phi);
  const sinParallax = 6378.14 / distanceKm;
  const hourAngle = (siderealTimeDeg + observer.lon - raDeg) * DEG;
  const dRa = Math.atan2(-rhoCosPhi * sinParallax * Math.sin(hourAngle), cos(decDeg) - rhoCosPhi * sinParallax * Math.cos(hourAngle));
  const decTopo = Math.atan2((sin(decDeg) - rhoSinPhi * sinParallax) * Math.cos(dRa), cos(decDeg) - rhoCosPhi * sinParallax * Math.cos(hourAngle));
  const h = hourAngle - dRa;
  const azSouth = Math.atan2(Math.sin(h), Math.cos(h) * sin(phi) - Math.tan(decTopo) * cos(phi)) / DEG;
  const elDeg = Math.asin(sin(phi) * Math.sin(decTopo) + cos(phi) * Math.cos(decTopo) * Math.cos(h)) / DEG;
  return { azDeg: normalize(azSouth + 180), elDeg };
}

/**
 * Meeus 49: the TD Julian day of the new (`phase` 0) or full (`phase` 0.5) Moon
 * of lunation `k`, counted from the new Moon of 2000 January 6. The fourteen
 * planetary corrections of the full series are left out, which costs under a
 * minute — 0.008° of elongation, far below what any assertion here reads.
 */
function meeusPhaseJde(k: number, phase: 0 | 0.5): number {
  const kk = k + phase;
  const T = kk / 1236.85;
  const E = 1 - 0.002_516 * T - 0.000_007_4 * T * T;
  const M = 2.5534 + 29.105_356_7 * kk - 0.000_001_4 * T * T - 0.000_000_11 * T ** 3;
  const M1 = 201.5643 + 385.816_935_28 * kk + 0.010_758_2 * T * T + 0.000_012_38 * T ** 3 - 0.000_000_058 * T ** 4;
  const F = 160.7108 + 390.670_502_84 * kk - 0.001_611_8 * T * T - 0.000_002_27 * T ** 3 + 0.000_000_011 * T ** 4;
  const omega = 124.7746 - 1.563_755_88 * kk + 0.002_067_2 * T * T + 0.000_002_15 * T ** 3;
  const mean = 2_451_550.097_66 + 29.530_588_861 * kk + 0.000_154_37 * T * T - 0.000_000_15 * T ** 3 + 0.000_000_000_73 * T ** 4;
  const [c1, c2, c3, c4, c5, c6, c7] =
    phase === 0
      ? ([-0.4072, 0.172_41, 0.016_08, 0.010_39, 0.007_39, -0.005_14, 0.002_08] as const)
      : ([-0.406_14, 0.173_02, 0.016_14, 0.010_43, 0.007_34, -0.005_15, 0.002_09] as const);
  return (
    mean +
    c1 * sin(M1) +
    c2 * E * sin(M) +
    c3 * sin(2 * M1) +
    c4 * sin(2 * F) +
    c5 * E * sin(M1 - M) +
    c6 * E * sin(M1 + M) +
    c7 * E * E * sin(2 * M) -
    0.001_11 * sin(M1 - 2 * F) -
    0.000_57 * sin(M1 + 2 * F) +
    0.000_56 * E * sin(2 * M1 + M) -
    0.000_42 * sin(3 * M1) +
    0.000_42 * E * sin(M + 2 * F) +
    0.000_38 * E * sin(M - 2 * F) -
    0.000_24 * E * sin(2 * M1 - M) -
    0.000_17 * sin(omega) -
    0.000_07 * sin(M1 + 2 * M)
  );
}

// Meeus example 47.a / 48.a, 1992 April 12 at 0h TD (JDE 2448724.5).
const EXAMPLE_47A = {
  jde: 2_448_724.5,
  apparentLonDeg: 133.167_265,
  latDeg: -3.229_126,
  distanceKm: 368_409.7,
  trueObliquityDeg: 23.440_636,
  nutationArcsec: 16.595,
  phaseAngleDeg: 69.0756,
  illuminatedFraction: 0.6786,
};

const EXAMPLE_47A_MS = utMsForJde(EXAMPLE_47A.jde);

function example47aHorizon(observer: Observer): { azDeg: number; elDeg: number } {
  const jdUt = EXAMPLE_47A_MS / 86_400_000 + 2_440_587.5;
  const theta = apparentSiderealTimeDeg(jdUt, EXAMPLE_47A.nutationArcsec, EXAMPLE_47A.trueObliquityDeg);
  const { raDeg, decDeg } = eclipticToEquatorial(EXAMPLE_47A.apparentLonDeg, EXAMPLE_47A.latDeg, EXAMPLE_47A.trueObliquityDeg);
  return topocentricHorizon(observer, theta, raDeg, decDeg, EXAMPLE_47A.distanceKm);
}

describe('moonAt', () => {
  it('reproduces the apparent ecliptic longitude and latitude of Meeus example 47.a within 0.01°', () => {
    const moon = moonAt(EXAMPLE_47A_MS, neuquen);
    expect(Math.abs(moon.eclipticLonDeg - EXAMPLE_47A.apparentLonDeg)).toBeLessThan(0.01);
  });

  it('matches the altitude and azimuth derived from Meeus example 47.a within 0.1°, at three latitudes', () => {
    // The published λ, β and Δ are pushed through Meeus 11/13/40 above — an
    // independent conversion — and compared with what astronomy-engine's
    // Equator/Horizon pair gives through `moonAt`. Agreement checks the
    // topocentric plumbing and the observer sign conventions at once.
    for (const observer of [neuquen, greenwich, singapore]) {
      const expected = example47aHorizon(observer);
      const moon = moonAt(EXAMPLE_47A_MS, observer);
      expect(Math.abs(moon.elDeg - expected.elDeg), `${observer.label} elevation`).toBeLessThan(0.1);
      expect(Math.abs(normalize(moon.azDeg - expected.azDeg + 180) - 180), `${observer.label} azimuth`).toBeLessThan(0.1);
    }
  });

  it('reproduces the illuminated fraction of Meeus example 48.a (0.6786 at phase angle 69.0756°)', () => {
    const moon = moonAt(EXAMPLE_47A_MS, neuquen);
    expect(moon.illuminatedFraction).toBeCloseTo(EXAMPLE_47A.illuminatedFraction, 3);
    // `phaseAngleDeg` is the elongation (0 = new, 180 = full), so Meeus's
    // Sun–Moon–Earth angle i is its supplement to within the ecliptic latitude.
    expect(180 - moon.phaseAngleDeg).toBeCloseTo(EXAMPLE_47A.phaseAngleDeg, 0);
  });

  it('is a new Moon at the published instant of Meeus example 49.a (1977 February 18, 3h37m40s TD)', () => {
    const published = 2_443_192.5 + (3 + 37 / 60 + 40 / 3600) / 24; // 1977-02-18.0 TD is JDE 2443192.5
    // The truncated series lands within 1.5 min of the published instant, which
    // is what dropping the fourteen planetary corrections costs.
    expect(Math.abs(meeusPhaseJde(-283, 0) - published) * 86_400).toBeLessThan(90);
    const moon = moonAt(utMsForJde(published), neuquen);
    expect(moon.illuminatedFraction).toBeLessThan(0.002);
    expect(Math.abs(normalize(moon.phaseAngleDeg + 180) - 180)).toBeLessThan(0.1);
    expect(moon.phase).toBe('new');
  });

  it('is a full Moon at the chapter-49 instant of the following lunation', () => {
    const moon = moonAt(utMsForJde(meeusPhaseJde(-283, 0.5)), neuquen);
    expect(moon.illuminatedFraction).toBeGreaterThan(0.998);
    expect(moon.phaseAngleDeg).toBeCloseTo(180, 1);
    expect(moon.phase).toBe('full');
  });

  it('carries the instant it was asked for and keeps every angle in range', () => {
    for (let day = 0; day < 30; day++) {
      const moon = moonAt(Date.UTC(2026, 8, 2) + day * 86_400_000, neuquen);
      expect(moon.t).toBe(Date.UTC(2026, 8, 2) + day * 86_400_000);
      expect(moon.phaseAngleDeg).toBeGreaterThanOrEqual(0);
      expect(moon.phaseAngleDeg).toBeLessThan(360);
      expect(moon.eclipticLonDeg).toBeGreaterThanOrEqual(0);
      expect(moon.eclipticLonDeg).toBeLessThan(360);
      expect(moon.azDeg).toBeGreaterThanOrEqual(0);
      expect(moon.azDeg).toBeLessThan(360);
      expect(Math.abs(moon.elDeg)).toBeLessThanOrEqual(90);
      expect(moon.illuminatedFraction).toBeGreaterThanOrEqual(0);
      expect(moon.illuminatedFraction).toBeLessThanOrEqual(1);
    }
  });

  it('gives the same instant different altitudes at different places, and rises and sets over a day', () => {
    const t = Date.UTC(2026, 8, 2, 3, 0);
    expect(moonAt(t, neuquen).elDeg).not.toBeCloseTo(moonAt(t, singapore).elDeg, 1);
    const elevations = Array.from({ length: 24 }, (_, h) => moonAt(Date.UTC(2026, 8, 2) + h * 3_600_000, neuquen).elDeg);
    expect(Math.max(...elevations)).toBeGreaterThan(0);
    expect(Math.min(...elevations)).toBeLessThan(0);
  });
});

describe('phaseName', () => {
  const half = MOON_PHASE_BAND_HALF_WIDTH_DEG;

  it('names the four cardinal phases at their exact angles', () => {
    expect(phaseName(0)).toBe('new');
    expect(phaseName(90)).toBe('firstQuarter');
    expect(phaseName(180)).toBe('full');
    expect(phaseName(270)).toBe('lastQuarter');
  });

  it('changes name at every band edge, and the edge belongs to the band above it', () => {
    const edges: [number, string, string][] = [
      [half, 'new', 'waxingCrescent'],
      [90 - half, 'waxingCrescent', 'firstQuarter'],
      [90 + half, 'firstQuarter', 'waxingGibbous'],
      [180 - half, 'waxingGibbous', 'full'],
      [180 + half, 'full', 'waningGibbous'],
      [270 - half, 'waningGibbous', 'lastQuarter'],
      [270 + half, 'lastQuarter', 'waningCrescent'],
      [360 - half, 'waningCrescent', 'new'],
    ];
    for (const [edge, below, atOrAbove] of edges) {
      expect(phaseName(edge - 1e-9), `just below ${String(edge)}°`).toBe(below);
      expect(phaseName(edge), `at ${String(edge)}°`).toBe(atOrAbove);
    }
  });

  it('covers the whole cycle with the eight names the lore file keys its lines by (FR-MOON-4)', () => {
    const seen = new Set<string>();
    for (let angle = 0; angle < 360; angle += 0.25) seen.add(phaseName(angle));
    expect([...seen].sort()).toEqual([...MOON_PHASES].sort());
  });

  it('wraps: an angle outside [0, 360) gets the name of its wrapped value', () => {
    expect(phaseName(360)).toBe('new');
    expect(phaseName(-90)).toBe('lastQuarter');
    expect(phaseName(450)).toBe('firstQuarter');
  });
});

describe('zodiac sign from the ecliptic longitude (FR-MOON-4)', () => {
  it('changes sign at a band edge, in both directions', () => {
    // The bands are the lore file's own (`signAtLongitude`), so the physics and
    // the tradition text cannot disagree about where a sign starts (D-97).
    expect(signAtLongitude(0).key).toBe('aries');
    expect(signAtLongitude(29.999).key).toBe('aries');
    expect(signAtLongitude(30).key).toBe('taurus');
    expect(signAtLongitude(209.999).key).toBe('libra');
    expect(signAtLongitude(210).key).toBe('scorpio');
  });

  it('gives a sign for the Moon at any instant of a lunation', () => {
    for (let day = 0; day < 30; day++) {
      const moon = moonAt(Date.UTC(2026, 8, 2) + day * 86_400_000, neuquen);
      expect(signAtLongitude(moon.eclipticLonDeg).startLonDeg).toBeLessThanOrEqual(moon.eclipticLonDeg);
      expect(signAtLongitude(moon.eclipticLonDeg).startLonDeg + 30).toBeGreaterThan(moon.eclipticLonDeg);
    }
  });
});

describe('angularSeparationDeg', () => {
  it('is zero for the same direction and 180° for opposites', () => {
    expect(angularSeparationDeg({ azDeg: 40, elDeg: 20 }, { azDeg: 40, elDeg: 20 })).toBeCloseTo(0, 9);
    expect(angularSeparationDeg({ azDeg: 0, elDeg: 90 }, { azDeg: 0, elDeg: -90 })).toBeCloseTo(180, 9);
  });

  it('is the elevation difference along one azimuth and the azimuth difference on the horizon', () => {
    expect(angularSeparationDeg({ azDeg: 120, elDeg: 10 }, { azDeg: 120, elDeg: 55 })).toBeCloseTo(45, 9);
    expect(angularSeparationDeg({ azDeg: 90, elDeg: 0 }, { azDeg: 160, elDeg: 0 })).toBeCloseTo(70, 9);
  });

  it('shrinks with elevation: 70° of azimuth at 60° up is 33.3° apart', () => {
    expect(angularSeparationDeg({ azDeg: 90, elDeg: 60 }, { azDeg: 160, elDeg: 60 })).toBeCloseTo(33.33, 2);
  });
});

describe('moonGlare (FR-MOON-2)', () => {
  const peak: PassPoint = { t: 0, azDeg: 100, elDeg: 40, rangeKm: 600 };
  const thresholds: MoonGlareThresholds = DEFAULT_MOON_GLARE_THRESHOLDS;
  /** A Moon 20° from the peak: inside the 30° threshold, so the separation condition holds unless moved. */
  const bright = (over: Partial<MoonState> = {}): MoonState => ({
    t: 0,
    phaseAngleDeg: 180,
    illuminatedFraction: 1,
    phase: 'full',
    azDeg: 100,
    elDeg: 60,
    eclipticLonDeg: 0,
    ...over,
  });

  it('warns when the Moon is up, bright and near the track', () => {
    const glare = moonGlare(bright(), peak, thresholds);
    expect(glare.glare).toBe(true);
    expect(glare.separationDeg).toBeCloseTo(20, 6);
  });

  it('does not warn when only the altitude fails', () => {
    const glare = moonGlare(bright({ elDeg: -0.5, azDeg: 100 }), { ...peak, elDeg: 20 }, thresholds);
    expect(glare.glare).toBe(false);
    expect(glare.separationDeg).toBeCloseTo(20.5, 6); // still measured: the angle is a fact
  });

  it('does not warn when only the illumination fails', () => {
    expect(moonGlare(bright({ illuminatedFraction: 0.499, phase: 'waxingCrescent', phaseAngleDeg: 60 }), peak, thresholds).glare).toBe(false);
  });

  it('does not warn when only the separation fails', () => {
    const far = moonGlare(bright({ elDeg: 9 }), peak, thresholds);
    expect(far.separationDeg).toBeCloseTo(31, 6);
    expect(far.glare).toBe(false);
  });

  it('is inclusive at half illumination and exclusive at the altitude and separation thresholds', () => {
    expect(moonGlare(bright({ illuminatedFraction: 0.5 }), peak, thresholds).glare).toBe(true);
    expect(moonGlare(bright({ illuminatedFraction: 0.499_999 }), peak, thresholds).glare).toBe(false);
    expect(moonGlare(bright({ elDeg: 0 }), { ...peak, elDeg: 20 }, thresholds).glare).toBe(false); // "above the horizon" is strict
    // …and a Moon `maxSeparationDeg` away is not close enough. The separation is
    // an arccosine, so the two sides of the threshold are read a millidegree
    // apart rather than exactly on it.
    const separationDeg = moonGlare(bright(), peak, thresholds).separationDeg ?? NaN;
    expect(moonGlare(bright(), peak, { ...thresholds, maxSeparationDeg: separationDeg - 0.001 }).glare).toBe(false);
    expect(moonGlare(bright(), peak, { ...thresholds, maxSeparationDeg: separationDeg + 0.001 }).glare).toBe(true);
  });

  it('reports no separation at all when there is no Moon above the horizon', () => {
    expect(moonGlare(null, peak, thresholds)).toEqual({ glare: false, separationDeg: null });
  });

  it('takes its thresholds as an argument, so OQ-12 can be answered without touching the rule', () => {
    const strict: MoonGlareThresholds = { minAltDeg: 0, minIlluminatedFraction: 0.9, maxSeparationDeg: 10 };
    expect(moonGlare(bright(), peak, strict).glare).toBe(false);
    expect(moonGlare(bright({ elDeg: 45 }), peak, strict).glare).toBe(true);
  });
});
