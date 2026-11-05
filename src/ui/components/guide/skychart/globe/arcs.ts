import { arcState, cutTrack, type ArcState } from '../../../../../lib/arcReveal';
import { SERIES_COUNT } from '../../../../../lib/legend';
import { interpolateTrack } from '../../../../../lib/skyGeometry';
import type { Pass, PassPoint } from '../../../../../model';
import { ARC_ARROW_SHARE, ARC_TICK_MIN } from './constants';
import { add, scale, type Vec3 } from './projection';
import type { GlobeSky } from './scene';

/**
 * R184 (FR-WIDE-3, FR-WIDE-7, FR-TRAJ-1; PLAN D-1099): the passes on the globe as J2000 geometry. Each track point's
 * azimuth and altitude become a direction at the shown place through `scene.ts`'s local frame (`altAz` read
 * backwards); FR-TRAJ-1's state comes from `lib/arcReveal.ts`; the highlighted pass's minute ticks and its arrow are
 * points with a heading. Pure and clock-free; the near side and the pixels are the renderer's.
 */

const RAD = Math.PI / 180;
/** The heading's half-step either side of a tick or the arrow, ms: two samples of the 10 s track. */
const HEADING_MS = 5_000;

/** A pass drawn on the globe at `t`: its series (1..`SERIES_COUNT`, by `passes` order as FR-LIVE-2's palette takes it), its state, the drawn part, the marker while up, the rise point while ahead. */
export interface GlobeArc {
  id: string;
  series: number;
  state: Exclude<ArcState, 'hidden'>;
  points: Vec3[];
  marker: Vec3 | null;
  rise: Vec3 | null;
}

/** A point on an arc with the directions a moment before and after it, so the renderer can turn the line's heading into pixels. */
export interface ArcMark {
  at: Vec3;
  back: Vec3;
  ahead: Vec3;
}

/** The highlighted arc's guides (FR-WIDE-7): a tick at every whole `ARC_TICK_MIN` of the drawn part, and the arrow. */
export interface ArcGuides {
  ticks: ArcMark[];
  arrow: ArcMark | null;
}

/** A sky direction at the shown place: azimuth from north through east, altitude, degrees — `altAz`'s inverse. */
export function horizonDir(sky: GlobeSky, azDeg: number, altDeg: number): Vec3 {
  const ca = Math.cos(altDeg * RAD);
  return add(add(scale(sky.north, ca * Math.cos(azDeg * RAD)), scale(sky.east, ca * Math.sin(azDeg * RAD))), scale(sky.zenith, Math.sin(altDeg * RAD)));
}

const dirOf = (sky: GlobeSky, p: PassPoint): Vec3 => horizonDir(sky, p.azDeg, p.elDeg);

/**
 * FR-WIDE-3: every pass drawn at `t`, in `passes` order; a hidden one (FR-TRAJ-1) is left out, its series kept by its
 * index.
 *
 * v2.14.1 (FR-WIDE-3 as amended, D-1137): with `whole` — the pass page — the polyline is the pass's whole track at
 * every `t`, as the dome drew it: up, ahead, gone or an hour later. Its state is `live` while the pass is up, with the
 * marker at its place at `t` on the drawn path, and `full` otherwise (drawn solid in its colour, no rise dot).
 */
export function globeArcs(sky: GlobeSky, passes: readonly Pass[], t: number, whole = false): GlobeArc[] {
  const arcs: GlobeArc[] = [];
  passes.forEach((pass, index) => {
    const reveal = arcState(pass, t);
    const state = whole ? (reveal === 'live' ? 'live' : 'full') : reveal;
    if (state === 'hidden' || pass.track.length === 0) return;
    const drawn = whole || state !== 'live' ? pass.track : cutTrack(pass, t);
    const points = drawn.map((p) => dirOf(sky, p));
    const marker = state !== 'live' ? null : whole ? dirOf(sky, interpolateTrack(pass.track, t)) : (points[points.length - 1] ?? null);
    arcs.push({
      id: pass.id,
      series: (index % SERIES_COUNT) + 1,
      state,
      points,
      marker,
      rise: state === 'ahead' ? (points[0] ?? null) : null,
    });
  });
  return arcs;
}

function markAt(sky: GlobeSky, pass: Pass, from: number, to: number, time: number): ArcMark {
  const at = (ms: number): Vec3 => dirOf(sky, interpolateTrack(pass.track, Math.max(from, Math.min(to, ms))));
  return { at: at(time), back: at(time - HEADING_MS), ahead: at(time + HEADING_MS) };
}

/**
 * FR-WIDE-7: the highlighted pass's ticks and arrow at `t`. The drawn part runs from the rise to `t` while the pass is
 * up and over the whole track otherwise; a tick stands at every whole `ARC_TICK_MIN` after the rise inside it, the
 * arrow at the marker while up and at `ARC_ARROW_SHARE` of the drawn part's time otherwise. A pass not drawn has none.
 */
export function arcGuides(sky: GlobeSky, pass: Pass, t: number, whole = false): ArcGuides {
  const g = guideTimes(pass, t, arcState(pass, t), whole);
  if (g === null) return { ticks: [], arrow: null };
  return { ticks: g.ticks.map((at) => markAt(sky, pass, g.from, g.to, at)), arrow: g.arrow === null ? null : markAt(sky, pass, g.from, g.to, g.arrow) };
}

/** FR-WIDE-7 as instants: the drawn part `[from, to]`, the ticks' and the arrow's times; `null` for a pass not drawn. The window reads these too (R185). */
export interface GuideTimes {
  from: number;
  to: number;
  ticks: number[];
  arrow: number | null;
}

/**
 * `arcGuides`'s rule, in time: the window projects these through its own camera, with the page's arc state (R185).
 * D-1137: with `whole` the drawn part is the whole track at every state, so the ticks cover it all; the arrow is at
 * `t` while the pass is up, as the marker is.
 */
export function guideTimes(pass: Pass, t: number, state: ArcState = arcState(pass, t), whole = false): GuideTimes | null {
  if ((state === 'hidden' && !whole) || pass.track.length === 0) return null;
  const from = pass.start.t;
  const to = state === 'live' && !whole ? t : pass.end.t;
  const step = ARC_TICK_MIN * 60_000;
  const ticks: number[] = [];
  for (let at = from + step; at < to; at += step) ticks.push(at);
  return { from, to, ticks, arrow: to > from ? (state === 'live' ? t : from + ARC_ARROW_SHARE * (to - from)) : null };
}

/* R185 (FR-WIDE-7): the guides' shapes and the arc's hit test in px, the globe's and the window's alike. */

/** A guide's place in px with its unit heading along the travel. */
export interface Heading {
  x: number;
  y: number;
  hx: number;
  hy: number;
}

/** The heading at `at` from the points a moment before and after it, or `null` where they coincide. */
export function headingOf(at: { x: number; y: number }, back: { x: number; y: number }, ahead: { x: number; y: number }): Heading | null {
  const len = Math.hypot(ahead.x - back.x, ahead.y - back.y);
  return len > 0 ? { x: at.x, y: at.y, hx: (ahead.x - back.x) / len, hy: (ahead.y - back.y) / len } : null;
}

/** Half a tick across the line, and the arrow's length and half-width, px. */
const TICK_HALF = 4;
const ARROW_LEN = 9;
const ARROW_HALF = 4.5;
const fmt = (n: number): string => n.toFixed(1);

/** The ticks as one path: each `2 × TICK_HALF` across the heading, centred on the line. */
export const ticksPath = (ticks: readonly Heading[]): string =>
  ticks.map((h) => `M${fmt(h.x - h.hy * TICK_HALF)} ${fmt(h.y + h.hx * TICK_HALF)}L${fmt(h.x + h.hy * TICK_HALF)} ${fmt(h.y - h.hx * TICK_HALF)}`).join('');

/** The arrowhead as one closed path, its tip `ARROW_LEN` ahead of the point along the heading; `''` for none. */
export const arrowPath = (a: Heading | null): string =>
  a ? `M${fmt(a.x + a.hx * ARROW_LEN)} ${fmt(a.y + a.hy * ARROW_LEN)}L${fmt(a.x - a.hy * ARROW_HALF)} ${fmt(a.y + a.hx * ARROW_HALF)}L${fmt(a.x + a.hy * ARROW_HALF)} ${fmt(a.y - a.hx * ARROW_HALF)}Z` : '';

/** FR-WIDE-7: an arc is under the pointer within this distance of its drawn line, px. */
const ARC_HIT_PX = 8;

function segmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const k = len > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - x1 - k * dx, py - y1 - k * dy);
}

/** The pass whose drawn line is nearest (`x`, `y`) within `ARC_HIT_PX`, or `null`; each pass is its runs, flat `[x0, y0, x1, y1, …]`. */
export function nearestPass(drawn: Iterable<readonly [string, readonly (readonly number[])[]]>, x: number, y: number): string | null {
  let best: string | null = null;
  let bestD = ARC_HIT_PX;
  for (const [id, runs] of drawn) {
    for (const run of runs) {
      for (let k = 0; k + 1 < run.length; k += 2) {
        const x1 = run[k] ?? 0;
        const y1 = run[k + 1] ?? 0;
        const dist = k + 3 < run.length ? segmentDistance(x, y, x1, y1, run[k + 2] ?? 0, run[k + 3] ?? 0) : Math.hypot(x - x1, y - y1);
        if (dist <= bestD) {
          bestD = dist;
          best = id;
        }
      }
    }
  }
  return best;
}
