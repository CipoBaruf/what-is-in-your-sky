import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { formatClock, formatShortClock } from '../../../lib/timeFormat';
import { cursorAt, hourTicks, keyStep, nightBands, passSegments, timeAt, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Pass } from '../../../model';
import styles from './TimeStripe.module.css';

/**
 * R33 (FR-LIVE-4, US-15 AC3, D-82): the time stripe under the dome, in SVG.
 * `now` at the left edge and `now + 24 h` at the right, a tick on every whole
 * hour of the observer's clock, the night shaded from the three sky states,
 * one segment per pass in the series colour its arc carries, and a cursor at
 * the shown instant with its clock time. Drag, click and the arrow keys (one
 * minute; ten with Shift) move the instant, clamped to the span.
 *
 * The geometry is `lib/timeStripe.ts`, in pixels of the measured width, so
 * the text is never scaled: the SVG's viewBox is its own box. The stripe is
 * one `slider` to assistive technology, whose value text is the cursor's
 * clock time; the drawing inside it is decoration (FR-GUIDE-7: the status
 * strip is the text alternative).
 */
export interface TimeStripeProps {
  span: Span;
  passes: readonly Pass[];
  bands: readonly SkyBand[];
  /** The shown instant. */
  t: EpochMs;
  timeZone: string | null;
  onScrub: (t: EpochMs) => void;
}

/** The stripe's height in CSS pixels — two text rows, the tap target (G6); the rows below are laid out in it. */
export const STRIPE_HEIGHT = 48;
/** Before the first measurement, and in a layout with no width (tests). */
export const DEFAULT_WIDTH = 600;
const LABEL_Y = 10;
const SEGMENTS_Y = 13;
const LANE_H = 6;
const SEGMENT_H = 4;
const TICK_Y = 32;
const TICK_H = 5;
const LABELLED_TICK_H = 8;
const HOUR_Y = 46;

export function TimeStripe({ span, passes, bands, t, timeZone, onScrub }: TimeStripeProps) {
  const m = useT();
  const locale = useLocale();
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      setWidth(el.clientWidth || DEFAULT_WIDTH);
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
    event.preventDefault();
    // jsdom has no pointer capture; the browser keeps the drag on the stripe when the pointer leaves it.
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
    const next = keyStep(t, event.key, event.shiftKey, span);
    if (next === null) return;
    event.preventDefault();
    onScrub(next);
  };

  const ticks = hourTicks(span, width, timeZone);
  const night = nightBands(bands, span, width);
  const segments = passSegments(passes, span, width, t);
  const cursor = cursorAt(t, span, width);

  return (
    <svg
      ref={ref}
      className={styles.stripe}
      viewBox={`0 0 ${String(width)} ${String(STRIPE_HEIGHT)}`}
      width="100%"
      height={STRIPE_HEIGHT}
      role="slider"
      tabIndex={0}
      aria-label={m.live.stripe}
      aria-valuemin={span.start}
      aria-valuemax={span.end}
      aria-valuenow={t}
      aria-valuetext={formatClock(t, timeZone, locale)}
      aria-orientation="horizontal"
      data-testid="time-stripe"
      data-dragging={dragging}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <rect className={styles.day} x="0" y="0" width={width} height={STRIPE_HEIGHT} />
      {night.map((band) => (
        <rect key={band.x} className={styles.night} data-sky={band.sky} x={fmt(band.x)} y="0" width={fmt(band.width)} height={STRIPE_HEIGHT} />
      ))}
      {ticks.map((tick) => (
        <g key={tick.t} data-tick={tick.hour}>
          <line className={styles.tick} x1={fmt(tick.x)} x2={fmt(tick.x)} y1={TICK_Y} y2={TICK_Y + (tick.labelled ? LABELLED_TICK_H : TICK_H)} />
          {tick.labelled && (
            <text className={styles.hour} x={fmt(tick.x)} y={HOUR_Y} textAnchor="middle">
              {String(tick.hour).padStart(2, '0')}
            </text>
          )}
        </g>
      ))}
      {segments.map((segment) => (
        <rect
          key={segment.passId}
          className={[styles.segment, segment.current ? styles.current : undefined].filter(Boolean).join(' ')}
          data-pass-segment={segment.passId}
          data-series={segment.series}
          data-current={segment.current}
          x={fmt(segment.x)}
          y={SEGMENTS_Y + segment.lane * LANE_H}
          width={fmt(segment.width)}
          height={SEGMENT_H}
          rx="1"
        />
      ))}
      <g data-testid="stripe-cursor" data-x={fmt(cursor.x)}>
        <line className={styles.cursor} x1={fmt(cursor.x)} x2={fmt(cursor.x)} y1={LABEL_Y + 2} y2={STRIPE_HEIGHT} />
        <text className={styles.clock} x={fmt(cursor.x)} y={LABEL_Y} textAnchor={cursor.anchor}>
          {formatShortClock(t, timeZone, locale)}
        </text>
      </g>
    </svg>
  );
}

const fmt = (n: number): string => n.toFixed(1);
