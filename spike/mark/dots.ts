/**
 * R74 revisit (FR-MARK-4 d/e, FR-MARK-6 as amended v2.0.1, D-460): the mark as
 * dots on a pixel grid — the second rasterisation of `scene.ts`.
 *
 * The braille tiers are one rasterisation of the scene: glyphcss strokes the
 * polygons' edges into a grid of braille dots the `<pre>` can carry. A PNG has
 * no braille cell and no font, so it does not need that grid; what it needs is
 * a whole number of pixels a dot, and a stroke that never passes through a
 * text engine. This module draws the same polygons the same way — every edge
 * sampled, the dot each sample falls in inked — onto an `N × N` grid the file
 * carries at an integer pitch. No glyphcss, no font, no browser: the output is
 * a function of the scene's constants alone, and therefore the same bytes on
 * every machine, which is what lets `tests/build/mark-icons.test.ts` pin the
 * files by bytes.
 *
 * Geometry: the drawing's centre is the grid's centre and the bezel's radius
 * is `(N − 1) / 2` dots, so the outermost dots of the ring sit on the grid's
 * first and last rows and columns (the ladder's `FILL = 1`). The projection is
 * the page's: a point's screen coordinates are its components along
 * `screenBasis(tilt)`, rows growing downwards.
 *
 * The bead is a filled square of whole dots, snapped, and the body is cleared
 * for one dot around it before the bead is placed: at 16 px the difference
 * between "ring with a bead on it" and "ring" is the gap, not the colour.
 */

import type { MarkTier } from '../../src/ui/components/mark/tiers';
import { BEAD_R, beadCentre, bodyPolygons, MARK_TILT_DEG, screenBasis, TIER_SCENES, type Poly, type Vertex } from './scene';

/** One dot of the grid, as `[row, col]`. */
export type Dot = [row: number, col: number];

/** A tier's scene drawn on `dots × dots`: the body's dots and the bead's, disjoint by construction. */
export interface DotRaster {
  dots: number;
  body: Dot[];
  bead: Dot[];
}

/** How finely a stroke is sampled, in dots: a tenth is well under the size of the smallest feature. */
const SAMPLE_STEP = 0.1;

/** The clearance around the bead, in dots. */
export const BEAD_CLEARANCE = 1;

const key = (row: number, col: number): number => row * 65_536 + col;

interface Point {
  x: number;
  y: number;
}

/** A point's place on the grid, in continuous dot coordinates: `x` grows right, `y` grows down. */
function project(p: Vertex, scale: number, centre: number, tiltDeg: number): Point {
  const { right, up } = screenBasis(tiltDeg);
  const sx = p[0] * right[0] + p[1] * right[1] + p[2] * right[2];
  const sy = p[0] * up[0] + p[1] * up[1] + p[2] * up[2];
  return { x: centre + sx * scale, y: centre - sy * scale };
}

const mid = (a: Vertex, b: Vertex): Vertex => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const dist = (a: Vertex, b: Vertex): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * The centreline of a ribbon quad. `scene.ts` draws every stroke as a ribbon
 * `2 × STROKE` wide — a quad whose two short edges are the rungs and whose two
 * long edges run along the stroke — so the stroke itself is the segment
 * joining the rungs' midpoints. glyphcss strokes all four edges and the braille
 * dot swallows the difference; a pixel grid at 48 dots does not, so the file
 * is drawn from the centreline and every line is one dot wide.
 */
function centreline(poly: Poly): [Vertex, Vertex] {
  const [v0, v1, v2, v3] = poly.vertices;
  if (!v0 || !v1 || !v2 || !v3) throw new Error('a ribbon quad has four vertices');
  // Either v0v1 and v2v3 are the rungs, or v1v2 and v3v0 are: the shorter pair.
  return dist(v0, v1) + dist(v2, v3) <= dist(v1, v2) + dist(v3, v0) ? [mid(v0, v1), mid(v3, v2)] : [mid(v3, v0), mid(v1, v2)];
}

const same = (a: Vertex, b: Vertex): boolean => dist(a, b) < 1e-9;

/** The polygons chained into strokes: consecutive quads whose centrelines meet end to end are one polyline. */
function strokes(polys: Poly[]): Vertex[][] {
  const paths: Vertex[][] = [];
  let current: Vertex[] = [];
  for (const poly of polys) {
    const [from, to] = centreline(poly);
    const last = current[current.length - 1];
    if (last === undefined || !same(last, from)) {
      if (current.length > 1) paths.push(current);
      current = [from];
    }
    current.push(to);
  }
  if (current.length > 1) paths.push(current);
  return paths;
}

/**
 * The dots a polyline passes through, one dot wide. Each segment is sampled
 * and the dot each sample falls in taken in order; then a dot the path only
 * clips the corner of — an `L` whose two neighbours already touch diagonally —
 * is dropped, which is what keeps a circle at 16 dots the minimal 8-connected
 * ring rather than a ring with a second dot at every diagonal.
 */
function strokePath(path: Vertex[], scale: number, centre: number, tiltDeg: number): Dot[] {
  const points = path.map((v) => project(v, scale, centre, tiltDeg));
  const seq: Dot[] = [];
  const push = (row: number, col: number): void => {
    const last = seq[seq.length - 1];
    if (last && last[0] === row && last[1] === col) return;
    seq.push([row, col]);
  };
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE_STEP));
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const t = s / steps;
      push(Math.floor(a.y + (b.y - a.y) * t), Math.floor(a.x + (b.x - a.x) * t));
    }
  }
  // Thinning: walk the sequence and drop the corner of every orthogonal L whose ends are diagonal neighbours.
  const thinned: Dot[] = [];
  for (const dot of seq) {
    const b = thinned[thinned.length - 1];
    const a = thinned[thinned.length - 2];
    if (a && b) {
      const ab = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
      const bc = Math.abs(b[0] - dot[0]) + Math.abs(b[1] - dot[1]);
      const ac = Math.max(Math.abs(a[0] - dot[0]), Math.abs(a[1] - dot[1]));
      if (ab === 1 && bc === 1 && ac === 1 && (a[0] !== dot[0] && a[1] !== dot[1])) thinned.pop();
    }
    thinned.push(dot);
  }
  return thinned;
}

/** The bead's side in dots at this grid: at least two, so it is a square and never a lone pixel. */
export function beadSide(dots: number): number {
  const radius = (dots - 1) / 2;
  return Math.max(2, Math.round(2 * BEAD_R * radius));
}

/**
 * The scene of a tier, drawn on `dots × dots`. The construction is the tier's
 * (`TIER_SCENES`), the frame is 0 — a file never steps (D-458) — and the bead
 * is where `beadCentre` puts it, snapped to whole dots.
 */
export function renderDots(tier: MarkTier, dots: number, tiltDeg = MARK_TILT_DEG): DotRaster {
  if (!Number.isInteger(dots) || dots < 4) throw new Error(`a dot grid must be a whole number of at least 4 dots, not ${String(dots)}`);
  const scene = TIER_SCENES[tier];
  const radius = (dots - 1) / 2;
  const centre = dots / 2;
  const inked = new Set<number>();
  for (const path of strokes(bodyPolygons(scene, tiltDeg))) {
    for (const [row, col] of strokePath(path, radius, centre, tiltDeg)) {
      if (row >= 0 && row < dots && col >= 0 && col < dots) inked.add(key(row, col));
    }
  }

  // The bead: a square of whole dots, its top-left corner rounded from the
  // projected centre, kept inside the grid.
  const side = beadSide(dots);
  const at = project(beadCentre(scene, 0, 1, tiltDeg), radius, centre, tiltDeg);
  const clamp = (v: number): number => Math.min(dots - side, Math.max(0, Math.round(v - side / 2)));
  const top = clamp(at.y);
  const left = clamp(at.x);
  const bead: Dot[] = [];
  for (let row = top; row < top + side; row++) for (let col = left; col < left + side; col++) bead.push([row, col]);

  // The clearance: every body dot within `BEAD_CLEARANCE` of the square goes.
  for (let row = top - BEAD_CLEARANCE; row < top + side + BEAD_CLEARANCE; row++) {
    for (let col = left - BEAD_CLEARANCE; col < left + side + BEAD_CLEARANCE; col++) inked.delete(key(row, col));
  }

  const body: Dot[] = [...inked].sort((a, b) => a - b).map((k) => [Math.floor(k / 65_536), k % 65_536]);
  return { dots, body, bead };
}

/** The raster as text, one character a dot — for `--dry-run` and for a test's failure message. */
export function dotsToText(raster: DotRaster, ink = '#', bead = '@', blank = '.'): string {
  const grid = Array.from({ length: raster.dots }, () => Array.from({ length: raster.dots }, () => blank));
  const put = (row: number, col: number, glyph: string): void => {
    const line = grid[row];
    if (line && col >= 0 && col < line.length) line[col] = glyph;
  };
  for (const [row, col] of raster.body) put(row, col, ink);
  for (const [row, col] of raster.bead) put(row, col, bead);
  return grid.map((line) => line.join('')).join('\n');
}
