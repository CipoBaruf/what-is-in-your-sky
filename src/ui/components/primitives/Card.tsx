import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import styles from './Card.module.css';

/**
 * R105 (FR-DS-4 item 4; D-703, D-719): the card — a box ruled in `--rule`
 * with `--space-2` inside, the one thing board 1B draws a pass, the next event
 * and nothing else in. `selected` is the card the guide is open on (FR-DESK-3):
 * ruled in the accent on the raised ground and `aria-current`, so the state is
 * told to anyone who is not looking at it. `frame="accent"` is the phone's
 * first card (FR-FIRST-4): ruled in the accent without being the selected one.
 *
 * `as` is the element: an `article` (a pass), a `section` (the next event,
 * named by its `aria-label`), or the card as one control — a `button` or an
 * `a` with the sheet's control chrome taken off, so the whole box is the hit
 * area. The focus ring is `global.css`'s and never restated here: a button or
 * link card wears the one `:focus-visible` ring, and an article whose
 * stretched child button is focused (`PassCard`'s `OpenGuide`) wears it by
 * the same rule's `:where([data-card]:has(> button:focus-visible))` (D-704, D-719).
 */
export interface CardOwnProps {
  /** The element: a pass's `article`, the next event's `section`, or the card as one `button` or `a`. */
  as?: 'article' | 'section' | 'button' | 'a';
  /** The card the guide is open on: ruled in the accent on the raised ground, `aria-current` (FR-DESK-3). */
  selected?: boolean;
  /** The frame's ink: the rule (a card among cards), or the accent (the phone's first card, FR-FIRST-4). */
  frame?: 'rule' | 'accent';
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type CardProps = CardOwnProps & Omit<ComponentPropsWithoutRef<'article'>, keyof CardOwnProps | 'style'> & { href?: string };

export function Card({ as = 'article', selected = false, frame = 'rule', children, className, href, ...rest }: CardProps) {
  const control = as === 'button' || as === 'a';
  const classes = [styles.card, control ? styles.control : undefined, frame === 'accent' ? styles.accent : undefined, className].filter(Boolean).join(' ');
  const state = { 'data-card': '', ...(selected ? { 'data-selected': 'true', 'aria-current': true as const } : {}) };
  if (as === 'button') {
    return (
      <button type="button" className={classes} {...state} {...(rest as ComponentPropsWithoutRef<'button'>)}>
        {children}
      </button>
    );
  }
  if (as === 'a') {
    return (
      <a href={href} className={classes} {...state} {...(rest as ComponentPropsWithoutRef<'a'>)}>
        {children}
      </a>
    );
  }
  const Tag = as;
  return (
    <Tag className={classes} {...state} {...rest}>
      {children}
    </Tag>
  );
}
