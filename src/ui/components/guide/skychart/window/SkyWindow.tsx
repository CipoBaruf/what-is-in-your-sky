import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useStarsPageT } from '../../../../../i18n/starsPageT';
import { useLocale, useT } from '../../../../../i18n/useT';
import { cutTrack, type ArcState } from '../../../../../lib/arcReveal';
import { compassPoint } from '../../../../../lib/compass';
import { degrees, formatClockDuration, formatSignedDegrees } from '../../../../../lib/format';
import { landmarkLine, landmarkNames } from '../../../../../lib/landmarkLine';
import { SERIES_COUNT, seriesToken } from '../../../../../lib/legend';
import { isNoEvent, nextEvent } from '../../../../../lib/nextEvent';
import { shortcutFor } from '../../../../../lib/shortcuts';
import type { SunState } from '../../../../../lib/skyBodies';
import { interpolateTrack, resampleArc, splitArcAt } from '../../../../../lib/skyGeometry';
import { constellationName, starName } from '../../../../../lib/skyStars';
import type { MoonState, PassPoint } from '../../../../../model';
import { SEARCH_WINDOW_HOURS } from '../../../../../state/passWindow';
import { STAR_LABEL_HOLD_S } from '../../../../screens/stars/field';
import { useScreenTurn } from '../../../screen/screenTurn';
import { quantise } from '../../../live/compassHeading';
import { useDeclination } from '../../../live/useDeclination';
import { NextEventBlock } from '../../../passes/NextEventBlock';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, moonVisible, sunVisible } from '../bodies';
import { useLayoutMode } from '../../../../hooks/useLayoutMode';
import { TextButton } from '../../../primitives/TextButton';
import { useSkyScreen } from '../../../screen/useSkyScreen';
import { useChartSlot } from '../../../sky/SkyViewLayout';
import { ChartFrame } from '../ChartFrame';
import { landmarkFor, sceneFor } from '../layers';
import { arcOf, FACING_OPTIONS, type ChartPass, type HiddenMarker, type SkyChartProps } from '../SkyChart.types';
import { createHandCamera, facePeak, nextRising, openingFacing, passPosition, SENSOR_CAMERA, ZOOM_KEY_FACTOR, ZOOM_WHEEL_RATE, type HandCamera, type SkyCamera } from './camera';
import { CompassGutter } from './CompassGutter';
import { FacingPicker, type FacingPickerProps, type FollowTarget } from './FacingPicker';
import { gutterMarks, passBearing, turnTo, type GutterMark, type GutterPass } from './gutter';
import { clampWindowFov, COMPASS, drawableDeg, EDGE_MARGIN_PX, groundClipPath, groundState, HORIZON, lookDirection, NAME_ALT_DEG, project, ring, scaleFor, uprightRotation, verticalHalfFieldDeg, WINDOW_FOV, type Mat3, type Projected, type SkyPoint, type View } from './projection';
import { nearestQuarter, turnFor, type Quarter } from './screenTurn';
import styles from './SkyWindow.module.css';
import { hitLine, hitTest, HIT_RADIUS_PX, type Point } from './starGlyphs';
import { catalogNames, figureKey, namedReadout, StarField } from './StarField';
import type { LabelSegment } from './starLabels';
import { useViewRotation, type HandPose } from './useViewRotation';

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
 *
 * R113 (FR-STAR-4, FR-STAR-9, FR-STAR-11; D-750, D-751): the window is re-cut
 * for the stars without changing what it draws today. The rotation comes from
 * `useViewRotation(camera)`, one `Mat3` whichever source drives it: the
 * sensor, as before, when no `camera` is given or the camera's source is
 * `sensor`; the hand when the stars page hands a `HandCamera`, and then the
 * box takes the dome's controls — a captured pointer drag folded into one
 * camera move per animation frame, the arrow keys while the box has focus —
 * and the sensor is never armed. The same hook publishes each rotation to
 * subscribers in the commit that draws it, and `scene.stars` mounts the
 * `StarField` group, the one layer written outside render; without a scene
 * nothing is mounted and the tree is `v2.3.0`'s.
 *
 * R125 (FR-SKY-14; FR-WIN-1, FR-GUT-3, FR-STAR-4 as amended; D-798, D-820,
 * D-821): the zoom. The field across the box's shorter side is `fovDeg` —
 * the hand camera's under the hand (page state: the slot keeps it through the
 * dome and back, as it keeps the facing), this window's own state under the
 * sensor, `WINDOW_FOV` on every page and every opening of the screen, never
 * saved — and everything `WINDOW_FOV`
 * fed reads it: the projection's `view`, the placeholder, the ground state,
 * the gutter's bracket. One pointer handler on the box tracks the active
 * pointers: one is FR-STAR-4's drag (under the hand), two are the pinch, which
 * scales the field by the inverse of the change in their distance, folded
 * into one move per animation frame like the drag; a native `wheel` listener
 * (`passive: false`, since React's own is passive) takes ctrl + wheel at
 * `ZOOM_WHEEL_RATE` and lets a plain wheel scroll the page; `+`/`=`/`-` and
 * `0` are the box's keys beside the arrows. Glyphs, line weights and hit
 * distances are px and stay so: zooming in spreads the same marks apart.
 *
 * R151 (FR-GYRO-2..5; D-941, D-942, D-955): `follow` — the page's own window
 * following the phone, which is the sky screen's sensor path run in the page's
 * box. `useViewRotation` arms the sensor beside the hand camera and draws the
 * phone's pose from its first reading; the field is the hand's `fovDeg`, which
 * the pinch keeps writing. FR-FSC-10's quarter is read from the pose as on the
 * screen, the projection is composed with it, and the box's contents — the
 * drawing and the ground notes — are turned by the difference from the
 * browser's angle inside the box, sides swapped, as the screen's layer was.
 * Nothing is drawn over the drawing but the ground notes: no readout, no hint,
 * no chip. The box keeps the hand's focus and pointer handlers, and the finger
 * wins: a press that travels past the tap's slop, or one of FR-SKY-14's keys,
 * seeds the hand camera with the last pose (`poseAsHand`), calls
 * `onFollowEnd(pose)` and then moves the hand as it always did. Turning
 * following off from the page seeds the hand the same way.
 */

/** The window's props: `SkyChartProps`, which every view implements; `camera` is on it for the window alone. */
export type SkyWindowProps = SkyChartProps & {
  /**
   * R151 (FR-GYRO-2, FR-GYRO-5; D-941): the page's own window follows the phone. With a hand camera, the sensor
   * drives the facing and the tilt from its next reading, the field stays the hand's (the pinch writes it), the
   * picture is turned upright to the reader inside the window's own box (FR-FSC-10), and nothing is drawn over it
   * but FR-FOL-5's ground notes. The page owns it (D-943); `false` by default.
   */
  follow?: boolean;
  /**
   * R151 (FR-GYRO-4; D-942): the finger wins — called once, before anything moves, when a drag starts or one of
   * FR-SKY-14's keys is pressed while following, with the pose the hand camera has just been given (where the
   * phone last pointed). The page turns its follow state off. A pinch does not call it.
   */
  onFollowEnd?: (pose: HandPose) => void;
};

/** The hand's stand-in for the placeholder: `useViewRotation` never reads its fallback under the hand. */
const NO_PLACEHOLDER: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
/** Resampling step along each arc (PLAN §8.3), the polar's. */
const ARC_STEP_DEG = 2;

/** FR-FLOW-14 as amended (D-883): the hand cameras opened before the passes were known and not yet turned or moved. */
const UNTURNED = new WeakSet<HandCamera>();
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
/** FR-SKY-14: the box's zoom keys; with ctrl or cmd they are the browser's page zoom and the box leaves them alone. */
const ZOOM_KEYS: ReadonlySet<string> = new Set(['+', '=', '-', '0']);
/** Whether the box holds this pointer's capture; jsdom and old browsers, which cannot capture, never do. */
function hasCapture(event: PointerEvent<HTMLDivElement>): boolean {
  try {
    return event.currentTarget.hasPointerCapture(event.pointerId);
  } catch {
    return false;
  }
}

// R114 (D-754): `SkyPoint`, `ring`, `HORIZON` and `groundClipPath` are `projection.ts`'s now, shared with the star field.
const ALT_30 = ring(30, 3);
const ALT_60 = ring(60, 4);
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);
// R116: `COMPASS` and `NAME_ALT_DEG` are `projection.ts`'s now, so the star field places its names after the compass.

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

const inFrame = (p: Projected, view: View): boolean => p.front && p.x >= -EDGE_MARGIN_PX && p.x <= view.width + EDGE_MARGIN_PX && p.y >= -EDGE_MARGIN_PX && p.y <= view.height + EDGE_MARGIN_PX;
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
  const drawn = state === 'live' ? cutTrack(pass, t) : pass.track;
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

export function SkyWindow(props: SkyWindowProps) {
  const { passes, observer, highlightedPassId, onSelectPass, now, sun, moon, hidden = [], initialFacingAzDeg, colorBy = 'highlight', fill = false, legendKeys = {}, legend, legendOpen, aside, stripe, measureBox, stacked, controls, overlay, onUnavailable, scene: given, camera: givenCamera, hand, facingOptions = FACING_OPTIONS, facingPassId = null, inventory = 'passes', namedStar: givenNamed = null, onNameStar, className, follow = false, onFollowEnd } = props;
  // FR-SKY-1 (R119): the scene through the layer table. The window's row has every layer and no cap, so today this is the page's scene object; the memo keeps it so if the row ever drops one.
  const scene = useMemo(() => sceneFor('window', given), [given]);
  // R127 (FR-SKY-11, D-796): the landmark star this window rings and names, from the page's scene through the table.
  const landmark = useMemo(() => landmarkFor('window', given), [given]);
  /*
   * R127 (FR-STAR-7 as amended, FR-STAR-14; FR-LEG-1 as amended: "a tap names a star anywhere"): where the page
   * holds no named object — the live page, the pass detail and their screens — the window holds its own, cleared
   * after `STAR_LABEL_HOLD_S` as the stars page clears its; the stars page's `namedStar` and `onNameStar` win where
   * they are given, since its list shares the value.
   */
  const [ownNamed, setOwnNamed] = useState<number | null>(null);
  useEffect(() => {
    if (ownNamed === null || onNameStar !== undefined) return;
    const id = window.setTimeout(() => {
      setOwnNamed(null);
    }, STAR_LABEL_HOLD_S * 1000);
    return () => {
      window.clearTimeout(id);
    };
  }, [ownNamed, onNameStar]);
  const namedStar = onNameStar === undefined ? ownNamed : givenNamed;
  const nameStar = onNameStar ?? setOwnNamed;
  // D-323: `screen` reaches `SkyChartProps` with R62 (D-322); read through a cast, so this compiles either side of it.
  const onScreen = (props as SkyChartProps & { screen?: boolean }).screen === true;
  const t = useT();
  const sp = useStarsPageT();
  const locale = useLocale();
  const compact = useLayoutMode() === 'compact';
  /*
   * FR-SKY-7 (D-790): the explained pass — the pass detail's one — and its peak where the page's picker offers
   * `peak`. The pass detail's window opens facing it, on the page and on the screen before the first reading.
   */
  const explained = useMemo(() => passes.find((pass) => pass.id === highlightedPassId) ?? null, [passes, highlightedPassId]);
  const peak = facingOptions.includes('peak') && explained !== null ? explained.peak : null;
  /*
   * D-789 (R121): the camera. The stars page hands one in; the chart hands a slot, from which this window takes
   * the camera a window before it left, or makes one on its first mount — the pass detail's at the peak, the live
   * page's facing the pass (R136, FR-FLOW-14: `openingFacing` — following the highlighted pass, else the next
   * rise, else the pole side) — and leaves it there, so the dome and back, and a turn of the phone, find the facing
   * where it was. Neither given, the sensor drives.
   */
  const [slotCamera] = useState(() => {
    if (hand === undefined || givenCamera !== undefined) return null;
    const kept = hand.get();
    if (kept !== null) return kept;
    if (peak !== null) return createHandCamera(facePeak(peak, WINDOW_FOV));
    const followed = facingPassId === null ? null : (passes.find((pass) => pass.id === facingPassId) ?? null);
    const opened = createHandCamera(openingFacing({ latDeg: observer.lat, now }, followed, nextRising(passes, now)));
    if (passes.length === 0) UNTURNED.add(opened);
    return opened;
  });
  useEffect(() => {
    if (slotCamera !== null) hand?.keep(slotCamera);
  }, [hand, slotCamera]);
  /*
   * FR-FLOW-14 as amended (V26-16, D-883): a camera opened before the passes were known is in `UNTURNED` until it
   * turns or the reader moves it. Every write to the camera reaches its listeners, so one subscription is the
   * "moved" flag; it unsubscribes at the first write after the turn, and the turn's own write is told apart by
   * `turningRef`. The set is keyed by the camera, so a remount from the slot (the dome and back, a turn of the
   * phone) before the passes arrive still turns. The turn itself is below, where the offered pass is known.
   */
  const turningRef = useRef(false);
  useEffect(() => {
    if (slotCamera === null || !UNTURNED.has(slotCamera)) return;
    const stop = slotCamera.subscribe(() => {
      if (turningRef.current) return;
      UNTURNED.delete(slotCamera);
      stop();
    });
    return stop;
  }, [slotCamera]);
  const camera: SkyCamera = givenCamera ?? slotCamera ?? SENSOR_CAMERA;
  // FR-SKY-2: the window laid out in the page's box under the hand — the frame cuts the box and corners the readout.
  const inBox = hand !== undefined && camera.source === 'hand' && !onScreen;
  // R44: the observer's declination, once per observer; the hook folds it into every heading.
  const declinationDeg = useDeclination(observer);

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

  const handCamera = camera.source === 'hand' ? camera : null;
  // R151 (D-941): following the phone needs a hand to hand back to; the sensor draws while it lasts.
  const followPhone = follow && handCamera !== null;
  const byHand = handCamera !== null && !followPhone;
  /*
   * FR-SKY-14 (D-798, D-820): the field under the sensor — the screen's — is this window's own state, `WINDOW_FOV`
   * at every mount (every opening of the screen opens at the default) and written only by the pinch below; under
   * the hand the field is the camera's and this is not read. Neither reaches the prefs or the hash.
   */
  const [sensorFov, setSensorFov] = useState(WINDOW_FOV);
  // Before the first reading: upright toward the explained pass's peak (or the caller's facing), 20° up or as high as the peak needs.
  // The placeholder's altitude reads the box's shape and not its angle (`verticalHalfFieldDeg`), so it is known before the hook that gives the angle.
  // Under the hand there is no first reading to wait for, so nothing is computed and the hook never reads it.
  const placeholder = useMemo(() => {
    if (handCamera !== null) return NO_PLACEHOLDER;
    // FR-SKY-7 (R121, D-790): opened from a pass detail — an explained pass and no facing of the caller's — the
    // screen looks at the peak as `facePeak` says until the sensor's first reading, at the field shown (R125). The
    // live page's screen, which names its facing, keeps D-241's placeholder.
    if (explained !== null && initialFacingAzDeg === undefined) {
      const aim = facePeak(explained.peak, sensorFov);
      return uprightRotation(aim.azDeg, aim.altDeg);
    }
    const highlighted = explained ?? passes[0];
    const placeholderAlt = placeholderAltDeg(highlighted?.peak.elDeg, { fovDeg: sensorFov, width: size.width, height: size.height, screenAngleDeg: 0 });
    return uprightRotation(initialFacingAzDeg ?? highlighted?.peak.azDeg ?? 0, placeholderAlt);
  }, [handCamera, passes, explained, initialFacingAzDeg, size.width, size.height, sensorFov]);

  // R113 (D-750, D-751): the one rotation, from the sensor or the hand, and the channel the star field reads it by.
  const { rotation: m, hand: handState, live, subscribe, orientation, poseAsHand } = useViewRotation(camera, declinationDeg, placeholder, followPhone);
  // FR-SKY-14: the field this render draws — the camera's under the hand, the window's own under the sensor.
  const fovDeg = handState?.fovDeg ?? sensorFov;
  // The hand's view is laid out upright on whatever screen it is on: the sensor's screen angle (read at mount,
  // and not followed while the sensor is off) is no part of it.
  const screenAngleDeg = byHand ? 0 : orientation.screenAngleDeg;

  /*
   * FR-FSC-10 (D-424, D-425, D-429): which way is up to the reader. On a screen — and, R151 (D-941), in a window
   * following the phone — the projection is composed with the quarter read from the pose: on an unlocked phone that
   * *is* the browser's angle, and on a locked one it is what the browser's angle would have been. Before the first
   * reading there is no pose to read, so the browser's own angle stands (FR-FSC-10, "it starts at none"). Elsewhere
   * the value is the browser's angle and nothing moves (D-425). The screen's layer is turned by the difference
   * (`SkyScreen`); the following window turns its own box's contents by it (`turnDeg`), sides swapped for a quarter.
   *
   * D-431: the fold itself is `useDeviceOrientation`'s, beside the rotation it folds — the hysteresis makes
   * each quarter depend on the one before it, and the frame that already eases the rotation is the one place
   * that can keep a previous value without a ref read in a render or a state set from an effect.
   */
  const turnsWithPose = onScreen || followPhone;
  const quarter: Quarter = turnsWithPose && orientation.rotation !== null ? orientation.quarter : nearestQuarter(screenAngleDeg);
  const turnDeg = followPhone ? turnFor(quarter, screenAngleDeg) : 0;
  const sideways = Math.abs(turnDeg) === 90;
  // The drawing's own box: the measured one, its sides swapped while it is turned a quarter.
  const drawWidth = sideways ? size.height : size.width;
  const drawHeight = sideways ? size.width : size.height;

  // FR-WIN-4: a refusal or a compass-less phone is the boundary's to handle — the note, and the dome as the view.
  const { state } = orientation;
  useEffect(() => {
    if (state === 'denied' || state === 'relative') onUnavailable?.(state);
  }, [state, onUnavailable]);

  /*
   * FR-STAR-4 (D-750): under the hand the box takes the dome's controls, from the dome's own handlers' shape
   * (`SkyDome`): the pointer is captured on the way down and its moves are summed into one camera move per
   * animation frame, so a fast finger costs one render a frame and not one a move; the arrow keys step the
   * camera while the box has focus (`tabIndex` only then — the sensor-driven box is not focusable and its DOM is
   * unchanged). The camera is the page's store, so a move notifies `useViewRotation` and the page alike, and
   * neither React state nor a callback prop stands in the per-frame path.
   */
  /*
   * R151 (FR-GYRO-2, FR-GYRO-4; D-942): where following ends, the hand takes the sky from where the phone last
   * pointed. The finger's way — a drag, a box key — seeds the hand camera and tells the page (`endFollow`), once a
   * spell, before the drag or the key moves anything; the page's own way — the toggle turned off — is seen here as
   * `follow` falling and seeds the hand the same way, in the layout effect of that commit, before it is painted.
   * Before any reading there is no pose: the hand's own is what was drawn, and it stays.
   */
  const followEndedRef = useRef(false);
  const wasFollowingRef = useRef(followPhone);
  useLayoutEffect(() => {
    const was = wasFollowingRef.current;
    wasFollowingRef.current = followPhone;
    if (followPhone) {
      followEndedRef.current = false;
      return;
    }
    if (!was || followEndedRef.current || handCamera === null) return;
    const pose = poseAsHand();
    if (pose !== null) handCamera.open(pose);
  }, [followPhone, handCamera, poseAsHand]);
  const endFollow = (): void => {
    if (!followPhone || handCamera === null || followEndedRef.current) return;
    followEndedRef.current = true;
    const sensed = poseAsHand();
    if (sensed !== null) handCamera.open(sensed);
    const { azDeg, altDeg, fovDeg: field } = handCamera.get();
    onFollowEnd?.(sensed ?? { azDeg, altDeg, fovDeg: field });
  };
  const dragRef = useRef<{ pointerId: number; x: number; y: number; x0: number; y0: number; travel: number } | null>(null);
  const pendingRef = useRef<{ dx: number; dy: number } | null>(null);
  const frameRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);
  /*
   * FR-SKY-14 (D-798, D-821): the zoom's pointers. Every active pointer on the box is tracked; the first is the
   * drag's (under the hand), the second makes the two a pinch — the drag ends there, its pending move dropped —
   * and a third is nothing. The pinch's factor is the product of the change in the two pointers' distance since
   * the last frame, inverted (fingers apart narrow the field), and ctrl + wheel and the keys multiply into the
   * same pending factor, so one frame applies one zoom whatever drove it. After a pinch the finger left on the
   * box does not take up the drag: a jump to where it now is would be the first thing the reader saw.
   */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ a: number; b: number; distance: number } | null>(null);
  const pendingZoomRef = useRef(1);
  const zoomBy = useCallback(
    (factor: number) => {
      if (!(factor > 0) || !Number.isFinite(factor) || factor === 1) return;
      if (handCamera) handCamera.zoomBy(factor);
      else setSensorFov((was) => clampWindowFov(was * factor));
    },
    [handCamera],
  );
  const flush = useCallback(() => {
    frameRef.current = 0;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) handCamera?.dragTo(pending.dx, pending.dy);
    const zoom = pendingZoomRef.current;
    pendingZoomRef.current = 1;
    zoomBy(zoom);
  }, [handCamera, zoomBy]);
  // The one way a pinch or a ctrl + wheel asks for a zoom: into the pending factor, applied on the next frame.
  const scheduleZoom = useCallback(
    (factor: number): void => {
      pendingZoomRef.current *= factor;
      if (!frameRef.current) frameRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );
  const pointerTypes = useRef(new Map<number, string>());
  const forget = (pointerId: number): void => {
    pointersRef.current.delete(pointerId);
    pointerTypes.current.delete(pointerId);
    const pinch = pinchRef.current;
    if (pinch && (pinch.a === pointerId || pinch.b === pointerId)) pinchRef.current = null;
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    // R132 (FR-FLOW-6, D-848): a drag, a pinch or a tap all begin here; the first one puts the hint away for good.
    hand?.gesture();
    const pointers = pointersRef.current;
    /*
     * A primary pointer starts a new contact: every other pointer of its type has lifted, whether or not its up
     * reached the box (a capture that failed and a finger lifted outside). Without this a stale finger would make
     * every later one-finger touch the second finger of a pinch.
     */
    if (event.isPrimary) {
      for (const id of [...pointers.keys()]) {
        if (pointerTypes.current.get(id) !== event.pointerType) continue;
        forget(id);
        if (dragRef.current?.pointerId === id) {
          dragRef.current = null;
          pendingRef.current = null;
        }
      }
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pointerTypes.current.set(event.pointerId, event.pointerType);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom and old browsers: the drag and the pinch still work while the pointers stay over the box.
    }
    if (pointers.size === 2 && pinchRef.current === null) {
      const [first, second] = [...pointers.entries()] as [[number, { x: number; y: number }], [number, { x: number; y: number }]];
      pinchRef.current = { a: first[0], b: second[0], distance: Math.hypot(first[1].x - second[1].x, first[1].y - second[1].y) };
      if (dragRef.current) {
        dragRef.current = null;
        pendingRef.current = null;
        setDragging(false);
      }
      return;
    }
    // A third finger, or a finger after a pinch: no drag. R127: the sensor's box tracks the press too, for the tap
    // that names (FR-STAR-7 on the screen); its moves turn nothing, since there is no hand camera to move.
    if (pointers.size !== 1 || pinchRef.current !== null || dragRef.current) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY, travel: 0 };
    if (handCamera !== null) setDragging(true);
  };
  /*
   * R116 (FR-STAR-7): a tap or a click on the drawing names the glyph `hitTest` finds under it, from the marks the
   * star field last drew (`hitsRef`); a second tap on the named mark or a tap on nothing clears it. A press is a tap
   * while it travels less than the hit radius, so a finger's wobble still names; anything longer is a drag. On a
   * desk the pointer's hover shows the same label while it is over a mark.
   */
  const hitsRef = useRef<readonly (Point | null)[]>([]);
  // R127 (FR-STAR-14): the figure segments as last drawn, for the tap on a line where no mark is under it.
  const lineHitsRef = useRef<readonly (LabelSegment | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const hitAt = (event: PointerEvent<HTMLDivElement>, clientX = event.clientX, clientY = event.clientY, lines = false): number | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = rect.width > 0 ? size.width / rect.width : 1;
    const sy = rect.height > 0 ? size.height / rect.height : 1;
    // The drawing's viewBox is the measured box, the projection's `view` — turned by `turnDeg` about the box's
    // centre while following (R151), so the press is turned back by it into the drawing's own frame.
    const cx = (clientX - rect.left) * sx - size.width / 2;
    const cy = (clientY - rect.top) * sy - size.height / 2;
    const turn = (turnDeg * Math.PI) / 180;
    const x = Math.cos(turn) * cx + Math.sin(turn) * cy + drawWidth / 2;
    const y = -Math.sin(turn) * cx + Math.cos(turn) * cy + drawHeight / 2;
    const mark = hitTest(hitsRef.current, x, y);
    if (mark !== null || !lines) return mark;
    // FR-STAR-14: a star or a planet within the distance wins; else the nearest drawn line within it names its figure.
    const segment = hitLine(lineHitsRef.current, x, y);
    return segment === null ? null : figureKey(segment);
  };
  // Where a tap can name, the sky holds still until the press travels past the tap's slop, so the marks a tap is tested against are the ones under the press.
  const tapSlop = scene?.stars ? HIT_RADIUS_PX : 0;
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const tracked = pointersRef.current.get(event.pointerId);
    if (tracked) {
      tracked.x = event.clientX;
      tracked.y = event.clientY;
    }
    const pinch = pinchRef.current;
    if (pinch !== null) {
      if (event.pointerId !== pinch.a && event.pointerId !== pinch.b) return;
      const a = pointersRef.current.get(pinch.a);
      const b = pointersRef.current.get(pinch.b);
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      // Two fingers that landed on one point have no distance to scale by: the first apart is where the pinch starts.
      if (pinch.distance === 0) {
        pinch.distance = distance;
        return;
      }
      if (distance > 0 && distance !== pinch.distance) {
        scheduleZoom(pinch.distance / distance);
        pinch.distance = distance;
      }
      return;
    }
    const active = dragRef.current;
    // The hover's label is the hand's, as before the pinch put these handlers on the sensor's box too.
    if (!active && byHand && event.pointerType === 'mouse' && scene?.stars) {
      const over = hitAt(event);
      if (over !== hovered) setHovered(over);
    }
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (dx === 0 && dy === 0) return;
    active.x = event.clientX;
    active.y = event.clientY;
    active.travel += Math.hypot(dx, dy);
    const pending = pendingRef.current ?? { dx: 0, dy: 0 };
    pendingRef.current = { dx: pending.dx + dx, dy: pending.dy + dy };
    // R151 (D-955): following, a press is the finger's drag once it is past the tap's slop — short of it, it may
    // still be a tap that names, or the first finger of a pinch, neither of which ends following.
    if (followPhone && !followEndedRef.current) {
      if (active.travel < HIT_RADIUS_PX) return;
      endFollow();
    }
    if (active.travel < tapSlop) return;
    if (!frameRef.current) frameRef.current = requestAnimationFrame(flush);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    forget(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // see setPointerCapture
    }
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    // R151: a press that ended short of the slop while following moved nothing, and leaves nothing for the next one.
    if (followPhone && !followEndedRef.current) pendingRef.current = null;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const active = dragRef.current;
    const tapped = active?.pointerId === event.pointerId && active.travel < HIT_RADIUS_PX;
    endDrag(event);
    // The hover from before a drag no longer marks what is under the pointer.
    if (event.pointerType === 'mouse' && hovered !== null) setHovered(null);
    if (!tapped || !active || !scene?.stars) return;
    // A tap's wobble never turned the sky (`tapSlop`): it is dropped, and the press point is tested.
    pendingRef.current = null;
    const hit = hitAt(event, active.x0, active.y0, true);
    nameStar(hit === namedStar ? null : hit);
  };
  const onPointerLeave = (event: PointerEvent<HTMLDivElement>): void => {
    if (hovered !== null) setHovered(null);
    // A pointer the box could not capture is gone once it leaves: no up for it will reach the box.
    if (pointersRef.current.has(event.pointerId) && !hasCapture(event)) endDrag(event);
  };
  // Capture lost without an up or a cancel reaching the box (the browser released it, the box moved): the drag, or the pinch, is over.
  const onLostPointerCapture = (event: PointerEvent<HTMLDivElement>): void => {
    forget(event.pointerId);
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };
  /*
   * FR-SKY-14 (D-798): ctrl + wheel — what a trackpad pinch sends, and ctrl + wheel on a mouse — scales the field
   * by `exp(deltaY × ZOOM_WHEEL_RATE)`. A native listener with `passive: false`, because React registers `wheel`
   * passive and a passive listener cannot keep the browser from zooming the page; `preventDefault` only with
   * `ctrlKey`, so a plain wheel scrolls the page as it did. On every window, under the sensor too.
   */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      scheduleZoom(Math.exp(event.deltaY * ZOOM_WHEEL_RATE));
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      box.removeEventListener('wheel', onWheel);
    };
  }, [scheduleZoom]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!handCamera) return;
    // FR-SKY-14: box keys, not page shortcuts — ctrl or cmd with `+`/`=`/`-`/`0` is the browser's own zoom, left to it; the arrows turn with any modifier, as before.
    if ((event.ctrlKey || event.metaKey) && ZOOM_KEYS.has(event.key)) return;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => {
        handCamera.stepYaw(-1);
      },
      ArrowRight: () => {
        handCamera.stepYaw(1);
      },
      ArrowUp: () => {
        handCamera.stepPitch(1);
      },
      ArrowDown: () => {
        handCamera.stepPitch(-1);
      },
      // FR-SKY-14 (D-798): `+` (or `=`, its unshifted key) narrows the field by `ZOOM_KEY_FACTOR`, `-` widens it, `0` restores `WINDOW_FOV`.
      '+': () => {
        handCamera.zoomBy(1 / ZOOM_KEY_FACTOR);
      },
      '=': () => {
        handCamera.zoomBy(1 / ZOOM_KEY_FACTOR);
      },
      '-': () => {
        handCamera.zoomBy(ZOOM_KEY_FACTOR);
      },
      '0': () => {
        handCamera.resetZoom();
      },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    // R151 (FR-GYRO-4): the box's keys end following as a drag does, from the phone's last pose.
    endFollow();
    move();
  };

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

  // FR-FSC-10 (D-429): the screen's layer learns the quarter through the context; nowhere else is it reported.
  const { report } = useScreenTurn();
  useEffect(() => {
    // One report per turn of the hand, and none at all off a screen, where `report` is the context's no-op.
    if (onScreen) report(quarter);
  }, [onScreen, quarter, report]);

  // FR-SKY-14: the field is the current one, so everything drawn from `view` — the scale, the drawable limit, the
  // ground thresholds, the bracket — follows the zoom.
  const view: View = useMemo(
    () => ({ fovDeg, width: drawWidth, height: drawHeight, screenAngleDeg: turnsWithPose ? quarter : screenAngleDeg }),
    [fovDeg, drawWidth, drawHeight, turnsWithPose, quarter, screenAngleDeg],
  );
  const limitDeg = drawableDeg(view);

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
  // FR-STAR-5: the stars inventory has no pass to name, so no chip.
  if (onScreen && inventory === 'passes' && now !== undefined && ground === 'sky' && !marks.some((mark) => mark.branch === 'in-bracket') && !drawnPasses.some(({ pass }) => arcInBox(pass, m, view, now))) {
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
  const readoutId = `${uid}-readout`;

  /*
   * FR-SKY-13 (R127, D-797): the pass the picker's key follows — the live page's highlighted pass, where the page
   * names one and the window is in the box — at its position now (`passPosition`), with the key the drawing gives
   * it. While the camera follows (`follow` on its state), every tick re-aims it here, before the frame is drawn:
   * a layout effect on the shown instant, so a pass crossing the field at 3600× stays in it. The key moves with
   * the highlighted pass; the following does not — it ends when its pass is no longer offered.
   */
  // The pass has a key only while its arc is drawn (FR-LEG-1, FR-TRAJ-1's look-ahead): before that there is nothing to offer.
  const facingPass = inBox && facingPassId !== null && (legendKeys[facingPassId] ?? '') !== '' ? (passes.find((pass) => pass.id === facingPassId) ?? null) : null;
  const followTarget: FollowTarget | null = facingPass === null ? null : { id: facingPass.id, key: legendKeys[facingPass.id] ?? '', position: passPosition(facingPass, now) };
  const following = handState?.follow !== undefined && followTarget !== null;
  // D-883's one turn: `openingFacing` again, for the passes as they now stand and the pass the window offers.
  useEffect(() => {
    if (slotCamera === null || !UNTURNED.has(slotCamera) || passes.length === 0) return;
    UNTURNED.delete(slotCamera);
    turningRef.current = true;
    try {
      slotCamera.open(openingFacing({ latDeg: observer.lat, now }, facingPass, nextRising(passes, now)));
    } finally {
      turningRef.current = false;
    }
  }, [slotCamera, passes, facingPass, observer.lat, now]);
  const followId = followTarget?.id;
  const followAz = followTarget?.position.azDeg;
  const followEl = followTarget?.position.elDeg;
  useLayoutEffect(() => {
    const followed = handCamera?.get().follow;
    if (!handCamera || followed === undefined) return;
    // The followed pass no longer offered — its key gone with its arc, or the headline on another pass: following ends
    // where the camera stands, so no later pass swings the camera without the reader's hand (R127 review).
    if (followed !== followId || followAz === undefined || followEl === undefined) {
      handCamera.unfollow();
      return;
    }
    handCamera.followPass(followId, { azDeg: followAz, elDeg: followEl });
  }, [handCamera, followId, followAz, followEl]);
  // FR-DESK-4 as amended v2.5: `f`, on the live page with the window in the box, through the shortcut table's one guard.
  // The listener is installed once per camera and target and reads the position of the moment through the ref.
  const followRef = useRef<FollowTarget | null>(null);
  useEffect(() => {
    followRef.current = followTarget;
  });
  useEffect(() => {
    if (!handCamera || followId === undefined) return;
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (shortcutFor(event)?.id !== 'follow') return;
      const target = followRef.current;
      if (!target) return;
      event.preventDefault();
      handCamera.followPass(target.id, target.position);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [handCamera, followId]);

  // `live`: the hand drives (always), or the sensor is on. FR-STAR-4, D-757: the hand points at true bearings and
  // has no declination to name, so its readout is the first line alone.
  // R116 (FR-STAR-7): the readout's second line is the named object's, "Canopus · mag −0.7 · 28° up · S" — under the
  // hand and, since R127, on the screen too (FR-SKY-11: a tap's name takes the line while it holds).
  const namedLine = scene?.stars && namedStar !== null ? namedReadout(scene.stars, namedStar, sp, locale) : null;
  /*
   * R127 (FR-SKY-11, D-796): on the screen the second line is the landmark line while a pass is in the scene and
   * none is tapped — the same formatter as the page's headline — and the declination line (FR-FSC-4) where the
   * scene has no pass. Off a screen the line is the page's, under the pass's name.
   */
  const sceneLandmark = given?.landmark ?? null;
  const sceneCatalog = scene?.stars?.catalog;
  const landmarkText =
    onScreen && sceneCatalog !== undefined && sceneLandmark !== null && passes.some((pass) => pass.id === sceneLandmark.passId)
      ? landmarkLine(
          sceneLandmark,
          landmarkNames({ star: (i, lang) => starName(catalogNames(sceneCatalog), i, lang), constellation: (con, lang) => constellationName(catalogNames(sceneCatalog), con, lang) }, sceneCatalog.con, locale),
          t.live,
        )
      : null;
  /*
   * FR-SKY-14 (D-798, D-822): while the field is not `WINDOW_FOV` the first line ends with ` · field 30°` (rounded
   * to 5°). The words are R123's string, `window.field`, which takes the degrees and carries its own separator, as
   * `following` takes the key. `data-fov` on the root carries the field in whole degrees for the tests.
   */
  const fieldSuffix = fovDeg !== WINDOW_FOV ? t.window.field({ degrees: degrees(Math.round(fovDeg / 5) * 5) }) : '';
  const status = live ? (
    <p className={styles.readout} data-testid="window-readout" {...(byHand ? { id: readoutId } : { 'data-declination': declinationDeg.toFixed(1) })} {...(following ? { 'data-following': followTarget.id } : {})}>
      <span>
        {/* FR-SKY-13: `Following A` in place of the facing point while the key holds. */}
        {following ? t.window.following({ key: followTarget.key }) : t.window.readout({ point: compassPoint(look.azDeg), azimuth: degrees(quantise(look.azDeg)), altitude: degrees(look.altDeg) })}
        {fieldSuffix}
      </span>
      {namedLine !== null ? (
        <>
          <br />
          <span className={styles.declination} data-testid="window-named" data-named={namedStar}>
            {namedLine}
          </span>
        </>
      ) : landmarkText !== null ? (
        <>
          <br />
          <span className={styles.declination} data-testid="window-landmark" data-landmark={sceneLandmark?.star?.index ?? ''}>
            {landmarkText}
          </span>
        </>
      ) : (
        !byHand && (
          <>
            <br />
            <span className={styles.declination} data-testid="window-heading" data-declination={declinationDeg.toFixed(1)}>
              {t.window.trueNorth({ declination: formatSignedDegrees(declinationDeg, locale) })}
            </span>
          </>
        )
      )}
    </p>
  ) : state === 'waiting' || (state === 'idle' && !orientation.needsGesture) ? (
    <p className={styles.note} data-testid="window-note">
      {t.window.waiting}
    </p>
  ) : null;

  // R151 (FR-GYRO-5, D-941): following adds nothing over the drawing — no readout, no waiting note.
  const shown = followPhone ? null : status;

  /*
   * FR-SKY-2 (D-789, D-790): the window in the page's box has the stars page's controls around it — the facing
   * picker from the page's list and, where the device has a sensor as well (a tablet), `[ hold up to the sky ]`,
   * which opens the screen as the stars page's does. In the rail where the page has one (the wide live page), in
   * the frame's controls row otherwise (the pass detail, the compact pages), after the view control.
   */
  const railed = inBox && fill && aside !== undefined && aside !== null;
  /*
   * R132 (FR-FLOW-4, D-842, D-846): inside a `SkyViewLayout` the readout is the page's `readout` slot's and the
   * facing row its `picker` slot's, with no `Facing:` prefix of its own (the rail labels the row, D-846). Outside
   * one they are the frame's, as above.
   */
  const readoutSlot = useChartSlot('readout');
  const pickerSlot = useChartSlot('picker');
  const facingRow =
    inBox && handCamera ? (
      <HandFacingRow camera={handCamera} options={facingOptions} peak={peak} follow={followTarget} prefix={!compact && !pickerSlot.inLayout} />
    ) : null;

  return (
    <div
      className={[styles.window, className].filter(Boolean).join(' ')}
      data-state={byHand ? 'hand' : state}
      data-ground={ground}
      {...(onScreen ? { 'data-screen': 'true', 'data-orientation': upright ? 'portrait' : 'landscape' } : {})}
      {...(inBox ? { 'data-in-box': 'true' } : {})}
      {...(followPhone ? { 'data-follow': 'true' } : {})}
      data-look-az={quantise(look.azDeg)}
      data-look-alt={Math.round(look.altDeg)}
      data-fov={Math.round(fovDeg)}
    >
      {!onScreen && readoutSlot.place(shown)}
      {!onScreen && pickerSlot.place(facingRow)}
      <ChartFrame
        fill={fill}
        legend={legend}
        aside={
          railed ? (
            <>
              {facingRow}
              {aside}
            </>
          ) : (
            aside
          )
        }
        stripe={stripe}
        handWindow={inBox}
        {...(measureBox === undefined ? {} : { measureBox })}
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
                  {/* FR-STAR-5: the stars inventory has no pass, so no next-event block — only the advice, which is about the picture. */}
                  {inventory === 'passes' && <NextEventBlock passes={drawnPasses.map(({ pass }) => pass)} timeZone={observer.timeZone} {...(now === undefined ? {} : { now })} hours={SEARCH_WINDOW_HOURS} />}
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
              {/* The hint is the sensor's ("hold the phone up"); the hand's box has its own hint in the box (below). */}
              {handCamera === null && <p className={styles.hint}>{t.window.hint}</p>}
              {!railed && !pickerSlot.inLayout && facingRow}
            </>
          )
        }
        status={readoutSlot.inLayout && !onScreen ? null : shown}
      >
        <div
          className={handCamera !== null ? [styles.box, styles.hand].join(' ') : styles.box}
          ref={boxRef}
          // FR-SKY-14: the pointer handlers are on every box, since the pinch is the sensor's too; the drag inside them is the hand's.
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={endDrag}
          onLostPointerCapture={onLostPointerCapture}
          {...(handCamera !== null
            ? {
                // FR-STAR-4: focusable for the keys, described by its own readout; the page names the group (R115).
                // R151: following too, since a key is one way the finger takes the sky back (D-942); the readout is
                // not drawn then, so nothing describes the box.
                tabIndex: 0,
                ...(byHand ? { 'aria-describedby': readoutId } : {}),
                'data-dragging': dragging,
                onKeyDown,
              }
            : {})}
        >
          {/* R151 (FR-FSC-10, D-941): what turns upright to the reader while following — the drawing and the notes.
              `display: contents` unturned, so the box lays out exactly as it did. */}
          <div
            className={styles.turn}
            {...(followPhone ? { 'data-turn': turnDeg } : {})}
            {...(turnDeg === 0 ? {} : { style: { width: `${String(drawWidth)}px`, height: `${String(drawHeight)}px`, '--window-turn': `${String(turnDeg)}deg` } as CSSProperties })}
          >
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
              {/* FR-STAR-11, FR-STAR-6 (D-751): the star field, under the horizon and the rings, mounted only when the scene
                  carries one and kept mounted across the ground states — its nodes exist once, and it hides itself at
                  `buried` by the rotation it is given, not by a remount. */}
              {scene?.stars && <StarField field={scene.stars} view={view} subscribe={subscribe} labelled={hovered ?? namedStar} hits={hitsRef} lineHits={lineHitsRef} landmark={landmark} />}
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
          </div>
          {/* R132 (FR-FLOW-6, D-848): R121's hand hint in the box's corner is the layout's `SkyHint` under the picker now. */}
          {/* R66 (FR-WIN-5 as amended v1.3.1, V13-8): no `[ point at the sky ]`. The window is only ever mounted
              on the sky screen, and the tap that opened the screen is the tap that asked (FR-WIN-4, D-350), so
              the gate had nothing left to guard: it was already suppressed on a screen (R64), and a screen is
              now the only place a window is. `useDeviceOrientation` keeps `start` for the state machine. */}
        </div>
      </ChartFrame>
    </div>
  );
}

/**
 * FR-SKY-2 (D-789): the in-box window's facing row — the picker and, where the device has a sensor as well (a
 * tablet), `[ hold up to the sky ]`, which is `useSkyScreen.open()`. Its own component so the screen's store and
 * the presence test are read by the window in a page's box alone, not by the stars page's or the screen's.
 */
function HandFacingRow({ camera, options, peak, follow, prefix }: Pick<FacingPickerProps, 'camera' | 'options' | 'peak' | 'follow' | 'prefix'>) {
  const sp = useStarsPageT();
  // On a compact page without a sensor there is no way to the screen to offer.
  const entry = useSkyScreen();
  return (
    <div className={styles.facingRow} data-testid="window-facing">
      <FacingPicker camera={camera} {...(options === undefined ? {} : { options })} {...(peak === undefined ? {} : { peak })} {...(follow === undefined ? {} : { follow })} {...(prefix === undefined ? {} : { prefix })} />
      {entry.available && <TextButton label={sp.holdUp} onClick={entry.open} data-testid="window-hold-up" />}
    </div>
  );
}
