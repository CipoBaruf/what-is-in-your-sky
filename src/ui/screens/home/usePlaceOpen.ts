import { useState } from 'react';
import type { ExampleOutcome } from '../../../lib/exampleOutcome';
import type { Observer } from '../../../model';
import { useActiveObserver, useAppStore } from '../../../state';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { useOwnObserver } from '../../hooks/useOwnObserver';
import { placeRequested } from './placeRequest';

/** What moves the question on: a different place, not a new object for the same one (the forecast's zone replaces it, and D-1025's town name a device fix's label). */
const placeKey = (observer: Observer | null): string | null => (observer === null ? null : `${String(observer.lat)},${String(observer.lon)},${String(observer.altM)},${observer.source === 'device' ? 'device' : observer.label}`);

/** Whether a text field has the focus: a coordinate pair that parsed under the reader's fingers (D-467). */
function typingInAField(): boolean {
  return typeof document !== 'undefined' && document.activeElement instanceof HTMLInputElement;
}

/** D-1178: the outcomes that draw the example; every other one draws the place question (FR-OPEN-6). */
const SHOWN: readonly ExampleOutcome[] = ['pending', 'pass'];

/**
 * R202 (FR-OPEN-3..6; D-1178, in place of R82's `useSteps`; D-1198): the first visit as the page's own state — not
 * stored, not in the hash. A first visit is a load with no saved and no visited place (`useOwnObserver`); in it the example
 * is drawn while its outcome is `pending` or `pass`, and the place question for every other outcome (`fallback`).
 * `open` is the question opened from the example's action; setting a place closes it, so the next render is the
 * stacked page or the panes.
 *
 * A typed pair is the observer at its first valid keystroke, and moving the page then would take the field from
 * under the reader (D-467), so on a phone the question's screen is `held` until the field is left, `Enter` is
 * pressed or `[ continue ]` is (`settle`).
 *
 * `asking` is the question as a screen of its own: the fallback, the compact form of `open`, a `[ set a place ]`
 * request and a held pair. The state is `App`'s, which never unmounts, so `offHome` stands in for the unmounting
 * the other routes used to do (R87): crossing it closes the question.
 *
 * Before the zone's city is known nothing is latched and there is no example yet: the page holds the example's
 * shape (`showing` with no observer) unless this load has had a place, which is a reader who dropped it.
 */
export function usePlaceOpen(offHome = false) {
  const compact = useLayoutMode() === 'compact';
  const active = useActiveObserver();
  const own = useOwnObserver();
  const outcome = useAppStore((s) => s.exampleOutcome);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const [hadPlace, setHadPlace] = useState(own !== null);
  const key = placeKey(own);
  const [seen, setSeen] = useState(key);
  const [away, setAway] = useState(offHome);
  if (own !== null && !hadPlace) setHadPlace(true);
  if (offHome !== away) {
    setAway(offHome);
    setOpen(false);
    setHeld(false);
    setSeen(key);
  } else if (key !== seen) {
    setSeen(key);
    if (own === null) setHeld(false);
    else if (own.source === 'coords' && typingInAField() && (seen === null || held)) setHeld(true);
    else {
      setHeld(false);
      setOpen(false);
    }
  }
  const first = own === null;
  const showing = first && SHOWN.includes(outcome) && (active !== null || (outcome === 'pending' && !hadPlace));
  const fallback = first && !showing;
  const requested = first && placeRequested();
  return {
    /** The example is on the page, or its shape for the moment before the city is known. */
    showing,
    /** FR-OPEN-6: a first visit with no example. */
    fallback,
    /** The question is the page's one screen (compact) or its cold open (wide fallback). */
    asking: fallback || (compact && (requested || (showing && open) || held)),
    /** FR-OPEN-5: the question is open over the example. */
    open: showing && (open || requested),
    held: compact && held,
    /** FR-OPEN-4: the example's run is not ready. */
    pending: outcome === 'pending',
    openPlace: (): void => {
      setOpen(true);
    },
    back: (): void => {
      setOpen(false);
    },
    settle: (): void => {
      setHeld(false);
      setOpen(false);
    },
  };
}

export type PlaceOpen = ReturnType<typeof usePlaceOpen>;
