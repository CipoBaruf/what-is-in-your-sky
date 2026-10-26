import { COMPASS_POINTS, normalizeAzimuthDeg, type CompassPoint } from '../../../../../lib/compass';
import { DRAG_PX_PER_DEG, PITCH_STEP_DEG, YAW_STEP_DEG } from '../dome/camera';
import { uprightRotation, WINDOW_FOV, type Mat3 } from './projection';

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
 */

/** The hand's state: where the centre of the field points, degrees. */
export interface HandState {
  /** Clockwise from north, in [0, 360). */
  azDeg: number;
  /** Above the horizon, in [STARS_TILT_MIN_DEG, STARS_TILT_MAX_DEG]. */
  altDeg: number;
}

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

/** The hand's first state for an observer: the pole side at the default tilt. */
export function initialHand(latDeg: number): HandState {
  return { azDeg: defaultFacingDeg(latDeg), altDeg: STARS_DEFAULT_TILT };
}

export function clampWindowTilt(altDeg: number): number {
  return Math.min(STARS_TILT_MAX_DEG, Math.max(STARS_TILT_MIN_DEG, altDeg));
}

const SECTOR_DEG = 360 / COMPASS_POINTS.length;

/** A compass point's bearing: `N` 0, `E` 90, `SW` 225. */
export function bearingOf(point: CompassPoint): number {
  return COMPASS_POINTS.indexOf(point) * SECTOR_DEG;
}

const at = (azDeg: number, altDeg: number): HandState => ({ azDeg: normalizeAzimuthDeg(azDeg), altDeg: clampWindowTilt(altDeg) });

/**
 * A drag by (dx, dy) CSS pixels at `DRAG_PX_PER_DEG`: the sky follows the
 * finger, as the dome does. Dragging right pulls the sky right, so the view
 * turns left (the azimuth decreases); dragging down pulls the sky down, so
 * the view looks higher (the altitude increases).
 */
export function dragTo(state: HandState, dxPx: number, dyPx: number): HandState {
  return at(state.azDeg - dxPx / DRAG_PX_PER_DEG, state.altDeg + dyPx / DRAG_PX_PER_DEG);
}

/** `←` / `→`: `steps` of `YAW_STEP_DEG`, positive clockwise (to the right). */
export function stepYaw(state: HandState, steps: number): HandState {
  return at(state.azDeg + steps * YAW_STEP_DEG, state.altDeg);
}

/** `↑` / `↓`: `steps` of `PITCH_STEP_DEG`, positive upward, held inside the clamp. */
export function stepPitch(state: HandState, steps: number): HandState {
  return at(state.azDeg, state.altDeg + steps * PITCH_STEP_DEG);
}

/** The facing picker: turn to a compass point at the current tilt. */
export function face(state: HandState, point: CompassPoint): HandState {
  return at(bearingOf(point), state.altDeg);
}

/** The picker's `up`: the zenith, keeping the azimuth so the way back down is where the reader was. */
export function up(state: HandState): HandState {
  return at(state.azDeg, STARS_TILT_MAX_DEG);
}

/**
 * FR-SKY-7 (R121, D-790): where a pass's peak stands in the field when the
 * window faces it — this far below the centre, so the peak is in the field's
 * upper half with the arc under it: 15° at `WINDOW_FOV`, a quarter of the
 * field, and no more than a quarter of a narrower one (D-798's zoom), so the
 * peak never leaves the field it was aimed at.
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
 * is not a parameter (D-808).
 */
export function facePeak(peak: SkyAim, fovDeg: number): HandState {
  const below = Math.min(PEAK_BELOW_CENTRE_DEG, fovDeg / 4);
  return at(peak.azDeg, Math.min(PEAK_TILT_MAX_DEG, Math.max(PEAK_TILT_MIN_DEG, peak.elDeg - below)));
}

/** FR-STAR-3, FR-SKY-7: the facing picker's eight points, in the order the row shows them. */
export const FACING_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const satisfies readonly CompassPoint[];
/** What the picker can offer: a point, the zenith, or (the pass detail) the explained pass's peak. */
export type FacingOption = (typeof FACING_POINTS)[number] | 'up' | 'peak';
/** The stars page's and the live page's list: the eight points, then the zenith. */
export const FACING_OPTIONS: readonly FacingOption[] = [...FACING_POINTS, 'up'];
/** The pass detail's list (D-790): `peak` first, then the eight points and the zenith. */
export const PEAK_FACING_OPTIONS: readonly FacingOption[] = ['peak', ...FACING_POINTS, 'up'];

/**
 * The picker's pressed option for a hand state: the zenith at the top of the
 * range, the peak where the hand is exactly where `facePeak` put it, a point
 * the hand is exactly at, or none after a drag. The zenith wins over the peak
 * and a point: at 90° every azimuth is the same view.
 */
export function facingOf(state: HandState, peak: SkyAim | null = null): FacingOption | '' {
  if (state.altDeg >= STARS_TILT_MAX_DEG) return 'up';
  if (peak !== null) {
    const aimed = facePeak(peak, WINDOW_FOV);
    if (Math.abs(normalizeAzimuthDeg(state.azDeg - aimed.azDeg + 180) - 180) < 1e-6 && Math.abs(state.altDeg - aimed.altDeg) < 1e-6) return 'peak';
  }
  return FACING_POINTS.find((point) => Math.abs(normalizeAzimuthDeg(state.azDeg - bearingOf(point) + 180) - 180) < 1e-6) ?? '';
}

/** The hand's rotation: the phone held upright, its back pointing where the hand says (`projection.ts`). */
export function handRotation(state: HandState): Mat3 {
  return uprightRotation(state.azDeg, state.altDeg);
}

/** The sensor drives the window: `useDeviceOrientation`'s rotation, as before R113. */
export interface SensorCamera {
  readonly source: 'sensor';
}

/**
 * The hand drives the window. A small external store: `get` returns the same
 * object until something changes, so `useSyncExternalStore` can read it, and
 * the five moves are the reducers above applied in place. A move that changes
 * nothing — a key at the clamp — notifies nobody.
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
  /** FR-SKY-7 (R121): the picker's `peak` — the pass's peak azimuth at the tilt `facePeak` gives, at the window's field. */
  facePeak(peak: SkyAim): void;
}

export type SkyCamera = SensorCamera | HandCamera;

/** The one sensor camera: it carries no state, so one value serves every window. */
export const SENSOR_CAMERA: SensorCamera = { source: 'sensor' };

export function createHandCamera(initial: HandState): HandCamera {
  let state = at(initial.azDeg, initial.altDeg);
  const listeners = new Set<() => void>();
  const apply = (next: HandState): void => {
    if (next.azDeg === state.azDeg && next.altDeg === state.altDeg) return;
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
    facePeak: (peak) => {
      apply(facePeak(peak, WINDOW_FOV));
    },
  };
}
