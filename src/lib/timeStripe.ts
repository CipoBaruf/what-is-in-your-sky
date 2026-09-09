import { INTL_LOCALE } from '../i18n/locale';
import type { EpochMs, Locale, Pass, SkyState } from '../model';

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

/**
 * R70 (FR-SPAN-1, OQ-24): the stripe draws a **chunk** of the span — four
 * hours — rather than all of it, so a drag moves seconds per pixel instead of
 * minutes. The number is a constant and not a setting: FR-SPAN-1 makes the
 * chunk a view of the shown instant, never a state.
 */
export const STRIPE_CHUNK_H = 4;
export const CHUNK_MS = STRIPE_CHUNK_H * HOUR_MS;
/**
 * R70 (FR-SPAN-6): the wall time an hour of the chunk must last for the chunk
 * to be worth drawing — ten seconds, so the chunk holds to 60× (an hour a
 * minute) and goes at 600×, where the whole four hours pass in 24 s and the
 * labels change faster than they can be read.
 *
 * FR-SPAN-6 states the outcome three times — the chunk at 1× and 60×, the
 * whole span at 600× and 3600× (D-385, and the task's own test) — and states
 * the arithmetic once, as the *chunk's* 24 s against this same 10 s, which
 * would keep the chunk at 600× and contradict the other three. The outcome is
 * what is implemented and the ten seconds is measured on the hour, the unit
 * the stripe's ticks are in; the effective floor is 40 s of wall time for a
 * chunk, between 600×'s 24 s and 60×'s 240 s.
 */
export const CHUNK_MIN_WALL_S = 10;

export const DAY_MS = 24 * HOUR_MS;

/** FR-LIVE-4 as amended v1.4: Page Up and Page Down move one chunk of shown time. */
function stepDirection(key: string): number {
  return key === 'ArrowRight' || key === 'ArrowUp' ? 1 : key === 'ArrowLeft' || key === 'ArrowDown' ? -1 : 0;
}

/** The instant after one arrow-key step from `t`: ±1 min, ±10 min with Shift, ±one chunk on Page Up and Page Down, clamped (FR-LIVE-4). `null` for a key that is not a step. */
export function keyStep(t: EpochMs, key: string, shift: boolean, span: Span): EpochMs | null {
  if (key === 'PageUp' || key === 'PageDown') return clampToSpan(t + (key === 'PageUp' ? CHUNK_MS : -CHUNK_MS), span);
  const direction = stepDirection(key);
  if (direction === 0) return null;
  return clampToSpan(t + direction * (shift ? SHIFT_KEY_STEP_MS : KEY_STEP_MS), span);
}

/** FR-SPAN-2: the overview's own keyboard — a quarter hour on the arrows, a chunk on the page keys, over the whole span. */
export const OVERVIEW_KEY_STEP_MS = 15 * MINUTE_MS;

export function overviewKeyStep(t: EpochMs, key: string, span: Span): EpochMs | null {
  if (key === 'PageUp' || key === 'PageDown') return clampToSpan(t + (key === 'PageUp' ? CHUNK_MS : -CHUNK_MS), span);
  const direction = stepDirection(key);
  if (direction === 0) return null;
  return clampToSpan(t + direction * OVERVIEW_KEY_STEP_MS, span);
}

/** Days from 1970-01-01 to a proleptic Gregorian date (Howard Hinnant's `days_from_civil`); no `Date` in `src/lib` (D-15). */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** R39 (F-38): one formatter per zone. Constructing one is the expensive part of `zoneOffsetMs`, and the zone rarely changes. */
const zoneFormats = new Map<string, Intl.DateTimeFormat | null>();

function zoneFormat(timeZone: string): Intl.DateTimeFormat | null {
  const cached = zoneFormats.get(timeZone);
  if (cached !== undefined) return cached;
  let made: Intl.DateTimeFormat | null;
  try {
    made = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  } catch {
    made = null;
  }
  zoneFormats.set(timeZone, made);
  return made;
}

/**
 * The offset of `timeZone` from UTC at `t`, in milliseconds, from the wall
 * clock Intl reads there; `0` for an unknown zone, whose clocks read UTC
 * everywhere else on the page (`lib/timeFormat.ts`).
 */
export function zoneOffsetMs(t: EpochMs, timeZone: string | null): number {
  if (!timeZone) return 0;
  const format = zoneFormat(timeZone);
  if (format === null) return 0;
  try {
    const parts = format.formatToParts(t);
    const get = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
    const wall = daysFromCivil(get('year'), get('month'), get('day')) * 86_400_000 + (get('hour') % 24) * HOUR_MS + get('minute') * MINUTE_MS + get('second') * 1000;
    // Intl gives whole seconds; the sub-second part of `t` is not part of the offset.
    return wall - (t - (t % 1000));
  } catch {
    return 0;
  }
}

/**
 * R70 (FR-SPAN-1, D-382): the chunk that holds `t` — the four hours of the
 * span the stripe draws. The boundaries are multiples of `STRIPE_CHUNK_H`
 * hours from the observer's local midnight, so they are whole clock hours
 * (00, 04, 08, …) that do not move as time runs, and they are found through
 * the same `zoneOffsetMs` path `hourTicks` uses, memoised on the zone as that
 * is. The chunk is then clipped to the span: the first starts at `now` and the
 * last ends at `now + 24 h`.
 *
 * Pure, and derived from `t` alone: nothing stores which chunk is drawn, so
 * there is no second thing that could disagree with the shown instant.
 */
export function chunkFor(t: EpochMs, span: Span, timeZone: string | null): Span {
  const at = clampToSpan(t, span);
  const offset = zoneOffsetMs(at, timeZone);
  let start = Math.floor((at + offset) / CHUNK_MS) * CHUNK_MS - offset;
  // `t` at the span's very end sits on a boundary whose chunk is wholly past it; the chunk that holds it is the one before.
  if (start >= span.end) start -= CHUNK_MS;
  return { start: Math.max(span.start, start), end: Math.min(span.end, start + CHUNK_MS) };
}

/**
 * R70 (FR-SPAN-6, D-385): the window the stripe draws — the chunk, or the
 * whole span at a speed that runs an hour of it past in less than
 * `CHUNK_MIN_WALL_S` seconds of wall time (600× and 3600×; 1× and 60× keep the
 * chunk). `speed` is `null` while playback is paused, which is a chunk
 * whatever the speed selected. Arithmetic rather than a list of speeds, so
 * nothing here has to be kept in step with `usePlayback`.
 */
export function drawnSpan(t: EpochMs, span: Span, timeZone: string | null, speed: number | null): Span {
  if (speed !== null && speed > 0 && HOUR_MS / 1000 / speed < CHUNK_MIN_WALL_S) return span;
  return chunkFor(t, span, timeZone);
}

export interface HourTick {
  t: EpochMs;
  x: number;
  /** The hour of the observer's clock, 0–23. */
  hour: number;
  /** R70 (FR-SPAN-7): the minute of that hour — 0 at every tick until the chunk's 30 min cadence. */
  minute: number;
  /** Whether this tick carries a label: every `labelEveryMs` from the observer's midnight. */
  labelled: boolean;
  /** R48 (FR-TRAJ-4): a midnight crossing, whose label is the date rather than `00`. */
  midnight: boolean;
}

/** A cell at the 16 px base (`--cell`, 0.6 em), which is what the stripe's labels are laid out in. */
export const CELL_PX = 9.6;
/**
 * R48 (FR-TRAJ-4): the labelled ticks are every 2 h where the stripe has the
 * room and every 3 h where it has not, counted from midnight. The labels are
 * body-size cells, two characters and a space apart, so twelve of them over a
 * 24 h span want 60 cells; under that they are every third hour, which is the
 * 36-cell phone's 1.5 cells an hour.
 *
 * R61 (D-312): the rule reads the stripe's own measured width, not the shell
 * it is drawn in. Up to R54 the two agreed — a wide page gave the stripe most
 * of its width — but the wide live page now draws it in a rail of 44 to 68
 * cells (F-59), where a shell-wide rule labels every second hour in 51 cells
 * and the numbers overlap. The two answers are the ones the shell rule gave;
 * only what picks between them has changed.
 */
export const LABEL_EVERY_HOURS = { dense: 3, roomy: 2 } as const;
/** The width in cells from which twelve two-character labels fit (FR-TRAJ-4). */
export const STRIPE_LABEL_MIN_CELLS = 60;

export function labelEveryHours(widthCells: number): number {
  return widthCells >= STRIPE_LABEL_MIN_CELLS ? LABEL_EVERY_HOURS.roomy : LABEL_EVERY_HOURS.dense;
}

/** The room a two-character label wants to itself: its two cells, the cell of air `keepLabels` demands, and a cell of margin. */
export const LABEL_MIN_GAP_CELLS = 4;
export const HALF_HOUR_MS = 30 * MINUTE_MS;

/**
 * R70 (FR-TRAJ-4 as amended v1.4, FR-SPAN-7): the same rule for the window
 * actually drawn. Over a chunk the pair is every 30 min and every hour; over
 * the whole span (FR-SPAN-6's fallback) it is `labelEveryHours`'s 2 h and 3 h,
 * untouched. Which pair applies follows the window's own length and not a
 * flag, so a stripe that changes span changes cadence with it.
 *
 * What picks between the chunk's two is the room its own labels want, and not
 * `STRIPE_LABEL_MIN_CELLS`: that 60 cells is twelve labels' worth, and a
 * four-hour chunk carries nine at the half hour, never twelve. FR-SPAN-7
 * writes the test as the same 60 cells and the task asks for the half hours at
 * 360 px — 37.5 cells — which cannot both hold; the room the labels actually
 * want is what is implemented, four cells each (`keepLabels`' no-touch rule
 * with a cell to spare), so a full chunk wants 32 and the 36 cells FR-TRAJ-4
 * guarantees the compact stripe are enough. A stripe narrower than that — the
 * rail, folded — gets the hours.
 */
export function labelEveryMs(spanMs: number, widthCells: number): number {
  if (spanMs > CHUNK_MS) return labelEveryHours(widthCells) * HOUR_MS;
  const gaps = Math.max(1, Math.round(spanMs / HALF_HOUR_MS));
  return widthCells >= gaps * LABEL_MIN_GAP_CELLS ? HALF_HOUR_MS : HOUR_MS;
}

/** One label of row 1: the tick it is centred on and the text drawn there (the hour, or the date at a midnight). */
export interface StripeLabel {
  tick: HourTick;
  text: string;
}

/**
 * FR-TRAJ-4 (R61, D-312): the labels row 1 can show at this width. A label is
 * centred on its tick and `text.length` cells wide, so one near an edge would
 * spill past it — dropped, as it always was — and one whose box reaches its
 * neighbour's would be drawn over it. The second rule is new: the date at a
 * midnight is seven cells against the hours' two, and where the labelled ticks
 * are closer than that the three ran together ("22 12 Sept 02"), which the
 * rail's 44 to 68 cells (F-59) meet at every width the wide page has.
 *
 * The date is placed first and the hours after it, left to right: it carries
 * the day, which no other label repeats, so where the two collide the hour is
 * the one to lose. A cell of air between two labels counts as a collision —
 * touching numbers read as one number.
 */
export function keepLabels(labels: readonly StripeLabel[], width: number): StripeLabel[] {
  const half = (label: StripeLabel): number => (label.text.length * CELL_PX) / 2;
  const inside = labels.filter((label) => label.text !== '' && label.tick.x >= half(label) && label.tick.x <= width - half(label));
  const kept: StripeLabel[] = [];
  for (const label of [...inside.filter((l) => l.tick.midnight), ...inside.filter((l) => !l.tick.midnight)]) {
    if (kept.some((k) => Math.abs(k.tick.x - label.tick.x) < half(k) + half(label) + CELL_PX)) continue;
    kept.push(label);
  }
  return kept.sort((a, b) => a.tick.x - b.tick.x);
}

/**
 * FR-LIVE-4's hour ticks: every whole hour of the observer's clock inside the
 * span, from the first after `start`. The zone offset is read once, at the
 * span's start; a DST change inside the 24 h moves the later ticks by an hour
 * on the clock, which the labels show and the ticks do not.
 */
export function hourTicks(span: Span, width: number, timeZone: string | null, widthCells: number = width / CELL_PX): HourTick[] {
  const offset = zoneOffsetMs(span.start, timeZone);
  const every = labelEveryMs(span.end - span.start, widthCells);
  // The ticks are every hour (FR-TRAJ-4's band), or every labelled instant where the cadence is finer than an hour.
  const step = Math.min(HOUR_MS, every);
  const first = Math.ceil((span.start + offset) / step) * step - offset;
  const ticks: HourTick[] = [];
  for (let t = first; t <= span.end; t += step) {
    const local = t + offset;
    const dayMs = ((local % DAY_MS) + DAY_MS) % DAY_MS;
    ticks.push({
      t,
      x: xAt(t, span, width),
      hour: Math.floor(dayMs / HOUR_MS),
      minute: Math.floor((dayMs % HOUR_MS) / MINUTE_MS),
      labelled: dayMs % every === 0,
      midnight: dayMs === 0,
    });
  }
  return ticks;
}

/**
 * R48 (FR-TRAJ-4), R70 (FR-SPAN-7): a labelled tick's two characters — the
 * hour on the hour, the minutes at the half hour the chunk's cadence adds. The
 * date at a midnight crossing is `midnightDate`'s and is put in by the caller,
 * which is the one that knows the language.
 */
export function tickLabel(tick: HourTick): string {
  return String(tick.minute === 0 ? tick.hour : tick.minute).padStart(2, '0');
}

/**
 * R48 (FR-TRAJ-4): the date at a midnight crossing — the day and the short
 * month in the observer's zone and the page's language, "12 Sep" / "12 sept".
 * Built from the parts so the order is the same in both languages; a trailing
 * period some CLDR month abbreviations carry is dropped, a cell being a cell.
 */
export function midnightDate(t: EpochMs, timeZone: string | null, locale: Locale): string {
  try {
    const parts = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: timeZone ?? 'UTC', day: 'numeric', month: 'short' }).formatToParts(t);
    const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('day')} ${get('month').replace(/\.$/, '')}`.trim();
  } catch {
    return '';
  }
}

/** R48 (FR-TRAJ-4): the short weekday of an instant in the zone, "Sat" / "sáb", for the readout when the instant is not today. */
export function shortWeekday(t: EpochMs, timeZone: string | null, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: timeZone ?? 'UTC', weekday: 'short' }).format(t).replace(/\.$/, '');
  } catch {
    return '';
  }
}

/** R48 (FR-TRAJ-5): a rise within this many milliseconds of `t` counts as reached, so the next tap moves on to the one after. */
export const RISE_SLACK_MS = 1000;

/**
 * FR-TRAJ-5's rise buttons: the first rise after `t` (or the last before it)
 * among the passes whose rise is inside the span — a pass already under way at
 * real time rose before the stripe starts and has no rise to land on. `null`
 * when there is none, which is the button's disabled state.
 */
export function nextRise(passes: readonly Pick<Pass, 'start'>[], t: EpochMs, span: Span): EpochMs | null {
  let best: EpochMs | null = null;
  for (const pass of passes) {
    const rise = pass.start.t;
    if (rise <= t + RISE_SLACK_MS || rise < span.start || rise > span.end) continue;
    if (best === null || rise < best) best = rise;
  }
  return best;
}

export function previousRise(passes: readonly Pick<Pass, 'start'>[], t: EpochMs, span: Span): EpochMs | null {
  let best: EpochMs | null = null;
  for (const pass of passes) {
    const rise = pass.start.t;
    if (rise >= t - RISE_SLACK_MS || rise < span.start || rise > span.end) continue;
    if (best === null || rise > best) best = rise;
  }
  return best;
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
  /** The pass's own interval, unclipped: what `isCurrent` asks the shown instant about. */
  start: EpochMs;
  end: EpochMs;
}

/** Whether the shown instant is inside this pass (the arc carrying a live marker). */
export function isCurrent(segment: PassSegment, t: EpochMs): boolean {
  return segment.start <= t && t <= segment.end;
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
 *
 * R39 (F-38): the shown instant is not an argument. It moves every frame while
 * playback runs, and the lanes and the pixels do not move with it, so the
 * component memoises this on `(passes, span, width)` and asks `isCurrent`
 * about each segment as it draws.
 */
export function passSegments(passes: readonly Pass[], span: Span, width: number): PassSegment[] {
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
      start: pass.start.t,
      end: pass.end.t,
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

/**
 * R54 (FR-LIVE-7 as amended v1.1.1, D-270) put the stripe on the playback
 * row's line from a page width of 164 cells. R61 (D-312) takes the whole fold
 * back: on wide the rows under the box are a rail beside it (F-59), where the
 * stripe has a line of its own at every width and the page's width says
 * nothing about how much of it the stripe gets. `STRIPE_LABEL_MIN_CELLS`
 * above is the part of that derivation that outlives it — the 60 cells
 * FR-TRAJ-4's twelve labels want — and it is now measured on the stripe.
 */
