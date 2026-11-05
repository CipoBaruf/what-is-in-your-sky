import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appStore, useAppStore } from '../../../state';
import { orientationAnswer, requestOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { deviceHeading, orientationApiPresent, orientationEventName, permissionRequest } from '../live/compassHeading';

/**
 * FR-PHONE-1 (V210-2): on a touch phone the window follows from the first reading where no permission is needed, and
 * from the saved grant on iOS after one allow (FR-PHONE-2). `on`: a page opens following wherever FR-WIN-4's presence
 * test passes and the browser has no motion request to make. Off would bring back v2.9's rule (off on every visit).
 * Since v2.14.2 (FR-PHONE-1 as amended, V214-40) on compact this holds only once an allow is saved.
 */
export const FOLLOW_DEFAULT = true;

/** v2.14.2 (FR-PHONE-17, V214-41; D-1143): the tab's record that the follow question was answered this visit. */
export const FOLLOW_ASKED_KEY = 'wiys:followAsked:v1';

function askedThisVisit(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(FOLLOW_ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

function markAsked(): void {
  try {
    globalThis.sessionStorage?.setItem(FOLLOW_ASKED_KEY, '1');
  } catch {
    // A storage that throws (a private window) only means the next page asks again.
  }
}

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
  /** FR-PHONE-17: the page shows the follow question now (compact only). */
  asking: boolean;
  /** The press that turns following on: asks inside the gesture, then follows on a grant or shows the line on a refusal. */
  turnOn: () => void;
  /** The press that turns following off: asks nothing. */
  turnOff: () => void;
  /** FR-PHONE-17's `[ allow ]`: `turnOn`, and the question answered for the visit. */
  allow: () => void;
  /** FR-PHONE-17's `[ not now ]` and `Esc`: the question answered for the visit, nothing asked, following left off. */
  notNow: () => void;
  /** D-942: the window's drag or box key took the sky back; the window has already seeded the hand camera. */
  onFollowEnd: () => void;
  /** D-963: `SkyViewLayout`'s `onFirstTouch` — `turnOn` while armed, nothing otherwise. */
  firstTouch: (() => void) | undefined;
}

/** What the first reading with a north does: start following, open the question, or nothing (not waiting). */
type Waiting = 'follow' | 'ask' | false;

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
 * v2.14.2 (FR-PHONE-17, V214-40..V214-42; D-1143): on `compact`, unless the question was answered this visit
 * (`FOLLOW_ASKED_KEY`), the page asks first — where a request exists at mount, where none exists at that first
 * reading with a north (and only with no `followGranted` saved: an Android allow carries to the next visit). The
 * compact page is never armed: the question's `[ allow ]` is the visit's tap.
 *
 * A page opened after this page session's grant (the request answered `granted` already, iOS answering a second
 * request from memory) starts on, with nothing to ask.
 *
 * `turnOn` asks inside the handler, before any await (`requestOrientationAccess`, D-175, D-240): granted, `on`, and
 * the grant is saved (`followGranted: true`, on every platform since D-1143); refused or throwing, `refused` and the
 * saved grant cleared — a refusal never writes `true`. Either way it disarms: one request per visit from the first touch.
 * A grant that answers after the reader turned following off, or took the sky back with a drag, saves the grant and
 * leaves following off: the reader's last word stands.
 */
export function useFollow(compact = false): Follow {
  const [sensor] = useState(() => typeof window !== 'undefined' && orientationApiPresent());
  const [start] = useState((): { on: boolean; armed: boolean; waiting: Waiting; asking: boolean } => {
    if (!sensor) return { on: false, armed: false, waiting: false, asking: false };
    const granted = appStore.getState().followGranted;
    const ask = compact && !askedThisVisit();
    if (permissionRequest() === null) {
      // On compact an Android page follows by default only after a saved allow; else it asks, or after `not now` waits for a press.
      const waiting: Waiting = (granted || !compact) && FOLLOW_DEFAULT ? 'follow' : ask && !granted ? 'ask' : false;
      return { on: false, armed: false, waiting, asking: false };
    }
    if (granted && orientationAnswer() === 'granted') return { on: true, armed: false, waiting: false, asking: false };
    if (compact) return { on: false, armed: false, waiting: false, asking: ask };
    return { on: false, armed: granted, waiting: false, asking: false };
  });
  const [on, setOn] = useState(start.on);
  const [armed, setArmed] = useState(start.armed);
  const [asking, setAsking] = useState(start.asking);
  // FR-PHONE-1 (D-986): following by default starts at the first reading with a north; any press or drag first wins.
  const [waiting, setWaiting] = useState<Waiting>(start.waiting);
  useEffect(() => {
    if (!waiting) return;
    const name = orientationEventName();
    const onReading = (event: Event): void => {
      const reading = event as Event & { alpha?: number | null; absolute?: boolean; webkitCompassHeading?: number | null };
      if (deviceHeading({ alpha: reading.alpha ?? null, absolute: reading.absolute === true, webkitCompassHeading: reading.webkitCompassHeading ?? null }) === null) return;
      setWaiting(false);
      // FR-PHONE-17: a question answered on another page of this visit meanwhile is not asked again.
      if (waiting === 'ask') setAsking(!askedThisVisit());
      else setOn(true);
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
    setAsking(false);
    const press = (said.current += 1);
    // Inside the gesture, before any await: the request is the press's (D-175).
    void requestOrientationAccess().then((answer) => {
      if (answer === 'granted') {
        if (said.current === press) setOn(true);
        if (!appStore.getState().followGranted) setFollowGranted(true);
        return;
      }
      setRefused(true);
      if (appStore.getState().followGranted) setFollowGranted(false);
    });
  }, [setFollowGranted]);
  const turnOff = useCallback(() => {
    said.current += 1;
    setWaiting(false);
    setAsking(false);
    setRefused(false);
    setOn(false);
  }, []);
  const allow = useCallback(() => {
    markAsked();
    turnOn();
  }, [turnOn]);
  const notNow = useCallback(() => {
    markAsked();
    said.current += 1;
    setAsking(false);
    setWaiting(false);
  }, []);
  const onFollowEnd = useCallback(() => {
    said.current += 1;
    setWaiting(false);
    setOn(false);
  }, []);

  // D-1144: the question is compact's; a page that crosses to wide stops showing it, unanswered.
  const shownAsking = asking && compact;
  return useMemo(
    () => ({ sensor, on, armed, refused, asking: shownAsking, turnOn, turnOff, allow, notNow, onFollowEnd, firstTouch: armed && !shownAsking ? turnOn : undefined }),
    [sensor, on, armed, refused, shownAsking, turnOn, turnOff, allow, notNow, onFollowEnd],
  );
}
