/**
 * R14 spike item 7: a first-person horizon panorama in SVG. The strip faces
 * the pass (centred on the arc's azimuth range, which contains the rise
 * azimuth), the horizon is the baseline with the 16 compass names along it,
 * the arc climbs over it and the satellite marker moves live with a trail.
 * Equirectangular: one pixel scale for azimuth and elevation. Same geometry
 * module as the polar view and the dome.
 */
import { useMemo } from 'react';
import { interpolateTrack, resampleArc } from '../src/lib/skyGeometry';
import type { Pass, PassPoint } from '../src/model';

const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const MAJOR = new Set(['N', 'E', 'S', 'W']);

interface Props {
  pass: Pass;
  now?: number;
  widthPx?: number;
  /** Minimum field of view in degrees of azimuth. */
  minFovDeg?: number;
  timeZone?: string | null;
}

const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

function clock(t: number, timeZone: string | null | undefined): string {
  return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', ...(timeZone ? { timeZone } : {}) });
}

/** Unwrap a sequence of azimuths so consecutive values never jump by more than 180°. */
function unwrap(points: readonly PassPoint[]): number[] {
  const out: number[] = [];
  let prev = 0;
  points.forEach((p, i) => {
    const az = i === 0 ? p.azDeg : prev + wrap180(p.azDeg - prev);
    out.push(az);
    prev = az;
  });
  return out;
}

export function SpikePanorama({ pass, now, widthPx = 390, minFovDeg = 100, timeZone }: Props) {
  const geometry = useMemo(() => {
    const points = resampleArc(pass.track, 2);
    const az = unwrap(points);
    const min = Math.min(...az);
    const max = Math.max(...az);
    const centre = (min + max) / 2;
    const fov = Math.min(220, Math.max(minFovDeg, max - min + 40));
    const pxPerDeg = widthPx / fov;
    const elTop = Math.min(90, Math.max(45, pass.peak.elDeg + 18));
    const skyH = elTop * pxPerDeg;
    const groundH = 34;
    const height = skyH + groundH + 4;
    const x = (azUnwrapped: number) => (azUnwrapped - centre + fov / 2) * pxPerDeg;
    const y = (el: number) => skyH - el * pxPerDeg;
    const xy = (p: PassPoint, i: number) => ({ x: x(az[i] ?? p.azDeg), y: y(p.elDeg) });
    const path = points.map((p, i) => xy(p, i));
    // Compass names inside the field of view, in unwrapped azimuth.
    const names: { label: string; x: number; major: boolean }[] = [];
    for (let k = -2; k <= 2; k++) {
      COMPASS_16.forEach((label, i) => {
        const a = i * 22.5 + k * 360;
        if (a >= centre - fov / 2 - 5 && a <= centre + fov / 2 + 5) names.push({ label, x: x(a), major: MAJOR.has(label) });
      });
    }
    const facingIndex = ((Math.round((((centre % 360) + 360) % 360) / 22.5) % 16) + 16) % 16;
    return { points, az, centre, fov, pxPerDeg, skyH, height, x, y, path, names, facing: COMPASS_16[facingIndex] ?? 'N', elTop };
  }, [pass, widthPx, minFovDeg]);

  const { path, names, skyH, height, fov, facing, elTop } = geometry;
  const current = now !== undefined && now >= pass.start.t && now <= pass.end.t ? interpolateTrack(pass.track, now) : null;
  // Trail: the part of the arc already travelled, cut at `now` by time.
  const trail = current ? [...geometry.points.filter((p) => p.t <= current.t), current] : [];
  const trailXy = trail.map((p) => {
    // Unwrap relative to the start azimuth, consistent with the resampled sequence.
    const first = geometry.az[0] ?? p.azDeg;
    return { x: geometry.x(first + wrap180(p.azDeg - first) + (Math.abs(wrap180(p.azDeg - first)) > 179 ? 0 : 0)), y: geometry.y(p.elDeg) };
  });
  const rise = path[0];
  const peakIdx = geometry.points.findIndex((p) => p === pass.peak || p.t === pass.peak.t);
  const peak = path[peakIdx >= 0 ? peakIdx : 0];
  const end = path[path.length - 1];
  const d = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = path[path.length - 1];
  const before = path[path.length - 2];
  const arrowAngle = last && before ? (Math.atan2(last.y - before.y, last.x - before.x) * 180) / Math.PI : 0;

  return (
    <div className="panorama">
      <svg className="panorama-svg" viewBox={`0 0 ${widthPx} ${height}`} width={widthPx} height={height} aria-hidden="true" data-drawing>
        <rect x={0} y={0} width={widthPx} height={skyH} className="sky" />
        <rect x={0} y={skyH} width={widthPx} height={height - skyH} className="ground" />
        {[30, 60].map(
          (el) =>
            el < elTop && (
              <g key={el}>
                <line x1={0} x2={widthPx} y1={geometry.y(el)} y2={geometry.y(el)} className="ring" />
                <text x={4} y={geometry.y(el) - 3} className="ring-label">
                  {el}°
                </text>
              </g>
            ),
        )}
        <line x1={0} x2={widthPx} y1={skyH} y2={skyH} className="horizon" />
        {names.map((n) => (
          <g key={`${n.label}-${n.x.toFixed(0)}`} transform={`translate(${n.x.toFixed(1)} ${skyH.toFixed(1)})`}>
            <line y1={0} y2={n.major ? 8 : 4} className="tick" />
            <text y={n.major ? 22 : 16} textAnchor="middle" className={n.major ? 'cardinal' : 'minor'} data-anchor={n.major ? n.label : undefined}>
              {n.label}
            </text>
          </g>
        ))}
        <g data-pass-id={pass.id}>
          <path d={d(path)} className="arc" />
          {trailXy.length > 1 && <path d={d(trailXy)} className="trail" />}
          {rise && (
            <g transform={`translate(${rise.x.toFixed(1)} ${rise.y.toFixed(1)})`}>
              <circle r={3} className="marker" data-marker="rise" />
              <text y={-9} textAnchor="middle" className="label" data-anchor="pass">
                {pass.name} · {clock(pass.start.t, timeZone)}
              </text>
            </g>
          )}
          {peak && (
            <g transform={`translate(${peak.x.toFixed(1)} ${peak.y.toFixed(1)})`}>
              <path d="M0 -5 L5 0 L0 5 L-5 0 Z" className="marker" data-marker="peak" />
              <text y={-10} textAnchor="middle" className="label" data-anchor="peak">
                max {Math.round(pass.peak.elDeg)}°
              </text>
            </g>
          )}
          {end && (
            <g transform={`translate(${end.x.toFixed(1)} ${end.y.toFixed(1)})`}>
              {pass.endReason === 'shadow' ? <circle r={4} className="shadow" data-marker="shadow" /> : <circle r={3} className="marker" data-marker="end" />}
              <path d="M-7 -4 L2 0 L-7 4 Z" transform={`rotate(${arrowAngle.toFixed(1)}) translate(8 0)`} className="arrow" data-marker="arrow" />
              <text y={16} textAnchor="middle" className="label">
                {pass.endReason === 'shadow' ? 'into shadow · ' : ''}
                {clock(pass.end.t, timeZone)}
              </text>
            </g>
          )}
          {current && trailXy.length > 0 && (
            <g transform={`translate(${(trailXy[trailXy.length - 1]?.x ?? 0).toFixed(1)} ${(trailXy[trailXy.length - 1]?.y ?? 0).toFixed(1)})`}>
              <path d="M0 -6 L6 0 L0 6 L-6 0 Z" className="now" data-marker="now" />
            </g>
          )}
        </g>
      </svg>
      <p className="readout">
        Facing {facing} · {Math.round(fov)}° of horizon shown · up to {Math.round(elTop)}° elevation
      </p>
    </div>
  );
}
