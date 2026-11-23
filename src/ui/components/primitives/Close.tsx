import { useContext, type ComponentProps } from 'react';
import { CloseNameContext } from './closeName';
import styles from './Close.module.css';

/**
 * R209 (FR-CTRL-12; D-1228, D-1257): the one close — a bare `×` in the dim ink with a `--target` hit area, named
 * by the active language's "Close". The host places it at the top-right corner of what it closes. R218 (FR-CTRL-8):
 * `danger` is the saved place's remove, whose `×` turns `--danger` under the pointer.
 */
export interface CloseOwnProps {
  onClose: () => void;
  /** The name, where "Close" alone does not say what closes; left out, the active language's word (`closeName.ts`). */
  label?: string | undefined;
  /** A removal rather than a close (a saved place's `×`, FR-CTRL-8): the glyph in `--danger` on hover. */
  danger?: boolean;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type CloseProps = CloseOwnProps & Omit<ComponentProps<'button'>, keyof CloseOwnProps | 'children' | 'style' | 'type' | 'onClick' | 'aria-label'>;

export function Close({ onClose, label, danger = false, className, ...rest }: CloseProps) {
  const word = useContext(CloseNameContext);
  return (
    <button type="button" className={[styles.close, danger ? styles.danger : undefined, className].filter(Boolean).join(' ')} aria-label={label ?? word} onClick={() => onClose()} {...rest}>
      <span className={styles.glyph}>×</span>
    </button>
  );
}
