/**
 * R111 (FR-STAR-6, FR-STAR-9): one frame of the stars field, as numbers. Both
 * render paths draw from this — React through its render, the ref path by
 * writing the same numbers to nodes that exist once — so the measured
 * difference between them is the render path and nothing else.
 */
import { drawableDeg, project, type Mat3, type View } from '../../src/ui/components/guide/skychart/window/projection';
import type { Catalog } from './catalogData';
import { collide, glyphFor, type AltAz, type PlanetAt } from './sky';

export interface Point {
  x: number;
  y: number;
  show: boolean;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  show: boolean;
}

export interface Frame {
  stars: Point[];
  planets: Point[];
  segments: Segment[];
  /** One per entry of `labelsFor`'s list, in that order. */
  labels: Point[];
  horizon: string;
}

export interface Label {
  text: string;
  /** A star index, or a figure's segment list to take the centroid of. */
  star: number | null;
  figure: number | null;
}

/** The names layer: every star at V ≤ 1.5 with a proper name, then each figure's name. */
export function labelsFor(catalog: Catalog): Label[] {
  const stars = catalog.stars.flatMap((s, i) => (s.v <= 1.5 && s.name !== '' ? [{ text: s.name, star: i, figure: null }] : []));
  const figures = catalog.figures.map((f, i) => ({ text: f.id.replace(/\d$/, ''), star: null, figure: i }));
  return [...stars, ...figures];
}

const LABEL_ADVANCE = 0.6;

export function computeFrame(
  catalog: Catalog,
  stars: readonly AltAz[],
  planets: readonly PlanetAt[],
  labels: readonly Label[],
  rotation: Mat3,
  view: View,
  options: { mag: number; small: number; collide: number; layers: readonly string[] },
): Frame {
  const limit = drawableDeg(view);
  const place = (p: AltAz): Point => {
    if (p.altDeg < 0) return { x: 0, y: 0, show: false };
    const q = project(rotation, p.azDeg, p.altDeg, view);
    const show = q.front && q.offAxisDeg <= limit && q.x >= 0 && q.x <= view.width && q.y >= 0 && q.y <= view.height;
    return { x: q.x, y: q.y, show };
  };

  const starsOn = options.layers.includes('stars');
  const raw = stars.map((p, i) => ((catalog.stars[i]?.v ?? 99) <= options.mag && starsOn ? place(p) : { x: 0, y: 0, show: false }));
  const planetPoints = planets.map((p) => (options.layers.includes('planets') ? place(p) : { x: 0, y: 0, show: false }));
  // Planets first in the collision walk: a planet is never the one dropped beside a star.
  const kept = collide([...planetPoints, ...raw].map((p) => (p.show ? p : null)), options.collide * options.small);
  const starPoints = raw.map((p, i) => ({ ...p, show: p.show && (kept[planetPoints.length + i] ?? false) }));

  // A segment is drawn when both ends are up and in front; the field's edge clips it (the SVG does).
  const ends = stars.map((p) => {
    if (p.altDeg < -10) return null;
    const q = project(rotation, p.azDeg, p.altDeg, view);
    return q.front && q.offAxisDeg <= limit + 15 ? q : null;
  });
  const figuresOn = options.layers.includes('figures');
  const segments: Segment[] = [];
  for (const figure of catalog.figures) {
    for (const [a, b] of figure.segments) {
      const p = ends[a];
      const q = ends[b];
      const up = (stars[a]?.altDeg ?? -1) >= 0 && (stars[b]?.altDeg ?? -1) >= 0;
      segments.push(p && q && up && figuresOn ? { x1: p.x, y1: p.y, x2: q.x, y2: q.y, show: true } : { x1: 0, y1: 0, x2: 0, y2: 0, show: false });
    }
  }

  // Labels: anchored, then dropped where they would overlap one already placed.
  const namesOn = options.layers.includes('names');
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const labelPoints = labels.map((label) => {
    if (!namesOn) return { x: 0, y: 0, show: false };
    let anchor: Point | null = null;
    if (label.star !== null) {
      const p = starPoints[label.star];
      anchor = p?.show ? { x: p.x + options.small * 0.8, y: p.y, show: true } : null;
    } else if (label.figure !== null && figuresOn) {
      const figure = catalog.figures[label.figure];
      const drawn = (figure?.segments ?? []).map(([a]) => starPoints[a]).filter((p): p is Point => p?.show === true);
      if (drawn.length >= 2) anchor = { x: drawn.reduce((s, p) => s + p.x, 0) / drawn.length, y: drawn.reduce((s, p) => s + p.y, 0) / drawn.length, show: true };
    }
    if (!anchor) return { x: 0, y: 0, show: false };
    const box = { x: anchor.x, y: anchor.y - options.small / 2, w: label.text.length * options.small * LABEL_ADVANCE, h: options.small };
    if (boxes.some((b) => box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h)) return { x: 0, y: 0, show: false };
    boxes.push(box);
    return anchor;
  });

  // The horizon, broken where it leaves the field.
  let horizon = '';
  let pen = false;
  for (let az = 0; az <= 360; az += 3) {
    const q = project(rotation, az, 0, view);
    if (q.front && q.offAxisDeg <= limit + 10) {
      horizon += `${pen ? 'L' : 'M'}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
      pen = true;
    } else pen = false;
  }

  return { stars: starPoints, planets: planetPoints, segments, labels: labelPoints, horizon };
}

export interface Rung {
  char: string;
  px: number;
  tone: string;
  /** The shift that puts the glyph's ink centre on the point, px; zero unless `inkfix`. */
  dx: number;
  dy: number;
}

/** Where a glyph's ink centre sits relative to the point FR-STAR-6 centres its em box on, px (positive: right, below). */
export type InkOffset = (char: string, px: number) => { x: number; y: number };

/** The ladder's glyph, size and ink shift for each catalogue star, computed once. */
export function ladderFor(catalog: Catalog, big: number, small: number, dot: 'period' | 'middle', ink: InkOffset | null): Rung[] {
  return catalog.stars.map((s) => {
    const g = glyphFor(s.v);
    const char = g.char === '.' && dot === 'middle' ? '·' : g.char;
    const px = g.size === 'big' ? big : small;
    const off = ink ? ink(char, px) : { x: 0, y: 0 };
    return { char, px, tone: g.tone, dx: -off.x, dy: -off.y };
  });
}
