import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import styles from './LocationInput.module.css';

/**
 * R52 (FR-COMP-2, US-20 AC2): "clear saved location" as a control of its own,
 * so the settings page can put it where FR-COMP-2 orders it — last, after the
 * saved places and the install offer — rather than inside the sentence about
 * where the location is kept.
 *
 * The wide panel keeps it in that sentence, which is where the approved desktop
 * mockup has it (FR-DESK-5) and where `LocationInput` still renders it; this is
 * the same operation with a different placement, not a second one. It reads the
 * store directly for the same reason `Favourites` does: every location
 * operation is the store's (D-139), and the observer is the only thing it needs
 * to know — there is nothing for a parent to add.
 *
 * It draws nothing with no observer: there is no saved location to clear, and a
 * dead control at the end of the page would be the reader's last impression of
 * it. The inputs above reseed themselves when the observer goes (F-29), and the
 * focus this control loses when it disappears goes to the place field with them.
 */
export function ClearSavedLocation() {
  const t = useT();
  const observer = useAppStore((s) => s.observer);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  if (observer === null) return null;
  return (
    <p className={styles.standaloneClear}>
      <button type="button" onClick={clearSavedObserver} className={`inline-control ${styles.clear}`} data-testid="clear-saved-location">
        {t.location.clearSaved}
      </button>
    </p>
  );
}
