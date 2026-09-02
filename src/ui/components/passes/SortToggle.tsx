import type { PassSort } from '../../../model';
import styles from './SortToggle.module.css';

/**
 * US-5 AC2 (R12): the list order, chronological by default or "best first"
 * (brightness × elevation, `lib/passSort.ts`). Two toggle buttons in a
 * labelled group, the pressed one marked `[x]` in text as well as colour
 * (FR-X-5); the choice is persisted by the store (`setSort`). Pure display:
 * the parent owns the value.
 */
export const SORT_LABELS: Record<PassSort, string> = { chronological: 'Soonest first', best: 'Best first' };
const ORDER: readonly PassSort[] = ['chronological', 'best'];

export interface SortToggleProps {
  value: PassSort;
  onChange: (sort: PassSort) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div role="group" aria-label="Sort passes" className={styles.group}>
      <span className={styles.label} aria-hidden="true">
        Sort:
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
          {SORT_LABELS[sort]}
        </button>
      ))}
    </div>
  );
}
