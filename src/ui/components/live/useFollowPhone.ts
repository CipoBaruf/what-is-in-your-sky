import { useCallback, useEffect, useMemo, useState } from 'react';
import { deviceHeading, facingFrom, orientationApiPresent, orientationEventName, permissionRequest, quantise, readingFrom, screenAngle } from './compassHeading';

/**
 * R34 (FR-LIVE-8, US-10, US-15 AC8; D-175): the phone's compass as the
 * dome's facing. `toggle` is the control's click handler and the only place
 * the sensor is asked for: iOS grants `DeviceOrientationEvent` only from a
 * user gesture (`requestPermission()`, HTTPS), so the request is made inside
 * the click and nowhere else. Granted — or not needed — the hook listens to
 * Chrome's absolute event where the window has it and the plain one
 * elsewhere, maps each reading through `compassHeading.ts`, and hands out a
 * whole-degree facing at most once per animation frame, the pace the drag
 * already updates the dome at.
 *
 *   - `off`: not following; the dome is the viewer's. R39 (F-42): this is also
 *     the state of a phone that has been asked and has said nothing yet. The
 *     listener is armed, but the state names what the dome is doing, and where
 *     no reading ever arrives — a desktop with the constructor and no sensor,
 *     a page whose permissions policy drops the events — that is nothing.
 *   - `on`: a reading with a heading has landed; `facingAzDeg` is the last one.
 *   - `relative`: a reading landed, but it carries no north (no `absolute`, no
 *     `webkitCompassHeading`), so the page shows a note and the dome stays
 *     where it is. A later reading with a heading recovers.
 *   - `denied`: the permission was refused, or the request failed (an
 *     insecure context); a note, and the control asks again on the next
 *     click.
 *
 * `stop` is what the dome's `onDrag` calls: a drag is the viewer taking the
 * dome by hand, and following stays off until the control turns it on again.
 * `available` is false where there is no phone to follow, and the control is
 * not rendered at all (PLAN §8.8).
 */
export type FollowState = 'off' | 'on' | 'relative' | 'denied';

export interface FollowPhoneHandle {
  available: boolean;
  state: FollowState;
  /** The facing while following, whole degrees clockwise from north; `null` until a heading has been read. */
  facingAzDeg: number | null;
  toggle: () => void;
  stop: () => void;
}

export function useFollowPhone(): FollowPhoneHandle {
  const available = useMemo(() => typeof window !== 'undefined' && orientationApiPresent(), []);
  // R39 (F-42): armed — the listener is on — is not the same as following. The click arms; the first
  // reading is what names the state, so a device that never sends one leaves the control alone.
  const [armed, setArmed] = useState(false);
  const [state, setState] = useState<FollowState>('off');
  const [facingAzDeg, setFacing] = useState<number | null>(null);

  useEffect(() => {
    if (!armed) return;
    let frame = 0;
    let pending: number | null = null;
    const flush = (): void => {
      frame = 0;
      if (pending === null) return;
      setFacing(pending);
      pending = null;
    };
    const onReading = (event: Event): void => {
      const heading = deviceHeading(readingFrom(event as DeviceOrientationEvent));
      if (heading === null) {
        setState('relative');
        return;
      }
      setState('on');
      pending = quantise(facingFrom(heading, screenAngle()));
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const name = orientationEventName();
    window.addEventListener(name, onReading);
    return () => {
      window.removeEventListener(name, onReading);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [armed]);

  const stop = useCallback(() => {
    setArmed(false);
    setState((current) => (current === 'denied' ? current : 'off'));
    setFacing(null);
  }, []);

  const arm = useCallback(() => {
    setArmed(true);
    // The refusal's note belongs to the answer before this click, not to the reading this one is waiting for.
    setState((current) => (current === 'denied' ? 'off' : current));
  }, []);

  const toggle = useCallback(() => {
    if (armed) {
      stop();
      return;
    }
    const request = permissionRequest();
    if (request === null) {
      arm();
      return;
    }
    // iOS: inside the click, so the gesture carries. The answer arrives later; a refusal shows the note.
    request()
      .then((answer) => {
        if (answer === 'granted') arm();
        else setState('denied');
      })
      .catch(() => {
        setState('denied');
      });
  }, [armed, arm, stop]);

  return { available, state, facingAzDeg, toggle, stop };
}
