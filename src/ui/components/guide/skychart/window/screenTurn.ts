import { normalizeAzimuthDeg } from '../../../../../lib/compass';
import { skyVector, toDevice, type Mat3 } from './projection';

/**
 * R73 (FR-FSC-10; PLAN D-424): which way is up on the sky screen, read from
 * the pose the orientation sensor already reports and not from `(orientation:
 * …)` or from `screen.orientation.angle`.
 *
 * A phone whose rotation is locked never reflows: held sideways, the viewport
 * stays 390 × 844 and the browser's angle stays 0, while the reader's eye is
 * looking at a wide picture that the page has drawn tall. The pose knows
 * better — the sensor says where the room's vertical is in the phone's own
 * frame — and that is the whole of what this file computes.
 *
 * It costs no new API, no second permission and no second listener:
 * `useDeviceOrientation` already hands out the smoothed device → earth
 * rotation the drawing is aimed by, and the room's up taken through that
 * rotation into the device frame is the vector this reads. It reads it through
 * `projection.ts`'s own helpers — `skyVector(_, 90)` is up in the room,
 * `toDevice` is the frame change — rather than restating the convention
 * (D-188; D-285's lesson: a frame written twice is a frame written wrong
 * once).
 *
 * The component of that vector in the plane of the screen (device X to the
 * right, Y up the screen) gives the direction the room's up lies in; the
 * quarter returned is the one whose screen-up is nearest it, expressed the way
 * `screen.orientation.angle` expresses it — 90 is the phone turned
 * counter-clockwise, its top to the reader's left, which is the pose where
 * device +X points up the room (R38, confirmed on the phone) — so the number
 * means the same thing the browser's does and, on an unlocked phone, is the
 * same number.
 *
 * Two guards keep it still, both here rather than in the caller, so the whole
 * behaviour is one pure function and the pose table is a unit test and not a
 * device (D-429):
 *
 *   - **flat** (FR-FSC-10): within `SCREEN_TURN_FLAT_DEG` of flat, face up or
 *     face down, the room's vertical has no direction worth reading in the
 *     plane of the screen — that is the phone held up at a pass near the
 *     zenith, which is the pose this app exists for — so `held` comes back
 *     unchanged and the reader keeps the picture they had.
 *   - **hysteresis** (FR-FSC-10): the quarter moves only once the pose is past
 *     the diagonal by `SCREEN_TURN_HYSTERESIS_DEG`, 65° from the quarter it is
 *     leaving, which is what keeps a phone held at an angle from flipping back
 *     and forth.
 *
 * `null` — before the first reading, and on a device that gives no reading at
 * all — is quarter 0: the screen is laid out as the viewport is, which is
 * right on every phone whose rotation is not locked and is no worse than
 * today's on the ones where it is.
 */

/** The turn, in `screen.orientation.angle`'s own convention. */
export type Quarter = 0 | 90 | 180 | 270;

/** FR-FSC-10: how far past the diagonal the pose goes before the quarter moves — 45 + 20 = 65° from the one it is leaving. */
export const SCREEN_TURN_HYSTERESIS_DEG = 20;

/** FR-FSC-10: how near flat, face up or face down, the quarter is held rather than recomputed. */
export const SCREEN_TURN_FLAT_DEG = 25;

const RAD = Math.PI / 180;

/** The shorter way round between two angles, degrees, 0..180. */
const separation = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

/** The quarter nearest an angle: the browser's own `screen.orientation.angle` on the way in, and the pose's on the way out. */
export function nearestQuarter(angleDeg: number): Quarter {
  return ((((Math.round(normalizeAzimuthDeg(angleDeg) / 90) * 90) % 360) + 360) % 360) as Quarter;
}

/** FR-FSC-10 (D-424): the quarter turn that puts the room's up at the top of the picture. */
export function quarterTurnFor(m: Mat3 | null, held: Quarter): Quarter {
  if (m === null) return 0;
  // Up in the room, in the phone's own frame: X to the right of the screen, Y up it, Z out of it.
  const [x, y] = toDevice(m, skyVector(0, 90));
  // Flat: what is left of the room's vertical in the plane of the screen is too short to have a direction.
  if (Math.hypot(x, y) < Math.sin(SCREEN_TURN_FLAT_DEG * RAD)) return held;
  const upDeg = normalizeAzimuthDeg(Math.atan2(x, y) / RAD);
  const nearest = nearestQuarter(upDeg);
  if (nearest === held) return held;
  return separation(upDeg, held) > 45 + SCREEN_TURN_HYSTERESIS_DEG ? nearest : held;
}
