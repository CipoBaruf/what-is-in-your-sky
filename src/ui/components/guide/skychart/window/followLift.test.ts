/**
 * v2.12 (FR-GYRO-2 as amended, D-1022): a following window lifts a pose that points under the horizon — half the
 * depth inside the band, back to nothing at the nadir — about the horizontal axis square to the look, so the facing
 * and the roll are the phone's.
 */
import { describe, expect, it } from 'vitest';
import { FOLLOW_LIFT_BAND_DEG, FOLLOW_LIFT_EASE_DEG, followLiftDeg, followLiftRotation, lookDirection, rotationMatrix, uprightRotation } from './projection';

describe('followLiftDeg (D-1022)', () => {
  it('lifts nothing at or above the horizon, about half the depth in the band, and nothing at the nadir', () => {
    expect(followLiftDeg(30)).toBe(0);
    expect(followLiftDeg(0)).toBe(0);
    // D-1027: eased in over the first 8°, so half the depth less 2° from there to the band's foot.
    expect(followLiftDeg(-FOLLOW_LIFT_EASE_DEG)).toBeCloseTo(FOLLOW_LIFT_EASE_DEG / 4, 9);
    expect(followLiftDeg(-20)).toBeCloseTo(8, 9);
    expect(followLiftDeg(-FOLLOW_LIFT_BAND_DEG)).toBeCloseTo(FOLLOW_LIFT_BAND_DEG / 2 - FOLLOW_LIFT_EASE_DEG / 4, 9);
    expect(followLiftDeg(-90)).toBeCloseTo(0, 9);
    for (let alt = -90; alt <= 0; alt += 0.5) expect(followLiftDeg(alt)).toBeGreaterThanOrEqual(0);
  });

  it('has no corner anywhere (D-1027): the slope is continuous at the horizon, at the band’s foot and between', () => {
    const slope = (alt: number): number => (followLiftDeg(alt + 1e-4) - followLiftDeg(alt - 1e-4)) / 2e-4;
    // Either side of the two joins, a hundredth of a degree apart: the same slope.
    for (const join of [0, -FOLLOW_LIFT_EASE_DEG, -FOLLOW_LIFT_BAND_DEG]) expect(Math.abs(slope(join + 0.01) - slope(join - 0.01))).toBeLessThan(0.01);
    expect(slope(0.01)).toBeCloseTo(0, 2);
    // Everywhere, a step of a twentieth of a degree changes the slope by little: no jump hides between the samples.
    let last = slope(-89.95);
    for (let alt = -89.9; alt <= 10; alt += 0.05) {
      const now = slope(alt);
      expect(Math.abs(now - last)).toBeLessThan(0.02);
      last = now;
    }
  });

  it('draws a tilt that rises with the phone’s everywhere: never held still, never backwards', () => {
    let last = -Infinity;
    for (let alt = -90; alt <= 90; alt += 0.5) {
      const drawn = alt + followLiftDeg(alt);
      expect(drawn).toBeGreaterThan(last);
      last = drawn;
    }
  });
});

describe('followLiftRotation (D-1022)', () => {
  it('raises an upright phone 20° under the horizon to 12° under it, facing where it faced', () => {
    for (const az of [0, 75, 180, 290]) {
      const look = lookDirection(followLiftRotation(uprightRotation(az, -20)));
      expect(look.altDeg).toBeCloseTo(-12, 6);
      expect(look.azDeg).toBeCloseTo(az, 6);
    }
  });

  it('leaves a pose at or above the horizon as it is', () => {
    const m = uprightRotation(120, 15);
    expect(followLiftRotation(m)).toBe(m);
  });

  it('keeps the screen’s roll against the horizon: a rolled phone stays as rolled', () => {
    // The phone 20° down and rolled 15°: the screen's x axis keeps its angle to the axis on the right.
    const m = rotationMatrix(40, 70, 15);
    const lifted = followLiftRotation(m);
    // The roll: the angle of the screen's x axis to the horizontal axis on the reader's right, which the lift turns about.
    const rollOf = (r: typeof m): number => {
      const az = (lookDirection(r).azDeg * Math.PI) / 180;
      return Math.acos(r[0][0] * Math.cos(az) - r[1][0] * Math.sin(az)) / (Math.PI / 180);
    };
    expect(rollOf(lifted)).toBeCloseTo(rollOf(m), 6);
    expect(lookDirection(lifted).azDeg).toBeCloseTo(lookDirection(m).azDeg, 6);
  });
});
