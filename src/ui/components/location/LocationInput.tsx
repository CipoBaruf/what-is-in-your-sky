import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { SectionHeading } from '../common/SectionHeading';
import { CoordsInput, coordsLabel } from './CoordsInput';
import { Favourites } from './Favourites';
import styles from './LocationInput.module.css';
import { PlacePicker, type PlaceSearchFn } from './PlacePicker';
import { accuracyText, UseMyLocation, type GeolocationEnv } from './UseMyLocation';

/**
 * The location section (PLAN §4): place picker (R9), coordinates and
 * altitude (US-2), the device button (US-3), a line naming the active
 * observer as rounded coordinates (FR-LOC-4 MVP behaviour; for a geocoded
 * one the picker's own "Using the centre of" line already does this), the
 * "clear saved location" action (US-8 AC2) and the city-level precision note
 * (FR-LOC-6). The inputs are pre-filled from the observer present at mount
 * (the restored one) and remounted empty when the saved location is cleared;
 * focus then moves to the place field, since the button it was on is gone.
 * R12: the section is titled by a character-rule heading (FR-X-6).
 * R28: the saved places (FR-OFF-7) close the section — they are how the
 * location is chosen once there are some, so they belong with the inputs that
 * choose it. They read the store themselves rather than arriving as props: the
 * observer is only half of what they need and every operation is the store's
 * (D-139), so a prop for each would be four to pass through this component
 * untouched.
 *
 * R49 (F-29): an observer that arrives from outside these inputs — picking a
 * saved place is the only way there is — reseeds them, exactly as the restored
 * one seeds them at mount. Without that the coordinate field still holds the
 * place before last, and the next keystroke in the altitude field re-emits it
 * (or, on an empty field, emits nothing at all and drops the observer): the
 * fields are what a later edit is relative to, so they have to be what is
 * active. What is *not* a reseed is the observer this component's own inputs
 * emitted coming back through the store, or the same place with the zone the
 * forecast fills in later (D-3) — either would remount the field under the
 * hands of whoever is typing in it.
 */
export const COORDS_INPUT_ID = 'coords';
export const PLACE_INPUT_ID = 'place';

/** Same place: the fields' worth of an observer, ignoring the zone (`state/slices/location.ts` compares the same five for the same reason). */
function sameObserver(a: Observer | null, b: Observer | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.lat === b.lat && a.lon === b.lon && a.altM === b.altM && a.source === b.source && a.label === b.label;
}

export interface LocationInputProps {
  observer: Observer | null;
  onObserver: (observer: Observer | null) => void;
  /** Forgets the saved location and drops the active observer (`clearSavedObserver`). */
  onClear: () => void;
  search: PlaceSearchFn;
  geolocation?: GeolocationEnv;
}

export function LocationInput({ observer, onObserver, onClear, search, geolocation }: LocationInputProps) {
  const t = useT();
  // The observer the inputs were seeded from; a new key remounts them. `focus`
  // is set only by the clear, the one reseed that moves the reader's focus.
  const [seed, setSeed] = useState(() => ({ key: 0, observer, focus: false }));
  // The observer the inputs are already showing: whatever they last emitted, or
  // what they were last seeded from. Anything else is a change from outside.
  const shown = useRef(observer);
  const headingId = useId();

  const emit = (next: Observer | null): void => {
    shown.current = next;
    onObserver(next);
  };

  const clear = (): void => {
    shown.current = null;
    onClear();
    setSeed((s) => ({ key: s.key + 1, observer: null, focus: true }));
  };

  // F-29: a saved place picked below reseeds the fields above.
  useEffect(() => {
    if (sameObserver(observer, shown.current)) return;
    shown.current = observer;
    setSeed((s) => ({ key: s.key + 1, observer, focus: false }));
  }, [observer]);

  // After a clear the inputs are remounted, so the focus goes to the new place
  // field once it exists. Picking a place moves nothing: the reader is looking
  // at the list they picked from.
  useEffect(() => {
    if (seed.focus) document.getElementById(PLACE_INPUT_ID)?.focus();
  }, [seed]);

  const accuracy = observer?.source === 'device' ? accuracyText(observer.accuracyM, t) : null;

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeading id={headingId}>{t.location.heading}</SectionHeading>
      <PlacePicker key={`place-${String(seed.key)}`} search={search} onObserver={emit} observer={observer} coordsInputId={COORDS_INPUT_ID} inputId={PLACE_INPUT_ID} {...(seed.observer?.source === 'geocode' ? { initialText: seed.observer.label } : {})} />
      <CoordsInput key={`coords-${String(seed.key)}`} id={COORDS_INPUT_ID} onObserver={emit} {...(seed.observer?.source === 'coords' ? { initial: { lat: seed.observer.lat, lon: seed.observer.lon, altM: seed.observer.altM } } : {})} />
      <UseMyLocation onObserver={emit} {...(geolocation ? { env: geolocation } : {})} />
      {observer && observer.source !== 'geocode' && (
        <p className={styles.active} data-testid="active-location">
          {t.location.active({
            coords: coordsLabel(observer.lat, observer.lon),
            fromDevice: observer.source === 'device',
            altitude: observer.altM === 0 ? null : String(Math.round(observer.altM)),
            accuracy,
          })}
        </p>
      )}
      {observer && (
        <p className={styles.saved}>
          {t.location.savedHere}{' '}
          <button type="button" onClick={clear} className={`inline-control ${styles.clear}`}>
            {t.location.clearSaved}
          </button>
        </p>
      )}
      <p className={styles.note}>{t.location.precisionNote}</p>
      {/* R28 (FR-OFF-7, US-17): the saved places, below the inputs and the notes about them. */}
      <Favourites />
    </section>
  );
}
