import { lazy, Suspense, useMemo, useRef, type PointerEvent } from 'react';
import { PINCH_HANDOFF_RATIO } from '../../../../../lib/layout';
import { useAppStore } from '../../../../../state';
import { useT } from '../../../../../i18n/useT';
import { cutTrack, type ArcState } from '../../../../../lib/arcReveal';
import { interpolateTrack, resampleArc, splitArcAt, toPolar } from '../../../../../lib/skyGeometry';
import type { SunState } from '../../../../../lib/skyBodies';
import type { ChartOrientation, MoonState, PassPoint } from '../../../../../model';
import { ToggleGroup } from '../../../primitives/ToggleGroup';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, moonVisible, sunVisible } from '../bodies';
import { useChartSlot } from '../../../sky/SkyViewLayout';
import { ChartFrame } from '../ChartFrame';
import { drawsLayer, landmarkFor } from '../layers';
import { arcOf, type ChartPass, type FieldAim, type HiddenMarker, type SkyChartProps, type SkyChartView } from '../SkyChart.types';
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
/** Half the viewBox's side, user units: room for the labels outside the horizon. */
const VIEW_HALF = 125;
const VIEWBOX = `${String(-VIEW_HALF)} ${String(-VIEW_HALF)} ${String(2 * VIEW_HALF)} ${String(2 * VIEW_HALF)}`;
/** Resampling step along each arc (PLAN §8.3). */
const ARC_STEP_DEG = 2;
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

/**
 * R160 (FR-PHONE-10, D-970): `toPolar` run backwards — a point of the chart in user units (the horizon at `HORIZON_R`)
 * to the sky direction under it, in the convention drawn: the altitude from the radius (90° at the centre, 0° on the
 * ring, under it past the ring, which the hand's tilt clamps), the azimuth from the angle with east on the left or the
 * right. The point a pinch's midpoint names, which the window then faces.
 */
export function skyAt(point: Xy, orientation: ChartOrientation): FieldAim {
  const east = orientation === 'map' ? 1 : -1;
  const r = Math.hypot(point.x, point.y) / HORIZON_R;
  const az = r < 1e-9 ? 0 : (Math.atan2(east * point.x, -point.y) * 180) / Math.PI;
  return { azDeg: ((az % 360) + 360) % 360, altDeg: 90 - 90 * r };
}

/** A client point to the chart's user units: the viewBox is square and centred in the drawing's box (`xMidYMid meet`). */
function chartPoint(svg: SVGSVGElement, clientX: number, clientY: number): Xy {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width, rect.height) / (2 * VIEW_HALF) || 1;
  return { x: (clientX - rect.left - rect.width / 2) / scale, y: (clientY - rect.top - rect.height / 2) / scale };
}

/**
 * R122 (FR-SKY-4, FR-SKY-10; D-813): the star group is its own chunk. It has
 * nothing to draw until the page's `stars` chunk has given the scene its
 * stars, so it loads beside that one and the ladder, the collision rule and
 * the ink offsets stay out of `main`, shared with the window's chunk.
 */
/** R158: one loader for the chunk's four components, so the build writes one preload list and not four (`main` pays for each). */
const polarChunk = (): Promise<typeof import('./PolarStars')> => import('./PolarStars');
const PolarStars = lazy(() => polarChunk().then((module) => ({ default: module.PolarStars })));
/**
 * R158 (FR-LOOK-1, FR-LOOK-7, FR-PHONE-9; D-968, D-969, D-988): the surface and the band, the Moon's disc and the
 * window's field are the same chunk's, so the window's pure modules they draw with stay out of `main`. The Moon
 * draws FR-DOME-6's marker until the chunk lands, so a chart that has no stars yet still shows where it is.
 */
const PolarSky = lazy(() => polarChunk().then((module) => ({ default: module.PolarSky })));
const PolarMoon = lazy(() => polarChunk().then((module) => ({ default: module.PolarMoon })));
const PolarFieldOutline = lazy(() => polarChunk().then((module) => ({ default: module.PolarFieldOutline })));
/** The cardinal letters' size, user units (the sheet's `.cardinal`). */
const CARDINAL_PX = 12;
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
const SERIES_COUNT = 6;

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

export function SkyPolar({ passes, observer, highlightedPassId, onSelectPass, now, sun, moon, hidden = [], colorBy = 'highlight', fill = false, legendKeys = {}, legend, legendOpen, aside, stripe, measureBox, stacked, controls, scene, camera, hand, follow = false, onFieldHandoff, className }: SkyChartProps) {
  const t = useT();
  const orientation = useAppStore((s) => s.chartOrientation);
  const setChartOrientation = useAppStore((s) => s.setChartOrientation);
  const field = scene?.stars;
  /*
   * R158 (FR-PHONE-9, D-969, D-988): the window's field is outlined wherever the page has a camera — the one it
   * passes, or the hand camera the window left in the chart's slot — and is absent where it has none.
   */
  const fieldCamera = drawsLayer('polar', 'fieldOutline') ? (camera?.source === 'hand' ? camera : (hand?.get() ?? null)) : null;
  /*
   * R160 (FR-PHONE-10; D-970): the pinch back to the window. Two pointers on the drawing are tracked from the second's
   * press to the first's lift; where the distance between them shrank by more than `PINCH_HANDOFF_RATIO`, the lift
   * hands the view back to the window facing the point under the pinch's midpoint where it began (`skyAt`), through
   * `onFieldHandoff`. One pointer is nothing here (the chart has no drag), a third is ignored, a cancel hands nothing
   * over, and the first touch's request is not this gesture's (`SkyViewLayout` asks only on a tap's lift).
   */
  const pointersRef = useRef(new Map<number, Xy>());
  const pinchRef = useRef<{ a: number; b: number; from: number; last: number; mid: Xy } | null>(null);
  const forget = (pointerId: number): void => {
    pointersRef.current.delete(pointerId);
    const pinch = pinchRef.current;
    if (pinch !== null && (pinch.a === pointerId || pinch.b === pointerId)) pinchRef.current = null;
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (onFieldHandoff === undefined) return;
    const pointers = pointersRef.current;
    if (event.isPrimary) for (const id of [...pointers.keys()]) forget(id);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom and old browsers: the pinch still works while the pointers stay over the drawing.
    }
    if (pointers.size !== 2 || pinchRef.current !== null) return;
    const [first, second] = [...pointers.entries()] as [[number, Xy], [number, Xy]];
    const distance = Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y);
    pinchRef.current = { a: first[0], b: second[0], from: distance, last: distance, mid: chartPoint(event.currentTarget, (first[1].x + second[1].x) / 2, (first[1].y + second[1].y) / 2) };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const tracked = pointersRef.current.get(event.pointerId);
    if (!tracked) return;
    tracked.x = event.clientX;
    tracked.y = event.clientY;
    const pinch = pinchRef.current;
    if (pinch === null || (pinch.a !== event.pointerId && pinch.b !== event.pointerId)) return;
    const a = pointersRef.current.get(pinch.a);
    const b = pointersRef.current.get(pinch.b);
    if (a && b) pinch.last = Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>): void => {
    const pinch = pinchRef.current;
    const released = pinch !== null && (pinch.a === event.pointerId || pinch.b === event.pointerId) ? pinch : null;
    forget(event.pointerId);
    if (released === null || onFieldHandoff === undefined) return;
    if (released.last > 0 && released.from / released.last > PINCH_HANDOFF_RATIO) onFieldHandoff(skyAt(released.mid, orientation));
  };
  const onPointerCancel = (event: PointerEvent<SVGSVGElement>): void => {
    forget(event.pointerId);
  };
  /** D-755 (R158): the compass letters' boxes, the names' first obstacles, in user units — the letters are centred on their point. */
  const compass = useMemo(
    () =>
      CARDINALS.map(({ label, azDeg }) => {
        const p = project({ azDeg, elDeg: 0 }, orientation, LABEL_R);
        const w = label.length * 0.6 * CARDINAL_PX;
        return { x0: p.x - w / 2, y0: p.y - CARDINAL_PX / 2, x1: p.x + w / 2, y1: p.y + CARDINAL_PX / 2 };
      }),
    [orientation],
  );
  const ring = (elDeg: number): number => project({ azDeg: 0, elDeg }, orientation).y * -1;
  /*
   * R132 (FR-FLOW-4, D-842): inside a `SkyViewLayout` the convention line is the page's `readout` slot's and the
   * orientation control stands where the window's facing picker does, in the `picker` slot — the polar chart's
   * "facing" is its convention. Outside one both are the frame's rows, as R13 placed them.
   */
  const readoutSlot = useChartSlot('readout');
  const pickerSlot = useChartSlot('picker');
  const orientationControl = <ToggleGroup name={t.chart.orientationGroup} options={ORIENTATIONS.map((value) => ({ value, label: t.chart.orientation[value] }))} value={orientation} onChange={setChartOrientation} />;
  const convention = (
    <p className={styles.convention} data-testid="chart-convention">
      {t.chart.orientationNote[orientation]}
    </p>
  );
  return (
    <div className={[styles.polar, className].filter(Boolean).join(' ')} data-orientation={orientation}>
      {readoutSlot.place(convention)}
      {pickerSlot.place(orientationControl)}
      <ChartFrame
        fill={fill}
        legend={legend}
        aside={aside}
        stripe={stripe}
        {...(measureBox === undefined ? {} : { measureBox })}
        {...(stacked === undefined ? {} : { stacked })}
        {...(legendOpen === undefined ? {} : { legendOpen })}
        controls={
          <>
            {controls}
            {!pickerSlot.inLayout && orientationControl}
          </>
        }
        status={readoutSlot.inLayout ? null : convention}
      >
      <svg className={styles.svg} viewBox={VIEWBOX} aria-hidden="true" data-drawing="polar" focusable="false" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onLostPointerCapture={onPointerCancel}>
        {/* R158 (FR-LOOK-1, FR-LOOK-2): the sky surface and the band inside the rim, under everything, where the scene carries stars. */}
        {field && drawsLayer('polar', 'surface') && (
          <Suspense fallback={null}>
            <PolarSky positions={field.positions} project={project} />
          </Suspense>
        )}
        {/* FR-DOME-6: the glow is a surface, so it goes under the grid. */}
        {sun && sunVisible(sun) && <SunGlow sun={sun} orientation={orientation} />}
        {/* FR-SKY-1, FR-SKY-4, FR-PHONE-8: the star layer whole under the grid and the arcs, in SVG order. */}
        {field && (
          <Suspense fallback={null}>
            <PolarStars
              catalog={field.catalog}
              positions={field.positions}
              stars={field.layers.stars}
              figures={field.layers.figures}
              planets={field.layers.planets}
              names={field.layers.names}
              orientation={orientation}
              project={project}
              compass={compass}
              half={VIEW_HALF}
              horizonR={HORIZON_R}
              landmark={landmarkFor('polar', scene)}
            />
          </Suspense>
        )}
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
        {/* R158 (FR-PHONE-9): the window's field, over the stars and under the arcs. R160: following, the sensor's poses move it. */}
        {fieldCamera && (
          <Suspense fallback={null}>
            <PolarFieldOutline camera={fieldCamera} orientation={orientation} project={project} follow={follow} observer={observer} />
          </Suspense>
        )}
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
        {/* R158 (FR-LOOK-7): with its phase, by the table, where the scene carries stars (whose chunk draws it); FR-DOME-6's marker until it lands, and without stars. */}
        {moon &&
          moonVisible(moon) &&
          (field && drawsLayer('polar', 'moonDisc') ? (
            <Suspense fallback={<MoonMarker moon={moon} orientation={orientation} />}>
              <PolarMoon moon={moon} sun={sun ?? undefined} orientation={orientation} project={project} />
            </Suspense>
          ) : (
            <MoonMarker moon={moon} orientation={orientation} />
          ))}
      </svg>
      </ChartFrame>
    </div>
  );
}

export const POLAR_VIEW: SkyChartView = { Component: SkyPolar, id: 'polar' };
