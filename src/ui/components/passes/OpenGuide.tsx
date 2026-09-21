import { useId } from 'react';
import { useT } from '../../../i18n/useT';
import styles from './OpenGuide.module.css';

/**
 * FR-DESK-3, FR-FIRST-10 as amended v2.1 (R84, D-548): the accessible control
 * that opens a pass, "Open guide → <name>". It draws nothing of its own; its
 * `::after` stretches over the nearest positioned ancestor — a `PassCard`, and
 * the phone's first card (`NextEventBlock`'s card form, FR-FIRST-3) — so the
 * whole box is one pointer target and one tab stop. The host puts it last, so
 * the stretched box lies over everything before it, and wears the focus ring
 * itself (`:has(button:focus-visible)`).
 */
export function OpenGuide({ passId, nameId, onOpen }: { passId: string; nameId: string; onOpen: (passId: string) => void }) {
  const t = useT();
  const openId = useId();
  return (
    <button
      type="button"
      id={openId}
      className={styles.open}
      aria-labelledby={`${openId} ${nameId}`}
      onClick={() => {
        onOpen(passId);
      }}
    >
      <span className="sr-only">{t.passes.openGuide}</span>
    </button>
  );
}
