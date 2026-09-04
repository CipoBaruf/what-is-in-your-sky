import type { ReactNode, Ref } from 'react';
import { useT } from '../../../i18n/useT';
import styles from './GuidePanel.module.css';

/**
 * R23 (FR-DESK-3, D-72): the wide shell. The compact sheet and this panel
 * render the same guide content; only the wrapper differs, and `PassDetail`
 * is what picks between them.
 *
 * It is a labelled region, not a dialog (D-118): it opens *beside* the list
 * rather than over it, the list stays scrollable and clickable behind — that
 * is the whole point of FR-DESK-3 — so calling it a dialog would tell a
 * screen-reader user the page was blocked when it is not. The label names
 * what the region is ("Guide: ISS (Zarya)"), because the article for the same
 * pass is still on screen a column to the left. Focus still moves to the
 * heading on open, and `Esc` still closes: those come from `PassDetail`,
 * which owns them for both shells.
 */
export interface GuidePanelProps {
  passId: string;
  name: string;
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
  children: ReactNode;
}

export function GuidePanel({ passId, name, headingId, headingRef, onClose, children }: GuidePanelProps) {
  const t = useT();
  return (
    <section className={styles.panel} aria-label={t.guide.panelLabel({ name })} data-pass-id={passId} data-testid="guide-panel">
      <div className={styles.head}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {name}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t.guide.close}>
          ×
        </button>
      </div>
      {children}
    </section>
  );
}
