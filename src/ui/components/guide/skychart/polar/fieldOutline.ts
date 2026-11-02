import { handRotation, type HandState } from '../window/camera';
import { scaleFor, type Mat3, type View } from '../window/projection';

/**
 * R158 (FR-PHONE-9; V210-5; PLAN D-969): the window's field on the whole sky,
 * as a pure path. The box's four edges are sampled, `FIELD_OUTLINE_SAMPLES`
 * points a side, taken back through the window's projection (stereographic,
 * `projection.ts`'s `project` run backwards: the box's pixel to the plane, the
 * screen angle undone, the plane to a device direction, the rotation to the
 * sky) and forward through the polar chart's projection, so a 60° field facing
 * south at 35° is a trapezoid low on the southern edge and a field facing the
 * zenith a loop round the centre. The closed curve is cut where it meets the
 * horizon and the part under it dropped: wholly above, the path is closed
 * (`Z`); crossing it, each run above is an open sub-path ending on the horizon
 * ring; wholly under, there is no path.
 *
 * The camera is a hand camera's pose (`HandState`'s aim) or a rotation — the
 * sensor's, when following (R160 wires that one) — and the view the window's:
 * its field and the shape of the box it would draw in.
 */

/** D-969: points per side of the box. */
export const FIELD_OUTLINE_SAMPLES = 12;

/** The polar chart's projection: a sky direction to the chart's user units, in the convention it draws. */
export type PolarProjection = (point: { azDeg: number; elDeg: number }) => { x: number; y: number };

/** What the outline is the field of: the hand's aim, or a rotation (device → earth, `projection.ts`'s `Mat3`). */
export type OutlineCamera = Pick<HandState, 'azDeg' | 'altDeg'> | Mat3;

type Vec3 = readonly [number, number, number];

const RAD = Math.PI / 180;
const fmt = (n: number): string => n.toFixed(2);

const isRotation = (camera: OutlineCamera): camera is Mat3 => Array.isArray(camera);

/**
 * A point of the box (px) back to the sky, as an earth-frame unit vector: the inverse of `projection.ts`'s
 * `projectDevice` and `project`. The plane point (u, v) is the stereographic image of the device direction
 * d = (2u, 2v, −(1 − s)) / (1 + s), s = u² + v², which looks along −Z where u = v = 0.
 */
export function unprojectBox(m: Mat3, view: View, x: number, y: number): Vec3 {
  const k = scaleFor(view);
  const ru = (x - view.width / 2) / k;
  const rv = -(y - view.height / 2) / k;
  const angle = view.screenAngleDeg * RAD;
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  // `projectDevice` turns the plane by +angle; turning it back is the transpose.
  const u = ru * cs + rv * sn;
  const v = -ru * sn + rv * cs;
  const s = u * u + v * v;
  const d: Vec3 = [(2 * u) / (1 + s), (2 * v) / (1 + s), -(1 - s) / (1 + s)];
  return [m[0][0] * d[0] + m[0][1] * d[1] + m[0][2] * d[2], m[1][0] * d[0] + m[1][1] * d[1] + m[1][2] * d[2], m[2][0] * d[0] + m[2][1] * d[1] + m[2][2] * d[2]];
}

/** The box's outline, clockwise from the top-left corner, `samples` points a side (each corner once). */
function boxOutline(view: View, samples: number): [number, number][] {
  const { width: w, height: h } = view;
  const out: [number, number][] = [];
  for (let i = 0; i < samples; i += 1) out.push([(w * i) / samples, 0]);
  for (let i = 0; i < samples; i += 1) out.push([w, (h * i) / samples]);
  for (let i = 0; i < samples; i += 1) out.push([w - (w * i) / samples, h]);
  for (let i = 0; i < samples; i += 1) out.push([0, h - (h * i) / samples]);
  return out;
}

const toSky = (v: Vec3): { azDeg: number; elDeg: number } => {
  const az = Math.atan2(v[0], v[1]) / RAD;
  return { azDeg: ((az % 360) + 360) % 360, elDeg: Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD };
};

/** Where the great circle from `a` (up) to `b` (down) meets the horizon: the chord's zero of height, back on the sphere. */
function onHorizon(a: Vec3, b: Vec3): Vec3 {
  const t = a[2] / (a[2] - b[2]);
  const x = a[0] + t * (b[0] - a[0]);
  const y = a[1] + t * (b[1] - a[1]);
  const n = Math.hypot(x, y) || 1;
  return [x / n, y / n, 0];
}

/**
 * D-969: the outline's `d` in the chart's user units, or `''` when none of the field is above the horizon (or the
 * view has no size).
 */
export function fieldOutline(camera: OutlineCamera, view: View, polar: PolarProjection, samples: number = FIELD_OUTLINE_SAMPLES): string {
  if (!(view.width > 0 && view.height > 0)) return '';
  const m = isRotation(camera) ? camera : handRotation(camera);
  const sky = boxOutline(view, samples).map(([x, y]) => unprojectBox(m, view, x, y));
  const up = sky.map((v) => v[2] >= 0);
  const at = (v: Vec3): string => {
    const p = polar(toSky(v));
    return `${fmt(p.x)} ${fmt(p.y)}`;
  };
  if (up.every(Boolean)) return `M${sky.map(at).join('L')}Z`;
  const start = up.indexOf(false);
  if (start < 0 || up.every((u) => !u)) return '';
  // Walk once round from a point under the horizon, so every run above starts and ends with a crossing.
  const runs: string[] = [];
  let run: string[] = [];
  for (let j = 1; j <= sky.length; j += 1) {
    const i = (start + j) % sky.length;
    const prev = sky[(i - 1 + sky.length) % sky.length] as Vec3;
    const here = sky[i] as Vec3;
    const wasUp = up[(i - 1 + sky.length) % sky.length] === true;
    const isUp = up[i] === true;
    if (!wasUp && isUp) run = [at(onHorizon(here, prev)), at(here)];
    else if (wasUp && isUp) run.push(at(here));
    else if (wasUp && !isUp) {
      run.push(at(onHorizon(prev, here)));
      runs.push(`M${run.join('L')}`);
      run = [];
    }
  }
  return runs.join('');
}
