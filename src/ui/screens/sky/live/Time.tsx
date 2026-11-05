import type { ReactNode } from 'react';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098) → R187 (FR-WIDE-4, D-1100): the wide live page's `Time` row — the shared `TimeControl`
 * with the page's step row under it, as the page builds it.
 */
export function LiveTime({ children }: { children: ReactNode }) {
  return (
    <div className={styles.group} data-testid="live-time">
      {children}
    </div>
  );
}
