import { COMPASS_POINTS, normalizeAzimuthDeg, type CompassPoint } from '../../../../../lib/compass';
import { interpolateTrack } from '../../../../../lib/skyGeometry';
import type { EpochMs, Pass } from '../../../../../model';
import { DRAG_PX_PER_DEG, PITCH_STEP_DEG, YAW_STEP_DEG } from '../dome/camera';
import { FACING_POINTS, passFacing, type FacingOption } from '../SkyChart.types';
import { clampWindowFov, uprightRotation, WINDOW_FOV, type Mat3 } from './projection';

/**
 * R113 (FR-STAR-4, FR-STAR-11; PLAN D-750): the window's camera — one
 * rotation with two sources. The **sensor** is the phone's pose through
 * `useDeviceOrientation`, unchanged; the **hand** is two numbers, the azimuth
 * and the altitude the field is centred on, moved by the dome's controls from
 * the dome's own constants (`DRAG_PX_PER_DEG`, `YAW_STEP_DEG`,
 * `PITCH_STEP_DEG`, imported and not moved) and turned into the same `Mat3`
 * the sensor produces by `uprightRotation`: the phone held upright, its back
 * pointing where the hand says. Everything downstream — the projection, the
 * ground state, the readout, the gutter, the star field — reads the rotation
 * and never asks which source made it.
 *
 * The hand's reducers are pure and exported on their own, so the test drives
 * them without a DOM; `createHandCamera` wraps them in a small store the
 * window drives from its pointer and key handlers and the page reads with
 * `useSyncExternalStore`. The store, not React state, is what keeps the page
 * out of the per-frame path: a drag notifies the window's rotation hook and
 * whoever else subscribed, and nothing re-renders that did not ask to.
 *
 * The tilt range is the page's own (FR-STAR-4): `STARS_TILT_MIN_DEG` (−10°),
 * so the horizon can stand high in the field and FR-FOL-5's `ground` state is
 * reachable by hand, to `STARS_TILT_MAX_DEG` (90°), the zenith, which `up()`
 * jumps to. The dome's [5°, 80°] is the dome's.
 *
 * R121 (FR-SKY-2, FR-SKY-7; D-789, D-790): the same camera drives the window
 * on the live page and the pass detail, where the window is laid out in the
 * frame's box. The sixth move is `facePeak`, the pass detail's opening state
 * and its picker's `peak`; the picker's option lists and its pressed-option
 * rule (`facingOf`) live here too, so the stars page and the chart's window
 * read one definition.
 *
 * R125 (FR-SKY-14; D-798, D-820): the zoom is the camera's `fovDeg` — the
 * field across the box's shorter side, `WINDOW_FOV` until the reader changes
 * it, held inside [`WINDOW_FOV_MIN_DEG`, `WINDOW_FOV_MAX_DEG`]. `zoomBy` scales
 * it and `resetZoom` puts it back; every other move keeps it, so picking a
 * facing point keeps the zoom. The two zoom rates are the window's own
 * constants, beside the dome's three the hand imports: `ZOOM_WHEEL_RATE` for
 * ctrl + wheel and `ZOOM_KEY_FACTOR` for `+`/`-`.
 *
 * R127 (FR-SKY-13; D-797, D-827): the seventh move **follows a pass**. The
 * live page's picker offers the highlighted pass's key after `up`, and `f`
 * does the same: `followPass` aims the camera at the pass's position — on
 * its track while it is up, its rise point before, its set point after
 * (`passPosition`) — at FR-SKY-7's tilt, and leaves the pass's id on the
 * state as `follow`, which the window re-applies on every tick while it
 * stands, so a pass crossing the field at 3600× stays in it. A drag, an arrow
 * key, a point, `up` or `peak` ends it (`at` never carries it); a zoom keeps
 * it, since the next tick re-aims at the new field. D-797 wrote `follow:
 * string | null`; it is absent rather than `null`, so a state that follows
 * nothing is the three numbers it was.
 */

/** The hand's state: where the centre of the field points, degrees, and how wide the field is. */
export interface HandState {
  /** Clockwise from north, in [0, 360). */
  azDeg: number;
  /** Above the horizon, in [STARS_TILT_MIN_DEG, STARS_TILT_MAX_DEG]. */
  altDeg: number;
  /** FR-SKY-14: degrees across the box's shorter side, in [WINDOW_FOV_MIN_DEG, WINDOW_FOV_MAX_DEG]; `WINDOW_FOV` at every open. */
  fovDeg: number;
  /** FR-SKY-13: the id of the pass the camera follows, while it does. */
  follow?: string;
}

/** Where a camera starts: the aim, and the field unless given is `WINDOW_FOV` (FR-SKY-14: every open is at the default). */
export type HandAim = Pick<HandState, 'azDeg' | 'altDeg'> & Partial<Pick<HandState, 'fovDeg'>>;

/**
 * FR-SKY-14: ctrl + wheel scales the field by `exp(deltaY × ZOOM_WHEEL_RATE)`
 * — one mouse notch of about 100 px is about a fifth — and `+` / `-` by
 * `ZOOM_KEY_FACTOR`, so three `+` from 60° read 30°.
 */
export const ZOOM_WHEEL_RATE = 0.002;
export const ZOOM_KEY_FACTOR = 1.25;

/** FR-STAR-4: the hand can look a little below the horizon, and straight up. */
export const STARS_TILT_MIN_DEG = -10;
export const STARS_TILT_MAX_DEG = 90;
/** FR-STAR-3: the tilt every open of the page starts at. */
export const STARS_DEFAULT_TILT = 35;
/**
 * FR-STAR-3: the facing every open starts at — the pole side, where the
 * circumpolar stars are and the field is never empty: south (180°) for an
 * observer south of the equator, north (0°) for one north of it.
 */
export const STARS_DEFAULT_FACING = { north: 0, south: 180 } as const;

/** `STARS_DEFAULT_FACING` for an observer's latitude: the hemisphere's pole side. */
export function defaultFacingDeg(latDeg: number): number {
  return latDeg < 0 ? STARS_DEFAULT_FACING.south : STARS_DEFAULT_FACING.north;
}

/** The hand's first state for an observer: the pole side at the default tilt, at the default field. */
export function initialHand(latDeg: number): HandState {
  return { azDeg: defaultFacingDeg(latDeg), altDeg: STARS_DEFAULT_TILT, fovDeg: WINDOW_FOV };
}

export function clampWindowTilt(altDeg: number): number {
  return Math.min(STARS_TILT_MAX_DEG, Math.max(STARS_TILT_MIN_DEG, altDeg));
}

const SECTOR_DEG = 360 / COMPASS_POINTS.length;

/** A compass point's bearing: `N` 0, `E` 90, `SW` 225. */
export function bearingOf(point: CompassPoint): number {
  return COMPASS_POINTS.indexOf(point) * SECTOR_DEG;
}

const at = (azDeg: number, altDeg: number, fovDeg: number = WINDOW_FOV): HandState => ({ azDeg: normalizeAzimuthDeg(azDeg), altDeg: clampWindowTilt(altDeg), fovDeg: clampWindowFov(fovDeg) });

/**
 * A drag by (dx, dy) CSS pixels at `DRAG_PX_PER_DEG`: the sky follows the
 * finger, as the dome does. Dragging right pulls the sky right, so the view
 * turns left (the azimuth decreases); dragging down pulls the sky down, so
 * the view looks higher (the altitude increases). The rate is the dome's at
 * every field (FR-SKY-14: what zoom changes is the projection's scale and
 * nothing else), so a zoomed-in field drags more sky per pixel of itself.
 */
export function dragTo(state: HandState, dxPx: number, dyPx: number): HandState {
  return at(state.azDeg - dxPx / DRAG_PX_PER_DEG, state.altDeg + dyPx / DRAG_PX_PER_DEG, state.fovDeg);
}

/** `←` / `→`: `steps` of `YAW_STEP_DEG`, positive clockwise (to the right). */
export function stepYaw(state: HandState, steps: number): HandState {
  return at(state.azDeg + steps * YAW_STEP_DEG, state.altDeg, state.fovDeg);
}

/** `↑` / `↓`: `steps` of `PITCH_STEP_DEG`, positive upward, held inside the clamp. */
export function stepPitch(state: HandState, steps: number): HandState {
  return at(state.azDeg, state.altDeg + steps * PITCH_STEP_DEG, state.fovDeg);
}

/** The facing picker: turn to a compass point at the current tilt, at the current field. */
export function face(state: HandState, point: CompassPoint): HandState {
  return at(bearingOf(point), state.altDeg, state.fovDeg);
}

/** The picker's `up`: the zenith, keeping the azimuth so the way back down is where the reader was. */
export function up(state: HandState): HandState {
  return at(state.azDeg, STARS_TILT_MAX_DEG, state.fovDeg);
}

/**
 * FR-SKY-14: the field scaled by `factor` — above 1 widens it, below 1 narrows
 * it — about the field's centre: the facing and the tilt do not move, so the
 * readout and the gutter stay true while the fingers move. Held inside the
 * range; at an end a further step changes nothing.
 */
export function zoomBy(state: HandState, factor: number): HandState {
  if (!(factor > 0) || !Number.isFinite(factor)) return state;
  return keepFollow(state, at(state.azDeg, state.altDeg, state.fovDeg * factor));
}

/** FR-SKY-14: `0` — the field back to `WINDOW_FOV`, the aim untouched. */
export function resetZoom(state: HandState): HandState {
  return keepFollow(state, at(state.azDeg, state.altDeg, WINDOW_FOV));
}

/** A zoom keeps the pass the camera follows (FR-SKY-13): the next tick re-aims at the new field. */
const keepFollow = (from: HandState, next: HandState): HandState => (from.follow === undefined ? next : { ...next, follow: from.follow });

/**
 * FR-SKY-13 (D-797): where a pass is to the camera at `now` — on its track
 * while it is up (the live marker's point, `interpolateTrack` as the arc
 * draws it), its rise point before it rises, its set point after it sets.
 * Without an instant, the rise point.
 */
export function passPosition(pass: Pick<Pass, 'start' | 'end' | 'track'>, now: EpochMs | undefined): SkyAim {
  if (now === undefined || now < pass.start.t) return { azDeg: pass.start.azDeg, elDeg: pass.start.elDeg };
  if (now > pass.end.t || pass.track.length === 0) return { azDeg: pass.end.azDeg, elDeg: pass.end.elDeg };
  const p = interpolateTrack(pass.track, now);
  return { azDeg: p.azDeg, elDeg: p.elDeg };
}

/**
 * FR-SKY-13 (D-797): the camera turned to pass `passId` at `position`, at
 * FR-SKY-7's tilt for the field the state has (`facePeak`'s rule, so the
 * pass stands in the field's upper half), and following it: the window calls
 * this again on every tick while `follow` stands.
 */
export function followPass(state: HandState, passId: string, position: SkyAim): HandState {
  return { ...facePeak(position, state.fovDeg), follow: passId };
}

/** FR-SKY-13 (R127 review): following ends where it stands — the aim and the field kept — when its pass is no longer the one offered. */
export function unfollow(state: HandState): HandState {
  return state.follow === undefined ? state : at(state.azDeg, state.altDeg, state.fovDeg);
}

/**
 * FR-SKY-7 (R121, D-790): where a pass's peak stands in the field when the
 * window faces it — this far below the centre, so the peak is in the field's
 * upper half with the arc under it: 15° at `WINDOW_FOV`, a quarter of the
 * field, and no more than a quarter of a narrower one (D-798's zoom), so the
 * peak never leaves the field it was aimed at — the field the caller passes.
 * R125: the camera's `facePeak` and `facingOf` default to the field the state
 * carries, so FR-SKY-7's tilt is reckoned at the current zoom (FR-SKY-14).
 */
export const PEAK_BELOW_CENTRE_DEG = 15;
/** FR-SKY-7: the tilt the peak is faced at stays inside [20°, 75°] — the horizon in the lower part, never the zenith. */
export const PEAK_TILT_MIN_DEG = 20;
export const PEAK_TILT_MAX_DEG = 75;

/** A point in the sky by its azimuth and elevation — a pass's `peak`, as `Pass` carries it. */
export interface SkyAim {
  azDeg: number;
  elDeg: number;
}

/**
 * The picker's `peak` (FR-SKY-7, D-790): face the pass's peak azimuth at
 * `clamp(peakAlt − 15°, 20°, 75°)`. The pass detail's window opens here, on
 * the page and on the screen before the sensor's first reading. D-790 wrote it
 * `facePeak(state, peak, fovDeg)`; the peak decides both numbers, so the state
 * is not a parameter (D-808). The field is the one the aim is reckoned at, and
 * the state returned keeps it (R125: picking `peak` keeps the zoom).
 */
export function facePeak(peak: SkyAim, fovDeg: number): HandState {
  const field = clampWindowFov(fovDeg);
  const below = Math.min(PEAK_BELOW_CENTRE_DEG, field / 4);
  return at(peak.azDeg, Math.min(PEAK_TILT_MAX_DEG, Math.max(PEAK_TILT_MIN_DEG, peak.elDeg - below)), field);
}

/** What `openingFacing` reads of the page's scene: the observer's latitude (today's default) and the shown instant. */
export interface OpeningScene {
  latDeg: number;
  now: EpochMs | undefined;
}

/**
 * FR-FLOW-14 (R136, D-876): where the live page's window opens, so a phone
 * that opens on it never faces an empty field. In order: the highlighted pass,
 * followed as `f` follows it (D-797's `followPass`, the readout reading
 * `Following A`); else the next pass's rise point at `clamp(alt − 15°, 20°,
 * 75°)` (`facePeak`'s rule on the rise point); else today's default, the pole
 * side at the opening tilt (`initialHand`). The pass detail keeps `facePeak`.
 */
export function openingFacing(scene: OpeningScene, highlighted: Pick<Pass, 'id' | 'start' | 'end' | 'track'> | null, nextPass: Pick<Pass, 'start'> | null): HandState {
  const fallback = initialHand(scene.latDeg);
  if (highlighted !== null) return followPass(fallback, highlighted.id, passPosition(highlighted, scene.now));
  if (nextPass !== null) return facePeak({ azDeg: nextPass.start.azDeg, elDeg: nextPass.start.elDeg }, WINDOW_FOV);
  return fallback;
}

/** `openingFacing`'s `nextPass`: the first pass in the span still to rise after `now`, or none. */
export function nextRising<P extends Pick<Pass, 'start'>>(passes: readonly P[], now: EpochMs | undefined): P | null {
  let next: P | null = null;
  for (const pass of passes) {
    if (now !== undefined && pass.start.t <= now) continue;
    if (next === null || pass.start.t < next.start.t) next = pass;
  }
  return next;
}

/** The picker's option lists are `SkyChart.types.ts`'s (a page in the main chunk names one); re-exported here for the picker and the tests. */
export { FACING_OPTIONS, FACING_POINTS, facedPassId, isPassFacing, passFacing, PEAK_FACING_OPTIONS, type FacingOption } from '../SkyChart.types';

/**
 * The picker's pressed option for a hand state: the pass it follows
 * (FR-SKY-13) first, then the zenith at the top of the range, the peak where
 * the hand is exactly where `facePeak` put it, a point the hand is exactly
 * at, or none after a drag. The zenith wins over the peak and a point: at 90°
 * every azimuth is the same view. The peak is compared at the state's own
 * field unless another is given (R125); the picker gives the store's
 * `peakFovDeg`, the field the peak was faced at, so a zoom alone does not
 * un-press it.
 */
export function facingOf(state: HandState, peak: SkyAim | null = null, fovDeg: number = state.fovDeg): FacingOption | '' {
  if (state.follow !== undefined) return passFacing(state.follow);
  if (state.altDeg >= STARS_TILT_MAX_DEG) return 'up';
  if (peak !== null) {
    const aimed = facePeak(peak, fovDeg);
    if (Math.abs(normalizeAzimuthDeg(state.azDeg - aimed.azDeg + 180) - 180) < 1e-6 && Math.abs(state.altDeg - aimed.altDeg) < 1e-6) return 'peak';
  }
  return FACING_POINTS.find((point) => Math.abs(normalizeAzimuthDeg(state.azDeg - bearingOf(point) + 180) - 180) < 1e-6) ?? '';
}

/** The hand's rotation: the phone held upright, its back pointing where the hand says (`projection.ts`). The field is no part of a rotation. */
export function handRotation(state: Pick<HandState, 'azDeg' | 'altDeg'>): Mat3 {
  return uprightRotation(state.azDeg, state.altDeg);
}

/** The sensor drives the window: `useDeviceOrientation`'s rotation, as before R113. */
export interface SensorCamera {
  readonly source: 'sensor';
}

/**
 * The hand drives the window. A small external store: `get` returns the same
 * object until something changes, so `useSyncExternalStore` can read it, and
 * the moves are the reducers above applied in place. A move that changes
 * nothing — a key at the clamp, a zoom at the range's end — notifies nobody.
 */
export interface HandCamera {
  readonly source: 'hand';
  get(): HandState;
  subscribe(listener: () => void): () => void;
  dragTo(dxPx: number, dyPx: number): void;
  stepYaw(steps: number): void;
  stepPitch(steps: number): void;
  face(point: CompassPoint): void;
  up(): void;
  /** FR-SKY-7 (R121): the picker's `peak` — the pass's peak azimuth at the tilt `facePeak` gives for the field shown (the camera's own unless said). */
  facePeak(peak: SkyAim, fovDeg?: number): void;
  /**
   * R125: the field the peak was last faced at (the field at creation until then). A zoom moves neither the aim nor
   * this, so the picker's `peak` stays pressed through a zoom (`facingOf(get(), peak, peakFovDeg())`).
   */
  peakFovDeg(): number;
  /** FR-SKY-14 (R125): the field scaled by `factor`, inside the range; the aim untouched. */
  zoomBy(factor: number): void;
  /** FR-SKY-14 (R125): the field back to `WINDOW_FOV`. */
  resetZoom(): void;
  /** FR-SKY-13 (R127): turned to pass `passId` at `position` and following it; the window calls it again each tick while `get().follow` is the id. */
  followPass(passId: string, position: SkyAim): void;
  /** FR-SKY-13 (R127 review): stops following, the camera where it is; the window calls it when the followed pass is no longer offered. */
  unfollow(): void;
}

export type SkyCamera = SensorCamera | HandCamera;

/** The one sensor camera: it carries no state, so one value serves every window. */
export const SENSOR_CAMERA: SensorCamera = { source: 'sensor' };

export function createHandCamera(initial: HandAim & Pick<HandState, 'follow'>): HandCamera {
  // R136 (FR-FLOW-14): a camera may open following a pass (`openingFacing`), so the opening state keeps its `follow`.
  const aimed = at(initial.azDeg, initial.altDeg, initial.fovDeg);
  let state: HandState = initial.follow === undefined ? aimed : { ...aimed, follow: initial.follow };
  let peakField = state.fovDeg;
  const listeners = new Set<() => void>();
  const apply = (next: HandState): void => {
    if (next.azDeg === state.azDeg && next.altDeg === state.altDeg && next.fovDeg === state.fovDeg && next.follow === state.follow) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    source: 'hand',
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dragTo: (dxPx, dyPx) => {
      apply(dragTo(state, dxPx, dyPx));
    },
    stepYaw: (steps) => {
      apply(stepYaw(state, steps));
    },
    stepPitch: (steps) => {
      apply(stepPitch(state, steps));
    },
    face: (point) => {
      apply(face(state, point));
    },
    up: () => {
      apply(up(state));
    },
    facePeak: (peak, fovDeg = state.fovDeg) => {
      const next = facePeak(peak, fovDeg);
      peakField = next.fovDeg;
      apply(next);
    },
    peakFovDeg: () => peakField,
    zoomBy: (factor) => {
      apply(zoomBy(state, factor));
    },
    resetZoom: () => {
      apply(resetZoom(state));
    },
    followPass: (passId, position) => {
      apply(followPass(state, passId, position));
    },
    unfollow: () => {
      apply(unfollow(state));
    },
  };
}
