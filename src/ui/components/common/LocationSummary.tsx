import { useT } from '../../../i18n/useT';
import { SETTINGS_HASH } from '../../../lib/shareLinks';
import { useAppStore } from '../../../state';
import { coordsLabel } from '../location/CoordsInput';
import { accuracyText } from '../location/UseMyLocation';
import styles from './LocationSummary.module.css';

/**
 * R52 (FR-COMP-3, US-20 AC3, D-184): what the compact home shows where the wide
 * layout shows the location form. One line — "Using <label> · [ change ]" —
 * that names the active place and opens `#settings`, which is where the form
 * now lives.
 *
 * The label is the place's own when it has one (a geocoded name, a saved
 * place's) and the rounded coordinates otherwise, which is the same rule
 * `LocationInput`'s active line follows. A long name is clipped rather than
 * wrapped: the row has 36 cells (FR-COMP-4) and a place name has no length the
 * app can promise, so the one part of the line that can be shortened is, and
 * the `[ change ]` control it would otherwise push onto a second line stays put.
 *
 * The device's accuracy (US-3 AC3) goes on a second, dim line rather than into
 * the row, for the same reason. With no observer at all the line is the prompt
 * to set one and opens the same page (FR-COMP-3's last sentence), so the first
 * visit on a phone has exactly one thing to do and it is one tap away.
 *
 * It reads the store rather than taking props: the observer is all it needs and
 * `App` has nothing to add to it.
 */
export function LocationSummary() {
  const t = useT();
  const observer = useAppStore((s) => s.observer);

  if (observer === null) {
    return (
      <p className={styles.summary} data-testid="location-summary">
        <span className={styles.label}>{t.location.summaryNone}</span>
        <span className={styles.separator} aria-hidden="true">
          ·
        </span>
        <a href={SETTINGS_HASH} className={styles.change} data-testid="location-summary-change">
          {t.location.summarySet}
        </a>
      </p>
    );
  }

  const label = observer.source === 'coords' ? coordsLabel(observer.lat, observer.lon) : observer.label;
  const accuracy = observer.source === 'device' ? accuracyText(observer.accuracyM, t) : null;

  return (
    <>
      <p className={styles.summary} data-testid="location-summary">
        <span className={styles.label}>{t.location.summary(label)}</span>
        <span className={styles.separator} aria-hidden="true">
          ·
        </span>
        <a href={SETTINGS_HASH} className={styles.change} data-testid="location-summary-change">
          {t.location.summaryChange}
        </a>
      </p>
      {accuracy !== null && (
        <p className={styles.accuracy} data-testid="location-summary-accuracy">
          {t.location.summaryAccuracy(accuracy)}
        </p>
      )}
    </>
  );
}
