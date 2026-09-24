import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import styles from './FaintToggle.module.css';

/**
 * R97 (FR-FAINT-2, FR-FAINT-3): `[ show 12 faint ]` / `[ hide 12 faint ]`,
 * after the count on the list's count line and after `[<n> more tonight]` on
 * the phone's third step. The count is every faint pass still in the window
 * (`useListedPasses().faint`), the same number in both states; the choice is
 * the stored preference (`showFaint`, R98), so it holds across a reload. Not
 * drawn with nothing faint: the caller does not render it.
 */
export function FaintToggle({ count, className }: { count: number; className?: string }) {
  const t = useT();
  const shown = useAppStore((s) => s.showFaint);
  const setShowFaint = useAppStore((s) => s.setShowFaint);
  return (
    <button
      type="button"
      className={`inline-control ${styles.toggle}${className ? ` ${className}` : ''}`}
      data-testid="faint-toggle"
      onClick={() => {
        setShowFaint(!shown);
      }}
    >
      {t.passes.faintToggle({ shown, count })}
    </button>
  );
}
