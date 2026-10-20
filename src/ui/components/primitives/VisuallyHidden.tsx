import type { ComponentProps, ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

/**
 * R107 (FR-DS-4 item 8; D-703, D-704, D-725): the hidden-text block — words
 * for assistive technology that the eye does not get, in the one copy of the
 * clip rule. It was `global.css`'s `.sr-only` and, by selector, a rule in
 * `App.module.css`; both are this module's now, so a hidden block is a
 * component a host places and never a class it spells. `as` is the element
 * the words need to be — a span inside a line, a paragraph that is a live
 * region, a heading in the outline (FR-A11Y-2), a `dt`, a `label` — and every
 * other attribute passes through (`role`, `aria-*`, `htmlFor`, a `data-*`).
 * The block carries `data-visually-hidden`, which is how a test tells it
 * from what is drawn (`tests/styles/cells.ts`). A primitive is a leaf: no
 * copy, no store, only props (D-703).
 */
export interface VisuallyHiddenOwnProps {
  /** The element: a span in a line (the default), a paragraph, a heading in the outline, a `dt`, or a `label`. */
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'dt' | 'label';
  /** The words. */
  children: ReactNode;
  /** Placement only — a grid area the host's rules name (D-704). */
  className?: string | undefined;
}

export type VisuallyHiddenProps = VisuallyHiddenOwnProps & Omit<ComponentProps<'label'>, keyof VisuallyHiddenOwnProps | 'style' | 'form'>;

export function VisuallyHidden({ as: Element = 'span', children, className, ...rest }: VisuallyHiddenProps) {
  return (
    <Element className={className ? `${styles.hidden} ${className}` : styles.hidden} data-visually-hidden="" {...rest}>
      {children}
    </Element>
  );
}
