import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../state';
import { requestOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { deviceHeading, orientationApiPresent, orientationEventName, permissionRequest, readingFrom } from './compassHeading';

/**
 * R34 (FR-LIVE-8, US-10, US-15 AC8; D-175), rewritten by R59 (FR-FOL-1..3,
 * FR-LIVE-8 as amended v1.2, D-276): the `[ follow phone ]` control's state.
 *
 * Following is no longer the dome turning; it is the sky window being shown.
 * The control opens the window over whatever view is showing and the second
 * press gives that view back, so what this hook owns is the *view override*
 * (D-277) and the two answers a phone can give before there is a window to
 * show: a refused permission, and a device with no north in its readings.
 * `window/useDeviceOrientation` is the only listener on the sensor once the
 * window is up, so there is never a second subscription and never two
 * smoothing states to disagree.
 *
 *   - `off`: not following; the chart is the reader's own view.
 *   - `on`: the window is showing because this control opened it.
 *   - `relative`: the one reading this hook waits for carried no north (no
 *     `absolute`, no `webkitCompassHeading`), so the window is not opened at
 *     all: it would have nothing to point at. A note, and the view is left
 *     exactly as it was (FR-FOL-2).
 *   - `denied`: the permission was refused, or the request failed (an insecure
 *     context); a note, and the control asks again on the next press.
 *
 * **The tap is where the browser is asked** (FR-WIN-4, FR-FOL-2). iOS grants
 * `DeviceOrientationEvent` only from a user gesture, so the request is made
 * inside the click through `orientationAccess.ts` — the same one place the
 * view control's "Window" option asks from, so the window this press opens
 * arms its own listener at once instead of showing `[ point at the sky ]`.
 *
 * **One reading before the switch** (F-42's lesson). Granted is not the same
 * as followable: a phone with no compass heading answers the permission and
 * then sends readings with no north in them. So the press arms a listener,
 * and it is the first reading that decides — a heading opens the window and
 * the listener goes (the window takes the sensor from there); no heading is
 * the `relative` note with the view untouched. A device that sends nothing at
 * all leaves the control unpressed and the page alone, which is what it did
 * before.
 *
 * **Leaving.** The second press, and unmounting the live page, clear the
 * override; `viewOverride ?? savedChartView` is what the chart reads, so
 * clearing it *is* restoring the view the press came from — there is no
 * second memory of it to go stale. Anything else that clears the override —
 * the reader picking a view by hand (`setChartView`), a window that reports it
 * cannot run here (`dropChartView`) — ends following too, and the control goes
 * back to unpressed.
 */
export type FollowState = 'off' | 'on' | 'relative' | 'denied';

export interface FollowPhoneHandle {
  available: boolean;
  state: FollowState;
  toggle: () => void;
}

/** FR-FOL-1: the view the control opens. */
const FOLLOW_VIEW = 'window';

/**
 * R64 (FR-FSC-1, D-321): whether the follow screen is up, for the parts of the
 * live page that are outside the component holding the control — its one-row
 * header, which the layer covers. Following *is* the override (D-277), so this
 * reads the store rather than the hook: calling `useFollowPhone` a second time
 * would arm a second sensor and keep a second note.
 */
export function useFollowing(): boolean {
  return useAppStore((s) => s.viewOverride) === FOLLOW_VIEW;
}

export function useFollowPhone(): FollowPhoneHandle {
  // FR-WIN-4's presence test, the window's own: the control is offered exactly where the window is.
  const available = useMemo(() => typeof window !== 'undefined' && orientationApiPresent(), []);
  const viewOverride = useAppStore((s) => s.viewOverride);
  const setViewOverride = useAppStore((s) => s.setViewOverride);
  // Armed — waiting for the reading that says whether this phone has north — is not yet following.
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState<'relative' | 'denied' | null>(null);
  /*
   * D-277: the override *is* following — nothing else in the app sets one — so
   * the state is read off the store rather than mirrored beside it. That is
   * what makes a view picked by hand (`setChartView`) or a window that reports
   * it cannot run here (`dropChartView`) end following with no listener of our
   * own watching for it, and what makes the two impossible to disagree.
   */
  const following = viewOverride === FOLLOW_VIEW;
  const state: FollowState = following ? 'on' : (note ?? 'off');

  useEffect(() => {
    if (!armed) return;
    const onReading = (event: Event): void => {
      setArmed(false);
      if (deviceHeading(readingFrom(event as DeviceOrientationEvent)) === null) {
        setNote('relative');
        return;
      }
      setViewOverride(FOLLOW_VIEW);
    };
    const name = orientationEventName();
    window.addEventListener(name, onReading);
    return () => {
      window.removeEventListener(name, onReading);
    };
  }, [armed, setViewOverride]);

  // FR-FOL-1: leaving the live page gives the view back, as the second press does. The ref is the
  // last committed answer, so the cleanup that runs on unmount reads it without depending on it.
  const followingRef = useRef(following);
  useEffect(() => {
    followingRef.current = following;
  }, [following]);
  useEffect(
    () => () => {
      if (followingRef.current) setViewOverride(null);
    },
    [setViewOverride],
  );

  const stop = useCallback(() => {
    setArmed(false);
    setNote(null);
    if (following) setViewOverride(null);
  }, [following, setViewOverride]);

  const toggle = useCallback(() => {
    if (following || armed) {
      stop();
      return;
    }
    // The note belongs to the answer before this press, not to the reading this one is waiting for.
    setNote(null);
    if (permissionRequest() === null) {
      setArmed(true);
      return;
    }
    // iOS: inside the click, so the gesture carries. The answer arrives later; a refusal shows the note.
    void requestOrientationAccess().then((answer) => {
      if (answer === 'granted') setArmed(true);
      else setNote('denied');
    });
  }, [following, armed, stop]);

  // R59 review: `stop` stays internal. The dome no longer turns while following, so there is no
  // drag to end it and nothing outside calls it — the hook's own toggle and unmount do.
  return { available, state, toggle };
}
