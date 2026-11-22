import type { ComponentProps, ReactNode } from 'react';
import styles from './PickRow.module.css';

/**
 * R209 (FR-CTRL-15; D-1228, D-1258): a row or card that opens or picks something — no frame, the raised ground
 * under the pointer, the picked one with the mark down its left edge. A link tells the picked one by
 * `aria-current`; a button by `aria-pressed`, or by `aria-current` where the row is the one being shown (`current`).
 * An `<a>` has no `disabled`, so a disabled link is one without its `href` (FR-CTRL-17): no focus, no press, nowhere to go.
 */
export interface PickRowOwnProps {
  /** Whether this is the picked one; the parent owns it. */
  picked: boolean;
  /** What a press means. */
  onPick?: (() => void) | undefined;
  /** Where the row goes: it is a link, not a button. */
  href?: string | undefined;
  /** The picked one is the one shown of its set (`aria-current`), not a button that is down (`aria-pressed`). */
  current?: boolean;
  /** What the row holds, its items a cell apart; their inks are their own. */
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type PickRowProps = PickRowOwnProps & Omit<ComponentProps<'button'>, keyof PickRowOwnProps | 'style' | 'type' | 'onClick'>;

export function PickRow({ picked, onPick, href, current = false, children, className, ...rest }: PickRowProps) {
  const classes = [styles.row, picked ? styles.picked : undefined, className].filter(Boolean).join(' ');
  const currency = picked ? { 'aria-current': true as const } : {};
  if (href !== undefined) {
    const { disabled = false, ...linkRest } = rest;
    // The role is said because an `<a>` without an `href` has none; a caller's `tabIndex` would hand the focus back.
    const target = disabled ? { role: 'link', 'aria-disabled': true, tabIndex: undefined } : { href, onClick: () => onPick?.() };
    return (
      <a className={classes} {...currency} {...(linkRest as Omit<ComponentProps<'a'>, 'children'>)} {...target}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...(current ? currency : { 'aria-pressed': picked })} onClick={() => onPick?.()} {...rest}>
      {children}
    </button>
  );
}
