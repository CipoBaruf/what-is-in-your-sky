import { useId, useState } from 'react';
import { useT } from '../../../i18n/useT';
import { searchPlaces, useAppStore } from '../../../state';
import { coordsLabel } from '../location/CoordsInput';
import { LocationInput } from '../location/LocationInput';
import { accuracyText, type GeolocationEnv } from '../location/UseMyLocation';
import styles from './LocationSummary.module.css';

/**
 * R52 (FR-COMP-3, US-20 AC3), R76 (FR-FIRST-4, FR-SET-3): the location reading
 * once there is a place. One line — "Using <label> · [ change ]" — whose
 * `[ change ]` opens the home page's input group (FR-FIRST-2) in place, under
 * the line, and closes it again; it never sends the reader to `#settings`,
 * which is no longer where a place is set (V20-5). With no observer there is
 * no line: the cold open is what the Where reading shows then (FR-FIRST-1).
 *
 * The label is the place's own when it has one (a geocoded name, a saved
 * place's) and the rounded coordinates otherwise. A long name is clipped rather
 * than wrapped: the row has 36 cells (FR-COMP-4) and a place name has no length
 * the app can promise, so the one part of the line that can be shortened is,
 * and the `[ change ]` control it would otherwise push onto a second line stays
 * put. The device's accuracy (US-3 AC3) goes on a second, dim line.
 *
 * It reads the store rather than taking props, and the group it opens writes
 * the store exactly as the settings page's form does (D-443).
 */
export interface LocationSummaryProps {
  /** The browser's geolocation, for tests; the app reads the real one. */
  geolocation?: GeolocationEnv;
  /** The saved places under the line (FR-FIRST-5's Where pane) rather than inside the group. */
  favouritesOutside?: boolean;
}

export function LocationSummary({ geolocation, favouritesOutside = false }: LocationSummaryProps = {}) {
  const t = useT();
  const observer = useAppStore((s) => s.observer);
  const setObserver = useAppStore((s) => s.setObserver);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  const [open, setOpen] = useState(false);
  const groupId = useId();

  if (observer === null) return null;

  const label = observer.source === 'coords' ? coordsLabel(observer.lat, observer.lon) : observer.label;
  const accuracy = observer.source === 'device' ? accuracyText(observer.accuracyM, t) : null;

  return (
    <>
      <p className={styles.summary} data-testid="location-summary">
        <span className={styles.label}>{t.location.summary(label)}</span>
        <span className={styles.separator} aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className={`inline-control ${styles.change}`}
          aria-expanded={open}
          aria-controls={groupId}
          data-testid="location-summary-change"
          onClick={() => {
            setOpen((o) => !o);
          }}
        >
          {t.location.summaryChange}
        </button>
      </p>
      {accuracy !== null && (
        <p className={styles.accuracy} data-testid="location-summary-accuracy">
          {t.location.summaryAccuracy(accuracy)}
        </p>
      )}
      <div id={groupId} hidden={!open} className={styles.group}>
        {open && (
          <LocationInput
            variant="group"
            observer={observer}
            onObserver={setObserver}
            onClear={clearSavedObserver}
            search={searchPlaces}
            showFavourites={!favouritesOutside}
            {...(geolocation ? { geolocation } : {})}
          />
        )}
      </div>
    </>
  );
}
