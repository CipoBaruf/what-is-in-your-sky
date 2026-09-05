import { describe, expect, it } from 'vitest';
import { loadReferenceValues, referenceObserver } from '../../tests/support/reference';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { moonAt } from '../physics/moon';
import { skyState } from '../physics/now';
import { sunAltitudeDeg, sunAt } from '../physics/sun';
import { skyBodiesAt, skyStateOf } from './skyBodies';

/**
 * R22, FR-DOME-6: `skyBodies` is the main thread's one door to the astronomy
 * (D-80), so what it owes is (a) the same numbers `physics/` produces, without
 * a correction of its own, and (b) the R1 reference value for the Sun at the
 * fixture instant, like every other physics-facing module.
 */
const ref = loadReferenceValues();
const observer = referenceObserver(ref);

describe('skyBodiesAt', () => {
  it('carries the instant on the result and on the Sun', () => {
    const bodies = skyBodiesAt(ref.t, observer);
    expect(bodies.t).toBe(ref.t);
    expect(bodies.sun.t).toBe(ref.t);
    expect(bodies.moon.t).toBe(ref.t);
  });

  it('reproduces the reference sun altitude at capturedAt (reference-values.json)', () => {
    expect(skyBodiesAt(ref.t, observer).sun.altDeg).toBeCloseTo(ref.sunAltitudeDeg, 6);
    expect(skyBodiesAt(ref.t, observer).sun.altDeg).toBeCloseTo(sunAltitudeDeg(observer, ref.t), 12);
  });

  it('adds nothing to what physics/sun.ts and physics/moon.ts return', () => {
    for (const t of [ref.t, ref.t + 3_600_000, Date.UTC(2026, 5, 21, 12, 0)]) {
      const bodies = skyBodiesAt(t, observer);
      expect({ azDeg: bodies.sun.azDeg, altDeg: bodies.sun.altDeg }).toEqual(sunAt(observer, t));
      expect(bodies.moon).toEqual(moonAt(t, observer));
    }
  });

  /** R32 (FR-LIVE-3, D-159): the sky state is restated here, so it is held to the worker's own function. */
  it('names the sky exactly as physics/now.ts does, across the whole range of Sun altitudes', () => {
    for (let alt = -90; alt <= 90; alt += 0.25) expect(skyStateOf(alt), String(alt)).toBe(skyState(alt, DEFAULT_THRESHOLDS));
    for (const edge of [DEFAULT_THRESHOLDS.sunAltMaxDeg, DEFAULT_THRESHOLDS.twilightLabelSunAltDeg]) {
      for (const alt of [edge - 1e-9, edge, edge + 1e-9]) expect(skyStateOf(alt), String(alt)).toBe(skyState(alt, DEFAULT_THRESHOLDS));
    }
    expect(skyBodiesAt(ref.t, observer).sky).toBe(skyState(sunAltitudeDeg(observer, ref.t), DEFAULT_THRESHOLDS));
  });

  it('moves both bodies with the instant: the Sun by about 15° of azimuth an hour, the Moon by about half a degree of sky', () => {
    const a = skyBodiesAt(ref.t, observer);
    const b = skyBodiesAt(ref.t + 3_600_000, observer);
    expect(Math.abs(b.sun.altDeg - a.sun.altDeg)).toBeGreaterThan(1);
    expect(Math.abs(b.moon.phaseAngleDeg - a.moon.phaseAngleDeg)).toBeLessThan(1);
  });
});
