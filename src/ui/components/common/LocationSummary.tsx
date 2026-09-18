import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { coordsLabel } from '../location/CoordsInput';
import { accuracyText } from '../location/UseMyLocation';
import styles from './LocationSummary.module.css';

/**
 * R52 (FR-COMP-3, US-20 AC3), R76 (FR-FIRST-4, FR-SET-3): the location reading
 * once there is a place. One line — "Using <label> · [ change ]" — whose
 * `[ change ]` opens the home page's input group (FR-FIRST-2) in place, under
 * the line, and closes it again (`aria-expanded`, `aria-controls`); it never
 * sends the reader to `#settings`, which is no longer where a place is set
 * (V20-5). With no observer there is no line: the cold open is what the Where
 * reading shows then (FR-FIRST-1).
 *
 * The group itself is the Where reading's (`screens/Home.tsx`), not this line's:
 * it is one mounted instance across the cold open and the line, so a reader
 * typing a place in it keeps the field they are typing in when the place
 * arrives.
 *
 * The label is the place's own when it has one (a geocoded name, a saved
 * place's) and the rounded coordinates otherwise. A long name is clipped rather
 * than wrapped: the row has 36 cells (FR-COMP-4) and a place name has no length
 * the app can promise, so the one part of the line that can be shortened is,
 * and the `[ change ]` control it would otherwise push onto a second line stays
 * put. The device's accuracy (US-3 AC3) goes on a second, dim line.
 */
export interface LocationSummaryProps {
  /** Whether the input group under the line is open. */
  open: boolean;
  onToggle: () => void;
  /** The id of the group `[ change ]` opens. */
  controls: string;
}

export function LocationSummary({ open, onToggle, controls }: LocationSummaryProps) {
  const t = useT();
  const observer = useAppStore((s) => s.observer);

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
        <button type="button" className={`inline-control ${styles.change}`} aria-expanded={open} aria-controls={controls} data-testid="location-summary-change" onClick={onToggle}>
          {t.location.summaryChange}
        </button>
      </p>
      {accuracy !== null && (
        <p className={styles.accuracy} data-testid="location-summary-accuracy">
          {t.location.summaryAccuracy(accuracy)}
        </p>
      )}
    </>
  );
}
