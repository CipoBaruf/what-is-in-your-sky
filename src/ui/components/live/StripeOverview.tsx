import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { formatClock } from '../../../lib/timeFormat';
import { chunkFor, cursorAt, nightBands, overviewKeyStep, passSegments, timeAt, xAt, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Pass } from '../../../model';
import styles from './StripeOverview.module.css';

/**
 * R70 (FR-SPAN-2, US-24 AC2, D-383): the whole night in one row, above the
 * stripe and under the clock readout. It carries the span the stripe used to
 * draw — FR-LIVE-4's night shading and one mark per pass in its arc's colour —
 * with a cursor at the shown instant and a bracket around the four hours drawn
 * below it (`chunkFor`). Its resolution is the old one, about two minutes per
 * pixel on a phone: it says *where in the night*, and the stripe says *when*.
 *
 * A slider of its own, and not a mode of `TimeStripe` (D-383): the two draw
 * different pictures at different resolutions from the same pure module, and a
 * `rows` prop would put them behind one set of props and one memo set. A click
 * or a drag sets the instant to what is under the pointer; the arrow keys step
 * a quarter hour and Page Up and Page Down a chunk (`overviewKeyStep`).
 *
 * The bracket is where `chunkFor` says and is drawn, not stored: nothing here
 * chooses the chunk, and the mark and the bracket cannot disagree with the
 * stripe below because both are the same function of `t` (FR-SPAN-1).
 */
export interface StripeOverviewProps {
  span: Span;
  passes: readonly Pass[];
  bands: readonly SkyBand[];
  /** The shown instant. */
  t: EpochMs;
  timeZone: string | null;
  onScrub: (t: EpochMs) => void;
}

/** One text row in CSS pixels at the 16 px base (`--row`, 1.5 rem): the overview is one row tall (FR-SPAN-2). */
export const OVERVIEW_HEIGHT = 24;
/** Before the first measurement, and in a layout with no width (tests). */
export const DEFAULT_WIDTH = 600;
/** A pass mark is at least this wide, so a ten-minute pass in 24 h is still a mark and not a hairline. */
export const MARK_MIN_PX = 2;

export function StripeOverview({ span, passes, bands, t, timeZone, onScrub }: StripeOverviewProps) {
  const m = useT();
  const locale = useLocale();
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(OVERVIEW_HEIGHT);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      setWidth(el.clientWidth || DEFAULT_WIDTH);
      setHeight(el.clientHeight || OVERVIEW_HEIGHT);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  const scrubTo = useCallback(
    (clientX: number) => {
      const left = ref.current?.getBoundingClientRect().left ?? 0;
      onScrub(timeAt(clientX - left, span, width));
    },
    [onScrub, span, width],
  );
  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    // R39 (F-39), as on the stripe: no `preventDefault()`, so the press gives the row the focus its keys need.
    event.currentTarget.focus({ preventScroll: true });
    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    scrubTo(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    if (!dragging) return;
    scrubTo(event.clientX);
  };
  const endDrag = (): void => {
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>): void => {
    const next = overviewKeyStep(t, event.key, span);
    if (next === null) return;
    event.preventDefault();
    onScrub(next);
  };

  // F-38's rule, kept: the night and the marks are the span's and do not move with the instant; the cursor and the bracket do, and both are arithmetic.
  const night = useMemo(() => nightBands(bands, span, width), [bands, span, width]);
  const marks = useMemo(() => passSegments(passes, span, width), [passes, span, width]);
  const chunk = chunkFor(t, span, timeZone);
  const bracketX = xAt(chunk.start, span, width);
  const bracketWidth = Math.max(MARK_MIN_PX, xAt(chunk.end, span, width) - bracketX);
  const cursor = cursorAt(t, span, width);

  return (
    <svg
      ref={ref}
      className={styles.overview}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width="100%"
      role="slider"
      tabIndex={0}
      aria-label={m.live.overview}
      aria-valuemin={span.start}
      aria-valuemax={span.end}
      aria-valuenow={t}
      aria-valuetext={formatClock(t, timeZone, locale)}
      aria-orientation="horizontal"
      data-testid="stripe-overview"
      data-dragging={dragging}
      data-chunk-start={chunk.start}
      data-chunk-end={chunk.end}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <rect className={styles.day} x="0" y="0" width={fmt(width)} height={fmt(height)} />
      {night.map((band) => (
        <rect key={band.x} className={styles.night} data-sky={band.sky} x={fmt(band.x)} y="0" width={fmt(band.width)} height={fmt(height)} />
      ))}
      {/* One mark per pass, in the colour its arc carries on the dome (FR-LEG-5); they sit on one row, unlike the stripe's lanes. */}
      <g data-row="marks">
        {marks.map((mark) => (
          <rect
            key={mark.passId}
            className={styles.mark}
            data-pass-mark={mark.passId}
            data-series={mark.series}
            x={fmt(mark.x)}
            y={fmt(height / 4)}
            width={fmt(Math.max(MARK_MIN_PX, mark.width))}
            height={fmt(height / 2)}
            rx="1"
          />
        ))}
      </g>
      {/* The four hours the stripe below is drawing (FR-SPAN-2): a bracket, open at the top and the bottom so the marks inside it still read. */}
      <g data-testid="overview-bracket" data-x={fmt(bracketX)} data-width={fmt(bracketWidth)}>
        <rect className={styles.bracket} x={fmt(bracketX)} y="0.5" width={fmt(bracketWidth)} height={fmt(height - 1)} rx="1" />
      </g>
      <line className={styles.cursor} data-testid="overview-cursor" data-x={fmt(cursor.x)} x1={fmt(cursor.x)} x2={fmt(cursor.x)} y1="0" y2={fmt(height)} />
    </svg>
  );
}

const fmt = (n: number): string => n.toFixed(1);
