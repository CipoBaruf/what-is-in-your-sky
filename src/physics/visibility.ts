import type { EpochMs, Observer, PassBoundaryReason, VisibilityThresholds } from '../model';
import { lookAnglesFrom, observerEci, type Vec3 } from './frames';
import { apparentMagnitude, phaseAngleDeg } from './magnitude';
import { propagateEci, type SatRec } from './sgp4';
import { inUmbra } from './shadow';
import { sunAltitudeDeg, sunVectorEqd } from './sun';

/** Everything the visibility predicate needs about one object at one instant. */
export interface VisibilitySample {
  t: EpochMs;
  posEci: Vec3;
  azDeg: number;
  elDeg: number;
  rangeKm: number;
  sunAltDeg: number; // at the observer
  lit: boolean; // not in umbra
  phaseDeg: number;
  magnitude: number;
}

/** Propagate and evaluate every visibility input at `t`. Null when SGP4 fails. */
export function sampleAt(satrec: SatRec, observer: Observer, t: EpochMs, stdMag: number): VisibilitySample | null {
  const state = propagateEci(satrec, t);
  if (!state) return null;
  const look = lookAnglesFrom(observer, state.position, t);
  const sun = sunVectorEqd(t);
  const lit = !inUmbra(state.position, sun);
  const phaseDeg = phaseAngleDeg(state.position, observerEci(observer, t), sun);
  return {
    t,
    posEci: state.position,
    ...look,
    sunAltDeg: sunAltitudeDeg(observer, t),
    lit,
    phaseDeg,
    magnitude: apparentMagnitude(stdMag, look.rangeKm, phaseDeg),
  };
}

export interface VisibilityVerdict {
  aboveMinElevation: boolean;
  dark: boolean;
  lit: boolean;
  visible: boolean;
}

/** The predicate of PLAN §6.3 step 3: `el ≥ min && sunAlt ≤ sunAltMax && lit`. */
export function visibilityAt(sample: VisibilitySample, thresholds: VisibilityThresholds): VisibilityVerdict {
  const aboveMinElevation = sample.elDeg >= thresholds.minElevationDeg;
  const dark = sample.sunAltDeg <= thresholds.sunAltMaxDeg;
  const lit = sample.lit;
  return { aboveMinElevation, dark, lit, visible: aboveMinElevation && dark && lit };
}

/**
 * Which condition makes `sample` invisible. When several fail at once the
 * order is horizon, then shadow, then twilight. Null when the sample is visible.
 */
export function failingReason(sample: VisibilitySample, thresholds: VisibilityThresholds): PassBoundaryReason | null {
  const v = visibilityAt(sample, thresholds);
  if (!v.aboveMinElevation) return 'horizon';
  if (!v.lit) return 'shadow';
  if (!v.dark) return 'twilight';
  return null;
}
