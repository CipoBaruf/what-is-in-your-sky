import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useStarsPageT } from '../../../../../i18n/starsPageT';
import { useLocale, useT } from '../../../../../i18n/useT';
import { cutTrack, type ArcState } from '../../../../../lib/arcReveal';
import { compassPoint } from '../../../../../lib/compass';
import { degrees, formatSignedDegrees } from '../../../../../lib/format';
import { SERIES_COUNT } from '../../../../../lib/legend';
import { shortcutFor } from '../../../../../lib/shortcuts';
import type { SunState } from '../../../../../lib/skyBodies';
import { interpolateTrack, resampleArc, splitArcAt } from '../../../../../lib/skyGeometry';
import type { MoonState, PassPoint } from '../../../../../model';
import { STAR_LABEL_HOLD_S } from '../../../../screens/stars/field';
import { quantise } from '../../../live/compassHeading';
import { useDeclination } from '../../../live/useDeclination';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, moonVisible, sunVisible } from '../bodies';
import { useLayoutMode } from '../../../../hooks/useLayoutMode';
import { useChartSlot } from '../../../sky/SkyViewLayout';
import { ChartFrame } from '../ChartFrame';
import { landmarkFor, sceneFor } from '../layers';
import { arcOf, FACING_OPTIONS, type ChartPass, type HiddenMarker, type SkyChartProps } from '../SkyChart.types';
import { createHandCamera, facePeak, nextRising, openingFacing, passPosition, SENSOR_CAMERA, ZOOM_KEY_FACTOR, ZOOM_WHEEL_RATE, type HandCamera, type SkyCamera } from './camera';
import { FacingPicker, type FacingPickerProps, type FollowTarget } from './FacingPicker';
import { clampWindowFov, COMPASS, drawableDeg, EDGE_MARGIN_PX, groundClipPath, groundState, HORIZON, lookDirection, NAME_ALT_DEG, project, ring, scaleFor, uprightRotation, verticalHalfFieldDeg, WINDOW_FOV, type Mat3, type Projected, type SkyPoint, type View } from './projection';
import { nearestQuarter, turnFor, type Quarter } from './screenTurn';
import styles from './SkyWindow.module.css';
import { hitLine, hitTest, HIT_RADIUS_PX, type Point } from './starGlyphs';
import { figureKey, namedReadout, StarField } from './StarField';
import type { LabelSegment } from './starLabels';
import { useViewRotation } from './useViewRotation';

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
 * R152 (FR-GYRO-6; D-945): the sky screen is gone, and with it the window's
 * `screen` mode — the overlays, the compass gutter, the empty-field chip, the
 * upright rows and the turn advice (R63, R73, R79). What the screen did that
 * the page still wants — the sensor camera, FR-FSC-10's quarter and FR-FOL-5's
 * ground notes — is the `follow` mode below.
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
 * R125 (FR-SKY-14; FR-WIN-1, FR-STAR-4 as amended; D-798, D-820,
 * D-821): the zoom. The field across the box's shorter side is `fovDeg` —
 * the hand camera's under the hand (page state: the slot keeps it through the
 * dome and back, as it keeps the facing), this window's own state under the
 * sensor, `WINDOW_FOV` at every mount, never
 * saved — and everything `WINDOW_FOV`
 * fed reads it: the projection's `view`, the placeholder, the ground state. One pointer handler on the box tracks the active
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
 * the pinch keeps writing. FR-FSC-10's quarter is read from the pose, the
 * projection is composed with it, and the box's contents — the drawing and the
 * ground notes — are turned by the difference from the browser's angle inside
 * the box, sides swapped, as the screen's layer was (FR-FSC-10: which way is up
 * is the pose's, not the viewport's; `useDeviceOrientation` folds the quarter
 * with hysteresis, D-431). Nothing is drawn over the drawing but the ground
 * notes: no readout, no hint. The box keeps the hand's focus and pointer
 * handlers, and the finger wins: a press that travels past the tap's slop, or
 * one of FR-SKY-14's keys, seeds the hand camera with the last pose
 * (`poseAsHand`), calls `onFollowEnd(pose)` and then moves the hand as it
 * always did. Turning following off from the page seeds the hand the same way.
 * R152 (D-944): `follow` and `onFollowEnd` are `SkyChartProps`' now, since
 * `SkyChart` passes them through from the page.
 */

/** The window's props: `SkyChartProps`, which every view implements; `camera`, `follow` and `onFollowEnd` are on it for the window alone. */
export type SkyWindowProps = SkyChartProps;

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
  const { passes, observer, highlightedPassId, onSelectPass, now, sun, moon, hidden = [], initialFacingAzDeg, colorBy = 'highlight', fill = false, legendKeys = {}, legend, legendOpen, aside, stripe, measureBox, stacked, controls, onUnavailable, scene: given, camera: givenCamera, hand, facingOptions = FACING_OPTIONS, facingPassId = null, namedStar: givenNamed = null, onNameStar, className, follow = false, onFollowEnd } = props;
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
  const t = useT();
  const sp = useStarsPageT();
  const locale = useLocale();
  const compact = useLayoutMode() === 'compact';
  /*
   * FR-SKY-7 (D-790): the explained pass — the pass detail's one — and its peak where the page's picker offers
   * `peak`. The pass detail's window opens facing it.
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
  const inBox = hand !== undefined && camera.source === 'hand';
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
   * FR-SKY-14 (D-798, D-820): the field under the sensor is this window's own state, `WINDOW_FOV` at every mount
   * and written only by the pinch below; under the hand the field is the camera's and this is not read. Neither
   * reaches the prefs or the hash.
   */
  const [sensorFov, setSensorFov] = useState(WINDOW_FOV);
  // Before the first reading: upright toward the explained pass's peak (or the caller's facing), 20° up or as high as the peak needs.
  // The placeholder's altitude reads the box's shape and not its angle (`verticalHalfFieldDeg`), so it is known before the hook that gives the angle.
  // Under the hand there is no first reading to wait for, so nothing is computed and the hook never reads it.
  const placeholder = useMemo(() => {
    if (handCamera !== null) return NO_PLACEHOLDER;
    // FR-SKY-7 (R121, D-790): an explained pass and no facing of the caller's — the window looks at the peak as
    // `facePeak` says until the sensor's first reading, at the field shown (R125); a caller that names its facing
    // keeps D-241's placeholder.
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
   * FR-FSC-10 (D-424, D-425, D-429) → R151 (D-941): which way is up to the reader. In a window following the phone
   * the projection is composed with the quarter read from the pose: on an unlocked phone that *is* the browser's
   * angle, and on a locked one it is what the browser's angle would have been. Before the first reading there is
   * no pose to read, so the browser's own angle stands (FR-FSC-10, "it starts at none"). Elsewhere the value is
   * the browser's angle and nothing moves (D-425). The following window turns its own box's contents by the
   * difference (`turnDeg`), sides swapped for a quarter.
   *
   * D-431: the fold itself is `useDeviceOrientation`'s, beside the rotation it folds — the hysteresis makes
   * each quarter depend on the one before it, and the frame that already eases the rotation is the one place
   * that can keep a previous value without a ref read in a render or a state set from an effect.
   */
  const quarter: Quarter = followPhone && orientation.rotation !== null ? orientation.quarter : nearestQuarter(screenAngleDeg);
  const turnDeg = followPhone ? turnFor(quarter, screenAngleDeg) : 0;
  const sideways = Math.abs(turnDeg) === 90;
  // The drawing's own box: the measured one, its sides swapped while it is turned a quarter.
  const drawWidth = sideways ? size.height : size.width;
  const drawHeight = sideways ? size.width : size.height;
  const turned = turnDeg !== 0;
  // R151 (D-956): the turned drawing and notes are the box's centre at the drawing's own size, rotated by the turn.
  const turnStyle = { width: `${String(drawWidth)}px`, height: `${String(drawHeight)}px`, '--window-turn': `${String(turnDeg)}deg` } as CSSProperties;

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

  // FR-SKY-14: the field is the current one, so everything drawn from `view` — the scale, the drawable limit, the
  // ground thresholds — follows the zoom.
  const view: View = useMemo(
    () => ({ fovDeg, width: drawWidth, height: drawHeight, screenAngleDeg: followPhone ? quarter : screenAngleDeg }),
    [fovDeg, drawWidth, drawHeight, followPhone, quarter, screenAngleDeg],
  );
  const limitDeg = drawableDeg(view);

  const look = lookDirection(m);
  const at = useCallback((p: SkyPoint): Projected => project(m, p.azDeg, p.elDeg, view), [m, view]);
  const zenith = at({ azDeg: 0, elDeg: 90 });

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
  // hand and under the sensor alike (FR-SKY-11: a tap's name takes the line while it holds).
  const namedLine = scene?.stars && namedStar !== null ? namedReadout(scene.stars, namedStar, sp, locale) : null;
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
   * FR-SKY-2 (D-789, D-790): the window in the page's box has the stars page's facing picker around it, from the
   * page's list. In the rail where the page has one (the wide live page), in the frame's controls row otherwise
   * (the pass detail, the compact pages), after the view control. R152 (FR-GYRO-6): `[ hold up to the sky ]`, which
   * stood beside it, is gone; `[ follow the phone ]` is the page's own row (`FollowToggle`).
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
      {...(inBox ? { 'data-in-box': 'true' } : {})}
      {...(followPhone ? { 'data-follow': 'true', 'data-turn': turnDeg } : {})}
      data-look-az={quantise(look.azDeg)}
      data-look-alt={Math.round(look.altDeg)}
      data-fov={Math.round(fovDeg)}
    >
      {readoutSlot.place(shown)}
      {pickerSlot.place(facingRow)}
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
        controls={
          <>
            {controls}
            {/* The hint is the sensor's ("hold the phone up"); the hand's box has its own hint in the box (below). */}
            {handCamera === null && <p className={styles.hint}>{t.window.hint}</p>}
            {!railed && !pickerSlot.inLayout && facingRow}
          </>
        }
        status={readoutSlot.inLayout ? null : shown}
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
          {/* R151 (FR-FSC-10, D-941): while following, the drawing — and the notes over it, below — turn upright to the
              reader inside the box when the pose's quarter is not the browser's (`turned`). The SVG stays the box's
              own child, which is how the stars page and the specs find the box. */}
          <svg
            className={turned ? [styles.svg, styles.turned].join(' ') : styles.svg}
            {...(turned ? { style: turnStyle } : {})}
            viewBox={`0 0 ${String(view.width)} ${String(view.height)}`}
            aria-hidden="true"
            data-drawing="window"
            focusable="false"
          >
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
          <div className={turned ? [styles.notes, styles.turned].join(' ') : styles.notes} {...(turned ? { style: turnStyle } : {})}>
            {/* FR-FOL-5: the note in the drawing, spoken (`role="status"`), never modal: raising the phone is what leaves it. */}
            {ground !== 'sky' && (
              <p className={ground === 'buried' ? styles.buriedNote : styles.groundNote} role="status" data-testid="window-ground-note" data-ground={ground}>
                {ground === 'buried' ? t.window.buried : t.window.ground}
              </p>
            )}
          </div>
          {/* R132 (FR-FLOW-6, D-848): R121's hand hint in the box's corner is the layout's `SkyHint` under the picker now. */}
          {/* R66 (FR-WIN-5 as amended v1.3.1, V13-8): no `[ point at the sky ]`. The tap that turns following on
              is the tap that asked (FR-WIN-4, FR-GYRO-2), so the gate has nothing to guard; `useDeviceOrientation`
              keeps `start` for the state machine. */}
        </div>
      </ChartFrame>
    </div>
  );
}

/**
 * FR-SKY-2 (D-789): the in-box window's facing row — the picker from the page's list. R152 (FR-GYRO-6, D-944):
 * `[ hold up to the sky ]` stood after it and is gone; the row keeps its test id for the specs that find the picker.
 */
function HandFacingRow({ camera, options, peak, follow, prefix }: Pick<FacingPickerProps, 'camera' | 'options' | 'peak' | 'follow' | 'prefix'>) {
  return (
    <div className={styles.facingRow} data-testid="window-facing">
      <FacingPicker camera={camera} {...(options === undefined ? {} : { options })} {...(peak === undefined ? {} : { peak })} {...(follow === undefined ? {} : { follow })} {...(prefix === undefined ? {} : { prefix })} />
    </div>
  );
}
