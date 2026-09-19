import { COMPASS_POINTS, type CompassPoint } from '../../../../../lib/compass';
import type { LegendColor } from '../../../../../lib/legend';
import { interpolateTrack } from '../../../../../lib/skyGeometry';
import type { Pass } from '../../../../../model';
import { scaleFor, type View } from './projection';

/**
 * R79 (FR-GUT-1..6, US-28; PLAN D-450): the compass gutter's geometry, pure.
 *
 * The gutter is the sky screen's bottom edge: the 180° of azimuth the reader
 * stands in, centred on the facing, laid linearly across the screen's width
 * (FR-GUT-2). On it the eight 45° compass names, a bracket for the field the
 * drawing shows (FR-GUT-3), a tick per drawn pass at its bearing (FR-GUT-4),
 * and, for a pass off the band, a marker at the nearer end with the angle to
 * turn (FR-GUT-5). Everything here is a function of numbers the drawing
 * already has — the facing the readout shows, the measured box and
 * `WINDOW_FOV` through `projection.ts`'s own scale — so the band is the same
 * function of the facing the projection is and moves with it, never in steps.
 *
 * The band runs west to east left to right, as the drawing does: a bearing
 * clockwise of the facing is right of centre (`projection.ts` puts east on
 * the reader's right in every pose, FR-FSC-10), so the tick and the arc are on
 * the same side.
 */

/** FR-GUT-2: the band's half span in degrees — the half of the horizon a turn of the head reaches. */
export const GUTTER_HALF_SPAN_DEG = 90;

/** FR-GUT-1: the gutter's height in px — a 24 px text row for the names and 4 px of tick above it. `--gutter` in `tokens.css`. */
export const GUTTER_PX = 28;

const RAD = Math.PI / 180;

/**
 * The signed difference `bearing − facing`, the shorter way round, in
 * (−180, 180]. The `+ 540` is `+ 180` to move the zero and `+ 360` to keep the
 * dividend positive, since JavaScript's `%` keeps the sign of the dividend; a
 * point exactly behind resolves to `+180` and never `−180`, so it cannot flip
 * ends from one frame to the next.
 */
export function wrapDeg(deg: number): number {
  const d = ((((deg + 540) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** FR-GUT-2: where a bearing falls across the band, `width × (wrap(bearing − facing) + 90) / 180`; off the band it is off `[0, width]`. */
export function gutterX(bearingDeg: number, facingDeg: number, widthPx: number): number {
  return (widthPx * (wrapDeg(bearingDeg - facingDeg) + GUTTER_HALF_SPAN_DEG)) / (2 * GUTTER_HALF_SPAN_DEG);
}

/**
 * FR-GUT-3: half the horizontal field the projection draws in this box, in
 * degrees — `verticalHalfFieldDeg`'s twin across the width, from the same
 * `scaleFor`, so it is `WINDOW_FOV / 2` upright and wider sideways, and no
 * constant of its own.
 */
export function horizontalHalfFieldDeg(view: View): number {
  return (2 * Math.atan(view.width / 2 / scaleFor(view))) / RAD;
}

/**
 * FR-GUT-3: the bracket's half width in degrees, and its two ends across the
 * band. The bracket is centred on the facing and the band is too, so its ends
 * are the same pixels whatever the facing is; only the box moves them. A box
 * whose field is wider than the band gets the whole band: the half width stops
 * at the band's half span, so nothing in the bracket has an `x` off the band.
 */
export function bracketFor(view: View): { halfDeg: number; x0: number; x1: number } {
  const halfDeg = Math.min(horizontalHalfFieldDeg(view), GUTTER_HALF_SPAN_DEG);
  const at = (d: number): number => (view.width * (d + GUTTER_HALF_SPAN_DEG)) / (2 * GUTTER_HALF_SPAN_DEG);
  return { halfDeg, x0: at(-halfDeg), x1: at(halfDeg) };
}

/** FR-GUT-2: the eight 45° names that fall on the band, with their `x`. */
export function bandNames(facingDeg: number, widthPx: number): { name: CompassPoint; x: number }[] {
  const out: { name: CompassPoint; x: number }[] = [];
  COMPASS_POINTS.forEach((name, index) => {
    if (index % 2 !== 0) return;
    const bearing = index * 22.5;
    if (Math.abs(wrapDeg(bearing - facingDeg)) <= GUTTER_HALF_SPAN_DEG) out.push({ name, x: gutterX(bearing, facingDeg, widthPx) });
  });
  return out;
}

/**
 * FR-GUT-4: where a pass is on the gutter — the satellite's azimuth at the
 * shown instant while it is up, and its rise azimuth otherwise (where to look
 * next). Read from the pass's own track, the one the arc is drawn from
 * (FR-LIVE-10), so the tick and the arc cannot disagree.
 */
export function passBearing(pass: Pick<Pass, 'start' | 'end' | 'track'>, now: number | undefined): number {
  if (now !== undefined && now >= pass.start.t && now <= pass.end.t && pass.track.length > 0) return interpolateTrack(pass.track, now).azDeg;
  return pass.start.azDeg;
}

/** A pass as the gutter needs it: its bearing, its legend key and its series colour. */
export interface GutterPass {
  id: string;
  name: string;
  key: string;
  color: LegendColor;
  bearingDeg: number;
}

/** FR-GUT-4 / FR-GUT-5: which of the four places a pass takes on the gutter. */
export type GutterBranch = 'in-bracket' | 'on-band' | 'off-left' | 'off-right';

export interface GutterMark {
  id: string;
  name: string;
  key: string;
  color: LegendColor;
  branch: GutterBranch;
  /** Across the band, px; on the band only. */
  x: number | null;
  /** FR-GUT-5: the whole degrees to turn, the shorter way (the readout's rounding); off the band only. */
  angleDeg: number | null;
  /** The turn to the pass from the facing on every branch — the side and the whole degrees — for the gutter's words. */
  turn: { side: 'left' | 'right'; angleDeg: number };
}

/**
 * FR-GUT-4, FR-GUT-5: one mark per pass, in the order given (the legend's).
 * In this order, with no overlap: within the bracket's half field is
 * `in-bracket`; within the band's half span is `on-band`; beyond it the side
 * is the sign of the shorter turn. Both boundaries are inclusive: a pass
 * exactly on the bracket's edge is being drawn, and exactly 180° behind turns
 * right (`wrapDeg` resolves the tie to `+180`).
 */
export function gutterMarks(passes: readonly GutterPass[], facingDeg: number, view: View): GutterMark[] {
  const { halfDeg } = bracketFor(view);
  return passes.map((pass) => {
    const d = wrapDeg(pass.bearingDeg - facingDeg);
    const base = { id: pass.id, name: pass.name, key: pass.key, color: pass.color, turn: turnTo(pass.bearingDeg, facingDeg) };
    if (Math.abs(d) <= halfDeg) return { ...base, branch: 'in-bracket', x: gutterX(pass.bearingDeg, facingDeg, view.width), angleDeg: null };
    if (Math.abs(d) <= GUTTER_HALF_SPAN_DEG) return { ...base, branch: 'on-band', x: gutterX(pass.bearingDeg, facingDeg, view.width), angleDeg: null };
    return { ...base, branch: d < 0 ? 'off-left' : 'off-right', x: null, angleDeg: Math.round(Math.abs(d)) };
  });
}

/**
 * FR-GUT-5: the markers at one end, stacked outward-in — the nearest angle
 * first, then legend order (the order `marks` came in) where two are level.
 */
export function edgeMarkers(marks: readonly GutterMark[], side: 'off-left' | 'off-right'): GutterMark[] {
  return marks
    .map((mark, order) => ({ mark, order }))
    .filter(({ mark }) => mark.branch === side)
    .sort((a, b) => (a.mark.angleDeg ?? 0) - (b.mark.angleDeg ?? 0) || a.order - b.order)
    .map(({ mark }) => mark);
}

/** FR-GUT-6: which way and how far to turn to a bearing, the shorter way, in whole degrees. */
export function turnTo(bearingDeg: number, facingDeg: number): { side: 'left' | 'right'; angleDeg: number } {
  const d = wrapDeg(bearingDeg - facingDeg);
  return { side: d < 0 ? 'left' : 'right', angleDeg: Math.round(Math.abs(d)) };
}
