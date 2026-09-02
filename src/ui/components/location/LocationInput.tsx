import { useState } from 'react';
import type { Observer } from '../../../model';
import { CoordsInput, coordsLabel } from './CoordsInput';
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
  // The observer the inputs were seeded from; a new key remounts them.
  const [seed, setSeed] = useState(() => ({ key: 0, observer }));

  const clear = (): void => {
    onClear();
    setSeed((s) => ({ key: s.key + 1, observer: null }));
    document.getElementById(PLACE_INPUT_ID)?.focus();
  };

  const accuracy = observer?.source === 'device' ? accuracyText(observer.accuracyM) : null;
  const detail = [observer?.source === 'device' ? 'from your device' : null, observer && observer.altM !== 0 ? `at ${String(Math.round(observer.altM))} m` : null].filter((part): part is string => part !== null).join(' ');

  return (
    <section aria-label="Location" className={styles.section}>
      <PlacePicker key={`place-${String(seed.key)}`} search={search} onObserver={onObserver} observer={observer} coordsInputId={COORDS_INPUT_ID} inputId={PLACE_INPUT_ID} {...(seed.observer?.source === 'geocode' ? { initialText: seed.observer.label } : {})} />
      <CoordsInput key={`coords-${String(seed.key)}`} id={COORDS_INPUT_ID} onObserver={onObserver} {...(seed.observer?.source === 'coords' ? { initial: { lat: seed.observer.lat, lon: seed.observer.lon, altM: seed.observer.altM } } : {})} />
      <UseMyLocation onObserver={onObserver} {...(geolocation ? { env: geolocation } : {})} />
      {observer && observer.source !== 'geocode' && (
        <p className={styles.active} data-testid="active-location">
          Using {coordsLabel(observer.lat, observer.lon)}
          {detail && ` ${detail}`}
          {accuracy && ` (accurate to ${accuracy})`}.
        </p>
      )}
      {observer && (
        <p className={styles.saved}>
          Saved in this browser only.{' '}
          <button type="button" onClick={clear} className={styles.clear}>
            Clear saved location
          </button>
        </p>
      )}
      <p className={styles.note}>Precision is city-level: a pass looks the same from anywhere within a few kilometres, so no street address is resolved.</p>
    </section>
  );
}
