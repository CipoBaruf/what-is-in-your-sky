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

/** FR-WIDE-3: every pass drawn at `t`, in `passes` order; a hidden one (FR-TRAJ-1) is left out, its series kept by its index. */
export function globeArcs(sky: GlobeSky, passes: readonly Pass[], t: number): GlobeArc[] {
  const arcs: GlobeArc[] = [];
  passes.forEach((pass, index) => {
    const state = arcState(pass, t);
    if (state === 'hidden' || pass.track.length === 0) return;
    const drawn = state === 'live' ? cutTrack(pass, t) : pass.track;
    const points = drawn.map((p) => dirOf(sky, p));
    arcs.push({
      id: pass.id,
      series: (index % SERIES_COUNT) + 1,
      state,
      points,
      marker: state === 'live' ? (points[points.length - 1] ?? null) : null,
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
export function arcGuides(sky: GlobeSky, pass: Pass, t: number): ArcGuides {
  const state = arcState(pass, t);
  if (state === 'hidden' || pass.track.length === 0) return { ticks: [], arrow: null };
  const from = pass.start.t;
  const to = state === 'live' ? t : pass.end.t;
  const step = ARC_TICK_MIN * 60_000;
  const ticks: ArcMark[] = [];
  for (let at = from + step; at < to; at += step) ticks.push(markAt(sky, pass, from, to, at));
  const arrowAt = state === 'live' ? t : from + ARC_ARROW_SHARE * (to - from);
  return { ticks, arrow: to > from ? markAt(sky, pass, from, to, arrowAt) : null };
}
