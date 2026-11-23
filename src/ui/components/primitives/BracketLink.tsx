import type { ComponentProps, ReactNode } from 'react';
import styles from './BracketLink.module.css';

/**
 * R104 (FR-DS-4 item 2; D-703, D-704), R206 (FR-CTRL-11): a link in a row — the
 * header's live and settings, the next event's live link. The accent, the
 * underline and the 48 px tap box are global.css's `a` rule. `current` is the
 * header's own page (FR-COMP-1): a `<span aria-current="page">` in the dim
 * ink, so the row's other control does not move between the two screens.
 */
export interface BracketLinkOwnProps {
  href: string;
  /** The link's words. */
  label: ReactNode;
  /** The page this control stands on: drawn as a dim `aria-current` span, not a link. */
  current?: boolean;
  /** R215 (FR-CTRL-5, V30-16): a header tab — the words in `--fg-dim`, `--fg` on hover; `current`, `--fg` over a 2 px `--accent` rule 6 px under the words. */
  tab?: boolean;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type BracketLinkProps = BracketLinkOwnProps & Omit<ComponentProps<'a'>, keyof BracketLinkOwnProps | 'children' | 'style'>;

export function BracketLink({ href, label, current = false, tab = false, className, ...rest }: BracketLinkProps) {
  const classes = [styles.bracketLink, tab ? styles.tab : undefined, current ? styles.current : undefined, className].filter(Boolean).join(' ');
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
