import type { ComponentProps, ReactNode } from 'react';
import styles from './Stack.module.css';

/**
 * R107 (FR-DS-4 item 8; D-703, D-725): the stack — a column of blocks a gap
 * from the space scale apart, where a module used to write `display: grid`
 * and `gap: var(--space-n)` itself. `gap` is the scale's step (FR-DS-1:
 * `--space-1` a quarter row, `--space-2` half, `--space-3` a row, `--space-4`
 * a row and a half, `--space-5` two rows) and the one thing the stack sets;
 * every other attribute (`id`, `hidden`, `role`, `aria-*`, a `data-*`) passes
 * through to the `div`, and a `hidden` stack is off the page. The host
 * places it (D-704) and the blocks inside it are the host's. A primitive is a
 * leaf: no copy, no store, only props (D-703).
 * R218 (FR-DS-12, FR-DS-10): `row` and `group` are the rhythm's gaps, `--gap-row` and `--gap-group`, which only a
 * primitive reads; `as="ul"` is a list whose items are the rows (the saved places), `as="section"` a labelled group.
 */
export interface StackOwnProps {
  /** The space between the blocks: a step of the space scale, `1` a quarter row (`--space-1`) up to `5` two rows (`--space-5`), or the rhythm's `row` (`--gap-row`) and `group` (`--gap-group`). */
  gap: 1 | 2 | 3 | 4 | 5 | 'row' | 'group';
  /** The element: a `div` (the default), a `ul` whose `li`s are the blocks, or a `section` (a group with its name). */
  as?: 'div' | 'ul' | 'section';
  /** The blocks, in order. */
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale, a `min-width` (D-704). */
  className?: string | undefined;
}

export type StackProps = StackOwnProps & Omit<ComponentProps<'div'>, keyof StackOwnProps | 'style' | 'ref'>;

export function Stack({ gap, as: Tag = 'div', children, className, ...rest }: StackProps) {
  const classes = [styles.stack, styles[`gap${String(gap)}`], Tag === 'ul' ? styles.list : undefined, className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
