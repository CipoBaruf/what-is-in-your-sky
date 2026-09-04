import type { MoonGlare, MoonState } from '../../src/model';

/**
 * Fixed Moon values for tests that need a `Pass` or a `NowState` but are not
 * about the Moon (R19). Plain literals with no `fs` and no astronomy, so the
 * jsdom project can use them as freely as the node one.
 *
 * The numbers are `moonAt(Date.UTC(2026, 8, 2, 8, 0), Neuquén)` rounded to four
 * decimals: a waning gibbous, 72 % lit, 29° up almost due north. Anything
 * asserting on the Moon itself should compute it instead of importing this.
 */
export const MOON_FIXTURE: MoonState = Object.freeze({
  t: Date.UTC(2026, 8, 2, 8, 0),
  phaseAngleDeg: 243.9115,
  illuminatedFraction: 0.72,
  phase: 'waningGibbous',
  azDeg: 6.721,
  elDeg: 29.1249,
  eclipticLonDeg: 43.8002,
});

/** A Moon far from the track and so no glare, whatever else the fixture is doing (FR-MOON-2). */
export const NO_MOON_GLARE: MoonGlare = Object.freeze({ glare: false, separationDeg: 120 });

/** A Moon below the horizon: still a phase and an illumination to show (US-18 AC1), never a glare. */
export const MOON_DOWN: MoonState = Object.freeze({ ...MOON_FIXTURE, azDeg: 186.721, elDeg: -29.1249 });

/** The Moon fields of a `Pass` for a fixture that does not care about them. */
export const NO_MOON_AT_PEAK = Object.freeze({ moonAtPeak: MOON_DOWN, moonGlare: NO_MOON_GLARE });
