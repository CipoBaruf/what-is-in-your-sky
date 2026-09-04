import type { EpochMs } from './thresholds';

/**
 * The eight phase names of FR-MOON-1, in cycle order. They are spelled the way
 * `data/moon/schema.ts` spells its `MoonPhaseKey`, so `phaseLore(moon.phase)`
 * needs no translation table between the physics and the lore (D-103); PLAN §5
 * wrote them hyphenated before R29 shipped the file, and the file won.
 * `physics/moon.ts` derives the name from the phase angle and
 * `physics/moon.test.ts` pins the two lists equal.
 */
export type MoonPhaseName =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

/** The Moon at one instant for one observer (FR-MOON-1), computed in the worker (D-80). */
export interface MoonState {
  t: EpochMs;
  /** Elongation from the Sun along the ecliptic: 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. Always in [0, 360). */
  phaseAngleDeg: number;
  /** Fraction of the disc lit as seen from Earth, 0..1. */
  illuminatedFraction: number;
  /** The band of `phaseAngleDeg` this instant falls in (FR-MOON-1). */
  phase: MoonPhaseName;
  /** Topocentric and geometric, like the sun's altitude: no refraction (D-2). */
  azDeg: number;
  elDeg: number;
  /** Apparent ecliptic longitude of date, for the tropical zodiac sign (FR-MOON-4). */
  eclipticLonDeg: number;
}

/**
 * FR-MOON-2's three conditions, as numbers rather than literals so the test can
 * fail each one on its own. Unlike `VisibilityThresholds` these are not user
 * settings and the protocol does not carry them: the defaults live in
 * `physics/constants.ts` and OQ-12 revisits them after field use.
 */
export interface MoonGlareThresholds {
  /** The Moon must be strictly above this altitude at the pass peak. */
  minAltDeg: number;
  /** …and at least this much of its disc lit. */
  minIlluminatedFraction: number;
  /** …and closer to the peak than this. */
  maxSeparationDeg: number;
}

/**
 * FR-MOON-2's verdict for one pass. `separationDeg` is the angular distance
 * between the Moon and the pass peak — always a real angle, because the Moon
 * has a direction whether or not it is above the horizon, and `Pass.moonAtPeak`
 * always carries it (D-109). `glare` is the requirement's three conditions
 * together; the altitude is one of them and is tested nowhere else.
 */
export interface MoonGlare {
  glare: boolean;
  separationDeg: number;
}
