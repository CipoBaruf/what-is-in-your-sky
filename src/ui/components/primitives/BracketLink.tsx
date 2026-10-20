import type { ComponentProps, ReactNode } from 'react';
import styles from './BracketLink.module.css';

/**
 * R104 (FR-DS-4 item 2; D-703, D-704): `[ label ]` on an `<a>` — the header's
 * `[ live ]` and `[ settings ]`, `[ Live sky ]`, the next event's live link.
 * The accent and the 48 px tap box are global.css's `a` rule; this module
 * drops the underline a prose link gets and adds the brackets. `current` is
 * the header's own page (FR-COMP-1): a `<span aria-current="page">` with the
 * same box in the dim ink, so the row's other control does not move between
 * the two screens.
 */
export interface BracketLinkOwnProps {
  href: string;
  /** The words between the brackets. */
  label: ReactNode;
  /** The page this control stands on: drawn as a dim `aria-current` span, not a link. */
  current?: boolean;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string;
}

export type BracketLinkProps = BracketLinkOwnProps & Omit<ComponentProps<'a'>, keyof BracketLinkOwnProps | 'children' | 'style'>;

export function BracketLink({ href, label, current = false, className, ...rest }: BracketLinkProps) {
  const classes = [styles.bracketLink, current ? styles.current : undefined, className].filter(Boolean).join(' ');
  if (current) {
    return (
      <span className={classes} aria-current="page" {...(rest as Omit<ComponentProps<'span'>, 'children'>)}>
        {label}
      </span>
    );
  }
  return (
    <a href={href} className={classes} {...rest}>
      {label}
    </a>
  );
}
