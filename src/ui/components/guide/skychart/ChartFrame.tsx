import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useLayoutMode } from '../../../hooks/useLayoutMode';
import styles from './ChartFrame.module.css';

/**
 * R15 review: one frame for every sky chart view, so switching between the
 * dome and the polar chart moves nothing else on the sheet. Fixed slots: a
 * controls row (the polar view's orientation toggle, the dome's "drag to
 * look around" hint) at least one tap target tall, the drawing box, a status
 * line (the polar convention, the dome's facing readout) two text rows tall
 * and, since R45, the legend's slot. The view owns what goes in each slot;
 * the frame owns the geometry.
 *
 * R45 (FR-COMP-5, FR-LEG-2, D-187): the frame owns the *box*. On compact the
 * drawing breaks out of the page's side padding with negative margins and is
 * a square; in fill mode (the live page) it takes the height it is given and,
 * in portrait, is never shorter than it is wide — the floor is the frame's
 * own measured width, written by a `ResizeObserver` into a custom property
 * rather than computed in CSS. The legend sits under the drawing on compact
 * and in a 24-cell column at its right on wide where the frame has the room
 * for both (a container query on the frame's own width, D-232; the 40-cell
 * guide column has not, and keeps it under); which shell is in force is the
 * same `useLayoutMode` answer the pages use (D-72), set on the frame as a
 * data attribute so the stylesheet needs no second breakpoint.
 */
export interface ChartFrameProps {
  controls?: ReactNode;
  status?: ReactNode;
  /** FR-LEG-2: the legend `SkyChart` rendered; the frame places it. */
  legend?: ReactNode;
  /**
   * FR-LIVE-7 as amended (v1.2, D-312): what the page hangs under the legend
   * in that same column — the wide live page's rail. With one, the column is
   * the page's side column and not a legend's width: it is sized from the
   * frame, the legend scrolls inside what the rail leaves it, and the rail
   * itself keeps its height.
   */
  aside?: ReactNode;
  /**
   * FR-LIVE-7 and FR-TRAJ-4 as amended (v1.2.1, D-315): the stripe block in a
   * row of its own under the drawing, the drawing's width — the wide live page
   * from step 2 of the ladder. Absent, the frame has no such row.
   */
  stripe?: ReactNode;
  /**
   * FR-LIVE-7 as amended (v1.2.1, D-314): the drawing box's fixed size from the
   * dome's ladder, CSS px. It reaches the stylesheet as two custom properties
   * on the frame — px literals may not be written in a wide-layout block
   * (`tests/styles/breakpoint.test.ts`), and the numbers are `lib/layout.ts`'s.
   * Absent, the box is fluid.
   */
  box?: { widthPx: number; heightPx: number };
  className?: string;
  /** FR-LIVE-1 (R32): the drawing takes the frame's whole height instead of a capped square; the frame takes its parent's. */
  fill?: boolean;
  children: ReactNode;
}

export function ChartFrame({ controls, status, legend, aside, stripe, box, className, fill = false, children }: ChartFrameProps) {
  const boxStyle = box ? ({ '--chart-box-w': `${String(box.widthPx)}px`, '--chart-box-h': `${String(box.heightPx)}px` } as CSSProperties) : undefined;
  const compact = useLayoutMode() === 'compact';
  const frameRef = useRef<HTMLDivElement>(null);

  // FR-COMP-5 / D-187: the live floor. The drawing's minimum height is the frame's width, measured, so a
  // portrait phone never gets a dome shorter than it is wide whatever the rows around it take.
  useEffect(() => {
    const frame = frameRef.current;
    if (!fill || !compact || !frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      frame.style.setProperty('--chart-floor', `${String(Math.round(width))}px`);
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
      frame.style.removeProperty('--chart-floor');
    };
  }, [fill, compact]);

  // The shell is the size container the frame's "beside" rule queries (D-232): a container query
  // answers for descendants, never for the container itself, so the frame needs a parent to ask.
  return (
    <div className={[styles.shell, fill ? styles.shellFill : undefined].filter(Boolean).join(' ')}>
      <div
        className={[styles.frame, fill ? styles.fill : undefined, className].filter(Boolean).join(' ')}
        ref={frameRef}
        data-testid="chart-frame"
        data-fill={fill}
        data-compact={compact}
        data-legend={legend !== undefined && legend !== null}
        data-aside={aside !== undefined && aside !== null}
        data-stripe={stripe !== undefined && stripe !== null}
        data-box={box !== undefined}
        style={boxStyle}
      >
        <div className={styles.controls}>{controls}</div>
        <div className={styles.drawing} data-testid="chart-box">
          {children}
        </div>
        <div className={styles.status}>{status}</div>
        {stripe !== undefined && stripe !== null && (
          <div className={styles.stripe} data-testid="chart-stripe">
            {stripe}
          </div>
        )}
        {legend !== undefined && legend !== null && (
          <div className={styles.legend} data-testid="chart-legend-slot">
            {aside === undefined || aside === null ? (
              legend
            ) : (
              <>
                <div className={styles.legendScroll} data-testid="chart-legend-scroll">
                  {legend}
                </div>
                <div className={styles.aside} data-testid="chart-aside">
                  {aside}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
