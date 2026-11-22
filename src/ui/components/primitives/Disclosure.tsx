import type { ComponentProps, ReactNode } from 'react';
import styles from './Disclosure.module.css';

/**
 * R209 (FR-CTRL-16; D-1228): the disclosure — `▸ Tonight · 3`, open `▾ Tonight · 3`, the whole line the
 * control, named by its words. The host renders what it opens and may name it with `aria-controls`.
 */
export interface DisclosureOwnProps {
  /** Whether what it opens is shown; the parent owns it. */
  open: boolean;
  onToggle: () => void;
  /** The line's words. */
  label: ReactNode;
  /** How many it holds, after a middle dot. */
  count?: number | undefined;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type DisclosureProps = DisclosureOwnProps & Omit<ComponentProps<'button'>, keyof DisclosureOwnProps | 'children' | 'style' | 'type' | 'onClick' | 'aria-expanded'>;

export function Disclosure({ open, onToggle, label, count, className, ...rest }: DisclosureProps) {
  return (
    <button type="button" className={[styles.disclosure, className].filter(Boolean).join(' ')} aria-expanded={open} onClick={() => onToggle()} {...rest}>
      <span className={styles.line}>
        <span className={styles.arrow} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>{' '}
        {label}
        {count !== undefined && ` · ${String(count)}`}
      </span>
    </button>
  );
}
