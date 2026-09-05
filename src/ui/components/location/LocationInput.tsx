import { useEffect, useId, useState } from 'react';
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
 */
export const COORDS_INPUT_ID = 'coords';
export const PLACE_INPUT_ID = 'place';

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
  // The observer the inputs were seeded from; a new key remounts them.
  const [seed, setSeed] = useState(() => ({ key: 0, observer }));
  const headingId = useId();

  const clear = (): void => {
    onClear();
    setSeed((s) => ({ key: s.key + 1, observer: null }));
  };

  // After a clear the inputs are remounted, so the focus goes to the new place field once it exists.
  useEffect(() => {
    if (seed.key > 0) document.getElementById(PLACE_INPUT_ID)?.focus();
  }, [seed.key]);

  const accuracy = observer?.source === 'device' ? accuracyText(observer.accuracyM, t) : null;

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeading id={headingId}>{t.location.heading}</SectionHeading>
      <PlacePicker key={`place-${String(seed.key)}`} search={search} onObserver={onObserver} observer={observer} coordsInputId={COORDS_INPUT_ID} inputId={PLACE_INPUT_ID} {...(seed.observer?.source === 'geocode' ? { initialText: seed.observer.label } : {})} />
      <CoordsInput key={`coords-${String(seed.key)}`} id={COORDS_INPUT_ID} onObserver={onObserver} {...(seed.observer?.source === 'coords' ? { initial: { lat: seed.observer.lat, lon: seed.observer.lon, altM: seed.observer.altM } } : {})} />
      <UseMyLocation onObserver={onObserver} {...(geolocation ? { env: geolocation } : {})} />
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
