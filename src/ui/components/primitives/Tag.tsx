import type { ComponentProps, ReactNode } from 'react';
import styles from './Tag.module.css';

/**
 * R209 (FR-CTRL-14; D-1228): the tag — a label that cannot be pressed, its word in brackets in its tone. Brackets
 * in the app mean this and nothing else. A tag that explains itself on hover and focus takes the host's `tabIndex`
 * and `aria-describedby`; it takes no press and no role. R221 (D-1292): a word is one text node with its
 * brackets, as the eye reads it, so a reader of the DOM (the cells counter) finds no gap inside it.
 */
type TagTone = 'dim' | 'accent' | 'ok' | 'warn' | 'danger';

export interface TagOwnProps {
  /** The ink of the word and its brackets. */
  tone: TagTone;
  /** The word. */
  children: ReactNode;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type TagProps = TagOwnProps & Omit<ComponentProps<'span'>, keyof TagOwnProps | 'onClick' | 'role' | 'style'>;

export function Tag({ tone, children, className, ...rest }: TagProps) {
  return (
    <span className={[styles.tag, styles[tone], className].filter(Boolean).join(' ')} {...rest}>
      {typeof children === 'string' ? `[${children}]` : <>[{children}]</>}
    </span>
  );
}
