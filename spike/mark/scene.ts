/**
 * R74 (FR-MARK-1, D-438): the mark "Aperture" as glyphcss polygons.
 *
 * This file is the drawing. It lives under `spike/` because `@glyphcss/react`
 * may only be imported here and under the dome's own directory (D-16, D-28),
 * and the mark's meshes have no business inside the dome; the page beside it
 * rasterises every tier and `scripts/build-mark.ts` reads the text out. The
 * app never sees any of this: it imports the committed
 * `src/ui/components/mark/rasters.json` and renders two `<pre>`s.
 *
 * The frame is the dome's (`src/lib/skyGeometry.ts`): **z is up**, the camera
 * is a turntable at `rotX` degrees above the horizontal looking at the origin,
 * and with `rotY = 0` it faces −x, so world y runs across the screen. Two
 * planes are used:
 *
 *   - the **screen plane**, spanned by `right = (0, 1, 0)` and
 *     `up = (−sin tilt, 0, cos tilt)`, which faces the camera exactly: a circle
 *     drawn in it reads as a circle. The bezel, its ticks, the globe's limb and
 *     the bead are drawn here, because a bezel is a rim seen face on and a
 *     sphere's silhouette is a circle whatever the camera does.
 *   - the **world horizontal plane** `z = 0`, which the tilt squashes to an
 *     ellipse of `sin(tilt)` — the orbit the bead runs on.
 *
 * Every constant below is the generator's, recorded in PLAN §8.1 with the
 * values that produce the committed rasters (FR-MARK-1).
 */

import type { MarkTier } from '../../src/ui/components/mark/tiers';

/** One glyphcss polygon: the vertices of a quad, wound counter-clockwise seen from outside. */
export type Vertex = [number, number, number];
export interface Poly {
  vertices: Vertex[];
}

const DEG = Math.PI / 180;

/** FR-MARK-1: 30° — every ring reads as an ellipse and the globe still reads as round. */
export const MARK_TILT_DEG = 30;

/** The bezel's radius is the mark's unit: everything else is a fraction of it. */
export const BEZEL_R = 1;
/** How far the four cardinal ticks reach in from the bezel. */
export const TICK_LEN = 0.18;
/** The orbit the bead runs on, in the world horizontal plane. */
export const ORBIT_R = 0.62;
/** The globe: its limb, and the one meridian the two smallest full tiers shed. */
export const GLOBE_R = 0.4;
/** The meridian's longitude away from the plane that faces the camera — 0° would project to a straight line. */
export const MERIDIAN_LON_DEG = 60;
/** Half the width of every stroke, in bezel radii: thin enough that a ribbon's two edges land in one braille dot. */
export const STROKE = 0.004;
/** The bead's half-size on the tiers that have room for a dot inside a cell. */
export const BEAD_R = 0.07;
/** How many nested squares the bead is drawn from, so a wireframe reads as a filled dot. */
export const BEAD_RINGS = 5;
/** Where frame 0 puts the bead: 45° past the right of the drawing, so it reads as coming towards the reader. */
export const BEAD_PHASE_DEG = 45;
/** The drawing's diameter as a fraction of the grid's width, so the bezel never touches the raster's edge. */
export const FILL = 1;

/** How many segments a full ring is cut into. More than the finest grid can show, so no tier sees a polygon corner. */
const RING_SEGMENTS = 120;

/** The two axes of the plane that faces the camera at this tilt. */
export function screenBasis(tiltDeg: number): { right: Vertex; up: Vertex } {
  const t = tiltDeg * DEG;
  return { right: [0, 1, 0], up: [-Math.sin(t), 0, Math.cos(t)] };
}

const at = (a: Vertex, b: Vertex, u: number, v: number): Vertex => [a[0] * u + b[0] * v, a[1] * u + b[1] * v, a[2] * u + b[2] * v];

/**
 * A ring as a ribbon of quads in the plane `(a, b)`: each quad joins the inner
 * and outer edge of one segment. glyphcss's wireframe mode strokes every quad
 * edge, so a ribbon `2 × STROKE` wide draws as one line and the rungs between
 * segments are shorter than a braille dot.
 */
export function ring(radius: number, a: Vertex, b: Vertex, segments = RING_SEGMENTS): Poly[] {
  const inner = radius - STROKE;
  const outer = radius + STROKE;
  const polys: Poly[] = [];
  for (let i = 0; i < segments; i++) {
    const t0 = (2 * Math.PI * i) / segments;
    const t1 = (2 * Math.PI * (i + 1)) / segments;
    polys.push({
      vertices: [
        at(a, b, inner * Math.cos(t0), inner * Math.sin(t0)),
        at(a, b, outer * Math.cos(t0), outer * Math.sin(t0)),
        at(a, b, outer * Math.cos(t1), outer * Math.sin(t1)),
        at(a, b, inner * Math.cos(t1), inner * Math.sin(t1)),
      ],
    });
  }
  return polys;
}

/** One cardinal tick: a radial stroke reaching in from the bezel, in the plane `(a, b)`. */
function tick(angleDeg: number, a: Vertex, b: Vertex): Poly {
  const t = angleDeg * DEG;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const r0 = BEZEL_R - TICK_LEN;
  const r1 = BEZEL_R;
  // The stroke's width is perpendicular to the radius, inside the same plane.
  const wx = -s * STROKE;
  const wy = c * STROKE;
  return {
    vertices: [
      at(a, b, r0 * c - wx, r0 * s - wy),
      at(a, b, r1 * c - wx, r1 * s - wy),
      at(a, b, r1 * c + wx, r1 * s + wy),
      at(a, b, r0 * c + wx, r0 * s + wy),
    ],
  };
}

/**
 * The bead: a filled square facing the camera, centred on `centre`.
 *
 * Filled the only way a wireframe can be. glyphcss strokes quad edges and
 * fills nothing, so one square would draw as a hollow box two cells wide at
 * the hero tier — a ring, which is the one shape the mark already has three
 * of. `BEAD_RINGS` nested squares put an edge every fraction of a braille dot,
 * and the eye reads the result as the solid dot the satellite is.
 */
export function bead(centre: Vertex, half: number, tiltDeg: number): Poly[] {
  const { right, up } = screenBasis(tiltDeg);
  const corner = (u: number, v: number): Vertex => [centre[0] + right[0] * u + up[0] * v, centre[1] + right[1] * u + up[1] * v, centre[2] + right[2] * u + up[2] * v];
  return Array.from({ length: BEAD_RINGS }, (_, i) => {
    const r = (half * (i + 1)) / BEAD_RINGS;
    return { vertices: [corner(-r, -r), corner(r, -r), corner(r, r), corner(-r, r)] };
  });
}

/** Which readings a tier draws (FR-MARK-2's "sheds" column). */
export interface TierScene {
  bezel: boolean;
  ticks: boolean;
  orbit: boolean;
  limb: boolean;
  meridian: boolean;
  /** Where the bead runs: on the orbit ring, or — once the orbit is shed — on the bezel itself. */
  beadOn: 'orbit' | 'bezel';
  /** The bead's half-size in bezel radii. */
  beadHalf: number;
  /** Whether the bead advances at all: the favicon is a still picture on a 4 × 2 grid. */
  animated: boolean;
}

/**
 * FR-MARK-2's ladder, as what each tier draws. Reading down the table, one
 * reading leaves at every step: the globe's meridian, then its limb, then the
 * orbit (and the bead moves onto the bezel), then the ticks — until the
 * favicon is one ring and one bead.
 *
 * The favicon does not animate. It is a file the browser draws, never a `<pre>`
 * the page steps, and on a 4 × 2 grid a bead half an orbit later would land on
 * the far side of a ring four cells wide, which is a different picture rather
 * than a moving one (FR-MARK-8 b asks frame 0 and frame 30 to be equal there).
 */
export const TIER_SCENES: Record<MarkTier, TierScene> = {
  hero: { bezel: true, ticks: true, orbit: true, limb: true, meridian: true, beadOn: 'orbit', beadHalf: BEAD_R, animated: true },
  icon192: { bezel: true, ticks: true, orbit: true, limb: true, meridian: true, beadOn: 'orbit', beadHalf: BEAD_R, animated: true },
  lockup80: { bezel: true, ticks: true, orbit: true, limb: true, meridian: false, beadOn: 'orbit', beadHalf: BEAD_R, animated: true },
  header56: { bezel: true, ticks: true, orbit: true, limb: false, meridian: false, beadOn: 'orbit', beadHalf: BEAD_R, animated: true },
  header32: { bezel: true, ticks: true, orbit: false, limb: false, meridian: false, beadOn: 'bezel', beadHalf: BEAD_R, animated: true },
  favicon16: { bezel: true, ticks: false, orbit: false, limb: false, meridian: false, beadOn: 'bezel', beadHalf: BEAD_R, animated: false },
};

/**
 * The body's polygons for a tier: everything but the bead, which is the other
 * layer (D-439) and the only thing that ever changes.
 */
export function bodyPolygons(scene: TierScene, tiltDeg = MARK_TILT_DEG): Poly[] {
  const { right, up } = screenBasis(tiltDeg);
  const east: Vertex = [1, 0, 0];
  const north: Vertex = [0, 1, 0];
  const polys: Poly[] = [];
  if (scene.bezel) polys.push(...ring(BEZEL_R, right, up));
  if (scene.ticks) polys.push(...[0, 90, 180, 270].map((angle) => tick(angle, right, up)));
  if (scene.orbit) polys.push(...ring(ORBIT_R, east, north));
  if (scene.limb) polys.push(...ring(GLOBE_R, right, up));
  if (scene.meridian) {
    const lon = MERIDIAN_LON_DEG * DEG;
    // A great circle through the poles, turned `MERIDIAN_LON_DEG` out of the
    // plane that faces the camera: at 0° it would project to a bare line.
    const across: Vertex = [Math.cos(lon), Math.sin(lon), 0];
    const pole: Vertex = [0, 0, 1];
    polys.push(...ring(GLOBE_R, across, pole));
  }
  return polys;
}

/** Where the bead sits at a frame, in world units. */
export function beadCentre(scene: TierScene, frame: number, frames: number, tiltDeg = MARK_TILT_DEG): Vertex {
  const step = scene.animated ? frame : 0;
  const angle = (BEAD_PHASE_DEG + (360 * step) / frames) * DEG;
  if (scene.beadOn === 'bezel') {
    const { right, up } = screenBasis(tiltDeg);
    return at(right, up, BEZEL_R * Math.cos(angle), BEZEL_R * Math.sin(angle));
  }
  // The orbit is the world horizontal plane: x towards the reader, y across the screen.
  return [ORBIT_R * Math.cos(angle), ORBIT_R * Math.sin(angle), 0];
}

/** The bead's polygons at a frame. */
export function beadPolygons(scene: TierScene, frame: number, frames: number, tiltDeg = MARK_TILT_DEG): Poly[] {
  return bead(beadCentre(scene, frame, frames, tiltDeg), scene.beadHalf, tiltDeg);
}
