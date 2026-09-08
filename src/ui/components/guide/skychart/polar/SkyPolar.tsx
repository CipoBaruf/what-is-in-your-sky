import { useAppStore } from '../../../../../state';
import { useT } from '../../../../../i18n/useT';
import { cutTrack, type ArcState } from '../../../../../lib/arcReveal';
import { interpolateTrack, resampleArc, splitArcAt, toPolar } from '../../../../../lib/skyGeometry';
import type { SunState } from '../../../../../lib/skyBodies';
import type { ChartOrientation, MoonState, PassPoint } from '../../../../../model';
import { OptionToggle } from '../../../common/OptionToggle';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, moonVisible, sunVisible } from '../bodies';
import { ChartFrame } from '../ChartFrame';
import { arcOf, type ChartPass, type HiddenMarker, type SkyChartProps, type SkyChartView } from '../SkyChart.types';
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
 *
 * R45 (FR-LEG-1, FR-TRAJ-1, D-186, D-189): no name, no time, no body caption
 * and no reason is drawn — each arc carries its legend key at the peak, and
 * the legend `SkyChart` renders sits in the frame's slot. Each pass is drawn
 * in its `arc` state: `full` as before, `live` as the cut track solid with
 * the marker, `ahead` dotted and thin with the rise marked, `linger` thin
 * with nothing marked, `hidden` not at all.
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

/** FR-LIVE-2: the six series tokens, cycled in pass order; `SkyPolar.module.css` maps `data-series` to `--chart-series-N`. */
export const SERIES_COUNT = 6;

interface ArcProps {
  pass: ChartPass;
  orientation: ChartOrientation;
  dim: boolean;
  /** FR-LIVE-2 (R32): 1–6 in `colorBy="pass"` mode, `null` in the guide's highlight mode. */
  series: number | null;
  now: number | undefined;
  /** FR-LEG-1: the legend key drawn at the peak; none where the view is mounted without a legend. */
  legendKey: string | undefined;
  onSelect: ((passId: string) => void) | undefined;
}

/** An open polyline through projected points; empty for fewer than two of them. */
const polyline = (points: readonly Xy[]): string => (points.length < 2 ? '' : points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' '));

/** FR-LEG-1: the key beside the peak marker, on the outward side of the arc so it does not sit on the track. */
function KeyLabel({ points, peak, rise, end, text }: { points: readonly Xy[]; peak: Xy; rise: Xy; end: Xy; text: string }) {
  const peakIndex = Math.max(1, points.findIndex((p) => p.x === peak.x && p.y === peak.y));
  const beforePeak = points[peakIndex - 1] ?? rise;
  const afterPeak = points[peakIndex + 1] ?? end;
  const keyAt = labelBeside(peak, { x: afterPeak.x - beforePeak.x, y: afterPeak.y - beforePeak.y }, 'outward', text);
  return (
    <text className={styles.key} data-anchor="key" data-key={text} {...keyAt}>
      {text}
    </text>
  );
}

function PassArc({ pass, orientation, dim, series, now, legendKey, onSelect }: ArcProps) {
  const state: ArcState = arcOf(pass);
  if (state === 'hidden') return null;
  const arc = resampleArc(pass.track, ARC_STEP_DEG);
  const points = arc.map((p) => project(p, orientation));
  const rise = project(pass.start, orientation);
  const peak = project(pass.peak, orientation);
  const end = project(pass.end, orientation);
  const group = {
    className: [series !== null ? styles.series : dim ? styles.passDim : styles.pass, state !== 'full' ? styles[state] : undefined].filter(Boolean).join(' '),
    'data-pass-id': pass.id,
    'data-arc': state,
    ...(series !== null ? { 'data-series': series } : {}),
    ...(series !== null && dim ? { 'data-dim': true } : {}),
    onClick: () => {
      onSelect?.(pass.id);
    },
  };
  const key = legendKey === undefined ? null : <KeyLabel points={points} peak={peak} rise={rise} end={end} text={legendKey} />;

  // FR-TRAJ-1, `live`: the cut track from the rise to the position at `now`, solid, with the marker; nothing beyond it.
  if (state === 'live') {
    const t = now ?? pass.end.t;
    const cut = resampleArc(cutTrack(pass, t), ARC_STEP_DEG).map((p) => project(p, orientation));
    const current = interpolateTrack(pass.track, t);
    return (
      <g {...group}>
        {cut.length > 1 && <path className={styles.track} data-marker="live" d={polyline(cut)} />}
        <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} />
        {t >= pass.peak.t && <Marker kind="peak" p={peak} />}
        <Marker kind="now" p={project(current, orientation)} />
        {key}
      </g>
    );
  }
  // `ahead`: the whole arc, thin and dotted, with the rise point marked. `linger`: the whole arc, thin, nothing marked.
  if (state === 'ahead' || state === 'linger') {
    return (
      <g {...group}>
        <path className={styles.track} data-marker={state} d={polyline(points)} />
        {state === 'ahead' && <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} />}
        {key}
      </g>
    );
  }

  // `full`: the pass detail's whole arc — FR-DOME-5's flown part over it, every marker, the arrowhead.
  const d = polyline(points);
  const flown = polyline(splitArcAt(arc, now).flown.map((p) => project(p, orientation)));
  // The arrowhead sits four fifths of the way along the arc, pointing the way the satellite moves.
  const head = Math.max(1, Math.floor(0.8 * (points.length - 1)));
  const tail = points[head - 1] ?? rise;
  const tip = points[head] ?? end;
  const headingDeg = (Math.atan2(tip.y - tail.y, tip.x - tail.x) * 180) / Math.PI;
  const current: PassPoint | null = now !== undefined && now >= pass.start.t && now <= pass.end.t ? interpolateTrack(pass.track, now) : null;
  return (
    <g {...group}>
      <path className={styles.track} d={d} />
      {flown && <path className={styles.flown} data-marker="flown" d={flown} />}
      <path className={styles.arrow} data-marker="arrow" d="M0 0 L-8 -4 L-8 4 Z" transform={`${at(tip)} rotate(${fmt(headingDeg)})`} />
      <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} />
      <Marker kind={pass.endReason === 'shadow' ? 'shadow' : 'end'} p={end} />
      <Marker kind="peak" p={peak} />
      {current && <Marker kind="now" p={project(current, orientation)} />}
      {key}
    </g>
  );
}

/** How far above a hidden object's mark its key sits, in user units. */
const HIDDEN_KEY_GAP = 7;

/**
 * FR-DOME-6: the Sun as a band of light on the horizon at its azimuth, wider,
 * taller and brighter the closer it is to rising — the same `../bodies` ramp
 * the dome's glow is built from, so the two views agree about where the Sun is
 * and how strongly it shows. The band is a thick stroked arc centred half its
 * own height above the horizon, so it fills the sky from the horizon up.
 *
 * F-4: the sample step is a quarter of the half-width, like the dome's
 * `sunGlow` (`dome/domeGeometry.ts`), so the band's edge always lands exactly
 * on the Sun's azimuth ± `halfWidth` instead of stopping short by up to a
 * fixed step's worth of degrees.
 */
function SunGlow({ sun, orientation }: { sun: SunState; orientation: ChartOrientation }) {
  const strength = glowStrength(sun.altDeg);
  const halfWidth = glowHalfWidthDeg(strength);
  const height = glowHeightDeg(strength);
  // Nine samples by index, not by accumulating `step`: `d += step` drifts past `halfWidth` by a rounding error for about one altitude in seven and drops the last sample (F-4).
  const samples = 8;
  const points: Xy[] = [];
  for (let k = 0; k <= samples; k += 1) points.push(project({ azDeg: sun.azDeg - halfWidth + (2 * halfWidth * k) / samples, elDeg: height / 2 }, orientation));
  const width = (HORIZON_R * height) / 90;
  return (
    <g data-body="sun">
      <path className={styles.glow} d={polyline(points)} strokeWidth={fmt(width)} opacity={fmt(0.3 + 0.5 * strength)} />
    </g>
  );
}

/** FR-DOME-6: the Moon's disc where it is. Its phase glyph and its name are a legend line since R45 (FR-DOME-6 as amended). */
function MoonMarker({ moon, orientation }: { moon: MoonState; orientation: ChartOrientation }) {
  const p = project(moon, orientation);
  return (
    <g data-body="moon">
      <circle className={styles.moon} data-marker="moon" r="4.5" transform={at(p)} />
    </g>
  );
}

/**
 * FR-LIVE-6 (R33): an object that is up but not worth looking for, dimmed —
 * a small hollow point in the dim pass colour. Dim by colour and by weight
 * (FR-X-5), like the other passes in the guide. R45 (FR-LIVE-6 as amended):
 * its reason is a legend row; the mark carries the legend key only.
 */
function HiddenPoint({ marker, orientation, legendKey }: { marker: HiddenMarker; orientation: ChartOrientation; legendKey: string | undefined }) {
  const p = project(marker, orientation);
  return (
    <g data-hidden-id={marker.id}>
      <circle className={styles.hidden} data-marker="hidden" r="3" transform={at(p)} />
      {legendKey !== undefined && (
        <text className={[styles.key, styles.hiddenKey].join(' ')} data-anchor="key" data-key={legendKey} x={fmt(p.x)} y={fmt(p.y - HIDDEN_KEY_GAP)} textAnchor="middle">
          {legendKey}
        </text>
      )}
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

export function SkyPolar({ passes, highlightedPassId, onSelectPass, now, sun, moon, hidden = [], colorBy = 'highlight', fill = false, legendKeys = {}, legend, aside, stripe, boxAspect, controls, className }: SkyChartProps) {
  const t = useT();
  const orientation = useAppStore((s) => s.chartOrientation);
  const setChartOrientation = useAppStore((s) => s.setChartOrientation);
  const ring = (elDeg: number): number => project({ azDeg: 0, elDeg }, orientation).y * -1;
  return (
    <div className={[styles.polar, className].filter(Boolean).join(' ')} data-orientation={orientation}>
      <ChartFrame
        fill={fill}
        legend={legend}
        aside={aside}
        stripe={stripe}
        {...(boxAspect === undefined ? {} : { boxAspect })}
        controls={
          <>
            {controls}
            <OptionToggle name={t.chart.orientationGroup} options={ORIENTATIONS.map((value) => ({ value, label: t.chart.orientation[value] }))} value={orientation} onChange={setChartOrientation} />
          </>
        }
        status={
          <p className={styles.convention} data-testid="chart-convention">
            {t.chart.orientationNote[orientation]}
          </p>
        }
      >
      <svg className={styles.svg} viewBox={VIEWBOX} aria-hidden="true" data-drawing="polar" focusable="false">
        {/* FR-DOME-6: the glow is a surface, so it goes under the grid. */}
        {sun && sunVisible(sun) && <SunGlow sun={sun} orientation={orientation} />}
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
        {passes.map((pass, index) => (
          <PassArc
            key={pass.id}
            pass={pass}
            orientation={orientation}
            dim={highlightedPassId !== null && highlightedPassId !== pass.id}
            series={colorBy === 'pass' ? (index % SERIES_COUNT) + 1 : null}
            now={now}
            legendKey={legendKeys[pass.id]}
            onSelect={onSelectPass}
          />
        ))}
        {/* FR-LIVE-6: the dimmed objects, under the Moon and over the arcs they are not part of. */}
        {hidden.map((marker) => (
          <HiddenPoint key={marker.id} marker={marker} orientation={orientation} legendKey={legendKeys[marker.id]} />
        ))}
        {/* …and the Moon over them, so a pass that crosses it does not hide it. */}
        {moon && moonVisible(moon) && <MoonMarker moon={moon} orientation={orientation} />}
      </svg>
      </ChartFrame>
    </div>
  );
}

export const POLAR_VIEW: SkyChartView = { Component: SkyPolar, id: 'polar' };
