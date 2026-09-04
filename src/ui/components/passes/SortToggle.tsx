import { useT } from '../../../i18n/useT';
import type { PassSort } from '../../../model';
import styles from './SortToggle.module.css';

/**
 * US-5 AC2 (R12): the list order, chronological by default or "best first"
 * (brightness × elevation, `lib/passSort.ts`). Two toggle buttons in a
 * labelled group, the pressed one marked `[x]` in text as well as colour
 * (FR-X-5); the choice is persisted by the store (`setSort`). Pure display:
 * the parent owns the value.
 */
const ORDER: readonly PassSort[] = ['chronological', 'best'];

export interface SortToggleProps {
  value: PassSort;
  onChange: (sort: PassSort) => void;
}

export function SortToggle({ value, onChange }: SortToggleProps) {
  const t = useT();
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
          {t.passes.sort[sort]}
        </button>
      ))}
    </div>
  );
}
