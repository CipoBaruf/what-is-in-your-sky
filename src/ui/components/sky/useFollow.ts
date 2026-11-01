import { useCallback, useMemo, useRef, useState } from 'react';
import { appStore, useAppStore } from '../../../state';
import { orientationAnswer, requestOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { orientationApiPresent, permissionRequest } from '../live/compassHeading';

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
 * every browser without one) `on` starts `FOLLOW_DEFAULT`; else with `followGranted` saved, `armed` starts true and
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
    if (!sensor) return { on: false, armed: false };
    if (permissionRequest() === null) return { on: FOLLOW_DEFAULT, armed: false };
    const granted = appStore.getState().followGranted;
    if (granted && orientationAnswer() === 'granted') return { on: true, armed: false };
    return { on: false, armed: granted };
  });
  const [on, setOn] = useState(start.on);
  const [armed, setArmed] = useState(start.armed);
  const [refused, setRefused] = useState(false);
  const setFollowGranted = useAppStore((s) => s.setFollowGranted);
  // Every press or drag that ends following moves this on, so an answer to an earlier press does not overrule it.
  const said = useRef(0);

  const turnOn = useCallback(() => {
    // FR-GYRO-3: the refusal's line goes on the next press, whatever that press does.
    setRefused(false);
    setArmed(false);
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
    setRefused(false);
    setOn(false);
  }, []);
  const onFollowEnd = useCallback(() => {
    said.current += 1;
    setOn(false);
  }, []);

  return useMemo(() => ({ sensor, on, armed, refused, turnOn, turnOff, onFollowEnd, firstTouch: armed ? turnOn : undefined }), [sensor, on, armed, refused, turnOn, turnOff, onFollowEnd]);
}
