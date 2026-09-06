import { permissionRequest } from '../../../live/compassHeading';

/**
 * R47 (FR-WIN-4, FR-WIN-5, D-240): the one place the window asks the browser
 * for the orientation sensor, kept outside React so the request can be made
 * in the tap that *chooses* the view — before `SkyWindow` exists to make it.
 *
 * iOS grants `DeviceOrientationEvent` only from a user gesture
 * (`requestPermission()`), so the request runs inside the click and nowhere
 * else (D-175). Two taps lead here: the view toggle's "Window" option, whose
 * `choose()` hook calls `requestOrientationAccess()` before the view mounts,
 * and the `[ point at the sky ]` control the window shows in its own place
 * when it is the saved view and no tap has been made yet (FR-WIN-5). The
 * answer is remembered for the page session — iOS answers a second request
 * from memory anyway — so the window mounted after a grant arms its listener
 * at once, and a refusal is asked again only on the next tap.
 *
 * Where no request exists (Android, and the desktop browsers that carry the
 * constructor) there is nothing to ask: listening is not a request, and the
 * window arms on mount. FR-WIN-4's "never on load" is about the prompt.
 */
export type OrientationAnswer = 'granted' | 'denied';

let answer: OrientationAnswer | null = null;
let inflight: Promise<OrientationAnswer> | null = null;

/** FR-WIN-5: the browser still needs a tap before it will give orientation. */
export function orientationGestureNeeded(): boolean {
  return permissionRequest() !== null && answer !== 'granted';
}

/** The remembered answer, or `null` before any request (and where none is needed). */
export function orientationAnswer(): OrientationAnswer | null {
  return answer;
}

/** The request in flight, for a window mounted between the tap and the answer. */
export function orientationRequestInFlight(): Promise<OrientationAnswer> | null {
  return inflight;
}

/**
 * Ask, inside a user gesture. Resolves `'granted'` at once where no request
 * exists; a request that throws (an insecure context) is a refusal, as
 * `useFollowPhone` reads it.
 */
export function requestOrientationAccess(): Promise<OrientationAnswer> {
  const request = permissionRequest();
  if (request === null) return Promise.resolve('granted');
  if (inflight) return inflight;
  const pending = request()
    .then((result): OrientationAnswer => (result === 'granted' ? 'granted' : 'denied'))
    .catch((): OrientationAnswer => 'denied')
    .then((result) => {
      answer = result;
      inflight = null;
      return result;
    });
  inflight = pending;
  return pending;
}

/** Tests only: forget the session's answer. */
export function resetOrientationAccess(): void {
  answer = null;
  inflight = null;
}
