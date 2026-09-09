import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { formatClock } from '../../../lib/timeFormat';
import { cursorAt, drawnSpan, hourTicks, isCurrent, keepLabels, keyStep, MAX_LANES, midnightDate, nightBands, passSegments, tickLabel, timeAt, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Pass } from '../../../model';
import styles from './TimeStripe.module.css';

/**
 * R33 (FR-LIVE-4, US-15 AC3, D-82): the time stripe under the dome, in SVG.
 * `now` at the left edge and `now + 24 h` at the right, the night shaded from
 * the three sky states, one segment per pass in the series colour its arc
 * carries, and a cursor at the shown instant. Drag, click and the arrow keys
 * (one minute; ten with Shift) move the instant, clamped to the span.
 *
 * R48 (FR-TRAJ-4, D-190): three rows of body-size cells. Row 1 is the hour
 * labels — every 2 h on wide and every 3 h on compact, counted from midnight,
 * with the date (day and short month) at each midnight crossing in place of
 * `00`. Row 2 is the band: the night shading and a tick on every whole hour
 * of the observer's clock. Row 3 is the pass segments. The cursor crosses all
 * three; the clock readout that used to ride on it is `TimeReadout`, above
 * the stripe, in the heading size. The rows are the measured height in
 * thirds, so `--row` sets them and the text is never scaled.
 *
 * R70 (FR-SPAN-1, FR-SPAN-5, FR-SPAN-7, D-382): the three rows draw a *chunk*
 * of the span — the four hours that hold the shown instant, `drawnSpan` — so a
 * drag moves 40 s a pixel on a phone instead of four minutes. The chunk is
 * derived from `t` on every render and stored nowhere; the whole span is still
 * the value's range, the overview row above shows it, and at 600× and 3600×
 * the stripe draws all of it again (FR-SPAN-6). The label cadence follows the
 * window drawn: every 30 min where twelve labels fit, every hour under that.
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
  /** R70 (FR-SPAN-6): the speed playback is running at, or `null` while it is paused — which is a chunk whatever speed is selected. */
  speed?: number | null;
  onScrub: (t: EpochMs) => void;
}

/** One text row in CSS pixels at the 16 px base (`--row`, 1.5 rem); the stripe is three of them. Before the first measurement, and in a layout with no height (tests). */
export const ROW_PX = 24;
export const ROWS = 3;
export const STRIPE_HEIGHT = ROWS * ROW_PX;
/** Before the first measurement, and in a layout with no width (tests). */
export const DEFAULT_WIDTH = 600;

export function TimeStripe({ span, passes, bands, t, timeZone, speed = null, onScrub }: TimeStripeProps) {
  const m = useT();
  const locale = useLocale();
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: STRIPE_HEIGHT });
  const [dragging, setDragging] = useState(false);
  const { width, height } = size;
  const rowH = height / ROWS;
  /*
   * R70 (FR-SPAN-1, FR-SPAN-5, D-382): what the stripe draws is the four hours
   * of the span that hold the shown instant — derived here from `t`, never
   * stored and never a prop, so there is no second thing that could disagree
   * with the instant. `drawnSpan` is two numbers; the window they name is
   * memoised on *them*, so a frame that stays inside the chunk hands the
   * geometry memos below the same object they had, and a frame that crosses a
   * boundary hands them a new one — one recompute per crossing (FR-SPAN-5),
   * none per frame.
   */
  const { start: drawnStart, end: drawnEnd } = drawnSpan(t, span, timeZone, speed);
  const drawn = useMemo<Span>(() => ({ start: drawnStart, end: drawnEnd }), [drawnStart, drawnEnd]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      setSize({ width: el.clientWidth || DEFAULT_WIDTH, height: el.clientHeight || STRIPE_HEIGHT });
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
      // FR-SPAN-1: the pointer names an instant in the window drawn, which is where the seconds per pixel are.
      onScrub(timeAt(clientX - left, drawn, width));
    },
    [onScrub, drawn, width],
  );
  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    // R39 (F-39): no `preventDefault()` here. It suppressed the focus the press would have given the
    // stripe, so the arrow keys did nothing after a click or a drag; the stripe takes focus itself
    // instead. There is nothing else to prevent — the CSS already says `touch-action: none` and
    // `user-select: none`, which is what stops the scroll and the text selection a drag would start.
    event.currentTarget.focus({ preventScroll: true });
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

  /*
   * R39 (F-38): the geometry does not depend on the shown instant, which moves
   * on every frame while playback runs — at 3600× that was the hour ticks, the
   * night bands and the lane packing recomputed sixty times a second, each with
   * a fresh `Intl.DateTimeFormat` for the zone. Only the cursor and the
   * `current` flag follow `t`, and both are arithmetic on what is memoised here.
   */
  const ticks = useMemo(() => hourTicks(drawn, width, timeZone), [drawn, width, timeZone]);
  const night = useMemo(() => nightBands(bands, drawn, width), [bands, drawn, width]);
  const segments = useMemo(() => passSegments(passes, drawn, width), [passes, drawn, width]);
  // FR-TRAJ-4: the labels of row 1 — the hour (the minutes at the chunk's half hours), or the date at a midnight — dropped where they would spill past an edge or over each other (`keepLabels`).
  const labels = useMemo(
    () => keepLabels(ticks.filter((tick) => tick.labelled).map((tick) => ({ tick, text: tick.midnight ? midnightDate(tick.t, timeZone, locale) : tickLabel(tick) })), width),
    [ticks, timeZone, locale, width],
  );
  const cursor = cursorAt(t, drawn, width);
  const laneH = rowH / MAX_LANES;
  const bandTop = rowH;
  const bandBottom = 2 * rowH;

  return (
    <svg
      ref={ref}
      className={styles.stripe}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width="100%"
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
      data-rows={ROWS}
      data-drawn-start={drawn.start}
      data-drawn-end={drawn.end}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      {/* Row 2 first, so the band sits under the ticks and the cursor. */}
      <g data-row="band">
        <rect className={styles.day} x="0" y={fmt(bandTop)} width={width} height={fmt(rowH)} />
        {night.map((band) => (
          <rect key={band.x} className={styles.night} data-sky={band.sky} x={fmt(band.x)} y={fmt(bandTop)} width={fmt(band.width)} height={fmt(rowH)} />
        ))}
        {ticks.map((tick) => (
          <line
            key={tick.t}
            className={styles.tick}
            data-tick={tick.hour}
            data-labelled={tick.labelled}
            x1={fmt(tick.x)}
            x2={fmt(tick.x)}
            y1={fmt(bandBottom - (tick.labelled ? rowH / 2 : rowH / 4))}
            y2={fmt(bandBottom)}
          />
        ))}
      </g>
      <g data-row="labels">
        {labels.map(({ tick, text }) => (
          <text key={tick.t} className={tick.midnight ? styles.date : styles.hour} data-label={tick.hour} data-midnight={tick.midnight} x={fmt(tick.x)} y={fmt(rowH * 0.75)} textAnchor="middle">
            {text}
          </text>
        ))}
      </g>
      <g data-row="segments">
        {segments.map((segment) => (
          <rect
            key={segment.passId}
            className={[styles.segment, isCurrent(segment, t) ? styles.current : undefined].filter(Boolean).join(' ')}
            data-pass-segment={segment.passId}
            data-series={segment.series}
            data-current={isCurrent(segment, t)}
            x={fmt(segment.x)}
            y={fmt(bandBottom + 1 + segment.lane * laneH)}
            width={fmt(segment.width)}
            height={fmt(Math.max(1, laneH - 2))}
            rx="1"
          />
        ))}
      </g>
      <g data-testid="stripe-cursor" data-x={fmt(cursor.x)}>
        <line className={styles.cursor} x1={fmt(cursor.x)} x2={fmt(cursor.x)} y1="0" y2={fmt(height)} />
      </g>
    </svg>
  );
}

const fmt = (n: number): string => n.toFixed(1);
