/**
 * R38 (FR-WIN-1, FR-WIN-2): the window drawing of the spike — SVG, one
 * `<path>` per line, recomputed on every rotation. The horizon with the
 * compass names, the 30° and 60° altitude lines and the zenith mark, azimuth
 * ticks every 30°, and the fixture passes as arcs with rise, peak and end
 * markers, the arrowhead and a one-character key at the peak (FR-LEG-1).
 *
 * The Sun glow and the Moon (FR-DOME-6) are not drawn: nothing the spike has
 * to decide depends on them.
 */
import { useMemo } from 'react';
import type { Pass } from '../../src/model';
import { drawableDeg, greatCircle, project, type Mat3, type Projected, type View } from './projection';

interface SkyPoint {
  azDeg: number;
  elDeg: number;
}

/** Sample a line of constant altitude all the way round. */
const ring = (elDeg: number, stepDeg: number): SkyPoint[] => {
  const out: SkyPoint[] = [];
  for (let az = 0; az <= 360; az += stepDeg) out.push({ azDeg: az % 360, elDeg });
  return out;
};

/** The track resampled along great circles every 2°, so three points draw as an arc. */
const arcOf = (pass: Pass): SkyPoint[] => {
  const out: SkyPoint[] = [];
  for (let i = 1; i < pass.track.length; i += 1) {
    const from = pass.track[i - 1];
    const to = pass.track[i];
    if (!from || !to) continue;
    const seg = greatCircle(from, to, 2);
    out.push(...(i === 1 ? seg : seg.slice(1)));
  }
  return out;
};

const COMPASS: readonly { azDeg: number; name: string; major: boolean }[] = [
  { azDeg: 0, name: 'N', major: true },
  { azDeg: 45, name: 'NE', major: false },
  { azDeg: 90, name: 'E', major: true },
  { azDeg: 135, name: 'SE', major: false },
  { azDeg: 180, name: 'S', major: true },
  { azDeg: 225, name: 'SW', major: false },
  { azDeg: 270, name: 'W', major: true },
  { azDeg: 315, name: 'NW', major: false },
];

const SERIES = ['#7cc4ff', '#ffb86b', '#b8f07c', '#f28cd1', '#9fa8ff', '#ffe27c'];

/** `M … L …`, broken wherever a point is out of the drawable field, so an arc leaves the frame instead of snapping across it. */
function pathFrom(points: readonly Projected[], limitDeg: number): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    const ok = p.front && p.offAxisDeg <= limitDeg && Number.isFinite(p.x) && Number.isFinite(p.y);
    if (!ok) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    pen = true;
  }
  return d;
}

const inFrame = (p: Projected, view: View, margin = 14): boolean => p.front && p.x >= -margin && p.x <= view.width + margin && p.y >= -margin && p.y <= view.height + margin;

export interface SkyWindowProps {
  m: Mat3;
  view: View;
  /** The fixture pass first, then the dim companions. */
  passes: readonly Pass[];
  /** The instant drawn as "now" on the fixture pass, as a fraction 0–1 of its length; the live marker sits there. */
  nowFraction: number;
}

export function SkyWindow({ m, view, passes, nowFraction }: SkyWindowProps) {
  const limit = drawableDeg(view);
  const horizon = useMemo(() => ring(0, 2), []);
  const alt30 = useMemo(() => ring(30, 3), []);
  const alt60 = useMemo(() => ring(60, 4), []);
  const arcs = useMemo(() => passes.map(arcOf), [passes]);

  const at = (p: SkyPoint): Projected => project(m, p.azDeg, p.elDeg, view);
  const zenith = at({ azDeg: 0, elDeg: 90 });
  const ticks: { a: Projected; b: Projected }[] = [];
  for (let az = 0; az < 360; az += 30) ticks.push({ a: at({ azDeg: az, elDeg: 0 }), b: at({ azDeg: az, elDeg: 2 }) });

  return (
    <svg className="window" width={view.width} height={view.height} viewBox={`0 0 ${String(view.width)} ${String(view.height)}`} role="img" aria-label="sky window">
      <rect width={view.width} height={view.height} className="window-ground" />
      <g className="window-grid">
        <path d={pathFrom(alt60.map(at), limit)} className="alt" />
        <path d={pathFrom(alt30.map(at), limit)} className="alt" />
        <path d={pathFrom(horizon.map(at), limit)} className="horizon" />
        {ticks.map(({ a, b }, i) => (inFrame(a, view) && b.front ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="tick" /> : null))}
        {inFrame(zenith, view) ? (
          <g className="zenith" transform={`translate(${zenith.x.toFixed(1)} ${zenith.y.toFixed(1)})`}>
            <line x1={-6} y1={0} x2={6} y2={0} />
            <line x1={0} y1={-6} x2={0} y2={6} />
          </g>
        ) : null}
        {COMPASS.map(({ azDeg, name, major }) => {
          const p = at({ azDeg, elDeg: 3.5 });
          return inFrame(p, view) ? (
            <text key={name} x={p.x} y={p.y} className={major ? 'compass major' : 'compass'}>
              {name}
            </text>
          ) : null;
        })}
      </g>
      {arcs.map((arc, i) => {
        const pass = passes[i];
        if (!pass) return null;
        const colour = SERIES[i % SERIES.length] ?? '#fff';
        const projected = arc.map(at);
        const rise = at(pass.start);
        const peak = at(pass.peak);
        const end = at(pass.end);
        const key = String.fromCharCode(65 + i);
        const nowIndex = Math.min(arc.length - 1, Math.round(nowFraction * (arc.length - 1)));
        const now = i === 0 ? projected[nowIndex] : undefined;
        const before = i === 0 ? projected[Math.max(0, nowIndex - 1)] : undefined;
        const tail = projected[projected.length - 1];
        const prev = projected[projected.length - 2];
        const heading = tail && prev ? Math.atan2(tail.y - prev.y, tail.x - prev.x) * (180 / Math.PI) : 0;
        return (
          <g key={pass.id} className={i === 0 ? 'pass highlighted' : 'pass dim'} style={{ color: colour }}>
            <path d={pathFrom(projected, limit)} className="arc" />
            {i === 0 && now && before ? <path d={pathFrom(projected.slice(0, nowIndex + 1), limit)} className="flown" /> : null}
            {inFrame(rise, view) ? <circle cx={rise.x} cy={rise.y} r={4} className="marker rise" /> : null}
            {inFrame(end, view) ? (
              <g transform={`translate(${end.x.toFixed(1)} ${end.y.toFixed(1)}) rotate(${heading.toFixed(1)})`}>
                <path d="M-8 -5 L2 0 L-8 5 Z" className="arrow" />
              </g>
            ) : null}
            {inFrame(peak, view) ? (
              <g transform={`translate(${peak.x.toFixed(1)} ${peak.y.toFixed(1)})`}>
                <circle r={5} className="marker peak" />
                <text x={9} y={-7} className="key">
                  {key}
                </text>
              </g>
            ) : null}
            {now && inFrame(now, view) ? <circle cx={now.x} cy={now.y} r={7} className="live" /> : null}
          </g>
        );
      })}
    </svg>
  );
}
