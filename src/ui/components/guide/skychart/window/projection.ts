import { normalizeAzimuthDeg } from '../../../../../lib/compass';

/**
 * R47 (FR-WIN-1, FR-WIN-3, PLAN D-188, §8.10): the sky-window projection,
 * pure, as the R38 spike fixed it (`docs/window/FINDINGS.md`): stereographic,
 * `WINDOW_FOV` 60° across the shorter side, `WINDOW_SMOOTHING` 0.6 applied to
 * the rotation's axes, the screen angle applied as `+angle` to the projected
 * plane, and the heading fused from the event's own `alpha` and a compass
 * calibration taken while the phone is upright.
 *
 * Frames, after the W3C DeviceOrientation spec:
 *   earth   X east, Y north, Z up.
 *   device  X to the right of the screen, Y up the screen, Z out of the screen
 *           towards the viewer; the camera the window imitates looks along −Z,
 *           out of the back of the phone.
 *   R = Rz(alpha) · Rx(beta) · Ry(gamma) takes a device vector to earth. With
 *   all three at 0 the phone lies flat, screen up; beta 90 stands it upright
 *   with the back facing north; alpha grows as it turns left, so the compass
 *   heading of the back is 360 − alpha.
 *
 * A sky direction (azimuth clockwise from north, altitude) is a unit vector in
 * earth coordinates; Rᵀ takes it to the device frame, where the stereographic
 * projection is x/(1 + forward): shapes kept, the horizon bends, nothing
 * stretches near the zenith. The three angles are taken as one rotation, so
 * the picture is continuous past the zenith and when the phone rolls; the
 * angles wrap and swap roles there, the axes do not.
 */

export type Vec3 = readonly [number, number, number];
/** Row-major 3×3, `m[row][col]`, with earth = m · device; column c is the earth-frame image of device axis c. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

/** FR-WIN-1: degrees across the shorter side of the view (FR-WIN-7's pick). */
export const WINDOW_FOV = 60;
/** FR-WIN-3: the weight the previous frame's axes keep per frame, 0 none, 0.98 the most (FR-WIN-7's pick). */
export const WINDOW_SMOOTHING = 0.6;

const RAD = Math.PI / 180;

/** The W3C rotation matrix, device → earth, from the three event angles in degrees. */
export function rotationMatrix(alphaDeg: number, betaDeg: number, gammaDeg: number): Mat3 {
  const a = alphaDeg * RAD;
  const b = betaDeg * RAD;
  const g = gammaDeg * RAD;
  const cA = Math.cos(a);
  const sA = Math.sin(a);
  const cB = Math.cos(b);
  const sB = Math.sin(b);
  const cG = Math.cos(g);
  const sG = Math.sin(g);
  return [
    [cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ];
}

/** The phone held upright, top up, its back pointing at `azDeg` / `altDeg`: the window's picture before the first reading. */
export function uprightRotation(azDeg: number, altDeg: number): Mat3 {
  return rotationMatrix(normalizeAzimuthDeg(360 - azDeg), 90 + altDeg, 0);
}

/** Earth → device: the transpose, since R is orthonormal. */
export function toDevice(m: Mat3, v: Vec3): Vec3 {
  return [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
}

/** A sky direction as an earth-frame unit vector. */
export function skyVector(azDeg: number, altDeg: number): Vec3 {
  const az = azDeg * RAD;
  const alt = altDeg * RAD;
  const c = Math.cos(alt);
  return [Math.sin(az) * c, Math.cos(az) * c, Math.sin(alt)];
}

/** Where the back of the phone points, as azimuth and altitude — the centre of the window. */
export function lookDirection(m: Mat3): { azDeg: number; altDeg: number } {
  // The camera looks along device −Z; its earth image is −(third column of R).
  const x = -m[0][2];
  const y = -m[1][2];
  const z = -m[2][2];
  return { azDeg: normalizeAzimuthDeg(Math.atan2(x, y) / RAD), altDeg: Math.asin(Math.max(-1, Math.min(1, z))) / RAD };
}

export interface View {
  /** Degrees across the shorter side. */
  fovDeg: number;
  width: number;
  height: number;
  /** `screen.orientation.angle`, degrees. */
  screenAngleDeg: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Angle from the view's centre, degrees: the clip test for whoever draws. */
  offAxisDeg: number;
  /** In front of the camera at all. */
  front: boolean;
}

/** Pixels per unit of the projection's plane, so `fov` spans the shorter side. */
export function scaleFor(view: View): number {
  const half = Math.min(view.width, view.height) / 2;
  return half / Math.tan((view.fovDeg / 4) * RAD);
}

/** A device-frame unit vector to a point on the view. */
export function projectDevice(d: Vec3, view: View): Projected {
  const forward = -d[2];
  const offAxisDeg = Math.acos(Math.max(-1, Math.min(1, forward))) / RAD;
  const front = forward > 1e-6;
  const denom = 1 + forward;
  const u = denom > 1e-6 ? d[0] / denom : 0;
  const v = denom > 1e-6 ? d[1] / denom : 0;
  // A phone turned counter-clockwise into landscape (its top to the left) reports angle 90 and has its
  // device +X pointing up the room: turning the projected plane by +angle puts east back on the
  // viewer's right (R38, confirmed on the phone in landscape).
  const angle = view.screenAngleDeg * RAD;
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  const ru = u * cs - v * sn;
  const rv = u * sn + v * cs;
  const k = scaleFor(view);
  return { x: view.width / 2 + k * ru, y: view.height / 2 - k * rv, offAxisDeg, front };
}

/** A sky direction to a point on the view, through the device rotation. */
export function project(m: Mat3, azDeg: number, altDeg: number, view: View): Projected {
  return projectDevice(toDevice(m, skyVector(azDeg, altDeg)), view);
}

/** The largest off-axis angle worth drawing: the corner of the view plus a margin, so arcs leave the frame instead of ending inside it. */
export function drawableDeg(view: View): number {
  const half = Math.hypot(view.width, view.height) / 2;
  const r = half / scaleFor(view);
  return Math.min(150, (2 * Math.atan(r)) / RAD + 5);
}

// --- The ground (FR-FOL-5, D-278) ----------------------------------------------

/**
 * Half the field's vertical extent, in degrees: the angle from the centre of
 * the view to the middle of its top edge. `WINDOW_FOV` spans the *shorter*
 * side (FR-WIN-1), so this is `FOV / 2` exactly in a square box and in any box
 * wider than it is tall, and more than that in a tall one — the box is only
 * square on the phone's floor (D-233), so it is read from the measured box and
 * never from the constant.
 */
export function verticalHalfFieldDeg(view: View): number {
  return (2 * Math.atan(view.height / 2 / scaleFor(view))) / RAD;
}

/** FR-FOL-5: how much sky the field still holds. */
export type GroundState = 'sky' | 'ground' | 'buried';

/**
 * FR-FOL-5 (D-278): the ground state, a pure function of where the phone
 * points and how big the box is — the altitude at the centre of the field and
 * the vertical half-field, no constant of its own:
 *
 *   `sky`     the centre is on or above the horizon; the picture is the sky's.
 *   `ground`  the centre is below the horizon but the top edge is above it:
 *             some sky is still in the field, and the part below is hatched.
 *   `buried`  the top edge is at or below the horizon: no sky is left.
 *
 * The roll is not read: a rolled phone turns the box, not the centre of it,
 * and FR-FOL-5 asks for the altitude at the centre. Takes the altitude
 * already read from `lookDirection` (F-58) rather than the matrix, so a
 * render's one `lookDirection` call serves both the readout and this.
 */
export function groundState(altDeg: number, view: View): GroundState {
  if (altDeg >= 0) return 'sky';
  return altDeg + verticalHalfFieldDeg(view) > 0 ? 'ground' : 'buried';
}

// --- Smoothing (FR-WIN-3's `WINDOW_SMOOTHING`) ---------------------------------

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] - k * b[0], a[1] - k * b[1], a[2] - k * b[2]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const column = (m: Mat3, c: number): Vec3 => [m[0][c] ?? 0, m[1][c] ?? 0, m[2][c] ?? 0];
const fromColumns = (x: Vec3, y: Vec3, z: Vec3): Mat3 => [
  [x[0], y[0], z[0]],
  [x[1], y[1], z[1]],
  [x[2], y[2], z[2]],
];

/**
 * One smoothing step on the rotation itself, not on the angles. The previous
 * frame's axes are blended with the new reading by `weight` (0 is no
 * smoothing, 0.9 is heavy) and re-orthonormalised, so the result is a
 * rotation again and the view stays continuous however the phone moves.
 */
export function smoothRotation(previous: Mat3 | null, next: Mat3, weight: number): Mat3 {
  if (!previous || weight <= 0) return next;
  const w = Math.min(0.98, weight);
  const blend = (c: number): Vec3 => {
    const p = column(previous, c);
    const n = column(next, c);
    // Opposite axes (a 180° jump) are not blended through zero; the new reading wins.
    if (dot(p, n) < -0.5) return n;
    return [w * p[0] + (1 - w) * n[0], w * p[1] + (1 - w) * n[1], w * p[2] + (1 - w) * n[2]];
  };
  const z = norm(blend(2));
  const y0 = blend(1);
  const y = norm(sub(y0, z, dot(y0, z)));
  const x = cross(y, z);
  return fromColumns(x, y, z);
}

/** Within a tenth of a degree on every axis: nothing left to ease toward. */
export function converged(a: Mat3, b: Mat3): boolean {
  for (const r of [0, 1, 2] as const) for (const c of [0, 1, 2] as const) if (Math.abs(a[r][c] - b[r][c]) > 0.0017) return false;
  return true;
}

// --- The heading (FR-WIN-3, FR-WIN-4; R38's fused pick) -------------------------

/** Every field of a `DeviceOrientationEvent` the window reads, as the platform gives it. */
export interface WindowReading {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  /** iOS leaves it `undefined` (R38, measured): read as "not absolute". */
  absolute: boolean | undefined;
  /** iOS only: the compass heading of the device's top, clockwise from magnetic north. */
  webkitCompassHeading: number | null;
  /** iOS only: `−1` before the compass settles (R38, measured), degrees of doubt after. */
  webkitCompassAccuracy: number | null;
}

export function windowReadingFrom(event: DeviceOrientationEvent): WindowReading {
  const any = event as DeviceOrientationEvent & { webkitCompassHeading?: unknown; webkitCompassAccuracy?: unknown };
  return {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    absolute: event.absolute,
    webkitCompassHeading: typeof any.webkitCompassHeading === 'number' ? any.webkitCompassHeading : null,
    webkitCompassAccuracy: typeof any.webkitCompassAccuracy === 'number' ? any.webkitCompassAccuracy : null,
  };
}

const finite = (n: number | null | undefined): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);

/** iOS's first events carry a heading of 0 with accuracy −1: not a reading yet, but not a relative-only device either. */
export function settling(reading: WindowReading): boolean {
  return finite(reading.webkitCompassHeading) !== null && (reading.webkitCompassAccuracy ?? 0) < 0;
}

/**
 * The event's alpha for the projection, corrected to true north. iOS puts the
 * compass in `webkitCompassHeading` and leaves `alpha` relative to where the
 * page loaded — and the compass fails overhead, since it is the direction of
 * the phone's top along the ground, which has no answer at the zenith. So the
 * heading is *fused* (R38): the platform's own `alpha`, continuous through the
 * zenith, offset by the compass as `calibrationSample` learned it while the
 * phone was upright; until the first sample, `360 − heading`. An absolute
 * reading (Android Chrome) has the W3C alpha already. Anything else is a
 * relative-only device: `null`.
 *
 * R44 (D-185): the sensor reads magnetic north. A true heading is the magnetic
 * one plus the declination, and alpha runs the other way, so alpha loses it.
 */
export function alphaFor(reading: WindowReading, offsetDeg: number | null, declinationDeg: number): number | null {
  const webkit = finite(reading.webkitCompassHeading);
  const alpha = finite(reading.alpha);
  let magnetic: number | null = null;
  if (webkit !== null) {
    if ((reading.webkitCompassAccuracy ?? 0) < 0) return null;
    magnetic = alpha !== null && offsetDeg !== null ? alpha + offsetDeg : 360 - webkit;
  } else if (reading.absolute === true && alpha !== null) magnetic = alpha;
  return magnetic === null ? null : normalizeAzimuthDeg(magnetic - declinationDeg);
}

/** The compass is trustworthy for calibrating alpha: the phone roughly upright, top up, and the accuracy in [0, 30] (R38, measured). */
export function calibrationSample(reading: WindowReading): number | null {
  const alpha = finite(reading.alpha);
  const beta = finite(reading.beta);
  const webkit = finite(reading.webkitCompassHeading);
  const accuracy = reading.webkitCompassAccuracy;
  if (alpha === null || beta === null || webkit === null) return null;
  if (accuracy !== null && (accuracy < 0 || accuracy > 30)) return null;
  if (beta < 45 || beta > 135) return null;
  return normalizeAzimuthDeg(360 - webkit - alpha);
}

/** A circular running mean of the calibration offset: a unit vector per sample, blended by `weight`, so 359° and 1° average to 0° and not 180°. */
export class OffsetEstimate {
  private x = 0;
  private y = 0;
  private count = 0;

  add(offsetDeg: number, weight = 0.1): void {
    const r = offsetDeg * RAD;
    const w = this.count === 0 ? 1 : weight;
    this.x = (1 - w) * this.x + w * Math.cos(r);
    this.y = (1 - w) * this.y + w * Math.sin(r);
    this.count += 1;
  }

  /** Degrees, or `null` before the first sample. */
  get(): number | null {
    return this.count === 0 ? null : normalizeAzimuthDeg(Math.atan2(this.y, this.x) / RAD);
  }

  get samples(): number {
    return this.count;
  }
}
