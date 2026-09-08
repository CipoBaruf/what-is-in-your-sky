import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../state';
import { requestOrientationAccess } from '../guide/skychart/window/orientationAccess';
import { deviceHeading, orientationApiPresent, orientationEventName, permissionRequest, readingFrom } from '../live/compassHeading';

/**
 * R34 (D-175) → R59 (D-276, D-301) → R66 (FR-FSC-6, FR-WIN-4, FR-FOL-2 as
 * amended v1.3.1; V13-6, D-350): the way into the sky screen.
 *
 * This was `useFollowPhone`, the `[ follow phone ]` control's state. The
 * control is gone (V13-6) and what it knew was never about a control: it is
 * what has to happen between the tap that chooses "window" from the view
 * control and the screen appearing. So the hook keeps all of it and loses the
 * toggle — `SkyChart` calls `open()` from the option's `onChange`, on the live
 * page and on the pass detail alike.
 *
 * **The tap is where the browser is asked** (FR-WIN-4, FR-FOL-2). iOS grants
 * `DeviceOrientationEvent` only from a user gesture, so the request is made
 * inside the click through `orientationAccess.ts`, whose memoised answer is
 * what lets the window arm its own listener at once when it mounts instead of
 * showing `[ point at the sky ]`.
 *
 * **One reading before the switch** (F-42's lesson). Granted is not the same
 * as followable: a phone with no compass heading answers the permission and
 * then sends readings with no north in them. So the tap arms a listener, and
 * it is the first reading that decides — a heading opens the screen and the
 * listener goes (the window takes the sensor from there); no heading is the
 * `relative` note with the page untouched, and the option is not offered again
 * this session (`windowLost`, FR-WIN-4). A device that sends nothing at all
 * leaves the page exactly as it was, which is what it did before.
 *
 * **The state is the store's** (D-350, D-352). `skyScreen`, `windowNote` and
 * `windowLost` live in the prefs slice because the window that fails is the one
 * *on the screen* and the control that has to answer for it is on the page
 * underneath; the only state here is the listener between the tap and the
 * reading, which belongs to the tap.
 */
export interface SkyScreenEntry {
  /** FR-WIN-4's presence test, less a phone this session has already found has no north. */
  available: boolean;
  /** The option's tap: ask, arm, and open on the first reading that carries a heading. */
  open: () => void;
  /** Armed — waiting for that reading. Not yet the screen. */
  armed: boolean;
}

export function useSkyScreen(): SkyScreenEntry {
  const present = useMemo(() => typeof window !== 'undefined' && orientationApiPresent(), []);
  const lost = useAppStore((s) => s.windowLost);
  const openSkyScreen = useAppStore((s) => s.openSkyScreen);
  const setWindowNote = useAppStore((s) => s.setWindowNote);
  const dropWindowView = useAppStore((s) => s.dropWindowView);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const onReading = (event: Event): void => {
      setArmed(false);
      if (deviceHeading(readingFrom(event as DeviceOrientationEvent)) === null) {
        // FR-WIN-4: no north on this phone, and none on the next tap either — the note, and the option goes for the session.
        dropWindowView('relative');
        return;
      }
      openSkyScreen();
    };
    const name = orientationEventName();
    window.addEventListener(name, onReading);
    return () => {
      window.removeEventListener(name, onReading);
    };
  }, [armed, openSkyScreen, dropWindowView]);

  const open = useCallback(() => {
    // The note belongs to the answer before this tap, not to the reading this one is waiting for.
    setWindowNote(null);
    if (permissionRequest() === null) {
      setArmed(true);
      return;
    }
    // iOS: inside the click, so the gesture carries. The answer arrives later; a refusal shows the note.
    void requestOrientationAccess().then((answer) => {
      if (answer === 'granted') setArmed(true);
      // FR-FOL-2: refused, and the option stays — the next tap asks again.
      else dropWindowView('denied');
    });
  }, [setWindowNote, dropWindowView]);

  return { available: present && !lost, open, armed };
}
