import { useT } from '../../../i18n/useT';
import { useAppStore } from '../../../state';
import { TextButton } from '../primitives/TextButton';

/**
 * R97 (FR-FAINT-2, FR-FAINT-3): `[ show 12 faint ]` / `[ hide 12 faint ]`,
 * after the count on the list's count line and after `[<n> more tonight]` on
 * the phone's third step. The count is every faint pass still in the window
 * (`useListedPasses().faint`), the same number in both states; the choice is
 * the stored preference (`showFaint`, R98), so it holds across a reload. Not
 * drawn with nothing faint: the caller does not render it.
 *
 * R104 (D-704): an inline `TextButton`; the control has no stylesheet of its own.
 */
export function FaintToggle({ count }: { count: number }) {
  const t = useT();
  const shown = useAppStore((s) => s.showFaint);
  const setShowFaint = useAppStore((s) => s.setShowFaint);
  return (
    <TextButton
      inline
      label={t.passes.faintToggle({ shown, count })}
      data-testid="faint-toggle"
      onClick={() => {
        setShowFaint(!shown);
      }}
    />
  );
}
