import { useEffect, useRef, type ReactNode } from 'react';
import { fitBox } from '../../../../lib/layout';
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
   * FR-LIVE-7 as amended (v1.2.1, D-314): the drawing box's aspect, width over
   * height. Given, on a wide fill frame with an aside, the frame measures what
   * it leaves the drawing — its own box, its controls row, the stripe row and
   * the rail's minimum beside it — and cuts the box to the largest rectangle of
   * that shape (`lib/layout.ts` `fitBox`), written as `--chart-box-w` /
   * `--chart-box-h` on the frame: px literals may not be written in a
   * wide-layout block (`tests/styles/breakpoint.test.ts`). Absent, the box is
   * fluid.
   */
  boxAspect?: number;
  className?: string;
  /** FR-LIVE-1 (R32): the drawing takes the frame's whole height instead of a capped square; the frame takes its parent's. */
  fill?: boolean;
  children: ReactNode;
}

export function ChartFrame({ controls, status, legend, aside, stripe, boxAspect, className, fill = false, children }: ChartFrameProps) {
  const compact = useLayoutMode() === 'compact';
  const frameRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<HTMLDivElement>(null);
  const railProbeRef = useRef<HTMLSpanElement>(null);
  const hasAside = aside !== undefined && aside !== null;
  const hasStripe = stripe !== undefined && stripe !== null;
  const boxed = fill && !compact && hasAside && boxAspect !== undefined;

  /*
   * R61 (FR-LIVE-7 as amended v1.2.1, D-314, F-59): the aspect-locked box. The frame is as tall as the page's
   * dome row and the rows around the drawing are its own, so it is the one thing that knows what the drawing
   * can have: its height less the controls row and the stripe row with their gaps, its width less the rail's
   * minimum and the column gap. `fitBox` picks the larger box of the aspect that fits both, and the answer is
   * written as two custom properties the stylesheet sizes the drawing from. Measured on a `ResizeObserver` of
   * the frame — a resize, a stripe that appears, a rail that wraps — and written only when it changes, so the
   * observer never feeds itself: the frame's own size is the page's and does not follow the drawing's.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!boxed || !frame || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const gap = parseFloat(getComputedStyle(frame).rowGap) || 0;
      const columnGap = parseFloat(getComputedStyle(frame).columnGap) || 0;
      const above = controlsRef.current?.getBoundingClientRect().height ?? 0;
      const below = stripeRef.current?.getBoundingClientRect().height ?? 0;
      const rail = railProbeRef.current?.getBoundingClientRect().width ?? 0;
      const { width, height } = frame.getBoundingClientRect();
      const box = fitBox({
        frameWidthPx: width,
        frameHeightPx: height,
        aboveHeightPx: above + gap,
        belowHeightPx: below > 0 ? below + gap : 0,
        besideWidthPx: rail + columnGap,
        aspect: boxAspect,
      });
      const next = { w: `${String(box.widthPx)}px`, h: `${String(box.heightPx)}px` };
      if (frame.style.getPropertyValue('--chart-box-w') !== next.w) frame.style.setProperty('--chart-box-w', next.w);
      if (frame.style.getPropertyValue('--chart-box-h') !== next.h) frame.style.setProperty('--chart-box-h', next.h);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    // The stripe row's height is content, not the frame's size: a stripe that arrives or leaves is a remeasure too.
    if (stripeRef.current) observer.observe(stripeRef.current);
    if (controlsRef.current) observer.observe(controlsRef.current);
    measure();
    return () => {
      observer.disconnect();
      frame.style.removeProperty('--chart-box-w');
      frame.style.removeProperty('--chart-box-h');
    };
  }, [boxed, boxAspect, hasStripe]);

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
        data-aside={hasAside}
        data-stripe={hasStripe}
        data-box={boxed}
      >
        {/* D-314: the rail's minimum in px, read off this probe — `--cell` is `1ch`, which no script can turn into px by itself. */}
        {boxed && <span className={styles.railProbe} ref={railProbeRef} aria-hidden="true" />}
        <div className={styles.controls} ref={controlsRef}>
          {controls}
        </div>
        <div className={styles.drawing} data-testid="chart-box">
          {children}
        </div>
        <div className={styles.status}>{status}</div>
        {hasStripe && (
          <div className={styles.stripe} data-testid="chart-stripe" ref={stripeRef}>
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
