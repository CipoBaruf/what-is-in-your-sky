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
 *
 * D-119: the head and the body are two rows rather than one stack, because
 * the panel is bounded by the column's height — the body scrolls and the
 * name and the close control stay where they are.
 *
 * R50 (FR-DESK-3 as amended, F-6, D-253): below `WIDE_SPLIT_MIN_CELLS` the
 * panel has the right column to itself, because the split there left the
 * guide a column too narrow to read a chart in. `[ list ]` is what the reader
 * gets back to the list with while it does — the compact sheet's `← Back`
 * without the closing, since the pass stays selected and in the hash. Which
 * of the two is on the page is the stylesheet's business (`App.module.css`),
 * so this control is always rendered and hidden above that width.
 */
export interface GuidePanelProps {
  passId: string;
  name: string;
  headingId: string;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
  /** R50 (F-6): show the list instead of this panel, below `WIDE_SPLIT_MIN_CELLS` where only one of them is on the page. */
  onShowList: () => void;
  children: ReactNode;
}

export function GuidePanel({ passId, name, headingId, headingRef, onClose, onShowList, children }: GuidePanelProps) {
  const t = useT();
  return (
    <section className={styles.panel} aria-label={t.guide.panelLabel({ name })} data-pass-id={passId} data-guide-panel="" data-testid="guide-panel">
      <div className={styles.head}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {name}
        </h2>
        <div className={styles.controls}>
          {/* Hidden by the stylesheet from the width at which the list is beside the panel anyway (F-6). */}
          <button type="button" className={styles.toList} onClick={onShowList} data-testid="guide-to-list">
            {t.guide.toList}
          </button>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.guide.close}>
            ×
          </button>
        </div>
      </div>
      <div className={styles.body} data-testid="guide-body">
        {children}
      </div>
    </section>
  );
}
