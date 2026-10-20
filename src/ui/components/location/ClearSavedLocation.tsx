import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { TextButton } from '../primitives/TextButton';
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
 *
 * R104 (D-704): the control is the same inline `TextButton` the sentence's
 * clear action is; this file's stylesheet only places the line.
 */
export function ClearSavedLocation({ short = false }: { short?: boolean } = {}) {
  const t = useT();
  const observer = useAppStore((s) => s.observer);
  const clearSavedObserver = useAppStore((s) => s.clearSavedObserver);
  if (observer === null) return null;
  // R75 (FR-SET-1): on the save row the visible label is the short one that fits FR-COMP-4's 36 cells; the
  // full sentence stays the accessible name, and the short label is its start (WCAG 2.5.3, label in name).
  return (
    <p className={styles.standaloneClear}>
      <TextButton inline label={short ? t.settings.clearSaved : t.location.clearSaved} onClick={clearSavedObserver} data-testid="clear-saved-location" {...(short ? { 'aria-label': t.location.clearSaved } : {})} />
    </p>
  );
}
