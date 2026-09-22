import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useT } from '../../../i18n/useT';
import type { Observer } from '../../../model';
import { sameLocation } from '../../../state/slices/location';
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

export interface LocationInputProps {
  observer: Observer | null;
  onObserver: (observer: Observer | null) => void;
  /**
   * Rendered at the end of the saved places block. The compact settings page passes its clear action here
   * (the owner, 2026-09-09): the reader looking at the places they keep is the reader who wants to drop the
   * one that is saved. The page owns the placement, this component only offers the seam (D-262).
   */
  savedPlacesFooter?: ReactNode;
  /** Forgets the saved location and drops the active observer (`clearSavedObserver`). */
  onClear: () => void;
  search: PlaceSearchFn;
  geolocation?: GeolocationEnv;
  /**
   * R52 (FR-COMP-2): whether the clear action rides in the "saved in this
   * browser only" sentence. The wide panel says yes, which is where the
   * approved desktop mockup has it; the settings page says no and renders
   * `ClearSavedLocation` itself, last on the page, after the saved places and
   * the install offer. The sentence stays either way — it is a statement about
   * the location, not a label for the button.
   */
  showClear?: boolean;
  /**
   * R75 (FR-SET-1, D-445): how the coordinate fields and the device button are
   * laid out. The settings page puts the button on one row with a
   * `[ coordinates ]` disclosure and the fields under it; left out, the fields
   * come first and the button after them, as the wide panel always had it. The
   * fields stay this component's — their seed and their remount key are what
   * F-29 depends on — and only their placement is handed over.
   */
  arrangeInputs?: (parts: { coords: ReactNode; device: ReactNode }) => ReactNode;
  /** R75 (FR-SET-1): whether the "saved in this browser only" sentence is here. The settings page says it at its foot instead. */
  showSavedHere?: boolean;
  /** R75 (FR-SET-1): whether the saved places close this section. The settings page makes them a block of their own. */
  showFavourites?: boolean;
  /**
   * R76 (FR-FIRST-2): `group` is the home page's input group — the cold open's
   * and the one `[ change ]` opens in place. `[ Use my location ]` comes first
   * as the one primary action, then the place field and the coordinate fields
   * as its equal alternatives (under it on a narrow group, beside it on a wide
   * one), and at the foot of the group the precision note and "Saved in this
   * browser only." — with the clear action beside that sentence when there is
   * a place to clear. The group has no heading of its own: the page's heading
   * names it (`labelledBy`), or, under the location line, the word "Location".
   * `panel`, the default, is the section the settings page arranges.
   */
  variant?: 'panel' | 'group';
  /**
   * R76 (FR-FIRST-1, FR-FIRST-2, board 1B): the group's two looks. `boxed`, a
   * phone: each alternative in a ruled box, and the group's foot the line
   * "Saved in this browser only. No account, no tracking." at the foot of the
   * screen. `plain`, the wide Where pane: no boxes, and the foot the precision
   * note. The board gives each look one of the two notes, and the question's
   * own sentence on a phone already says what the precision note says.
   */
  look?: 'boxed' | 'plain';
  /** The id of the heading that names the group (`variant: 'group'`). */
  labelledBy?: string;
  /** R84 (FR-FIRST-2 as amended v2.1, D-548): drawn under the coordinate fields (`variant: 'group'`) — the where step's `[ continue ]`. */
  afterCoords?: ReactNode;
}

export function LocationInput({ observer, onObserver, onClear, search, geolocation, showClear = true, savedPlacesFooter, arrangeInputs, showSavedHere = true, showFavourites = true, variant = 'panel', labelledBy, look = 'boxed', afterCoords }: LocationInputProps) {
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

  // F-29: a saved place picked below reseeds the fields above. "Same place" is
  // the effects' own test — everything but the zone (D-3) — so the store and
  // the form cannot disagree about what counts as a change.
  useEffect(() => {
    if (sameLocation(observer, shown.current)) return;
    shown.current = observer;
    // R52: a clear is the one reseed that moves focus, wherever it came from —
    // the sentence's own button, or the settings page's `ClearSavedLocation`,
    // which is removed by the very change it makes. The place field is where
    // the reader has to go next either way.
    setSeed((s) => ({ key: s.key + 1, observer, focus: observer === null }));
  }, [observer]);

  // After a clear the inputs are remounted, so the focus goes to the new place
  // field once it exists. Picking a place moves nothing: the reader is looking
  // at the list they picked from.
  useEffect(() => {
    if (seed.focus) document.getElementById(PLACE_INPUT_ID)?.focus();
  }, [seed]);

  const accuracy = observer?.source === 'device' ? accuracyText(observer.accuracyM, t) : null;
  const fieldLook = variant === 'group' ? look : 'panel';
  const coords = <CoordsInput key={`coords-${String(seed.key)}`} id={COORDS_INPUT_ID} onObserver={emit} look={fieldLook} {...(seed.observer?.source === 'coords' ? { initial: { lat: seed.observer.lat, lon: seed.observer.lon, altM: seed.observer.altM } } : {})} />;
  const device = <UseMyLocation onObserver={emit} primary={variant === 'group'} {...(geolocation ? { env: geolocation } : {})} />;
  const place = <PlacePicker key={`place-${String(seed.key)}`} search={search} onObserver={emit} observer={observer} coordsInputId={COORDS_INPUT_ID} inputId={PLACE_INPUT_ID} look={fieldLook} {...(seed.observer?.source === 'geocode' ? { initialText: seed.observer.label } : {})} />;
  const favourites = showFavourites && <Favourites {...(savedPlacesFooter === undefined ? {} : { footer: savedPlacesFooter })} />;

  if (variant === 'group') {
    return (
      <section {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': t.location.heading })} className={`${styles.section} ${styles.group}`} data-testid="location-group" data-look={look}>
        {/* Where US-3 AC1 withholds the device button, the alternatives are the group's only child and take its whole width. */}
        <div className={styles.inputs}>
          {device}
          <div className={styles.alternatives} data-testid="location-alternatives">
            {place}
            {coords}
            {afterCoords}
          </div>
        </div>
        <div className={styles.foot} data-testid="location-foot">
          <p className={styles.note}>
            {look === 'boxed' ? t.home.savedFoot : t.location.precisionNote}
            {observer && showClear && (
              <>
                {' '}
                <button type="button" onClick={clear} className={`inline-control ${styles.clear}`} data-testid="clear-saved-location">
                  {t.location.clearSaved}
                </button>
              </>
            )}
          </p>
        </div>
        {favourites}
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeading id={headingId}>{t.location.heading}</SectionHeading>
      {place}
      {arrangeInputs ? (
        arrangeInputs({ coords, device })
      ) : (
        <>
          {coords}
          {device}
        </>
      )}
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
      {observer && (showSavedHere || showClear) && (
        <p className={styles.saved}>
          {showSavedHere && t.location.savedHere}
          {showClear && (
            <>
              {' '}
              <button type="button" onClick={clear} className={`inline-control ${styles.clear}`} data-testid="clear-saved-location">
                {t.location.clearSaved}
              </button>
            </>
          )}
        </p>
      )}
      <p className={styles.note}>{t.location.precisionNote}</p>
      {/* R28 (FR-OFF-7, US-17): the saved places, below the inputs and the notes about them. */}
      {favourites}
    </section>
  );
}
