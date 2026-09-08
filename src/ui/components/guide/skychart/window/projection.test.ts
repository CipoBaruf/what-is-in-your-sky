/**
 * R47 (FR-WIN-1, FR-WIN-3; PLAN D-188, §8.10): the product projection against
 * hand-computed points — the spike's `tests/spike/window-projection.test.ts`
 * with the picks of `docs/window/FINDINGS.md` fixed: stereographic only,
 * `WINDOW_FOV` 60, `WINDOW_SMOOTHING` 0.6, the screen angle as `+angle`, the
 * fused heading, and the declination folded into `alphaFor` (R44).
 */
import { describe, expect, it } from 'vitest';
import {
  alphaFor,
  calibrationSample,
  converged,
  drawableDeg,
  groundState,
  lookDirection,
  OffsetEstimate,
  project,
  rotationMatrix,
  settling,
  smoothRotation,
  uprightRotation,
  verticalHalfFieldDeg,
  WINDOW_FOV,
  WINDOW_SMOOTHING,
  windowReadingFrom,
  type Mat3,
  type View,
  type WindowReading,
} from './projection';

const view: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };
/** Upright, back to the north: beta 90 stands the phone up, alpha 0 keeps its back on north. */
const upright = rotationMatrix(0, 90, 0);

/** The device turned in its own plane by `deg`, counter-clockwise seen from the viewer: a roll, for the screen-angle cases. */
function rollDevice(m: Mat3, deg: number): Mat3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // R · Rz(deg): the new X is c·X + s·Y, the new Y is −s·X + c·Y, in the device frame.
  return [
    [m[0][0] * c + m[0][1] * s, -m[0][0] * s + m[0][1] * c, m[0][2]],
    [m[1][0] * c + m[1][1] * s, -m[1][0] * s + m[1][1] * c, m[1][2]],
    [m[2][0] * c + m[2][1] * s, -m[2][0] * s + m[2][1] * c, m[2][2]],
  ];
}

describe('the picks (FR-WIN-7, docs/window/FINDINGS.md)', () => {
  it('are 60° across the shorter side and 0.6 of smoothing', () => {
    expect(WINDOW_FOV).toBe(60);
    expect(WINDOW_SMOOTHING).toBe(0.6);
  });
});

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

  it('uprightRotation is the inverse: the picture before the first reading points where it is told', () => {
    const look = lookDirection(uprightRotation(135, 20));
    expect(look.azDeg).toBeCloseTo(135, 6);
    expect(look.altDeg).toBeCloseTo(20, 6);
  });
});

describe('the stereographic projection', () => {
  it('puts north on the horizon at the centre for an upright phone facing north', () => {
    const p = project(upright, 0, 0, view);
    expect(p.x).toBeCloseTo(195, 6);
    expect(p.y).toBeCloseTo(195, 6);
    expect(p.front).toBe(true);
    expect(p.offAxisDeg).toBeCloseTo(0, 6);
  });

  it('puts east to the right and up above, with the 60° field spanning the 390 px side', () => {
    // 30° to the east of north sits at the right edge: x = 390.
    const east = project(upright, 30, 0, view);
    expect(east.x).toBeCloseTo(390, 6);
    expect(east.y).toBeCloseTo(195, 6);
    const up = project(upright, 0, 30, view);
    expect(up.x).toBeCloseTo(195, 6);
    expect(up.y).toBeCloseTo(0, 6);
    // A taller box keeps the field on the shorter side, so the horizontal edge is still 30° away.
    expect(project(upright, 30, 0, { ...view, height: 600 }).x).toBeCloseTo(390, 6);
  });

  it('bends the horizon when the phone looks up (a small circle of the sky, not a line)', () => {
    const tilted = rotationMatrix(0, 120, 0);
    const row = [-25, 0, 25].map((az) => project(tilted, az, 0, view).y);
    expect(Math.abs((row[0] ?? 0) - (row[1] ?? 0))).toBeGreaterThan(2);
    expect(row[0]).toBeCloseTo(row[2] ?? NaN, 6);
  });

  it('a roll of 90° swaps the axes, and gamma is not that roll', () => {
    const rolled = rollDevice(upright, 90);
    expect(lookDirection(rolled).azDeg).toBeCloseTo(0, 4);
    expect(lookDirection(rolled).altDeg).toBeCloseTo(0, 4);
    const east = project(rolled, 30, 0, view);
    expect(east.x).toBeCloseTo(195, 4);
    expect(east.y).toBeCloseTo(390, 4);
    // Gamma turns about the device's Y, which for an upright phone is the vertical: it changes the heading instead.
    expect(lookDirection(rotationMatrix(0, 90, 90)).azDeg).toBeCloseTo(270, 4);
  });

  it('the screen-angle correction turns the picture back: a 90° screen with a 90° roll reads like no roll', () => {
    const p = project(rollDevice(upright, 90), 30, 0, { ...view, screenAngleDeg: 90 });
    expect(p.x).toBeCloseTo(390, 4);
    expect(p.y).toBeCloseTo(195, 4);
    const q = project(rollDevice(upright, -90), 30, 0, { ...view, screenAngleDeg: 270 });
    expect(q.x).toBeCloseTo(390, 4);
    expect(q.y).toBeCloseTo(195, 4);
  });

  it('flags what is behind the camera, and the drawable limit reaches past the corner of the frame', () => {
    expect(project(upright, 180, 0, view).front).toBe(false);
    expect(project(upright, 180, 0, view).offAxisDeg).toBeCloseTo(180, 6);
    // The corner of a 390 px square at a 60° field is 30·√2 ≈ 41° off axis under gnomonic; stereographic differs, but the limit exceeds any corner.
    const corner = project(upright, 30, 30, view);
    expect(corner.offAxisDeg).toBeLessThan(drawableDeg(view));
    expect(drawableDeg(view)).toBeLessThanOrEqual(150);
  });
});

describe('smoothing (WINDOW_SMOOTHING)', () => {
  it('with no weight the new reading is used as is; with weight it moves part of the way and stays a rotation', () => {
    const a = rotationMatrix(0, 90, 0);
    const b = rotationMatrix(20, 90, 0);
    expect(smoothRotation(a, b, 0)).toEqual(b);
    expect(smoothRotation(null, b, 0.6)).toEqual(b);
    const mid = smoothRotation(a, b, 0.5);
    const az = lookDirection(mid).azDeg;
    expect(az).toBeGreaterThan(340);
    expect(az).toBeLessThan(360);
    for (let c = 0; c < 3; c += 1) expect(Math.hypot(mid[0][c] ?? 0, mid[1][c] ?? 0, mid[2][c] ?? 0)).toBeCloseTo(1, 9);
  });

  it('converges: repeated steps at 0.6 reach the target within a tenth of a degree in a few frames', () => {
    const target = rotationMatrix(30, 100, 5);
    let m: Mat3 | null = rotationMatrix(0, 90, 0);
    let frames = 0;
    while (m && !converged(m, target) && frames < 60) {
      m = smoothRotation(m, target, WINDOW_SMOOTHING);
      frames += 1;
    }
    expect(frames).toBeGreaterThan(1);
    expect(frames).toBeLessThan(25);
  });

  it('is continuous past the zenith: the look direction moves smoothly through 90° of altitude', () => {
    // Tilting from 80° up, over the head, to 80° up facing the other way: the smoothed look never jumps.
    let m: Mat3 | null = null;
    let previous: number | null = null;
    for (let beta = 170; beta <= 190; beta += 1) {
      m = smoothRotation(m, rotationMatrix(0, beta, 0), WINDOW_SMOOTHING);
      const alt = lookDirection(m).altDeg;
      if (previous !== null) expect(Math.abs(alt - previous)).toBeLessThan(3);
      previous = alt;
    }
  });
});

describe('the heading (FR-WIN-3, FR-WIN-4; R38 fused; R44 declination)', () => {
  const ios: WindowReading = { alpha: 80.9, beta: 99.9, gamma: 4.7, absolute: undefined, webkitCompassHeading: 4.7, webkitCompassAccuracy: 13.9 };

  it('reads the event, with iOS extras absent read as null', () => {
    const plain = windowReadingFrom({ alpha: 10, beta: 20, gamma: 30, absolute: true } as DeviceOrientationEvent);
    expect(plain).toEqual({ alpha: 10, beta: 20, gamma: 30, absolute: true, webkitCompassHeading: null, webkitCompassAccuracy: null });
    const webkit = windowReadingFrom({ alpha: 1, beta: 2, gamma: 3, absolute: undefined, webkitCompassHeading: 45, webkitCompassAccuracy: 12 } as unknown as DeviceOrientationEvent);
    expect(webkit.webkitCompassHeading).toBe(45);
    expect(webkit.webkitCompassAccuracy).toBe(12);
  });

  it('reads the WebKit compass as 360 − heading until calibrated, an absolute alpha as itself, and anything else as no heading', () => {
    expect(alphaFor({ ...ios, webkitCompassHeading: 90 }, null, 0)).toBe(270);
    expect(alphaFor({ alpha: 45, beta: 90, gamma: 0, absolute: true, webkitCompassHeading: null, webkitCompassAccuracy: null }, null, 0)).toBe(45);
    expect(alphaFor({ alpha: 45, beta: 90, gamma: 0, absolute: false, webkitCompassHeading: null, webkitCompassAccuracy: null }, null, 0)).toBeNull();
    expect(alphaFor({ alpha: 45, beta: 90, gamma: 0, absolute: undefined, webkitCompassHeading: null, webkitCompassAccuracy: null }, null, 0)).toBeNull();
    expect(alphaFor({ alpha: null, beta: null, gamma: null, absolute: true, webkitCompassHeading: null, webkitCompassAccuracy: null }, null, 0)).toBeNull();
  });

  it('the first iOS events, heading 0 with accuracy −1, are settling, not a reading and not a relative-only device', () => {
    const first: WindowReading = { ...ios, webkitCompassHeading: 0, webkitCompassAccuracy: -1 };
    expect(settling(first)).toBe(true);
    expect(alphaFor(first, null, 0)).toBeNull();
    expect(settling(ios)).toBe(false);
  });

  it('calibrates only while upright and while the compass says it is accurate', () => {
    expect(calibrationSample(ios)).toBeCloseTo((360 - 4.7 - 80.9 + 360) % 360, 6);
    expect(calibrationSample({ ...ios, webkitCompassAccuracy: -1 })).toBeNull();
    expect(calibrationSample({ ...ios, webkitCompassAccuracy: 40 })).toBeNull();
    expect(calibrationSample({ ...ios, beta: 170 })).toBeNull();
    expect(calibrationSample({ ...ios, alpha: null })).toBeNull();
  });

  it('averages the offset on the circle and applies it to alpha, so the heading is continuous through the zenith', () => {
    const estimate = new OffsetEstimate();
    expect(estimate.get()).toBeNull();
    estimate.add(359);
    estimate.add(1, 0.5);
    // On the circle: 0 and 360 − ε are the same offset.
    const mean = estimate.get() ?? NaN;
    expect(Math.min(mean, 360 - mean)).toBeCloseTo(0, 4);
    expect(estimate.samples).toBe(2);
    // Calibrated: alpha + offset, whatever the compass says now (it has no answer overhead).
    expect(alphaFor({ ...ios, alpha: 10, webkitCompassHeading: 123 }, 350, 0)).toBeCloseTo(0, 6);
    expect(alphaFor(ios, null, 0)).toBeCloseTo(355.3, 6);
    expect(alphaFor(ios, 274.4, 0)).toBeCloseTo(355.3, 6);
  });

  it('corrects to true north: a positive (east) declination lowers alpha by as much', () => {
    // Magnetic heading 90 (alpha 270) with +1.1° of declination is a true heading of 91.1: alpha 268.9.
    expect(alphaFor({ alpha: 270, beta: 90, gamma: 0, absolute: true, webkitCompassHeading: null, webkitCompassAccuracy: null }, null, 1.1)).toBeCloseTo(268.9, 6);
    expect(lookDirection(rotationMatrix(268.9, 90, 0)).azDeg).toBeCloseTo(91.1, 6);
    expect(alphaFor({ ...ios, webkitCompassHeading: 90 }, null, -5)).toBeCloseTo(275, 6);
  });
});

/**
 * R56 (FR-FOL-5, US-21 AC10; PLAN D-278): the ground state, derived from the
 * altitude at the centre of the field and the vertical half-field of the
 * measured box — the same `WINDOW_FOV` across the shorter side, no constant of
 * its own.
 */
describe('the ground state (FR-FOL-5)', () => {
  /** The guide's square box, a tall phone box, and a box turned on its side. */
  const square: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };
  const portrait: View = { ...square, width: 390, height: 780 };
  const landscape: View = { ...square, width: 780, height: 390, screenAngleDeg: 90 };
  /** The half-field of a box twice as tall as it is wide: 2·atan(2·tan 15°). */
  const portraitHalf = (2 * Math.atan(2 * Math.tan(Math.PI / 12)) * 180) / Math.PI;
  /** `groundState` now takes the altitude `lookDirection` already read (F-58), not the matrix. */
  const looking = (altDeg: number): number => lookDirection(uprightRotation(120, altDeg)).altDeg;

  it('spans WINDOW_FOV across the shorter side, so the landscape half-field is the narrower one', () => {
    // 60° across the shorter side: in a square box, and in any box wider than it is tall, the shorter side is the height.
    expect(verticalHalfFieldDeg(square)).toBeCloseTo(WINDOW_FOV / 2, 6);
    expect(verticalHalfFieldDeg(landscape)).toBeCloseTo(WINDOW_FOV / 2, 6);
    // A tall box sees further up and down than that; turning the phone is what narrows the field.
    expect(portraitHalf).toBeCloseTo(56.374, 3);
    expect(verticalHalfFieldDeg(portrait)).toBeCloseTo(portraitHalf, 6);
    expect(verticalHalfFieldDeg(landscape)).toBeLessThan(verticalHalfFieldDeg(portrait));
  });

  it('is sky down to the horizon and ground below it, in portrait and in landscape', () => {
    for (const box of [portrait, landscape]) {
      expect(groundState(looking(40), box)).toBe('sky');
      // The boundary is the horizon itself: a hair above it is the sky's picture, a hair below it the ground's.
      // (Exactly 0 falls inside the rotation's own rounding, and either answer draws the same box: the horizon
      // through its centre.)
      expect(groundState(looking(0.05), box)).toBe('sky');
      expect(groundState(looking(-0.05), box)).toBe('ground');
      expect(groundState(looking(-10), box)).toBe('ground');
    }
  });

  it('is buried once the top edge of the field is at or below the horizon, which the tall box reaches later', () => {
    expect(groundState(looking(-(portraitHalf - 0.05)), portrait)).toBe('ground');
    expect(groundState(looking(-(portraitHalf + 0.05)), portrait)).toBe('buried');
    expect(groundState(looking(-29.95), landscape)).toBe('ground');
    expect(groundState(looking(-30.05), landscape)).toBe('buried');
    // The same aim in two boxes: the narrower field has already lost the sky the taller one still holds.
    expect(groundState(looking(-45), portrait)).toBe('ground');
    expect(groundState(looking(-45), landscape)).toBe('buried');
    expect(groundState(looking(-90), portrait)).toBe('buried');
  });
});
