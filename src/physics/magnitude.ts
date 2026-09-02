import { dot, norm, sub, type Vec3 } from './frames';

/** Diffuse-sphere phase law p(β) = sin β + (π − β) cos β. */
export function phaseFunction(betaRad: number): number {
  return Math.sin(betaRad) + (Math.PI - betaRad) * Math.cos(betaRad);
}

/**
 * Phase angle at the satellite between the direction to the sun and the
 * direction to the observer, in degrees. 0° = fully lit face toward the
 * observer, 180° = back-lit.
 */
export function phaseAngleDeg(satEci: Vec3, observerEci: Vec3, sunUnit: Vec3): number {
  const toObserver = sub(observerEci, satEci);
  const cosBeta = dot(sunUnit, toObserver) / norm(toObserver);
  return (Math.acos(Math.min(1, Math.max(-1, cosBeta))) * 180) / Math.PI;
}

const P_HALF_PHASE = phaseFunction(Math.PI / 2); // = 1

/**
 * Apparent magnitude (D-1):
 *   m = m_std + 5·log10(range_km / 1000) − 2.5·log10( p(β) / p(90°) )
 * so that m(1000 km, 90°) = m_std by construction.
 */
export function apparentMagnitude(stdMag: number, rangeKm: number, phaseDeg: number): number {
  const beta = (phaseDeg * Math.PI) / 180;
  const p = Math.max(phaseFunction(beta), 1e-9);
  return stdMag + 5 * Math.log10(rangeKm / 1000) - 2.5 * Math.log10(p / P_HALF_PHASE);
}
