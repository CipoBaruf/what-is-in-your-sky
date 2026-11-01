import { skyVector, type Mat3, type Vec3 } from './projection';

/**
 * R155 (FR-STAR-2, FR-LOOK-3, FR-LOOK-8; PLAN D-983): the rotation from the
 * J2000 equatorial frame to the observer's horizon at the shown instant,
 * recovered from the scene itself. The scene hands the window the catalogue
 * (right ascension and declination) and every star's altitude and azimuth at
 * the instant, both through FR-STAR-2's one rotation per instant in the
 * `stars` chunk; the deep stars and the Milky Way's outline are right
 * ascension and declination too and want the same rotation, and the window
 * is not to compute positions of its own (FR-LIVE-10). So it reads the
 * rotation back: two bright stars well apart give an orthonormal basis in
 * each frame, and the rotation is the one that carries the equatorial basis
 * onto the horizon one — exact for data that came through one rotation,
 * which these did, precession and nutation inside it. Recovered once per
 * positions object (one per instant, `starsAt` memoising on `t`), and the
 * rest of the deep catalogue and the outline go through it once each.
 *
 * Pure: no React, no DOM, no ephemeris.
 */

const RAD = Math.PI / 180;

/** A J2000 direction as a unit vector: x toward the vernal equinox, z toward the north celestial pole. */
export function equatorialVector(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * RAD;
  const dec = decDeg * RAD;
  const c = Math.cos(dec);
  return [Math.cos(ra) * c, Math.sin(ra) * c, Math.sin(dec)];
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalized = (v: Vec3): Vec3 => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n === 0 ? [0, 0, 0] : [v[0] / n, v[1] / n, v[2] / n];
};

/** An orthonormal basis from two directions: the first, the second made perpendicular to it, and their cross product. */
function basis(a: Vec3, b: Vec3): [Vec3, Vec3, Vec3] {
  const u1 = normalized(a);
  const u2 = normalized([b[0] - dot(b, u1) * u1[0], b[1] - dot(b, u1) * u1[1], b[2] - dot(b, u1) * u1[2]]);
  return [u1, u2, cross(u1, u2)];
}

/** The second star is taken at least this far from the first, in the cosine of their separation: about 45°, so the basis is well conditioned. */
const MAX_PAIR_COS = 0.7;

export interface SkyFramePositions {
  altDeg: ArrayLike<number>;
  azDeg: ArrayLike<number>;
}

export interface SkyFrameCatalog {
  ra: ArrayLike<number>;
  dec: ArrayLike<number>;
}

/**
 * The equatorial-to-horizon rotation behind `positions`, as a matrix `M` with `M · e = h` (columns the images of the
 * equatorial axes), or `null` where the catalogue has no two stars far enough apart with a finite position.
 */
export function skyFrameOf(catalog: SkyFrameCatalog, positions: SkyFramePositions): Mat3 | null {
  const n = Math.min(catalog.ra.length, positions.altDeg.length);
  const finite = (i: number): boolean => Number.isFinite(catalog.ra[i] ?? Number.NaN) && Number.isFinite(catalog.dec[i] ?? Number.NaN) && Number.isFinite(positions.altDeg[i] ?? Number.NaN) && Number.isFinite(positions.azDeg[i] ?? Number.NaN);
  let a = -1;
  for (let i = 0; i < n; i += 1) {
    if (finite(i)) {
      a = i;
      break;
    }
  }
  if (a < 0) return null;
  const ea = equatorialVector(catalog.ra[a] ?? 0, catalog.dec[a] ?? 0);
  let b = -1;
  for (let i = a + 1; i < n; i += 1) {
    if (finite(i) && Math.abs(dot(ea, equatorialVector(catalog.ra[i] ?? 0, catalog.dec[i] ?? 0))) < MAX_PAIR_COS) {
      b = i;
      break;
    }
  }
  if (b < 0) return null;
  const eb = equatorialVector(catalog.ra[b] ?? 0, catalog.dec[b] ?? 0);
  const ha = skyVector(positions.azDeg[a] ?? 0, positions.altDeg[a] ?? 0);
  const hb = skyVector(positions.azDeg[b] ?? 0, positions.altDeg[b] ?? 0);
  const E = basis(ea, eb);
  const H = basis(ha, hb);
  // M = H · Eᵀ: M[r][c] = Σ_k H[k][r] · E[k][c], the k-th basis vectors paired.
  const m = (r: number, c: number): number => (H[0][r] ?? 0) * (E[0][c] ?? 0) + (H[1][r] ?? 0) * (E[1][c] ?? 0) + (H[2][r] ?? 0) * (E[2][c] ?? 0);
  return [
    [m(0, 0), m(0, 1), m(0, 2)],
    [m(1, 0), m(1, 1), m(1, 2)],
    [m(2, 0), m(2, 1), m(2, 2)],
  ];
}

/** `M · v`, the matrix as rows. */
export function applyFrame(frame: Mat3, v: Vec3): Vec3 {
  return [frame[0][0] * v[0] + frame[0][1] * v[1] + frame[0][2] * v[2], frame[1][0] * v[0] + frame[1][1] * v[1] + frame[1][2] * v[2], frame[2][0] * v[0] + frame[2][1] * v[1] + frame[2][2] * v[2]];
}

/** `Mᵀ · v`: the horizon frame back to the equatorial one. */
export function unapplyFrame(frame: Mat3, v: Vec3): Vec3 {
  return [frame[0][0] * v[0] + frame[1][0] * v[1] + frame[2][0] * v[2], frame[0][1] * v[0] + frame[1][1] * v[1] + frame[2][1] * v[2], frame[0][2] * v[0] + frame[1][2] * v[1] + frame[2][2] * v[2]];
}

/** An earth-frame unit vector (`skyVector`'s layout) as azimuth from north through east and altitude, degrees. */
export function horizonOf(v: Vec3): { azDeg: number; altDeg: number } {
  const az = Math.atan2(v[0], v[1]) / RAD;
  return { azDeg: ((az % 360) + 360) % 360, altDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD };
}

/** A J2000 direction at the instant behind `frame`, as azimuth and altitude. */
export function horizonAt(frame: Mat3, raDeg: number, decDeg: number): { azDeg: number; altDeg: number } {
  return horizonOf(applyFrame(frame, equatorialVector(raDeg, decDeg)));
}
