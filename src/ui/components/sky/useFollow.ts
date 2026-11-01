import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appStore, useAppStore } from '../../../state';
import { orientationAnswer, requestOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { deviceHeading, orientationApiPresent, orientationEventName, permissionRequest } from '../live/compassHeading';

/**
 * FR-PHONE-1 (V210-2): on a touch phone the window follows from the first reading where no permission is needed, and
 * from the saved grant on iOS after one allow (FR-PHONE-2). `on`: a page opens following wherever FR-WIN-4's presence
 * test passes and the browser has no motion request to make. Off would bring back v2.9's rule (off on every visit).
 */
export const FOLLOW_DEFAULT = true;

/** What a page's follow state is, and the presses that change it: the toggle's, the control's, the window's and the first touch's. */
export interface Follow {
  /** FR-WIN-4's presence test, asked once at mount: the page draws the toggle and the control only where it passes. */
  sensor: boolean;
  /** Whether the page's window follows the phone now. */
  on: boolean;
  /** FR-PHONE-2: a grant is saved and nothing has been asked yet this visit, so the first touch on the sky asks. */
  armed: boolean;
  /** FR-GYRO-3: the last request was refused (or threw); the toggle and the control draw the line until the next press. */
  refused: boolean;
  /** The press that turns following on: asks inside the gesture, then follows on a grant or shows the line on a refusal. */
  turnOn: () => void;
  /** The press that turns following off: asks nothing. */
  turnOff: () => void;
  /** D-942: the window's drag or box key took the sky back; the window has already seeded the hand camera. */
  onFollowEnd: () => void;
  /** D-963: `SkyViewLayout`'s `onFirstTouch` — `turnOn` while armed, nothing otherwise. */
  firstTouch: (() => void) | undefined;
}

/**
 * R159 (FR-PHONE-1, FR-PHONE-2, FR-GYRO-1..3 as amended; US-45 AC1, AC2; PLAN D-962, D-963, D-986): the one owner of
 * a page's following, in place of the three pages' `useState(false)`. The live page, the stars page and the pass
 * detail each call it once and hand the result to every control that shows the state — the sheet's or the action
 * slot's `FollowToggle`, the overlay's `FollowControl` — and to `SkyViewLayout`'s first-touch listener, so the
 * controls never disagree and share one press logic and one refusal line.
 *
 * At mount, where `orientationApiPresent()`: with no request to make (`permissionRequest()` is `null`: Android, and
 * every browser without one) the page follows (`FOLLOW_DEFAULT`) from the sensor's first reading that has a north in
 * it — a phone gives one within a frame, so it follows from its first reading as FR-PHONE-1 says, while a touch
 * laptop or a desk Chromium, whose readings carry no north (every angle `null`, or `absolute: false`), never starts
 * following and keeps its window by hand rather than reading as a compass-less phone (D-986); else with `followGranted` saved, `armed` starts true and
 * `on` false — nothing is asked at load (FR-WIN-4); else both start false, the first visit's rule. Without the sensor
 * everything is off and stays off.
 *
 * A page opened after this page session's grant (the request answered `granted` already, iOS answering a second
 * request from memory) starts on, with nothing to ask.
 *
 * `turnOn` asks inside the handler, before any await (`requestOrientationAccess`, D-175, D-240): granted, `on`, and
 * where a request exists the grant is saved (`followGranted: true`); refused or throwing, `refused` and the saved
 * grant cleared — a refusal never writes `true`. Either way it disarms: one request per visit from the first touch.
 * A grant that answers after the reader turned following off, or took the sky back with a drag, saves the grant and
 * leaves following off: the reader's last word stands.
 */
export function useFollow(): Follow {
  const [sensor] = useState(() => typeof window !== 'undefined' && orientationApiPresent());
  const [start] = useState(() => {
    if (!sensor) return { on: false, armed: false, waiting: false };
    if (permissionRequest() === null) return { on: false, armed: false, waiting: FOLLOW_DEFAULT };
    const granted = appStore.getState().followGranted;
    if (granted && orientationAnswer() === 'granted') return { on: true, armed: false, waiting: false };
    return { on: false, armed: granted, waiting: false };
  });
  const [on, setOn] = useState(start.on);
  const [armed, setArmed] = useState(start.armed);
  // FR-PHONE-1 (D-986): following by default starts at the first reading with a north; any press or drag first wins.
  const [waiting, setWaiting] = useState(start.waiting);
  useEffect(() => {
    if (!waiting) return;
    const name = orientationEventName();
    const onReading = (event: Event): void => {
      const reading = event as Event & { alpha?: number | null; absolute?: boolean; webkitCompassHeading?: number | null };
      if (deviceHeading({ alpha: reading.alpha ?? null, absolute: reading.absolute === true, webkitCompassHeading: reading.webkitCompassHeading ?? null }) === null) return;
      setWaiting(false);
      setOn(true);
    };
    window.addEventListener(name, onReading);
    return () => {
      window.removeEventListener(name, onReading);
    };
  }, [waiting]);
  const [refused, setRefused] = useState(false);
  const setFollowGranted = useAppStore((s) => s.setFollowGranted);
  // Every press or drag that ends following moves this on, so an answer to an earlier press does not overrule it.
  const said = useRef(0);

  const turnOn = useCallback(() => {
    // FR-GYRO-3: the refusal's line goes on the next press, whatever that press does.
    setRefused(false);
    setArmed(false);
    setWaiting(false);
    const asks = permissionRequest() !== null;
    const press = (said.current += 1);
    // Inside the gesture, before any await: the request is the press's (D-175).
    void requestOrientationAccess().then((answer) => {
      if (answer === 'granted') {
        if (said.current === press) setOn(true);
        if (asks && !appStore.getState().followGranted) setFollowGranted(true);
        return;
      }
      setRefused(true);
      if (appStore.getState().followGranted) setFollowGranted(false);
    });
  }, [setFollowGranted]);
  const turnOff = useCallback(() => {
    said.current += 1;
    setWaiting(false);
    setRefused(false);
    setOn(false);
  }, []);
  const onFollowEnd = useCallback(() => {
    said.current += 1;
    setWaiting(false);
    setOn(false);
  }, []);

  return useMemo(() => ({ sensor, on, armed, refused, turnOn, turnOff, onFollowEnd, firstTouch: armed ? turnOn : undefined }), [sensor, on, armed, refused, turnOn, turnOff, onFollowEnd]);
}
