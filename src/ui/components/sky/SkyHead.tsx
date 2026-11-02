import type { ReactNode, Ref } from 'react';
import { useT } from '../../../i18n/useT';
import { TextButton } from '../primitives/TextButton';
import styles from './SkyHead.module.css';

/**
 * R147 (FR-FULL-2; D-920): the head over the compact live page's sky — one row on `--screen-overlay` at the box's
 * top-left: `[ ← ]`, the header's back control (its words, its name "Back" / "Volver", its `live-back` test id and
 * the page's Back rule of §4.37, which the page hands in as `onBack`), then `ShownTime` — the shown time at
 * `--text-heading` and its chip at `--small`. The row is as wide as its content, at most the box less `--space-3` on
 * each side, and one line in both languages: the chip is what gives, cut with an ellipsis before the row would wrap.
 *
 * The page's name, the mark and the place are not here: the page keeps its `h1` visually hidden (R148), and the
 * place is the sheet's head's (FR-FULL-4).
 *
 * R162 (FR-CLEAN-2, FR-CLEAN-9; D-996, D-1005): shared by the three sky pages from `components/sky/`, so the head
 * takes its line as a prop — the live page's `<ShownTime>`, the stars page's dark-window line, the pass detail's
 * countdown with the name as its chip — and the row cuts that line's paragraph as it cut the shown time's. `[ ← ]` is
 * still the page's Back (`onBack`): every page's Back is the history-aware rule of §4.37, not an address.
 */
export interface SkyHeadProps {
  /** The page's one line after `[ ← ]`: a paragraph that sets its own sizes, cut with an ellipsis at its end. */
  line: ReactNode;
  /** `[ ← ]`: leaves the page, by the page's Back rule. */
  onBack?: () => void;
  /** The `[ ← ]` element, for a page that places the focus on it. */
  backRef?: Ref<HTMLButtonElement>;
  /** Placement only (D-704): the overlay's top-left corner is the page's. */
  className?: string | undefined;
}

export function SkyHead({ line, onBack, backRef, className }: SkyHeadProps) {
  const t = useT();
  return (
    <div className={[styles.head, className].filter(Boolean).join(' ')} data-testid="live-head">
      <TextButton label={t.header.back} aria-label={t.header.backName} className={`${styles.back} target`} onClick={onBack} ref={backRef} data-testid="live-back" />
      <div className={styles.time}>{line}</div>
    </div>
  );
}
