import { useContext, type ComponentProps } from 'react';
import { CloseNameContext } from './closeName';
import styles from './Close.module.css';

/**
 * R209 (FR-CTRL-12; D-1228, D-1257): the one close — a bare `×` in the dim ink with a `--target` hit area, named
 * by the active language's "Close". The host places it at the top-right corner of what it closes.
 */
export interface CloseOwnProps {
  onClose: () => void;
  /** The name, where "Close" alone does not say what closes; left out, the active language's word (`closeName.ts`). */
  label?: string | undefined;
  /** Placement only — a grid area, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export type CloseProps = CloseOwnProps & Omit<ComponentProps<'button'>, keyof CloseOwnProps | 'children' | 'style' | 'type' | 'onClick' | 'aria-label'>;

export function Close({ onClose, label, className, ...rest }: CloseProps) {
  const word = useContext(CloseNameContext);
  return (
    <button type="button" className={[styles.close, className].filter(Boolean).join(' ')} aria-label={label ?? word} onClick={() => onClose()} {...rest}>
      <span className={styles.glyph}>×</span>
    </button>
  );
}
