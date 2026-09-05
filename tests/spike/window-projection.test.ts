/**
 * R38 (FR-WIN-7, PLAN §8.10): the spike's projection against hand-computed
 * points — north on the horizon at heading 0°, the zenith at pitch 90°, a
 * roll of 90° swapping the axes — so the picks the owner makes on the phone
 * are made on a window that points where the phone points.
 */
import { describe, expect, it } from 'vitest';
import { alphaFor, greatCircle, lookDirection, project, rollDevice, rotationMatrix, smoothRotation, type View } from '../../spike/window/projection';

const view: View = { projection: 'gnomonic', fovDeg: 60, width: 390, height: 390, screenAngleDeg: 0 };
const stereo: View = { ...view, projection: 'stereographic' };
/** Upright, back to the north: beta 90 stands the phone up, alpha 0 keeps its back on north. */
const upright = rotationMatrix(0, 90, 0);

describe('where the phone points', () => {
  it('flat on the table looks at the ground; upright with alpha 0 looks north at the horizon', () => {
    expect(lookDirection(rotationMatrix(0, 0, 0)).altDeg).toBeCloseTo(-90, 6);
    const look = lookDirection(upright);
    expect(look.azDeg).toBeCloseTo(0, 6);
    expect(look.altDeg).toBeCloseTo(0, 6);
  });

  it('turning left by alpha turns the heading right by the same: heading is 360 − alpha', () => {
    expect(lookDirection(rotationMatrix(90, 90, 0)).azDeg).toBeCloseTo(270, 6);
    expect(lookDirection(rotationMatrix(270, 90, 0)).azDeg).toBeCloseTo(90, 6);
  });

  it('tilting the top back by 30° raises the look by 30°; beta 180 is the zenith', () => {
    expect(lookDirection(rotationMatrix(0, 120, 0)).altDeg).toBeCloseTo(30, 6);
    expect(lookDirection(rotationMatrix(0, 180, 0)).altDeg).toBeCloseTo(90, 6);
  });
});

describe('the projection', () => {
  it('puts north on the horizon at the centre for an upright phone facing north, in both projections', () => {
    for (const v of [view, stereo]) {
      const p = project(upright, 0, 0, v);
      expect(p.x).toBeCloseTo(195, 6);
      expect(p.y).toBeCloseTo(195, 6);
      expect(p.front).toBe(true);
      expect(p.offAxisDeg).toBeCloseTo(0, 6);
    }
  });

  it('puts east to the right and up above, and the field-of-view edge on the frame', () => {
    // 30° to the east of north sits at the right edge of a 60° field: x = 390.
    const east = project(upright, 30, 0, view);
    expect(east.x).toBeCloseTo(390, 6);
    expect(east.y).toBeCloseTo(195, 6);
    const up = project(upright, 0, 30, view);
    expect(up.x).toBeCloseTo(195, 6);
    expect(up.y).toBeCloseTo(0, 6);
    // Stereographic puts the same edge at the same place (that is what the scale is for).
    expect(project(upright, 30, 0, stereo).x).toBeCloseTo(390, 6);
  });

  it('gnomonic keeps a great circle straight; stereographic bends the horizon', () => {
    const y = (v: View, az: number): number => project(upright, az, 0, v).y;
    // The horizon through the centre: a great circle, straight under gnomonic.
    expect(y(view, 20)).toBeCloseTo(195, 6);
    expect(y(view, -20)).toBeCloseTo(195, 6);
    // Looking 30° up, the horizon is a small circle's worth of the sky: it curves under stereographic and is a line under gnomonic.
    const tilted = rotationMatrix(0, 120, 0);
    const rowG = [-25, 0, 25].map((az) => project(tilted, az, 0, view).y);
    const rowS = [-25, 0, 25].map((az) => project(tilted, az, 0, stereo).y);
    expect(Math.abs((rowG[0] ?? 0) - (rowG[1] ?? 0))).toBeLessThan(1e-6);
    expect(Math.abs((rowS[0] ?? 0) - (rowS[1] ?? 0))).toBeGreaterThan(2);
  });

  it('a roll of 90° swaps the axes', () => {
    // Upright, facing north, then turned counter-clockwise in its own plane (the top to the left):
    // the look direction is unchanged and east, which was to the right, is now along the device's −Y.
    const rolled = rollDevice(upright, 90);
    expect(lookDirection(rolled).azDeg).toBeCloseTo(0, 4);
    expect(lookDirection(rolled).altDeg).toBeCloseTo(0, 4);
    const east = project(rolled, 30, 0, view);
    expect(east.x).toBeCloseTo(195, 4);
    expect(east.y).toBeCloseTo(390, 4);
    // Gamma is not that roll: it turns about the device's Y, which for an upright phone is the vertical, so it changes the heading instead.
    expect(lookDirection(rotationMatrix(0, 90, 90)).azDeg).toBeCloseTo(270, 4);
  });

  it('the screen-angle correction turns the picture back: a 90° screen with a 90° roll reads like no roll', () => {
    const rolled = rollDevice(upright, 90);
    const p = project(rolled, 30, 0, { ...view, screenAngleDeg: 90 });
    expect(p.x).toBeCloseTo(390, 4);
    expect(p.y).toBeCloseTo(195, 4);
    // The other way round too.
    const q = project(rollDevice(upright, -90), 30, 0, { ...view, screenAngleDeg: 270 });
    expect(q.x).toBeCloseTo(390, 4);
    expect(q.y).toBeCloseTo(195, 4);
  });

  it('flags what is behind the camera', () => {
    expect(project(upright, 180, 0, view).front).toBe(false);
    expect(project(upright, 180, 0, stereo).offAxisDeg).toBeCloseTo(180, 6);
  });
});

describe('smoothing and the heading source', () => {
  it('with no weight the new reading is used as is; with weight it moves part of the way and stays a rotation', () => {
    const a = rotationMatrix(0, 90, 0);
    const b = rotationMatrix(20, 90, 0);
    expect(smoothRotation(a, b, 0)).toEqual(b);
    const mid = smoothRotation(a, b, 0.5);
    const az = lookDirection(mid).azDeg;
    expect(az).toBeGreaterThan(340);
    expect(az).toBeLessThan(360);
    // Orthonormal: each column has unit length.
    for (let c = 0; c < 3; c += 1) expect(Math.hypot(mid[0][c] ?? 0, mid[1][c] ?? 0, mid[2][c] ?? 0)).toBeCloseTo(1, 9);
  });

  it('reads the WebKit compass as 360 − heading and an absolute alpha as itself', () => {
    expect(alphaFor({ alpha: 12, absolute: false, webkitCompassHeading: 90 }, 'auto')).toBe(270);
    expect(alphaFor({ alpha: 12, absolute: false, webkitCompassHeading: 90 }, 'alpha')).toBe(12);
    expect(alphaFor({ alpha: 45, absolute: true, webkitCompassHeading: null }, 'auto')).toBe(45);
    expect(alphaFor({ alpha: null, absolute: false, webkitCompassHeading: null }, 'auto')).toBeNull();
  });

  it('resamples a three-point track into an arc through the sky', () => {
    const arc = greatCircle({ azDeg: 0, elDeg: 0 }, { azDeg: 90, elDeg: 0 }, 5);
    expect(arc.length).toBe(19);
    expect(arc[9]?.azDeg).toBeCloseTo(45, 6);
    expect(arc[9]?.elDeg).toBeCloseTo(0, 6);
  });
});
