import { useId } from 'react';
import { useT } from '../../../i18n/useT';
import { PickRow } from '../primitives/PickRow';
import { VisuallyHidden } from '../primitives/VisuallyHidden';
import styles from './OpenGuide.module.css';

/**
 * FR-DESK-3, FR-FIRST-10 as amended v2.1 (R84, D-548): the accessible control
 * that opens a pass, "Open guide → <name>". Its box is stretched over the
 * nearest positioned ancestor — a `PassCard`, and the phone's first card
 * (`NextEventBlock`'s card form, FR-FIRST-3) — so the whole box is one pointer
 * target and one tab stop, and the host wears the focus ring
 * (`:has(> button:focus-visible)`).
 *
 * R221 (FR-CTRL-15, D-1292): the control is a `PickRow`, so the card has the row's
 * hover ground and, picked, the raised ground with the accent line at its left and
 * `aria-current` (the pass the guide is open on). The ground is opaque, so the box
 * lies under the host's content, which lets the pointer through (`OpenGuide.module.css`).
 */
export function OpenGuide({ passId, nameId, onOpen, picked = false }: { passId: string; nameId: string; onOpen: (passId: string) => void; picked?: boolean }) {
  const t = useT();
  const openId = useId();
  return (
    <PickRow
      picked={picked}
      current
      id={openId}
      className={styles.open}
      aria-labelledby={`${openId} ${nameId}`}
      onPick={() => {
        onOpen(passId);
      }}
    >
      <VisuallyHidden>{t.passes.openGuide}</VisuallyHidden>
    </PickRow>
  );
}
