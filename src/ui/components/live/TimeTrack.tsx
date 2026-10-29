import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useT } from '../../../i18n/useT';
import { TRACK_HEIGHT_PX } from '../../../lib/layout';
import { CELL_PX, clampToSpan, cursorAt, DAY_MS, HOUR_MS, MINUTE_MS, nightBands, passSegments, timeAt, xAt, zoneOffsetMs, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Pass } from '../../../model';
import styles from './TimeTrack.module.css';

/**
 * R142 (FR-TONIGHT-3, D-900): the compact live page's one timeline, in SVG as
 * the stripe is (D-82). The whole span, `now` to `now + 24 h`, at the content
 * width and `TRACK_HEIGHT_PX` tall: the three sky states as fills (day, bright
 * twilight, dark), one tick per visible pass in its arc's series colour, at
 * least `TICK_MIN_PX` wide, and a thumb at the shown instant. Under it one
 * HTML row of labels: `now`, the local hour at every third hour from
 * midnight, `+24 h`.
 *
 * Input is pointer events with capture. A press inside a tick's
 * `TICK_ZONE_PX` zone (nearest tick centre wins) asks for that pass's lead
 * instant — `onSeek(pass.start, { lead: true })`, the page taking
 * `TONIGHT_LEAD_MIN` off it — and a press anywhere else, or a move while the
 * pointer is held, sets the instant under it (`lead: false`). A press on a
 * tick holds its choice until the finger has moved `TAP_SLOP_PX`, so a tap's
 * jitter is not a drag. The page pauses on every `onSeek`.
 *
 * One `slider` to assistive technology: the value is the instant in epoch ms
 * and its text the page's headline string (FR-TONIGHT-7), which the page
 * passes in as `valueText`; the arrows step a quarter hour and the page keys
 * an hour (FR-SPAN-2's keys).
 */
export interface TimeTrackProps {
  span: Span;
  /** The sky states over the span (`useSkyBands`, D-170). */
  bands: readonly SkyBand[];
  /** The visible passes, in the order their arcs take their series colours (`passSegments`, FR-LIVE-2). */
  passes: readonly Pass[];
  /** The shown instant. */
  t: EpochMs;
  /**
   * The instant the reader asked for. With `lead: false` it is the instant itself; with `lead: true` it is a
   * tapped pass's start, and the page lands `TONIGHT_LEAD_MIN` before it (FR-TONIGHT-3).
   */
  onSeek: (t: EpochMs, options: { lead: boolean }) => void;
  timeZone: string | null;
  /** The slider's `aria-valuetext`: the shown time and its chip (FR-TONIGHT-7). */
  valueText: string;
}

/** Before the first measurement, and in a layout with no width (tests). */
export const DEFAULT_WIDTH = 390;
/** A pass tick is at least this wide, so a two-minute pass in 24 h is still a mark a finger can find (FR-TONIGHT-3). */
export const TICK_MIN_PX = 3;
/** A tick's hit zone, centred on it: the target floor (`--target`, D-851). */
export const TICK_ZONE_PX = 44;
/** How far a press that landed on a tick may wander before it becomes a drag. */
export const TAP_SLOP_PX = 6;
/** The thumb: a full-height bar this wide, kept inside the track at the two ends. */
const THUMB_PX = 3;
/** FR-TONIGHT-3: the arrows step a quarter hour, Page Up and Page Down an hour. */
export const TRACK_KEY_STEP_MS = 15 * MINUTE_MS;
export const TRACK_PAGE_STEP_MS = HOUR_MS;
/** FR-TONIGHT-3: the label row's hours are every third hour of the observer's clock, counted from midnight. */
const LABEL_EVERY_MS = 3 * HOUR_MS;
/** A `--small` cell (0.875 of the base cell): what the label row's text is laid out in. */
const SMALL_CELL_PX = CELL_PX * 0.875;

export interface TrackTick {
  passId: string;
  /** The pass's start, unclipped: what a tap on the tick asks for. */
  start: EpochMs;
  x: number;
  width: number;
  series: number;
}

/** The ticks of the visible passes: `passSegments`' pixels on one row, each at least `TICK_MIN_PX` wide. */
export function trackTicks(passes: readonly Pass[], span: Span, width: number): TrackTick[] {
  return passSegments(passes, span, width).map((segment) => ({
    passId: segment.passId,
    start: segment.start,
    x: segment.x,
    width: Math.max(TICK_MIN_PX, segment.width),
    series: segment.series,
  }));
}

/** The tick whose zone holds pixel `x` — the nearest centre where two zones overlap — or `null`. */
export function tickAt(x: number, ticks: readonly TrackTick[]): TrackTick | null {
  let best: TrackTick | null = null;
  let bestDistance = Infinity;
  for (const tick of ticks) {
    const distance = Math.abs(x - (tick.x + tick.width / 2));
    if (distance > Math.max(TICK_ZONE_PX, tick.width) / 2 || distance >= bestDistance) continue;
    best = tick;
    bestDistance = distance;
  }
  return best;
}

/** The instant after one key from `t`, clamped; `null` for a key that is not a step. */
export function trackKeyStep(t: EpochMs, key: string, span: Span): EpochMs | null {
  const step =
    key === 'PageUp'
      ? TRACK_PAGE_STEP_MS
      : key === 'PageDown'
        ? -TRACK_PAGE_STEP_MS
        : key === 'ArrowRight' || key === 'ArrowUp'
          ? TRACK_KEY_STEP_MS
          : key === 'ArrowLeft' || key === 'ArrowDown'
            ? -TRACK_KEY_STEP_MS
            : 0;
  return step === 0 ? null : clampToSpan(t + step, span);
}

export interface TrackLabel {
  t: EpochMs;
  x: number;
  text: string;
}

/**
 * The label row's hours: every third whole hour of the observer's clock in the span, two digits, dropped where one
 * would run into the `now` or the `+24 h` at the ends or past an edge. The zone offset is read once, at the span's
 * start, as `hourTicks` reads it (D-170).
 */
export function trackLabels(span: Span, width: number, timeZone: string | null, ends: { now: string; end: string }): TrackLabel[] {
  const offset = zoneOffsetMs(span.start, timeZone);
  const half = SMALL_CELL_PX;
  const left = ends.now.length * SMALL_CELL_PX + SMALL_CELL_PX + half;
  const right = width - ends.end.length * SMALL_CELL_PX - SMALL_CELL_PX - half;
  const labels: TrackLabel[] = [];
  for (let t = Math.ceil((span.start + offset) / LABEL_EVERY_MS) * LABEL_EVERY_MS - offset; t <= span.end; t += LABEL_EVERY_MS) {
    const x = xAt(t, span, width);
    if (x < left || x > right) continue;
    const dayMs = (((t + offset) % DAY_MS) + DAY_MS) % DAY_MS;
    labels.push({ t, x, text: String(Math.floor(dayMs / HOUR_MS)).padStart(2, '0') });
  }
  return labels;
}

export function TimeTrack({ span, bands, passes, t, onSeek, timeZone, valueText }: TimeTrackProps) {
  const m = useT();
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  // Where a press on a tick landed, while it still counts as a tap; `null` once it is a drag or off a tick.
  const pressRef = useRef<number | null>(null);
  const height = TRACK_HEIGHT_PX;

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

  // F-38's rule, kept: the bands, the ticks and the labels are the span's and do not move with the instant; the thumb does, and it is arithmetic.
  const sky = useMemo(() => nightBands(bands, span, width), [bands, span, width]);
  const ticks = useMemo(() => trackTicks(passes, span, width), [passes, span, width]);
  const labels = useMemo(() => trackLabels(span, width, timeZone, { now: m.track.now, end: m.track.end }), [span, width, timeZone, m]);

  const xOf = (clientX: number): number => clientX - (ref.current?.getBoundingClientRect().left ?? 0);
  const onPointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return;
    // R39 (F-39), as on the stripe: no `preventDefault()`, so the press gives the track the focus its keys need.
    event.currentTarget.focus({ preventScroll: true });
    // jsdom has no pointer capture; the browser keeps the drag on the track when the finger leaves it.
    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const x = xOf(event.clientX);
    const tick = tickAt(x, ticks);
    pressRef.current = tick ? x : null;
    if (tick) onSeek(tick.start, { lead: true });
    else onSeek(timeAt(x, span, width), { lead: false });
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    if (!dragging) return;
    const x = xOf(event.clientX);
    if (pressRef.current !== null) {
      if (Math.abs(x - pressRef.current) < TAP_SLOP_PX) return;
      pressRef.current = null;
    }
    onSeek(timeAt(x, span, width), { lead: false });
  };
  const endDrag = (): void => {
    pressRef.current = null;
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>): void => {
    const next = trackKeyStep(t, event.key, span);
    if (next === null) return;
    event.preventDefault();
    onSeek(next, { lead: false });
  };

  const thumbX = Math.min(width - THUMB_PX, Math.max(0, cursorAt(t, span, width).x - THUMB_PX / 2));

  return (
    <div className={styles.track} data-testid="time-track">
      <svg
        ref={ref}
        className={styles.bar}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        width="100%"
        height={height}
        role="slider"
        tabIndex={0}
        aria-label={m.track.label}
        aria-valuemin={span.start}
        aria-valuemax={span.end}
        aria-valuenow={t}
        aria-valuetext={valueText}
        aria-orientation="horizontal"
        data-testid="time-track-bar"
        data-dragging={dragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <rect className={styles.day} x="0" y="0" width={fmt(width)} height={fmt(height)} />
        {sky.map((band) => (
          <rect key={band.x} className={styles.band} data-sky={band.sky} x={fmt(band.x)} y="0" width={fmt(band.width)} height={fmt(height)} />
        ))}
        <g data-row="ticks">
          {ticks.map((tick) => (
            <rect
              key={tick.passId}
              className={styles.tick}
              data-pass-tick={tick.passId}
              data-series={tick.series}
              x={fmt(tick.x)}
              y={fmt(height / 4)}
              width={fmt(tick.width)}
              height={fmt(height / 2)}
              rx="1"
            />
          ))}
        </g>
        <rect className={styles.thumb} data-testid="time-track-thumb" x={fmt(thumbX)} y="0" width={THUMB_PX} height={fmt(height)} />
      </svg>
      <div className={styles.labels} aria-hidden="true" data-testid="time-track-labels">
        <span>{m.track.now}</span>
        {labels.map((label) => (
          <span key={label.t} className={styles.hour} data-label={label.text} style={{ left: `${fmt((label.x / width) * 100)}%` }}>
            {label.text}
          </span>
        ))}
        <span>{m.track.end}</span>
      </div>
    </div>
  );
}

const fmt = (n: number): string => n.toFixed(1);
