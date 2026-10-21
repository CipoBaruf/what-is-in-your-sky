import type { ComponentProps, ReactNode } from 'react';
import styles from './Cluster.module.css';

/**
 * R107 (FR-DS-4 item 8; D-703, D-725): the cluster — a row of controls that
 * wraps when the width runs out, its items a cell count apart and on one
 * baseline, where a module used to write `display: flex`, `flex-wrap: wrap`
 * and `gap: 0 calc(2 * var(--cell))` itself. Horizontal space is in cells
 * (FR-DS-1), so `gap` is a count: one cell (a row of options), two (the
 * share row, the panel's pair), three (the header's links). There is no
 * vertical gap: a wrapped row's lines sit on the grid as a paragraph's do.
 * `as` is the element where the row is a paragraph; every other attribute
 * (`role`, `aria-*`, a `data-*`) passes through, and a `hidden` cluster is
 * off the page. The host places it (D-704) and the controls are the host's.
 * A primitive is a leaf: no copy, no store, only props (D-703).
 */
export interface ClusterOwnProps {
  /** The space between the controls, in cells: `1`, `2` (the default) or `3`. */
  gap?: 1 | 2 | 3;
  /** How the controls line up across the row: on their baseline (the default, a row of text controls) or centred (a row that mixes boxes and text). */
  align?: 'baseline' | 'center';
  /** The element: a `div` (the default) or, where the row is a sentence with its control, a `p`. */
  as?: 'div' | 'p';
  /** The controls, in order. */
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type ClusterProps = ClusterOwnProps & Omit<ComponentProps<'div'>, keyof ClusterOwnProps | 'style'>;

export function Cluster({ gap = 2, align = 'baseline', as: Element = 'div', children, className, ...rest }: ClusterProps) {
  const classes = [styles.cluster, styles[`gap${String(gap)}`], align === 'center' ? styles.center : undefined, className].filter(Boolean).join(' ');
  return (
    <Element className={classes} {...rest}>
      {children}
    </Element>
  );
}
