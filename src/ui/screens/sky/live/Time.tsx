import type { ReactNode } from 'react';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098): the wide live page's `Time` row — today's time control as the page builds it: the
 * overview while watching, and while scrubbing the time row with the playback controls, the stripe and the steps
 * (R78's scrub block). R187 moves the control itself into `components/sky/time/` and shares it with the other pages.
 */
export function LiveTime({ overview, scrubBlock }: { overview: ReactNode; scrubBlock: ReactNode }) {
  if ((overview === null || overview === false) && (scrubBlock === null || scrubBlock === false)) return null;
  return (
    <div className={styles.group} data-testid="live-time">
      {overview}
      {scrubBlock}
    </div>
  );
}
