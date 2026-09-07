import { useT } from '../../../i18n/useT';
import type { PassSort } from '../../../model';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import styles from './SortToggle.module.css';

/**
 * US-5 AC2 (R12): the list order, chronological by default or "best first"
 * (brightness × elevation, `lib/passSort.ts`). Two toggle buttons in a
 * labelled group, the pressed one marked `[x]` in text as well as colour
 * (FR-X-5); the choice is persisted by the store (`setSort`). Pure display:
 * the parent owns the value.
 *
 * R52 (US-5 AC2 as amended v1.1, FR-COMP-4): the two orders are named short on
 * compact — "Soonest" and "Best" — because the row has 36 cells and
 * "Sort: [x] Soonest first [ ] Best first" is 39. A label may differ between
 * the widths; the meaning may not, and it does not: the same two orders, the
 * same group name for anyone who hears it rather than reads it.
 */
const ORDER: readonly PassSort[] = ['chronological', 'best'];

export interface SortToggleProps {
  value: PassSort;
  onChange: (sort: PassSort) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  const t = useT();
  const labels = useLayoutMode() === 'compact' ? t.passes.sortShort : t.passes.sort;
  return (
    <div role="group" aria-label={t.passes.sortGroup} className={styles.group}>
      <span className={styles.label} aria-hidden="true">
        {t.passes.sortPrefix}
      </span>
      {ORDER.map((sort) => (
        <button
          key={sort}
          type="button"
          aria-pressed={value === sort}
          className={styles.option}
          onClick={() => {
            if (sort !== value) onChange(sort);
          }}
        >
          {labels[sort]}
        </button>
      ))}
    </div>
  );
}
