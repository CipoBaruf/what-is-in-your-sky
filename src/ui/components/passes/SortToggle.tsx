import { useT } from '../../../i18n/useT';
import type { PassSort } from '../../../model';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { ToggleGroup } from '../primitives/ToggleGroup';

/**
 * US-5 AC2 (R12): the list order, chronological by default or "best first"
 * (brightness × elevation, `lib/passSort.ts`). Two toggle buttons in a
 * labelled group, the pressed one marked in text as well as colour (FR-X-5);
 * the choice is persisted by the store (`setSort`). Pure display: the parent
 * owns the value.
 *
 * R52 (US-5 AC2 as amended v1.1, FR-COMP-4): the two orders are named short on
 * compact — "Soonest" and "Best" — because the row has 36 cells and
 * "Sort: [x] Soonest first [ ] Best first" is 39. A label may differ between
 * the widths; the meaning may not, and it does not: the same two orders, the
 * same group name for anyone who hears it rather than reads it.
 *
 * R81 (FR-FIRST-10): on the home page's count and sort line the short names
 * at every width (`short`), and the pressed order bracketed —
 * `Sort: [ Soonest ] Best` — which is the board's way of marking it and not
 * colour alone (FR-X-5).
 *
 * R104 (FR-DS-4 item 3, D-705): the row is a `ToggleGroup` with the bracket
 * mark; this file keeps its name, its copy and its props, and its own `[x]`
 * markup and stylesheet are gone.
 */
const ORDER: readonly PassSort[] = ['chronological', 'best'];

export interface SortToggleProps {
  value: PassSort;
  onChange: (sort: PassSort) => void;
  /** The short names whatever the layout (the home page's count and sort line). */
  short?: boolean;
}

export function SortToggle({ value, onChange, short = false }: SortToggleProps) {
  const t = useT();
  const mode = useLayoutMode();
  const labels = short || mode === 'compact' ? t.passes.sortShort : t.passes.sort;
  return <ToggleGroup<PassSort> name={t.passes.sortGroup} prefix={t.passes.sortPrefix} mark="bracket" options={ORDER.map((sort) => ({ value: sort, label: labels[sort] }))} value={value} onChange={onChange} />;
}
