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
 */
export interface StackOwnProps {
  /** The space between the blocks, as a step of the space scale: `1` a quarter row (`--space-1`) up to `5` two rows (`--space-5`). */
  gap: 1 | 2 | 3 | 4 | 5;
  /** The blocks, in order. */
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale, a `min-width` (D-704). */
  className?: string | undefined;
}

export type StackProps = StackOwnProps & Omit<ComponentProps<'div'>, keyof StackOwnProps | 'style'>;

export function Stack({ gap, children, className, ...rest }: StackProps) {
  const classes = [styles.stack, styles[`gap${String(gap)}`], className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
