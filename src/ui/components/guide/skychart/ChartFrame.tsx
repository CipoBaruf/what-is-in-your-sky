import type { ReactNode } from 'react';
import styles from './ChartFrame.module.css';

/**
 * R15 review: one frame for every sky chart view, so switching between the
 * dome and the polar chart moves nothing else on the sheet. Three fixed
 * slots: a controls row (the polar view's orientation toggle, the dome's
 * "drag to look around" hint) at least one tap target tall, a square drawing
 * box of the same width for both views, and a status line (the polar
 * convention, the dome's facing readout) two text rows tall. The
 * view owns what goes in each slot; the frame owns the geometry.
 */
export interface ChartFrameProps {
  controls?: ReactNode;
  status?: ReactNode;
  className?: string;
  /** FR-LIVE-1 (R32): the drawing takes the frame's whole height instead of a capped square; the frame takes its parent's. */
  fill?: boolean;
  children: ReactNode;
}

export function ChartFrame({ controls, status, className, fill = false, children }: ChartFrameProps) {
  return (
    <div className={[styles.frame, fill ? styles.fill : undefined, className].filter(Boolean).join(' ')} data-testid="chart-frame" data-fill={fill}>
      <div className={styles.controls}>{controls}</div>
      <div className={styles.drawing}>{children}</div>
      <div className={styles.status}>{status}</div>
    </div>
  );
}
