import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale, useT } from '../../../../../i18n/useT';
import { cutTrack, type ArcState } from '../../../../../lib/arcReveal';
import { compassPoint } from '../../../../../lib/compass';
import { degrees, formatClockDuration, formatSignedDegrees } from '../../../../../lib/format';
import { SERIES_COUNT, seriesToken } from '../../../../../lib/legend';
import { isNoEvent, nextEvent } from '../../../../../lib/nextEvent';
import type { SunState } from '../../../../../lib/skyBodies';
import { interpolateTrack, resampleArc, splitArcAt } from '../../../../../lib/skyGeometry';
import type { MoonState, PassPoint } from '../../../../../model';
import { SEARCH_WINDOW_HOURS } from '../../../../../state/passWindow';
import { useScreenTurn } from '../../../screen/screenTurn';
import { quantise } from '../../../live/compassHeading';
import { useDeclination } from '../../../live/useDeclination';
import { NextEventBlock } from '../../../passes/NextEventBlock';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, moonVisible, sunVisible } from '../bodies';
import { ChartFrame } from '../ChartFrame';
import { arcOf, type ChartPass, type HiddenMarker, type SkyChartProps } from '../SkyChart.types';
import { CompassGutter } from './CompassGutter';
import { gutterMarks, passBearing, turnTo, type GutterMark, type GutterPass } from './gutter';
import { drawableDeg, groundState, lookDirection, project, scaleFor, uprightRotation, verticalHalfFieldDeg, WINDOW_FOV, type Mat3, type Projected, type View } from './projection';
import { nearestQuarter, type Quarter } from './screenTurn';
import styles from './SkyWindow.module.css';
import { useDeviceOrientation } from './useDeviceOrientation';

/**
 * R47 (FR-WIN-1, FR-WIN-2, FR-WIN-4, FR-WIN-5; US-21; PLAN D-188, §8.10): the
 * sky window — the sky as seen from the observer in the direction the phone
 * points, in SVG (FR-GUIDE-5), from `SkyChartProps` and nothing else
 * (FR-LIVE-10). The picks are the R38 spike's (`docs/window/FINDINGS.md`):
 * stereographic, `WINDOW_FOV` 60° across the shorter side, the rotation
 * smoothed on its axes by `WINDOW_SMOOTHING`.
 *
 * What it draws (FR-WIN-2): the horizon with the compass names where they
 * are in view, the 30° and 60° altitude lines and a zenith mark, azimuth
 * ticks every 30°, each pass as an arc through the same `resampleArc` the
 * dome and the polar use (FR-GUIDE-2b: one geometry), clipped to the
 * drawable field, with its rise, peak, end and shadow markers, the arrowhead,
 * the flown part and the live marker (FR-DOME-5), the Sun's glow and the
 * Moon's disc (FR-DOME-6), and the legend key at each peak (FR-LEG-1). Each
 * pass is drawn in its `arc` state as the polar draws it (FR-TRAJ-1, D-189).
 * Colours are the `--chart-*` tokens of `SkyPolar.module.css` (FR-DOME-2,
 * FR-LIVE-2).
 *
 * Everything positioned — markers, keys, names — stays in the DOM whether or
 * not it is in view, hidden by `visibility` and marked `data-in-view`: at
 * sixty frames a second a stable tree is cheaper than mounting and unmounting
 * nodes as they cross the edge, and the tests can read where a thing is.
 *
 * The drawing's box is measured (`ResizeObserver`), so the field spans the
 * shorter side whatever the frame gives it: the guide's square, the live
 * page's whole height. Before the first reading the picture is the phone held
 * upright toward the highlighted pass's peak, 20° up or as high as the peak
 * needs to stay inside the top of the box with its key (`placeholderAltDeg`,
 * D-241). `facingAzDeg` and `onDrag` are ignored: the window has no
 * hand-driven view (FR-WIN-5).
 *
 * FR-WIN-5: when the browser still needs a tap for orientation — the window
 * saved as the view and reloaded on iOS — the one `[ point at the sky ]`
 * control sits in the window's place until tapped. A refusal, or a phone with
 * no compass heading, is reported through `onUnavailable`, and `SkyChart`
 * shows the note and leaves the dome as the view (FR-WIN-4).
 *
 * R63 (FR-FSC-1; US-21 AC11; D-323): on the sky screen — `props.screen` — the
 * window has no chrome of its own: the frame gets no `controls`, so neither
 * the view control the page handed down nor the hint is drawn, and the readout
 * stays the `status` slot the frame turns into an overlay.
 *
 * R73 (FR-FSC-4 as rewritten, FR-FSC-10, FR-FSC-11; US-21 AC12, AC15; D-425,
 * D-427, D-428, D-429): and it draws whatever the viewport is doing. R63's
 * portrait veil — `(orientation: landscape)` gating the whole picture, with
 * `status={null}` and `legend={null}` under it — is gone: a viewport whose
 * rotation is locked never becomes landscape, so on those phones the veil was
 * the whole screen with nothing behind it. The SVG, the readout and the legend
 * are drawn in both orientations, `ground` is `groundState` in both again
 * (D-323 had made it landscape-only so the veil could win), and upright the
 * picture is the portrait box's with one line of advice over it
 * (`turnAdvice`), which the ground notes outrank.
 *
 * Which way is up is the pose's, not the viewport's (FR-FSC-10): `screenTurn`
 * reads the quarter from the rotation the hook already smooths, the projection
 * is composed with that quarter instead of `screen.orientation.angle`, and the
 * layer is turned by the difference — which is nothing at all on a phone whose
 * rotation is not locked, where the two numbers are the same. `data-orientation`
 * is read from the measured box, which is what the reader is looking at, and
 * not from a media query, which under a rotation lock is not.
 *
 * R79 (FR-GUT-1..8, US-28; D-450, D-451): the screen's bottom edge is the
 * compass gutter (`CompassGutter`, from `gutter.ts`), which takes the legend
 * strip's slot sideways. Its facing is `look.azDeg`, the smoothed heading the
 * readout shows, and its marks are one per drawn pass at the bearing the arc
 * is drawn from. When no drawn pass crosses the field — no arc in the box and
 * no tick inside the bracket — one `role="status"` chip over the drawing names
 * the pass whose next event is soonest, the turn to it and the countdown
 * (FR-GUT-6); FR-FOL-5's ground notes outrank it. Upright (FR-GUT-7) the frame
 * lays the screen out as five rows — the readout, the next-event block with
 * the advice under its peak line, the band, the legend's two rows and the
 * gutter — and FR-FSC-11's `role="status"` advice line is gone. Upright is
 * read from the *screen's* measured box (a probe in the overlay slot), not
 * from the drawing's, since the band is capped square and would otherwise
 * decide its own orientation.
 */

/** Resampling step along each arc (PLAN §8.3), the polar's. */
const ARC_STEP_DEG = 2;
/** The placeholder's altitude before the first reading: the horizon and the arc's lower part both in view. */
const PLACEHOLDER_ALT_DEG = 20;
/** How far inside the top of the box the placeholder keeps the peak, so its marker and key (9 px up) stay in view. */
const PEAK_INSET_DEG = 8;

/**
 * Where the placeholder looks in altitude: 20° up, so the horizon sits in the
 * lower part of the box, raised as far as the explained pass's peak needs to
 * stay inside the top with its key (a 61° peak in a square box at 60° across
 * asks for 39°). The vertical half-field comes from the measured box, not the
 * constant, because the box is only square on the phone's floor (D-233).
 */
export function placeholderAltDeg(peakElDeg: number | undefined, view: View): number {
  if (peakElDeg === undefined) return PLACEHOLDER_ALT_DEG;
  return Math.min(90, Math.max(PLACEHOLDER_ALT_DEG, peakElDeg - verticalHalfFieldDeg(view) + PEAK_INSET_DEG));
}
/** The box in jsdom, where nothing can be measured: the compact phone's square. */
const UNMEASURED = { width: 390, height: 390 };
/** How far outside the box a positioned thing is still "in view", so a marker leaves the frame rather than winking out at the edge. */
const EDGE_MARGIN = 14;

interface SkyPoint {
  azDeg: number;
  elDeg: number;
}

/** A line of constant altitude all the way round. */
const ring = (elDeg: number, stepDeg: number): SkyPoint[] => {
  const out: SkyPoint[] = [];
  for (let az = 0; az <= 360; az += stepDeg) out.push({ azDeg: az % 360, elDeg });
  return out;
};
const HORIZON = ring(0, 2);
const ALT_30 = ring(30, 3);
const ALT_60 = ring(60, 4);
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);
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
/** The names sit a little above the horizon line. */
const NAME_ALT_DEG = 3.5;

const fmt = (n: number): string => n.toFixed(1);

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
    d += `${pen ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)} `;
    pen = true;
  }
  return d;
}

/**
 * R56 (FR-FOL-5, D-278): the closed image of the horizon, for clipping the
 * ground's hatch to it. The projection is stereographic, so the horizon — a
 * great circle — draws a circle on the plane, and the point at infinity is the
 * antipode of where the phone points: with the centre of the field *below* the
 * horizon (which is every state this is drawn in) the sky is the part that
 * runs off to infinity, so the ground is exactly the inside of that closed
 * curve. It takes the horizon points the grid path already projected (F-57),
 * sampled the same way, but whole instead of clipped to the drawable field:
 * the curve may run far outside the box, and closing it is what makes the
 * clip a region.
 */
function groundClipPath(points: readonly Projected[]): string {
  let d = '';
  for (const p of points) {
    // Within a hair of the antipode the projection has no answer (`projectDevice` returns the centre);
    // those samples are hundreds of box-widths away and only exist when the centre is on the horizon itself.
    if (p.offAxisDeg > 179.5 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    d += `${d ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)} `;
  }
  return d ? `${d}Z` : '';
}

const inFrame = (p: Projected, view: View): boolean => p.front && p.x >= -EDGE_MARGIN && p.x <= view.width + EDGE_MARGIN && p.y >= -EDGE_MARGIN && p.y <= view.height + EDGE_MARGIN;
const inBox = (p: Projected, view: View): boolean => p.front && p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height;

/**
 * FR-GUT-6: whether any part of the arc the window draws for this pass is in
 * the box — the flown part up to `now` while the pass is `live`, the whole arc
 * otherwise, at the track's own samples.
 */
function arcInBox(pass: ChartPass, m: Mat3, view: View, now: number | undefined): boolean {
  const state = arcOf(pass);
  if (state === 'hidden') return false;
  const t = now ?? pass.end.t;
  const drawn = state === 'live' ? [...pass.track.filter((p) => p.t <= t), interpolateTrack(pass.track, t)] : pass.track;
  return drawn.some((p) => inBox(project(m, p.azDeg, p.elDeg, view), view));
}

/** The attributes every positioned element carries: where it is, and whether it is in the box. */
function placed(p: Projected, view: View): { transform: string; 'data-in-view': boolean; visibility?: 'hidden' } {
  const visible = inFrame(p, view);
  return { transform: `translate(${fmt(p.x)} ${fmt(p.y)})`, 'data-in-view': visible, ...(visible ? {} : { visibility: 'hidden' as const }) };
}

function Marker({ kind, p, view }: { kind: 'rise' | 'end' | 'shadow' | 'peak' | 'now'; p: Projected; view: View }) {
  const at = placed(p, view);
  switch (kind) {
    case 'peak':
      return <path className={styles.peak} data-marker="peak" d="M0 -7 L7 0 L0 7 L-7 0 Z" {...at} />;
    case 'shadow':
      // Half filled: the satellite crosses into (or out of) Earth's shadow here.
      return (
        <g data-marker="shadow" {...at}>
          <circle className={styles.point} r="6" />
          <path className={styles.shadowHalf} d="M0 -6 A6 6 0 0 1 0 6 Z" />
        </g>
      );
    case 'now':
      return <circle className={styles.now} data-marker="now" r="7" {...at} />;
    default:
      return <circle className={styles.point} data-marker={kind} r="6" {...at} />;
  }
}

/** FR-LEG-1: the key beside the peak marker, up and to the right of it. */
function KeyLabel({ p, view, text }: { p: Projected; view: View; text: string }) {
  return (
    <text className={styles.key} data-anchor="key" data-key={text} x={9} y={-9} {...placed(p, view)}>
      {text}
    </text>
  );
}

interface ArcProps {
  pass: ChartPass;
  m: Mat3;
  view: View;
  limitDeg: number;
  dim: boolean;
  /** FR-LIVE-2 (R32): 1–6 in `colorBy="pass"` mode, `null` in the guide's highlight mode. */
  series: number | null;
  now: number | undefined;
  legendKey: string | undefined;
  onSelect: ((passId: string) => void) | undefined;
}

function PassArc({ pass, m, view, limitDeg, dim, series, now, legendKey, onSelect }: ArcProps) {
  const state: ArcState = arcOf(pass);
  const arc = useMemo(() => resampleArc(pass.track, ARC_STEP_DEG), [pass.track]);
  if (state === 'hidden') return null;
  const at = (p: SkyPoint): Projected => project(m, p.azDeg, p.elDeg, view);
  const points = arc.map(at);
  const rise = at(pass.start);
  const peak = at(pass.peak);
  const end = at(pass.end);
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
  const key = legendKey === undefined ? null : <KeyLabel p={peak} view={view} text={legendKey} />;

  // FR-TRAJ-1, `live`: the cut track from the rise to the position at `now`, solid, with the marker; nothing beyond it.
  if (state === 'live') {
    const t = now ?? pass.end.t;
    const cut = resampleArc(cutTrack(pass, t), ARC_STEP_DEG).map(at);
    const current = interpolateTrack(pass.track, t);
    return (
      <g {...group}>
        <path className={styles.track} data-marker="live" d={pathFrom(cut, limitDeg)} />
        <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} view={view} />
        {t >= pass.peak.t && <Marker kind="peak" p={peak} view={view} />}
        <Marker kind="now" p={at(current)} view={view} />
        {key}
      </g>
    );
  }
  // `ahead`: the whole arc, thin and dotted, with the rise point marked. `linger`: the whole arc, thin, nothing marked.
  if (state === 'ahead' || state === 'linger') {
    return (
      <g {...group}>
        <path className={styles.track} data-marker={state} d={pathFrom(points, limitDeg)} />
        {state === 'ahead' && <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} view={view} />}
        {key}
      </g>
    );
  }

  // `full`: the pass detail's whole arc — FR-DOME-5's flown part over it, every marker, the arrowhead.
  const flown = pathFrom(splitArcAt(arc, now).flown.map(at), limitDeg);
  // The arrowhead sits four fifths of the way along the arc, pointing the way the satellite moves.
  const head = Math.max(1, Math.floor(0.8 * (points.length - 1)));
  const tail = points[head - 1] ?? rise;
  const tip = points[head] ?? end;
  const headingDeg = (Math.atan2(tip.y - tail.y, tip.x - tail.x) * 180) / Math.PI;
  const arrowAt = placed(tip, view);
  const arrowVisible = arrowAt['data-in-view'] && tail.front && tail.offAxisDeg <= limitDeg;
  const current: PassPoint | null = now !== undefined && now >= pass.start.t && now <= pass.end.t ? interpolateTrack(pass.track, now) : null;
  return (
    <g {...group}>
      <path className={styles.track} d={pathFrom(points, limitDeg)} />
      {flown && <path className={styles.flown} data-marker="flown" d={flown} />}
      <path
        className={styles.arrow}
        data-marker="arrow"
        d="M0 0 L-11 -5 L-11 5 Z"
        transform={`${arrowAt.transform} rotate(${fmt(headingDeg)})`}
        data-in-view={arrowVisible}
        {...(arrowVisible ? {} : { visibility: 'hidden' as const })}
      />
      <Marker kind={pass.startReason === 'shadow' ? 'shadow' : 'rise'} p={rise} view={view} />
      <Marker kind={pass.endReason === 'shadow' ? 'shadow' : 'end'} p={end} view={view} />
      <Marker kind="peak" p={peak} view={view} />
      {current && <Marker kind="now" p={at(current)} view={view} />}
      {key}
    </g>
  );
}

/** Pixels per degree at the centre of the view: the stereographic scale is `k · tan(θ/2)`, so `k / 2` per radian near the axis. */
const pixelsPerDegree = (view: View): number => (scaleFor(view) * Math.PI) / 360;

/**
 * FR-DOME-6: the Sun as a band of light on the horizon at its azimuth, the
 * polar's `SunGlow` through this projection — the same `../bodies` ramp, nine
 * samples across `± halfWidth` at half the band's height (F-4), the stroke as
 * tall as the band.
 */
function SunGlow({ sun, m, view, limitDeg }: { sun: SunState; m: Mat3; view: View; limitDeg: number }) {
  const strength = glowStrength(sun.altDeg);
  const halfWidth = glowHalfWidthDeg(strength);
  const height = glowHeightDeg(strength);
  const samples = 8;
  const points: Projected[] = [];
  for (let k = 0; k <= samples; k += 1) points.push(project(m, sun.azDeg - halfWidth + (2 * halfWidth * k) / samples, height / 2, view));
  return (
    <g data-body="sun">
      <path className={styles.glow} d={pathFrom(points, limitDeg)} strokeWidth={fmt(height * pixelsPerDegree(view))} opacity={fmt(0.3 + 0.5 * strength)} />
    </g>
  );
}

/** FR-DOME-6: the Moon's disc where it is; its phase and name are a legend line (R45). */
function MoonMarker({ moon, m, view }: { moon: MoonState; m: Mat3; view: View }) {
  return (
    <g data-body="moon">
      <circle className={styles.moon} data-marker="moon" r="7" {...placed(project(m, moon.azDeg, moon.elDeg, view), view)} />
    </g>
  );
}

/** FR-LIVE-6: an object up but not worth looking for — hollow, thin, dim — with its legend key above it. */
function HiddenPoint({ marker, m, view, legendKey }: { marker: HiddenMarker; m: Mat3; view: View; legendKey: string | undefined }) {
  const p = project(m, marker.azDeg, marker.elDeg, view);
  const at = placed(p, view);
  return (
    <g data-hidden-id={marker.id}>
      <circle className={styles.hidden} data-marker="hidden" r="4" {...at} />
      {legendKey !== undefined && (
        <text className={[styles.key, styles.hiddenKey].join(' ')} data-anchor="key" data-key={legendKey} y={-9} textAnchor="middle" {...at}>
          {legendKey}
        </text>
      )}
    </g>
  );
}

export function SkyWindow(props: SkyChartProps) {
  const { passes, observer, highlightedPassId, onSelectPass, now, sun, moon, hidden = [], initialFacingAzDeg, colorBy = 'highlight', fill = false, legendKeys = {}, legend, legendOpen, aside, stripe, boxAspect, stacked, controls, overlay, onUnavailable, className } = props;
  // D-323: `screen` reaches `SkyChartProps` with R62 (D-322); read through a cast, so this compiles either side of it.
  const onScreen = (props as SkyChartProps & { screen?: boolean }).screen === true;
  const t = useT();
  const locale = useLocale();
  // R44: the observer's declination, once per observer; the hook folds it into every heading.
  const declinationDeg = useDeclination(observer);
  const orientation = useDeviceOrientation(declinationDeg);

  // FR-WIN-4: a refusal or a compass-less phone is the boundary's to handle — the note, and the dome as the view.
  const { state } = orientation;
  useEffect(() => {
    if (state === 'denied' || state === 'relative') onUnavailable?.(state);
  }, [state, onUnavailable]);

  // The box, measured, so the field spans the shorter side of whatever the frame gives.
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(UNMEASURED);
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observerOfSize = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    observerOfSize.observe(box);
    return () => {
      observerOfSize.disconnect();
    };
  }, []);

  /*
   * R79 (FR-GUT-7, D-451): the screen's own box, for which way up the layout is. Upright the band is capped at as
   * tall as it is wide, so the drawing's box cannot answer the question it would then be shaped by; a probe that
   * fills the frame's overlay slot — the whole screen, in its layout box, before FR-FSC-10's turn — can. Null
   * until measured, and off a screen, where the drawing's box is the answer as it was.
   */
  const probeRef = useRef<HTMLSpanElement>(null);
  const [screenBox, setScreenBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const probe = probeRef.current;
    if (!onScreen || !probe || typeof ResizeObserver === 'undefined') return;
    const observerOfScreen = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) setScreenBox({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    observerOfScreen.observe(probe);
    return () => {
      observerOfScreen.disconnect();
    };
  }, [onScreen]);

  /*
   * FR-FSC-10 (D-424, D-425, D-429): which way is up to the reader. On a screen the projection is composed with
   * the quarter read from the pose — on an unlocked phone that *is* the browser's angle, and on a locked one it
   * is what the browser's angle would have been — and the layer is turned by the difference. Before the first
   * reading there is no pose to read, so the browser's own angle stands and the layer turns by nothing
   * (FR-FSC-10, "it starts at none"). Off a screen the value is the browser's angle and nothing moves (D-425).
   *
   * D-431: the fold itself is `useDeviceOrientation`'s, beside the rotation it folds — the hysteresis makes
   * each quarter depend on the one before it, and the frame that already eases the rotation is the one place
   * that can keep a previous value without a ref read in a render or a state set from an effect.
   */
  const { report } = useScreenTurn();
  const quarter: Quarter = onScreen && orientation.rotation !== null ? orientation.quarter : nearestQuarter(orientation.screenAngleDeg);
  useEffect(() => {
    // One report per turn of the hand, and none at all off a screen, where `report` is the context's no-op.
    if (onScreen) report(quarter);
  }, [onScreen, quarter, report]);

  const view: View = useMemo(
    () => ({ fovDeg: WINDOW_FOV, width: size.width, height: size.height, screenAngleDeg: onScreen ? quarter : orientation.screenAngleDeg }),
    [size, onScreen, quarter, orientation.screenAngleDeg],
  );
  const limitDeg = drawableDeg(view);

  // Before the first reading: upright toward the explained pass's peak (or the caller's facing), 20° up or as high as the peak needs.
  const highlighted = passes.find((pass) => pass.id === highlightedPassId) ?? passes[0];
  const placeholderAz = initialFacingAzDeg ?? highlighted?.peak.azDeg ?? 0;
  const placeholderAlt = placeholderAltDeg(highlighted?.peak.elDeg, view);
  const m = useMemo(() => orientation.rotation ?? uprightRotation(placeholderAz, placeholderAlt), [orientation.rotation, placeholderAz, placeholderAlt]);
  const look = lookDirection(m);
  const at = useCallback((p: SkyPoint): Projected => project(m, p.azDeg, p.elDeg, view), [m, view]);
  const zenith = at({ azDeg: 0, elDeg: 90 });

  // FR-FSC-4 as rewritten, FR-GUT-7 (D-427, D-451): the shape of the screen the reader is looking at, read from
  // the box that was measured and not from `(orientation: landscape)`, which a rotation lock never answers true;
  // the box, not the viewport, because FR-FSC-10 may have turned the layer under it. On a screen it is the
  // screen's box (the probe), since upright the drawing is a band cut to the width.
  const shape = onScreen && screenBox !== null ? screenBox : size;
  const upright = shape.height > shape.width;

  // FR-FOL-5 (D-278): pointed at the ground, in two steps — the hatch over the part of the field below the
  // horizon, and, once no sky is left in it, the whole box. Neither is modal: raising the phone is what leaves.
  // D-427: in every orientation again — D-323's landscape-only guard existed to let the portrait veil win, and
  // with no veil it is what would hide the ground note on an upright phone. F-58: `look` above is the one
  // `lookDirection` per render.
  const ground = groundState(look.altDeg, view);
  // F-57: the grid's horizon path and the ground clip share this — one projection of the 181 points, not two —
  // under the grid path's own condition, since the clip exists only in the `ground` state, which is inside it.
  // Buried, the horizon is drawn by neither and projected not at all.
  const drawsHorizon = ground !== 'buried';
  const horizonProjected = useMemo(() => (drawsHorizon ? HORIZON.map(at) : []), [at, drawsHorizon]);
  const veilClip = ground === 'ground' ? groundClipPath(horizonProjected) : '';
  const veil = ground === 'buried' || veilClip !== '';
  const uid = useId().replaceAll(':', '');

  /*
   * FR-GUT-2..5 (D-450): the gutter's marks, one per drawn pass in legend order, at the bearing the arc is drawn
   * from — where the satellite is while it is up, where it rises otherwise — in the arc's own colour token.
   */
  const facingDeg = look.azDeg;
  const drawnPasses = useMemo(() => passes.map((pass, index) => ({ pass, index })).filter(({ pass }) => arcOf(pass) !== 'hidden'), [passes]);
  // Not memoised: the facing is the sensor's and changes every frame the drawing does, and so does everything below.
  const marks: GutterMark[] = onScreen
    ? gutterMarks(
        drawnPasses.map(({ pass, index }): GutterPass => ({
          id: pass.id,
          name: pass.name,
          key: legendKeys[pass.id] ?? '',
          color: colorBy === 'pass' ? seriesToken(index) : highlightedPassId !== null && highlightedPassId !== pass.id ? 'pass-dim' : 'pass',
          bearingDeg: passBearing(pass, now),
        })),
        facingDeg,
        view,
      )
    : [];

  /*
   * FR-GUT-6: the empty-field chip. The field is empty when no drawn pass crosses it — no tick inside the bracket
   * and no part of any arc in the box. Then the one line names the pass whose next event is soonest (FR-FIRST-3's
   * rule, `nextEvent`), the shorter turn to where it is or will rise, and the countdown from the shown instant
   * (FR-FSC-8: the screen always has one); with nothing in the span it names no direction. The ground notes outrank
   * it, so over the ground it is not drawn at all.
   */
  let chip: string | null = null;
  if (onScreen && now !== undefined && ground === 'sky' && !marks.some((mark) => mark.branch === 'in-bracket') && !drawnPasses.some(({ pass }) => arcInBox(pass, m, view, now))) {
    const event = nextEvent(
      drawnPasses.map(({ pass }) => pass),
      now,
    );
    if (isNoEvent(event)) chip = t.window.emptySky;
    else {
      const turn = turnTo(passBearing(event.pass, now), facingDeg);
      chip = t.window.emptyField({ name: event.pass.name, angle: degrees(turn.angleDeg), side: turn.side, kind: event.kind, countdown: formatClockDuration((event.at - now) / 1000) });
    }
  }
  const hatchId = `${uid}-hatch`;
  const clipId = `${uid}-ground`;

  const live = state === 'on';
  const status = live ? (
    <p className={styles.readout} data-testid="window-readout">
      <span>{t.window.readout({ point: compassPoint(look.azDeg), azimuth: degrees(quantise(look.azDeg)), altitude: degrees(look.altDeg) })}</span>
      <br />
      <span className={styles.declination} data-testid="window-heading" data-declination={declinationDeg.toFixed(1)}>
        {t.window.trueNorth({ declination: formatSignedDegrees(declinationDeg, locale) })}
      </span>
    </p>
  ) : state === 'waiting' || (state === 'idle' && !orientation.needsGesture) ? (
    <p className={styles.note} data-testid="window-note">
      {t.window.waiting}
    </p>
  ) : null;

  return (
    <div
      className={[styles.window, className].filter(Boolean).join(' ')}
      data-state={state}
      data-ground={ground}
      {...(onScreen ? { 'data-screen': 'true', 'data-orientation': upright ? 'portrait' : 'landscape' } : {})}
      data-look-az={quantise(look.azDeg)}
      data-look-alt={Math.round(look.altDeg)}
    >
      <ChartFrame
        fill={fill}
        legend={legend}
        aside={aside}
        stripe={stripe}
        {...(boxAspect === undefined ? {} : { boxAspect })}
        {...(stacked === undefined ? {} : { stacked })}
        {...(legendOpen === undefined ? {} : { legendOpen })}
        /* D-322: the frame's screen mode is the window's to pass on — it is the window that renders the frame. Cast, like `screen` itself, so this compiles either side of R62. */
        {...({ screen: onScreen } as { screen?: boolean })}
        /* FR-FSC-1, D-321 (R64): the page's own children over the drawing — the follow screen's `×`. R62 put the
           slot on `ChartFrameProps` and on `SkyChartProps`; this is the last link, and the window is what renders
           the frame. Off a screen there is no overlay slot in the frame, so nothing changes for the pass detail. */
        {...(overlay === undefined && !onScreen
          ? {}
          : {
              overlay: (
                <>
                  {overlay}
                  {/* R79 (D-451): the screen's own box, measured for which way up the layout is. */}
                  {onScreen && <span className={styles.probe} ref={probeRef} aria-hidden="true" />}
                </>
              ),
            })}
        /* R79 (FR-GUT-1, FR-GUT-7; D-450, D-451): on a screen the bottom slot is the gutter, and upright the frame
           lays out the rows around a band with the next-event block above it. */
        {...(onScreen
          ? {
              gutter: <CompassGutter facingDeg={facingDeg} view={view} marks={marks} />,
              upright,
              headline: upright ? (
                <div className={styles.headline} data-testid="window-headline">
                  <NextEventBlock passes={drawnPasses.map(({ pass }) => pass)} {...(now === undefined ? {} : { now })} hours={SEARCH_WINDOW_HOURS} />
                  {/* FR-GUT-7 (D-451): the advice is secondary copy under the peak line, not a note over the picture. */}
                  <p className={styles.advice} data-testid="window-turn-advice">
                    {t.window.turnAdvice}
                  </p>
                </div>
              ) : null,
            }
          : {})}
        /* FR-FSC-1, D-323: the screen has no control row — neither the page's view control nor the hint. */
        controls={
          onScreen ? undefined : (
            <>
              {controls}
              <p className={styles.hint}>{t.window.hint}</p>
            </>
          )
        }
        status={status}
      >
        <div className={styles.box} ref={boxRef}>
          <svg className={styles.svg} viewBox={`0 0 ${String(view.width)} ${String(view.height)}`} aria-hidden="true" data-drawing="window" focusable="false">
            {/* FR-FOL-5: the ground's hatch — a pattern, not a colour, so it reads without one (FR-X-5). */}
            {ground !== 'sky' && (
              <defs>
                <pattern id={hatchId} data-pattern="ground" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect className={styles.groundFill} width="8" height="8" />
                  <line className={styles.groundHatch} x1="0" y1="0" x2="0" y2="8" />
                </pattern>
                {veilClip && (
                  <clipPath id={clipId}>
                    <path d={veilClip} />
                  </clipPath>
                )}
              </defs>
            )}
            {/* FR-FOL-5: with no sky left in the field there is nothing to draw but the ground. */}
            {ground !== 'buried' && (
              <>
                {/* FR-DOME-6: the glow is a surface, so it goes under the grid. */}
                {sun && sunVisible(sun) && <SunGlow sun={sun} m={m} view={view} limitDeg={limitDeg} />}
                <g className={styles.grid}>
                  <path className={styles.altitude} data-ring="60" d={pathFrom(ALT_60.map(at), limitDeg)} />
                  <path className={styles.altitude} data-ring="30" d={pathFrom(ALT_30.map(at), limitDeg)} />
                  <path className={styles.horizon} data-horizon d={pathFrom(horizonProjected, limitDeg)} />
                  {TICKS.map((azDeg) => {
                    const a = at({ azDeg, elDeg: 0 });
                    const b = at({ azDeg, elDeg: 2 });
                    const visible = inFrame(a, view) && b.front;
                    return <line key={azDeg} className={styles.tick} data-tick={azDeg} x1={fmt(a.x)} y1={fmt(a.y)} x2={fmt(b.x)} y2={fmt(b.y)} data-in-view={visible} {...(visible ? {} : { visibility: 'hidden' as const })} />;
                  })}
                  <g className={styles.zenith} data-marker="zenith" {...placed(zenith, view)}>
                    <line x1={-6} y1={0} x2={6} y2={0} />
                    <line x1={0} y1={-6} x2={0} y2={6} />
                  </g>
                  {COMPASS.map(({ azDeg, name, major }) => (
                    <text
                      key={name}
                      className={major ? styles.compassMajor : styles.compass}
                      {...(major ? { 'data-anchor': name } : { 'data-compass': name })}
                      textAnchor="middle"
                      {...placed(at({ azDeg, elDeg: NAME_ALT_DEG }), view)}
                    >
                      {name}
                    </text>
                  ))}
                </g>
                {passes.map((pass, index) => (
                  <PassArc
                    key={pass.id}
                    pass={pass}
                    m={m}
                    view={view}
                    limitDeg={limitDeg}
                    dim={highlightedPassId !== null && highlightedPassId !== pass.id}
                    series={colorBy === 'pass' ? (index % SERIES_COUNT) + 1 : null}
                    now={now}
                    legendKey={legendKeys[pass.id]}
                    onSelect={onSelectPass}
                  />
                ))}
                {hidden.map((marker) => (
                  <HiddenPoint key={marker.id} marker={marker} m={m} view={view} legendKey={legendKeys[marker.id]} />
                ))}
                {moon && moonVisible(moon) && <MoonMarker moon={moon} m={m} view={view} />}
              </>
            )}
            {/* FR-FOL-5: the hatch over the ground — clipped to the horizon while some sky is left, the whole box once none is. */}
            {veil && (
              <rect
                className={styles.groundVeil}
                data-ground-veil={ground}
                x="0"
                y="0"
                width={view.width}
                height={view.height}
                fill={`url(#${hatchId})`}
                {...(ground === 'ground' ? { clipPath: `url(#${clipId})` } : {})}
              />
            )}
          </svg>
          {/* FR-FOL-5: the note in the drawing, spoken (`role="status"`), never modal: raising the phone is what leaves it. */}
          {ground !== 'sky' && (
            <p className={ground === 'buried' ? styles.buriedNote : styles.groundNote} role="status" data-testid="window-ground-note" data-ground={ground}>
              {ground === 'buried' ? t.window.buried : t.window.ground}
            </p>
          )}
          {/* FR-GUT-6: over an empty field, one line naming the next pass and the turn to it. The ground notes
              above outrank it, so at most one line ever stands over the drawing. */}
          {chip !== null && (
            <p className={styles.chip} role="status" data-testid="window-chip">
              {chip}
            </p>
          )}
          {/* R66 (FR-WIN-5 as amended v1.3.1, V13-8): no `[ point at the sky ]`. The window is only ever mounted
              on the sky screen, and the tap that opened the screen is the tap that asked (FR-WIN-4, D-350), so
              the gate had nothing left to guard: it was already suppressed on a screen (R64), and a screen is
              now the only place a window is. `useDeviceOrientation` keeps `start` for the state machine. */}
        </div>
      </ChartFrame>
    </div>
  );
}
