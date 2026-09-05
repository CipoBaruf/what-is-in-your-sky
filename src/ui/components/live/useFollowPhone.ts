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
 *   - `off`: not listening; the dome is the viewer's.
 *   - `on`: listening; `facingAzDeg` is the last heading, or `null` before
 *     the first reading lands.
 *   - `relative`: listening, but the readings carry no north (no
 *     `absolute`, no `webkitCompassHeading`), so the page shows a note and
 *     the dome stays where it is. A later reading with a heading recovers.
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

const listening = (state: FollowState): boolean => state === 'on' || state === 'relative';

export function useFollowPhone(): FollowPhoneHandle {
  const available = useMemo(() => typeof window !== 'undefined' && orientationApiPresent(), []);
  const [state, setState] = useState<FollowState>('off');
  const [facingAzDeg, setFacing] = useState<number | null>(null);
  const active = listening(state);

  useEffect(() => {
    if (!active) return;
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
        setState((current) => (current === 'on' ? 'relative' : current));
        return;
      }
      setState((current) => (current === 'relative' ? 'on' : current));
      pending = quantise(facingFrom(heading, screenAngle()));
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const name = orientationEventName();
    window.addEventListener(name, onReading);
    return () => {
      window.removeEventListener(name, onReading);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [active]);

  const stop = useCallback(() => {
    setState((current) => (current === 'denied' ? current : 'off'));
    setFacing(null);
  }, []);

  const toggle = useCallback(() => {
    if (listening(state)) {
      stop();
      return;
    }
    const request = permissionRequest();
    if (request === null) {
      setState('on');
      return;
    }
    // iOS: inside the click, so the gesture carries. The answer arrives later; a refusal shows the note.
    request()
      .then((answer) => {
        setState(answer === 'granted' ? 'on' : 'denied');
      })
      .catch(() => {
        setState('denied');
      });
  }, [state, stop]);

  return { available, state, facingAzDeg, toggle, stop };
}
