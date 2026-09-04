import { useAppStore } from '../../../../../state';
import { useLocale, useT } from '../../../../../i18n/useT';
import type { Messages } from '../../../../../i18n/messages';
import { degrees } from '../../../../../lib/format';
import { interpolateTrack, resampleArc, splitArcAt, toPolar } from '../../../../../lib/skyGeometry';
import type { SunState } from '../../../../../lib/skyBodies';
import { formatClock } from '../../../../../lib/timeFormat';
import type { ChartOrientation, Locale, MoonState, Pass, PassPoint } from '../../../../../model';
import { OptionToggle } from '../../../common/OptionToggle';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, moonGlyph, moonVisible, sunVisible } from '../bodies';
import { ChartFrame } from '../ChartFrame';
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
 * R15 review: laid out in the shared `ChartFrame` (toggle in the controls
 * row, the SVG in the square box, the convention in the status row) so the
 * dome and this view occupy the same space.
 */
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
const LABEL_GAP = 10;
const LABEL_HEIGHT = 8;
/** Label text is 9 px monospace in user units: about 0.6 em per character; labels must end inside the viewBox. */
const LABEL_CHAR_W = 5.4;
const LABEL_LIMIT = 122;

function unit(v: Xy, fallback: Xy): Xy {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-6 ? fallback : { x: v.x / len, y: v.y / len };
}

/** Toward the zenith from `p`; straight up when `p` is the zenith itself. */
const toCentre = (p: Xy): Xy => unit({ x: -p.x, y: -p.y }, { x: 0, y: -1 });

/**
 * A label beside the arc at `p`: offset along the normal to the direction of
 * travel there (`side` picks the normal that points toward or away from the
 * centre), never along the arc, so the text does not lie on the track. The
 * text runs away from the point and hangs below it when the normal points
 * down; when it would run past the drawing's edge it runs the other way.
 */
function labelBeside(p: Xy, travel: Xy, side: 'inward' | 'outward', text: string): { x: string; y: string; textAnchor: 'start' | 'middle' | 'end' } {
  const centre = toCentre(p);
  const dir = unit(travel, centre);
  let n = { x: -dir.y, y: dir.x };
  const dot = n.x * centre.x + n.y * centre.y;
  if ((side === 'inward' && dot < 0) || (side === 'outward' && dot > 0)) n = { x: -n.x, y: -n.y };
  if (Math.abs(dot) < 1e-6 && side === 'outward') n = { x: -n.x, y: -n.y };
  const x = p.x + n.x * LABEL_GAP;
  const y = p.y + n.y * LABEL_GAP + (n.y > 0.3 ? LABEL_HEIGHT : n.y < -0.3 ? 0 : LABEL_HEIGHT / 2);
  const lean = Math.abs(n.x) > 0.3 ? n.x : centre.x;
  const width = text.length * LABEL_CHAR_W;
  const fits = { start: x + width <= LABEL_LIMIT, end: x - width >= -LABEL_LIMIT };
  const preferred = lean >= 0 ? 'start' : 'end';
  const other = preferred === 'start' ? 'end' : 'start';
  const textAnchor = fits[preferred] ? preferred : fits[other] ? other : 'middle';
  return { x: fmt(x), y: fmt(y), textAnchor };
}

interface ArcProps {
  pass: Pass;
  orientation: ChartOrientation;
  timeZone: string | null;
  dim: boolean;
  now: number | undefined;
  onSelect: ((passId: string) => void) | undefined;
  t: Messages;
  locale: Locale;
}

/** An open polyline through projected points; empty for fewer than two of them. */
const polyline = (points: readonly Xy[]): string => (points.length < 2 ? '' : points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' '));

function PassArc({ pass, orientation, timeZone, dim, now, onSelect, t, locale }: ArcProps) {
  const arc = resampleArc(pass.track, ARC_STEP_DEG);
  const points = arc.map((p) => project(p, orientation));
  const d = polyline(points);
  // FR-DOME-5: the part already flown at `now`, drawn over the arc in its own colour.
  const flown = polyline(splitArcAt(arc, now).flown.map((p) => project(p, orientation)));
  const rise = project(pass.start, orientation);
  const peak = project(pass.peak, orientation);
  const end = project(pass.end, orientation);
  // The arrowhead sits four fifths of the way along the arc, pointing the way the satellite moves.
  const head = Math.max(1, Math.floor(0.8 * (points.length - 1)));
  const tail = points[head - 1] ?? rise;
  const tip = points[head] ?? end;
  const headingDeg = (Math.atan2(tip.y - tail.y, tip.x - tail.x) * 180) / Math.PI;
  const current: PassPoint | null = now !== undefined && now >= pass.start.t && now <= pass.end.t ? interpolateTrack(pass.track, now) : null;
  const nameText = t.chart.passLabel({ name: pass.name, time: formatClock(pass.start.t, timeZone, locale) });
  const peakText = t.chart.peakLabel(degrees(pass.peak.elDeg));
  const second = points[1] ?? peak;
  const nameAt = labelBeside(rise, { x: second.x - rise.x, y: second.y - rise.y }, 'inward', nameText);
  const peakIndex = Math.max(1, points.findIndex((p) => p.x === peak.x && p.y === peak.y));
  const beforePeak = points[peakIndex - 1] ?? rise;
  const afterPeak = points[peakIndex + 1] ?? end;
  const peakAt = labelBeside(peak, { x: afterPeak.x - beforePeak.x, y: afterPeak.y - beforePeak.y }, 'outward', peakText);
  return (
    <g
      className={dim ? styles.passDim : styles.pass}
      data-pass-id={pass.id}
      onClick={() => {
        onSelect?.(pass.id);
      }}
    >
      <path className={styles.track} d={d} />
      {flown && <path className={styles.flown} data-marker="flown" d={flown} />}
      <path className={styles.arrow} data-marker="arrow" d="M0 0 L-8 -4 L-8 4 Z" transform={`${at(tip)} rotate(${fmt(headingDeg)})`} />
      <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} />
      <Marker kind={pass.endReason === 'shadow' ? 'shadow' : 'end'} p={end} />
      <Marker kind="peak" p={peak} />
      {current && <Marker kind="now" p={project(current, orientation)} />}
      <text className={styles.label} data-anchor="pass" {...nameAt}>
        {nameText}
      </text>
      <text className={styles.label} data-anchor="peak" {...peakAt}>
        {peakText}
      </text>
    </g>
  );
}

/** How far above a body's marker its name sits, in user units. */
const BODY_LABEL_GAP = 7;
/** The glow is sampled every few degrees of azimuth; enough for a smooth band at this radius. */
const GLOW_STEP_DEG = 4;

/**
 * FR-DOME-6: the Sun as a band of light on the horizon at its azimuth, wider,
 * taller and brighter the closer it is to rising — the same `../bodies` ramp
 * the dome's glow is built from, so the two views agree about where the Sun is
 * and how strongly it shows. The band is a thick stroked arc centred half its
 * own height above the horizon, so it fills the sky from the horizon up.
 */
function SunGlow({ sun, orientation, label }: { sun: SunState; orientation: ChartOrientation; label: string }) {
  const strength = glowStrength(sun.altDeg);
  const halfWidth = glowHalfWidthDeg(strength);
  const height = glowHeightDeg(strength);
  const points: Xy[] = [];
  for (let d = -halfWidth; d <= halfWidth; d += GLOW_STEP_DEG) points.push(project({ azDeg: sun.azDeg + d, elDeg: height / 2 }, orientation));
  const width = (HORIZON_R * height) / 90;
  const name = project({ azDeg: sun.azDeg, elDeg: height }, orientation);
  return (
    <g data-body="sun">
      <path className={styles.glow} d={polyline(points)} strokeWidth={fmt(width)} opacity={fmt(0.3 + 0.5 * strength)} />
      <text className={[styles.bodyLabel, styles.sunLabel].join(' ')} data-anchor="sun" x={fmt(name.x)} y={fmt(name.y)} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}

/** FR-DOME-6: the Moon's disc where it is, with its phase glyph in the label (`../bodies`). */
function MoonMarker({ moon, orientation, label }: { moon: MoonState; orientation: ChartOrientation; label: string }) {
  const p = project(moon, orientation);
  return (
    <g data-body="moon">
      <circle className={styles.moon} data-marker="moon" r="4.5" transform={at(p)} />
      <text className={[styles.bodyLabel, styles.moonLabel].join(' ')} data-anchor="moon" x={fmt(p.x)} y={fmt(p.y - BODY_LABEL_GAP)} textAnchor="middle">
        {label}
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

export function SkyPolar({ passes, observer, highlightedPassId, onSelectPass, now, sun, moon, className }: SkyChartProps) {
  const t = useT();
  const locale = useLocale();
  const orientation = useAppStore((s) => s.chartOrientation);
  const setChartOrientation = useAppStore((s) => s.setChartOrientation);
  const ring = (elDeg: number): number => project({ azDeg: 0, elDeg }, orientation).y * -1;
  return (
    <div className={[styles.polar, className].filter(Boolean).join(' ')} data-orientation={orientation}>
      <ChartFrame
        controls={<OptionToggle name={t.chart.orientationGroup} options={ORIENTATIONS.map((value) => ({ value, label: t.chart.orientation[value] }))} value={orientation} onChange={setChartOrientation} />}
        status={
          <p className={styles.convention} data-testid="chart-convention">
            {t.chart.orientationNote[orientation]}
          </p>
        }
      >
      <svg className={styles.svg} viewBox={VIEWBOX} aria-hidden="true" data-drawing="polar" focusable="false">
        {/* FR-DOME-6: the glow is a surface, so it goes under the grid. */}
        {sun && sunVisible(sun) && <SunGlow sun={sun} orientation={orientation} label={t.chart.sunLabel} />}
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
          <PassArc
            key={pass.id}
            pass={pass}
            orientation={orientation}
            timeZone={observer.timeZone}
            dim={highlightedPassId !== null && highlightedPassId !== pass.id}
            now={now}
            onSelect={onSelectPass}
            t={t}
            locale={locale}
          />
        ))}
        {/* …and the Moon over them, so a pass that crosses it does not hide it. */}
        {moon && moonVisible(moon) && <MoonMarker moon={moon} orientation={orientation} label={t.chart.moonLabel(moonGlyph(moon))} />}
      </svg>
      </ChartFrame>
    </div>
  );
}

export const POLAR_VIEW: SkyChartView = { Component: SkyPolar, id: 'polar' };
