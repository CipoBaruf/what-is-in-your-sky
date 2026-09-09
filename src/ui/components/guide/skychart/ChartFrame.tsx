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
   * FR-LEG-7 as amended (v1.4, V14-5, D-387): the legend is behind a control
   * — the compact live page's `[ list (n) ]`. Given `false` the slot is not
   * rendered at all, so the box has the height it leaves; given `true` it is a
   * panel of exactly `LEGEND_OPEN_ROWS` rows of `--tap` that scrolls inside
   * itself, whatever it holds, so a pass rising or ending never moves the
   * picture. Absent (every other page, and every wide one) the legend is
   * rendered whenever there is one, as it always was.
   */
  legendOpen?: boolean;
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
   * row of its own under the drawing, the drawing's width — every wide live
   * page. Absent, the frame has no such row.
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
  /**
   * FR-LIVE-7 as amended (v1.2.1, D-319): the one-column wide live page. The
   * drawing, the stripe and the legend stack, each centred at the box's width,
   * and the box is cut from the frame's whole width and the height the three
   * rows leave. Only meaningful on a wide fill frame without an aside.
   */
  stacked?: boolean;
  /**
   * FR-FSC-1, FR-FSC-3 (R62, D-322): the frame is a screen. The box is the
   * host's whole size — no aspect, no floor, no full-bleed margins, nothing
   * measured — and the rows around it become overlays over it: the `status`
   * slot in the top-left corner, the `legend` slot as a strip along the bottom
   * edge two rows high, both on `--screen-overlay`, and the `overlay` slot over
   * both. There is no controls row, no stripe row and no side column, so
   * `controls`, `stripe` and `aside` are not rendered.
   */
  screen?: boolean;
  /**
   * FR-FSC-1 (R62, D-322): the page's own children over everything — the follow
   * screen's `×`. Only placed on a `screen`; the frame does not read it.
   */
  overlay?: ReactNode;
  className?: string;
  /** FR-LIVE-1 (R32): the drawing takes the frame's whole height instead of a capped square; the frame takes its parent's. */
  fill?: boolean;
  children: ReactNode;
}

/**
 * R64 (FR-FSC-2, D-321): the id of the screen's status slot — the facing
 * readout — so the follow screen's `role="dialog"` can name itself with the
 * line the reader is looking at rather than with a label of its own. There is
 * at most one screen frame in the document (the live page renders one layer),
 * so a constant is unique; the slot is absent in the portrait state, where the
 * layer falls back to its `aria-label` (FR-FSC-4).
 */
export const SCREEN_STATUS_ID = 'follow-screen-readout';

/**
 * FR-LEG-7 (R71, D-387): the open legend panel's height, in rows of `--tap`.
 * Two — the same two the sky screen's strip is capped at (FR-FSC-3), and for
 * the same reason: two rows of a compact legend are two lines of text. It is a
 * *height* here and a maximum there, because what V14-5 asks for is that the
 * panel take the same room whatever it holds.
 */
export const LEGEND_OPEN_ROWS = 2;

/**
 * FR-LEG-7 (R71, D-387): the open panel's id, so `[ list (n) ]` can name what
 * it opens (`aria-controls`). One frame on the page carries the panel — the
 * compact live page's, the only caller that passes `legendOpen` — so a
 * constant is unique, as `SCREEN_STATUS_ID` above is.
 */
export const LEGEND_PANEL_ID = 'live-legend-panel';

export function ChartFrame({ controls, status, legend, legendOpen, aside, stripe, boxAspect, stacked = false, screen = false, overlay, className, fill = false, children }: ChartFrameProps) {
  const compact = useLayoutMode() === 'compact';
  const frameRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<HTMLDivElement>(null);
  const railProbeRef = useRef<HTMLSpanElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const hasAside = aside !== undefined && aside !== null;
  const hasStripe = stripe !== undefined && stripe !== null;
  // FR-LEG-7 (D-387): closed, there is no slot at all — not an empty one — so the rows under the box are the box's.
  const hasLegend = legend !== undefined && legend !== null && legendOpen !== false;
  // D-319: stacked only where there is no rail to stand beside; an aside wins, since the rail is what it is for.
  const isStacked = stacked && !hasAside;
  // D-322: a screen measures nothing. The box is the host's, so neither the aspect fit nor the compact floor runs.
  const boxed = !screen && fill && !compact && boxAspect !== undefined && (hasAside || isStacked);

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
      const stripeHeight = stripeRef.current?.getBoundingClientRect().height ?? 0;
      // D-319: stacked, the legend is a row under the stripe and costs the box its height too; beside, it is the rail's.
      const legendHeight = isStacked ? (legendRef.current?.getBoundingClientRect().height ?? 0) : 0;
      const below = (stripeHeight > 0 ? stripeHeight + gap : 0) + (legendHeight > 0 ? legendHeight + gap : 0);
      const rail = railProbeRef.current?.getBoundingClientRect().width ?? 0;
      const { width, height } = frame.getBoundingClientRect();
      const box = fitBox({
        frameWidthPx: width,
        frameHeightPx: height,
        aboveHeightPx: above + gap,
        belowHeightPx: below,
        besideWidthPx: isStacked ? 0 : rail + columnGap,
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
    if (isStacked && legendRef.current) observer.observe(legendRef.current);
    measure();
    return () => {
      observer.disconnect();
      frame.style.removeProperty('--chart-box-w');
      frame.style.removeProperty('--chart-box-h');
    };
  }, [boxed, boxAspect, hasStripe, isStacked, hasLegend]);

  // FR-COMP-5 / D-187: the live floor. The drawing's minimum height is the frame's width, measured, so a
  // portrait phone never gets a dome shorter than it is wide whatever the rows around it take.
  useEffect(() => {
    const frame = frameRef.current;
    if (screen || !fill || !compact || !frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      frame.style.setProperty('--chart-floor', `${String(Math.round(width))}px`);
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
      frame.style.removeProperty('--chart-floor');
    };
  }, [fill, compact, screen]);

  /*
   * R62 (FR-FSC-1, FR-FSC-3, D-322): the screen. A frame of its own — not
   * `.frame`, not `.fill` — so none of the rules above can reach it: it has no
   * grid, no rows and no column, and the box is the host's whole size. Over the
   * box, in this order and in this stacking order, the facing readout at the
   * top-left, the legend strip along the bottom edge, and whatever the page
   * puts over both. `aside` and `stripe` have nowhere to go here and are not
   * rendered; neither is the controls row, since a screen has no controls
   * (FR-FSC-1). A slot with nothing in it is left out rather than drawn empty:
   * the two overlays carry a surface, and R63's portrait state hands the frame
   * `status={null}` and `legend={null}` precisely so the note is all there is.
   */
  if (screen) {
    return (
      <div className={[styles.shell, styles.shellFill].join(' ')}>
        <div className={[styles.screen, className].filter(Boolean).join(' ')} ref={frameRef} data-testid="chart-frame" data-screen="true" data-fill={fill} data-legend={hasLegend}>
          <div className={styles.drawing} data-testid="chart-box">
            {children}
          </div>
          {status !== undefined && status !== null && (
            <div className={styles.status} id={SCREEN_STATUS_ID} data-testid="chart-status">
              {status}
            </div>
          )}
          {hasLegend && (
            <div className={styles.legend} data-testid="chart-legend-slot">
              {legend}
            </div>
          )}
          {overlay !== undefined && overlay !== null && (
            <div className={styles.overlay} data-testid="chart-overlay">
              {overlay}
            </div>
          )}
        </div>
      </div>
    );
  }

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
        data-legend={hasLegend}
        {...(legendOpen === undefined ? {} : { 'data-legend-open': legendOpen })}
        data-aside={hasAside}
        data-stripe={hasStripe}
        data-box={boxed}
        data-stacked={isStacked}
      >
        {/* D-314: the rail's minimum in px, read off this probe — `--cell` is `1ch`, which no script can turn into px by itself. */}
        {boxed && !isStacked && <span className={styles.railProbe} ref={railProbeRef} aria-hidden="true" />}
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
        {hasLegend && (
          <div className={styles.legend} data-testid="chart-legend-slot" ref={legendRef} {...(legendOpen === undefined ? {} : { id: LEGEND_PANEL_ID })}>
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
