/**
 * R38 (FR-WIN-1, FR-WIN-3, PLAN §8.10): the sky-window projection, pure.
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
 * earth coordinates; Rᵀ takes it to the device frame, where the projection is
 * a function of (x, y, −z) alone. Gnomonic: x/(−z), straight great circles,
 * stretches past 60°. Stereographic: x/(1 − z), shapes kept, the horizon
 * bends. `fov` is the angle across the shorter side of the view.
 *
 * The screen's own rotation (`screen.orientation.angle`) is applied to the
 * projected point, not to the sensor: the device axes are the phone's, and
 * what turned is where the browser draws them.
 */

export type Vec3 = readonly [number, number, number];
/** Row-major 3×3, `m[row][col]`, with earth = m · device; column c is the earth-frame image of device axis c. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

const RAD = Math.PI / 180;

export const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

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

/** `m` followed by a roll of `deg` about the device's own Z axis: the phone turned in its plane, screen still facing the same way. */
export function rollDevice(m: Mat3, deg: number): Mat3 {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  // m · Rz(deg), with Rz = [[c, -s, 0], [s, c, 0], [0, 0, 1]].
  const col = (r: 0 | 1 | 2, c0: number, c1: number): number => m[r][0] * c0 + m[r][1] * c1;
  return [
    [col(0, c, s), col(0, -s, c), m[0][2]],
    [col(1, c, s), col(1, -s, c), m[1][2]],
    [col(2, c, s), col(2, -s, c), m[2][2]],
  ];
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
  const azDeg = ((Math.atan2(x, y) / RAD) % 360 + 360) % 360;
  const altDeg = Math.asin(Math.max(-1, Math.min(1, z))) / RAD;
  return { azDeg, altDeg };
}

export interface View {
  projection: 'gnomonic' | 'stereographic';
  /** Degrees across the shorter side. */
  fovDeg: number;
  width: number;
  height: number;
  /** `screen.orientation.angle`, degrees; 0 when not corrected. */
  screenAngleDeg: number;
}

export interface Projected {
  x: number;
  y: number;
  /** Angle from the view's centre, degrees: the clip test for whoever draws. */
  offAxisDeg: number;
  /** In front of the camera at all (gnomonic cannot draw what is behind it). */
  front: boolean;
}

/** Pixels per unit of the projection's plane, so `fov` spans the shorter side. */
export function scaleFor(view: View): number {
  const half = Math.min(view.width, view.height) / 2;
  const halfFov = (view.fovDeg / 2) * RAD;
  return view.projection === 'gnomonic' ? half / Math.tan(halfFov) : half / Math.tan(halfFov / 2);
}

/** A device-frame unit vector to a point on the view. */
export function projectDevice(d: Vec3, view: View): Projected {
  const forward = -d[2];
  const offAxisDeg = Math.acos(Math.max(-1, Math.min(1, forward))) / RAD;
  const front = forward > 1e-6;
  let u: number;
  let v: number;
  if (view.projection === 'gnomonic') {
    const denom = front ? forward : 1e-6;
    u = d[0] / denom;
    v = d[1] / denom;
  } else {
    const denom = 1 + forward;
    u = denom > 1e-6 ? d[0] / denom : 0;
    v = denom > 1e-6 ? d[1] / denom : 0;
  }
  // A phone turned counter-clockwise into landscape (its top to the left) reports angle 90 and has its
  // device +X pointing up the room: turning the projected plane by +angle puts east back on the
  // viewer's right. The phone confirms the sign (OQ-17); the page's `correction=neg` tries the other.
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
  const k = scaleFor(view);
  const r = half / k;
  const edge = view.projection === 'gnomonic' ? Math.atan(r) : 2 * Math.atan(r);
  return Math.min(view.projection === 'gnomonic' ? 85 : 150, edge / RAD + 5);
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
 * One smoothing step on the rotation itself, not on the angles: the angles
 * wrap at 360 and swap roles past the zenith, the device axes do not. The
 * previous frame's axes are blended with the new reading by `weight` (0 is
 * no smoothing, 0.9 is heavy) and re-orthonormalised, so the result is a
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

/**
 * The event's alpha for the projection. iOS puts the compass in
 * `webkitCompassHeading` (clockwise from north, of the device's top) and
 * leaves `alpha` relative to where the page loaded; an absolute Android
 * reading's alpha is already the W3C angle. OQ-17 asks whether the WebKit
 * heading combines with the same event's beta and gamma as if it were
 * `alpha = 360 − heading`; the spike lets the owner switch and see.
 */
export function alphaFor(reading: { alpha: number | null; absolute: boolean | undefined; webkitCompassHeading: number | null }, source: 'auto' | 'webkit' | 'alpha'): number | null {
  const webkit = reading.webkitCompassHeading;
  const useWebkit = source === 'webkit' || (source === 'auto' && typeof webkit === 'number' && Number.isFinite(webkit));
  if (useWebkit) return typeof webkit === 'number' && Number.isFinite(webkit) ? ((360 - webkit) % 360 + 360) % 360 : null;
  return reading.alpha !== null && Number.isFinite(reading.alpha) ? reading.alpha : null;
}

/**
 * Points along the great circle between two sky directions, every `stepDeg`,
 * so a track sampled coarsely (the golden pass carries three points) still
 * draws as an arc. Ends included.
 */
export function greatCircle(from: { azDeg: number; elDeg: number }, to: { azDeg: number; elDeg: number }, stepDeg: number): { azDeg: number; elDeg: number }[] {
  const a = skyVector(from.azDeg, from.elDeg);
  const b = skyVector(to.azDeg, to.elDeg);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  const n = Math.max(1, Math.ceil(angle / RAD / stepDeg));
  const out: { azDeg: number; elDeg: number }[] = [];
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    const sa = angle < 1e-9 ? 1 - f : Math.sin((1 - f) * angle) / Math.sin(angle);
    const sb = angle < 1e-9 ? f : Math.sin(f * angle) / Math.sin(angle);
    const v = norm([sa * a[0] + sb * b[0], sa * a[1] + sb * b[1], sa * a[2] + sb * b[2]]);
    out.push({ azDeg: ((Math.atan2(v[0], v[1]) / RAD) % 360 + 360) % 360, elDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD });
  }
  return out;
}
