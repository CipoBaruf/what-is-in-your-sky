/**
 * R185 (FR-WIDE-7; PLAN D-1099): the window's highlighted arc's ticks and arrow, and the arc under the pointer — the
 * globe's rule and shapes (`globe/arcs.ts`) through the window's camera. Pure. It sees only the drawn part inside the
 * drawable field (`pathFrom`'s test), so an arc the box clips is neither ticked nor hit there.
 */
import { cutTrack, type ArcState } from '../../../../../lib/arcReveal';
import { interpolateTrack, resampleArc } from '../../../../../lib/skyGeometry';
import { arrowPath, guideTimes, headingOf, ticksPath, type Heading } from '../globe/arcs';
import { arcOf, type ChartPass } from '../SkyChart.types';
import { project, type Mat3, type Projected, type View } from './projection';

/** The heading's half-step either side of a guide, ms: `arcs.ts`'s. */
const HEADING_MS = 5_000;

const shown = (p: Projected, limitDeg: number): boolean => p.front && p.offAxisDeg <= limitDeg && Number.isFinite(p.x) && Number.isFinite(p.y);

/** The highlighted pass's guides as two path strings, for its state at `t` (`now`, else the set: the pass detail's whole arc). */
export function windowGuides(pass: ChartPass, state: ArcState, m: Mat3, view: View, limitDeg: number, t: number | undefined): { ticks: string; arrow: string; count: number } {
  const g = guideTimes(pass, t ?? pass.end.t, state);
  if (g === null) return { ticks: '', arrow: '', count: 0 };
  const at = (ms: number): Projected => {
    const p = interpolateTrack(pass.track, Math.max(g.from, Math.min(g.to, ms)));
    return project(m, p.azDeg, p.elDeg, view);
  };
  const heading = (ms: number): Heading | null => {
    const here = at(ms);
    return shown(here, limitDeg) ? headingOf(here, at(ms - HEADING_MS), at(ms + HEADING_MS)) : null;
  };
  const ticks = g.ticks.map(heading).filter((h): h is Heading => h !== null);
  return { ticks: ticksPath(ticks), arrow: arrowPath(g.arrow === null ? null : heading(g.arrow)), count: ticks.length };
}

/** Each drawn pass's visible runs as flat `[x0, y0, x1, y1, …]`, the line `PassArc` draws, for `nearestPass`. */
export function drawnRuns(passes: readonly ChartPass[], m: Mat3, view: View, limitDeg: number, now: number | undefined, stepDeg: number): Map<string, number[][]> {
  const out = new Map<string, number[][]>();
  for (const pass of passes) {
    const state = arcOf(pass);
    if (state === 'hidden') continue;
    const track = state === 'live' ? cutTrack(pass, now ?? pass.end.t) : pass.track;
    const runs: number[][] = [];
    let run: number[] = [];
    for (const point of resampleArc(track, stepDeg)) {
      const p = project(m, point.azDeg, point.elDeg, view);
      if (shown(p, limitDeg)) run.push(p.x, p.y);
      else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
    out.set(pass.id, runs);
  }
  return out;
}
