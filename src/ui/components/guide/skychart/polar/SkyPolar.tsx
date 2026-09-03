import { useAppStore } from '../../../../../state';
import { degrees } from '../../../../../lib/format';
import { interpolateTrack, resampleArc, toPolar } from '../../../../../lib/skyGeometry';
import { formatClock } from '../../../../../lib/timeFormat';
import type { ChartOrientation, Pass, PassPoint } from '../../../../../model';
import { OptionToggle } from '../../../common/OptionToggle';
import type { SkyChartProps, SkyChartView } from '../SkyChart.types';
import styles from './SkyPolar.module.css';

/**
 * FR-GUIDE-2b, FR-GUIDE-4 (R13): the 2D all-sky chart as SVG (FR-GUIDE-5:
 * no canvas). Horizon as the outer circle, zenith at the centre, 30° / 60°
 * rings, cardinal labels, each pass as an arc resampled to ~2° through
 * `lib/skyGeometry` (the same geometry the dome uses) with rise / peak / end
 * markers, shadow markers where a boundary is a shadow one, an arrowhead for
 * the direction of travel and, when `now` falls inside a pass, the current
 * position. The convention is the `chartOrientation` preference: looking up
 * (east on the left) by default, map (east on the right) on toggle; the
 * choice is labelled under the drawing and persisted. The drawing is
 * `aria-hidden` (FR-GUIDE-7): the caption and the numbers carry the facts.
 */
export const ORIENTATION_LABELS: Record<ChartOrientation, string> = { 'looking-up': 'Looking up', map: 'Map' };
export const ORIENTATION_NOTES: Record<ChartOrientation, string> = {
  'looking-up': 'Looking up: east on the left, as when lying on your back.',
  map: 'Map: east on the right, as on a map.',
};
const ORIENTATIONS: readonly ChartOrientation[] = ['looking-up', 'map'];

/** The horizon radius in user units; the viewBox leaves room for the labels outside it. */
export const HORIZON_R = 100;
const LABEL_R = 114;
const VIEWBOX = '-125 -125 250 250';
/** Resampling step along each arc (PLAN §8.3). */
export const ARC_STEP_DEG = 2;
const CARDINALS: readonly { label: string; azDeg: number }[] = [
  { label: 'N', azDeg: 0 },
  { label: 'E', azDeg: 90 },
  { label: 'S', azDeg: 180 },
  { label: 'W', azDeg: 270 },
];
const TICK_AZIMUTHS = [45, 135, 225, 315];

interface Xy {
  x: number;
  y: number;
}

function project(point: { azDeg: number; elDeg: number }, orientation: ChartOrientation, r = HORIZON_R): Xy {
  const p = toPolar(point.azDeg, point.elDeg, orientation);
  return { x: p.x * r, y: p.y * r };
}

const fmt = (n: number): string => n.toFixed(2);
const at = ({ x, y }: Xy): string => `translate(${fmt(x)} ${fmt(y)})`;

/** Text on the left half of the disc runs rightwards, and vice versa, so labels stay inside the drawing. */
function anchorFor(x: number): 'start' | 'middle' | 'end' {
  if (Math.abs(x) < 8) return 'middle';
  return x < 0 ? 'start' : 'end';
}

function inward(p: Xy, by: number): Xy {
  const len = Math.hypot(p.x, p.y) || 1;
  return { x: p.x - (p.x / len) * by, y: p.y - (p.y / len) * by };
}

interface ArcProps {
  pass: Pass;
  orientation: ChartOrientation;
  timeZone: string | null;
  dim: boolean;
  now: number | undefined;
  onSelect: ((passId: string) => void) | undefined;
}

function PassArc({ pass, orientation, timeZone, dim, now, onSelect }: ArcProps) {
  const points = resampleArc(pass.track, ARC_STEP_DEG).map((p) => project(p, orientation));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ');
  const rise = project(pass.start, orientation);
  const peak = project(pass.peak, orientation);
  const end = project(pass.end, orientation);
  // The arrowhead sits four fifths of the way along the arc, pointing the way the satellite moves.
  const head = Math.max(1, Math.floor(0.8 * (points.length - 1)));
  const tail = points[head - 1] ?? rise;
  const tip = points[head] ?? end;
  const headingDeg = (Math.atan2(tip.y - tail.y, tip.x - tail.x) * 180) / Math.PI;
  const current: PassPoint | null = now !== undefined && now >= pass.start.t && now <= pass.end.t ? interpolateTrack(pass.track, now) : null;
  const nameAt = inward(rise, 10);
  const peakLabel = { x: peak.x + (peak.x < 0 ? 6 : -6), y: peak.y - 6 };
  return (
    <g
      className={dim ? styles.passDim : styles.pass}
      data-pass-id={pass.id}
      onClick={() => {
        onSelect?.(pass.id);
      }}
    >
      <path className={styles.track} d={d} />
      <path className={styles.arrow} data-marker="arrow" d="M0 0 L-8 -4 L-8 4 Z" transform={`${at(tip)} rotate(${fmt(headingDeg)})`} />
      <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} />
      <Marker kind={pass.endReason === 'shadow' ? 'shadow' : 'end'} p={end} />
      <Marker kind="peak" p={peak} />
      {current && <Marker kind="now" p={project(current, orientation)} />}
      <text className={styles.label} data-anchor="pass" x={fmt(nameAt.x)} y={fmt(nameAt.y)} textAnchor={anchorFor(nameAt.x)}>
        {pass.name} {formatClock(pass.start.t, timeZone)}
      </text>
      <text className={styles.label} data-anchor="peak" x={fmt(peakLabel.x)} y={fmt(peakLabel.y)} textAnchor={peak.x < 0 ? 'start' : 'end'}>
        max {degrees(pass.peak.elDeg)}
      </text>
    </g>
  );
}

function Marker({ kind, p }: { kind: 'rise' | 'end' | 'shadow' | 'peak' | 'now'; p: Xy }) {
  switch (kind) {
    case 'peak':
      return <path className={styles.peak} data-marker="peak" d="M0 -5 L5 0 L0 5 L-5 0 Z" transform={at(p)} />;
    case 'shadow':
      // Half filled: the satellite crosses into (or out of) Earth's shadow here.
      return (
        <g data-marker="shadow" transform={at(p)}>
          <circle className={styles.point} r="4" />
          <path className={styles.shadowHalf} d="M0 -4 A4 4 0 0 1 0 4 Z" />
        </g>
      );
    case 'now':
      return <circle className={styles.now} data-marker="now" r="4.5" transform={at(p)} />;
    default:
      return <circle className={styles.point} data-marker={kind} r="4" transform={at(p)} />;
  }
}

export function SkyPolar({ passes, observer, highlightedPassId, onSelectPass, now, className }: SkyChartProps) {
  const orientation = useAppStore((s) => s.chartOrientation);
  const setChartOrientation = useAppStore((s) => s.setChartOrientation);
  const ring = (elDeg: number): number => project({ azDeg: 0, elDeg }, orientation).y * -1;
  return (
    <div className={[styles.polar, className].filter(Boolean).join(' ')} data-orientation={orientation}>
      <OptionToggle name="Chart orientation" prefix="Orientation:" options={ORIENTATIONS.map((value) => ({ value, label: ORIENTATION_LABELS[value] }))} value={orientation} onChange={setChartOrientation} />
      <svg className={styles.svg} viewBox={VIEWBOX} aria-hidden="true" data-drawing="polar" focusable="false">
        <circle className={styles.horizon} r={HORIZON_R} />
        <circle className={styles.ring} r={fmt(ring(30))} data-ring="30" />
        <circle className={styles.ring} r={fmt(ring(60))} data-ring="60" />
        <circle className={styles.zenith} r="1.5" />
        {TICK_AZIMUTHS.map((azDeg) => {
          const outer = project({ azDeg, elDeg: 0 }, orientation);
          const inner = project({ azDeg, elDeg: 0 }, orientation, HORIZON_R - 5);
          return <line key={azDeg} className={styles.tick} x1={fmt(outer.x)} y1={fmt(outer.y)} x2={fmt(inner.x)} y2={fmt(inner.y)} />;
        })}
        {CARDINALS.map(({ label, azDeg }) => {
          const p = project({ azDeg, elDeg: 0 }, orientation, LABEL_R);
          return (
            <text key={label} className={styles.cardinal} data-anchor={label} x={fmt(p.x)} y={fmt(p.y)} textAnchor="middle" dominantBaseline="central">
              {label}
            </text>
          );
        })}
        {passes.map((pass) => (
          <PassArc key={pass.id} pass={pass} orientation={orientation} timeZone={observer.timeZone} dim={highlightedPassId !== null && highlightedPassId !== pass.id} now={now} onSelect={onSelectPass} />
        ))}
      </svg>
      <p className={styles.convention} data-testid="chart-convention">
        {ORIENTATION_NOTES[orientation]}
      </p>
    </div>
  );
}

export const POLAR_VIEW: SkyChartView = { Component: SkyPolar, id: 'polar', label: 'Polar' };
