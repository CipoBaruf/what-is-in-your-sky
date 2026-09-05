import type { EpochMs, Pass, SkyState } from '../model';

/**
 * R33 (FR-LIVE-4, D-82): the time stripe's geometry, pure and clock-free
 * (D-15). The stripe is a horizontal SVG under the dome: `now` at the left
 * edge and `now + 24 h` at the right, hour ticks, night shading from the three
 * `SkyState` bands, one segment per pass in its arc's series colour, and a
 * cursor at the shown instant. Everything here is a number in pixels of a
 * stripe `width` wide, or an instant; the component (`components/live/
 * TimeStripe.tsx`) draws the numbers and words the labels through the
 * catalogs (FR-I18N-2).
 *
 * A "span" is the stripe's interval, `[start, start + spanMs]`. `xAt` maps an
 * instant to a pixel and `timeAt` maps a pixel back, clamped, so a pointer
 * anywhere on the stripe names an instant inside it (FR-LIVE-4's "clamps to
 * the span"). The arrow-key steps are here too, so the same clamp governs
 * both ways of moving.
 */
export interface Span {
  start: EpochMs;
  end: EpochMs;
}

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

/** FR-LIVE-4: an arrow key moves one minute; with Shift, ten. */
export const KEY_STEP_MS = MINUTE_MS;
export const SHIFT_KEY_STEP_MS = 10 * MINUTE_MS;

export function clampToSpan(t: EpochMs, span: Span): EpochMs {
  return Math.min(span.end, Math.max(span.start, t));
}

/** The pixel of `t` on a stripe `width` wide; outside the span it is outside the stripe. */
export function xAt(t: EpochMs, span: Span, width: number): number {
  return ((t - span.start) / (span.end - span.start)) * width;
}

/** The instant under pixel `x`, clamped to the span (a pointer past either edge names the edge). */
export function timeAt(x: number, span: Span, width: number): EpochMs {
  if (width <= 0) return span.start;
  return clampToSpan(Math.round(span.start + (x / width) * (span.end - span.start)), span);
}

/** The instant after one arrow-key step from `t`: ±1 min, ±10 min with Shift, clamped (FR-LIVE-4). `null` for a key that is not a step. */
export function keyStep(t: EpochMs, key: string, shift: boolean, span: Span): EpochMs | null {
  const direction = key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : 0;
  if (direction === 0) return null;
  return clampToSpan(t + direction * (shift ? SHIFT_KEY_STEP_MS : KEY_STEP_MS), span);
}

/**
 * The offset of `timeZone` from UTC at `t`, in milliseconds, from the wall
 * clock Intl reads there; `0` for an unknown zone, whose clocks read UTC
 * everywhere else on the page (`lib/timeFormat.ts`).
 */
export function zoneOffsetMs(t: EpochMs, timeZone: string | null): number {
  if (!timeZone) return 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(t));
    const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    // Intl gives whole seconds; the sub-second part of `t` is not part of the offset.
    return wall - (t - (t % 1000));
  } catch {
    return 0;
  }
}

export interface HourTick {
  t: EpochMs;
  x: number;
  /** The hour of the observer's clock, 0–23. */
  hour: number;
  /** Whether this tick carries its hour as text: every `labelEveryHours`-th hour, counted from midnight. */
  labelled: boolean;
}

/** Hour labels are two characters wide; ticks nearer than this many pixels share one label between them. */
export const MIN_LABEL_GAP_PX = 40;

/** How many hours apart the labelled ticks are, for a stripe of this width: the finest of 1, 2, 3, 6 that keeps labels `MIN_LABEL_GAP_PX` apart. */
export function labelEveryHours(span: Span, width: number): number {
  const hourPx = (HOUR_MS / (span.end - span.start)) * width;
  for (const step of [1, 2, 3, 6]) {
    if (hourPx * step >= MIN_LABEL_GAP_PX) return step;
  }
  return 12;
}

/**
 * FR-LIVE-4's hour ticks: every whole hour of the observer's clock inside the
 * span, from the first after `start`. The zone offset is read once, at the
 * span's start; a DST change inside the 24 h moves the later ticks by an hour
 * on the clock, which the labels show and the ticks do not.
 */
export function hourTicks(span: Span, width: number, timeZone: string | null): HourTick[] {
  const offset = zoneOffsetMs(span.start, timeZone);
  const every = labelEveryHours(span, width);
  const first = Math.ceil((span.start + offset) / HOUR_MS) * HOUR_MS - offset;
  const ticks: HourTick[] = [];
  for (let t = first; t <= span.end; t += HOUR_MS) {
    const hour = Math.round(((t + offset) / HOUR_MS) % 24 + 24) % 24;
    ticks.push({ t, x: xAt(t, span, width), hour, labelled: hour % every === 0 });
  }
  return ticks;
}

/** One stretch of sky in one `SkyState`, in instants; the stripe shades `bright-twilight` and `dark` (FR-LIVE-4's night shading). */
export interface SkyBand {
  from: EpochMs;
  to: EpochMs;
  sky: SkyState;
}

export interface NightBand {
  x: number;
  width: number;
  sky: SkyState;
}

/** The bands clipped to the span and mapped to pixels; day is the stripe's own background and is left out. */
export function nightBands(bands: readonly SkyBand[], span: Span, width: number): NightBand[] {
  const out: NightBand[] = [];
  for (const band of bands) {
    if (band.sky === 'day') continue;
    const from = Math.max(band.from, span.start);
    const to = Math.min(band.to, span.end);
    if (to <= from) continue;
    const x = xAt(from, span, width);
    out.push({ x, width: xAt(to, span, width) - x, sky: band.sky });
  }
  return out;
}

/**
 * The bands of a sampled Sun altitude: `sample(t)` is asked every `stepMs`
 * from `from` to `to`, and consecutive samples of one state are one band.
 * Pure: the sampler is the caller's (the astronomy chunk, `lib/skyBodies.ts`).
 */
export function skyBands(from: EpochMs, to: EpochMs, stepMs: number, sample: (t: EpochMs) => SkyState): SkyBand[] {
  const bands: SkyBand[] = [];
  for (let t = from; t < to; t += stepMs) {
    const sky = sample(t);
    const last = bands[bands.length - 1];
    if (last && last.sky === sky) last.to = Math.min(t + stepMs, to);
    else bands.push({ from: t, to: Math.min(t + stepMs, to), sky });
  }
  return bands;
}

export interface PassSegment {
  passId: string;
  x: number;
  width: number;
  /** FR-LIVE-2's series colour, 1–6 by pass order — the same number the arc carries on the dome. */
  series: number;
  /** Which row the segment sits on, 0 first: passes that overlap in time take different rows. */
  lane: number;
  /** Whether the shown instant is inside this pass (the arc carrying a live marker). */
  current: boolean;
}

/** The six series tokens of the chart, cycled in pass order (`SkyPolar.SERIES_COUNT`). */
export const SERIES_COUNT = 6;
/** Segments narrower than this are widened to it, so a two-minute pass is still a mark and not a hairline. */
export const MIN_SEGMENT_PX = 2;
/** How many rows overlapping passes may stack into before they share the last one. */
export const MAX_LANES = 3;

/**
 * FR-LIVE-4: each pass a segment in its arc's colour, clipped to the span.
 * Overlapping passes are stacked into lanes greedily in `passes` order, so
 * two satellites up at once are two marks and not one; a pass wholly outside
 * the span is left out.
 */
export function passSegments(passes: readonly Pass[], span: Span, width: number, t: EpochMs): PassSegment[] {
  const laneEnds: EpochMs[] = [];
  const out: PassSegment[] = [];
  passes.forEach((pass, index) => {
    const from = Math.max(pass.start.t, span.start);
    const to = Math.min(pass.end.t, span.end);
    if (to < from) return;
    let lane = laneEnds.findIndex((end) => end <= pass.start.t);
    if (lane === -1) {
      lane = Math.min(laneEnds.length, MAX_LANES - 1);
      if (laneEnds.length < MAX_LANES) laneEnds.push(pass.end.t);
      else laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, pass.end.t);
    } else laneEnds[lane] = pass.end.t;
    const x = xAt(from, span, width);
    out.push({
      passId: pass.id,
      x,
      width: Math.max(MIN_SEGMENT_PX, xAt(to, span, width) - x),
      series: (index % SERIES_COUNT) + 1,
      lane,
      current: pass.start.t <= t && t <= pass.end.t,
    });
  });
  return out;
}

export interface Cursor {
  x: number;
  /** Where the clock label's anchor sits so it stays inside the stripe: start near the left edge, end near the right, middle otherwise. */
  anchor: 'start' | 'middle' | 'end';
}

/** The label is about this many pixels wide ("21:14" in the stripe's small type); near an edge it hangs inward. */
export const CURSOR_LABEL_HALF_PX = 22;

/** The cursor marking the shown instant, clamped to the span like the instant itself. */
export function cursorAt(t: EpochMs, span: Span, width: number): Cursor {
  const x = xAt(clampToSpan(t, span), span, width);
  const anchor = x < CURSOR_LABEL_HALF_PX ? 'start' : x > width - CURSOR_LABEL_HALF_PX ? 'end' : 'middle';
  return { x, anchor };
}
