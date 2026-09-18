import type { EpochMs, Pass, SkyState } from '../model';
import { DAY_MS, HOUR_MS, MINUTE_MS, zoneOffsetMs, type SkyBand, type Span } from './timeStripe';

/**
 * R81 (FR-FIRST-8, D-506): tonight's stripe — the night as three lines of text
 * at the head of the When reading. The hour labels every
 * `TONIGHT_STRIPE_LABEL_STEP_H` in the observer's zone, the band as 30
 * characters of 24 min each (`▓` day, `▒` bright twilight, `█` dark), and a
 * `▲` under the character holding each listed pass's peak.
 *
 * The bands are the ones the live page's stripe shades with (FR-LIVE-4,
 * `useSkyBands`) and the conditions table's `Dark` row reads (D-470), so the
 * three can never disagree about when it is dark. Pure and clock-free (D-15):
 * `now` is a parameter, and the zone's offset is read through
 * `timeStripe.zoneOffsetMs`, the path every other stripe label takes.
 */
export const TONIGHT_STRIPE_HOURS = 12;
export const TONIGHT_STRIPE_LABEL_STEP_H = 2;
/** One character to 24 min: 12 h is 30 characters, and a 2 h label step is five of them. */
export const TONIGHT_STRIPE_CELL_MS = 24 * MINUTE_MS;
export const TONIGHT_STRIPE_CELLS = (TONIGHT_STRIPE_HOURS * HOUR_MS) / TONIGHT_STRIPE_CELL_MS;

/** The character each sky is drawn with (FR-FIRST-8). */
export const STRIPE_CHARS: Readonly<Record<SkyState, string>> = { day: '▓', 'bright-twilight': '▒', dark: '█' };
export const STRIPE_TICK = '▲';

/** The first dark band still open at `now`, or the next one to open; null when the bands hold none (D-470). */
export function tonightsDark(bands: readonly SkyBand[], now: EpochMs): SkyBand | null {
  return bands.find((band) => band.sky === 'dark' && band.to > now) ?? null;
}

/**
 * Local solar midnight — UTC midnight less the longitude at 4 min a degree —
 * the first one after `now` (OQ-33): the middle of the night at any latitude,
 * dark band or not.
 */
export function solarMidnight(lonDeg: number, now: EpochMs): EpochMs {
  const shift = -lonDeg * 4 * MINUTE_MS;
  let t = Math.floor(now / DAY_MS) * DAY_MS + shift;
  while (t <= now) t += DAY_MS;
  while (t - DAY_MS > now) t -= DAY_MS;
  return t;
}

/** `t` rounded to the nearest whole hour of `timeZone`'s clock (a half-hour zone's hours are not UTC's). */
function roundToLocalHour(t: EpochMs, timeZone: string | null): EpochMs {
  const offset = zoneOffsetMs(t, timeZone);
  return Math.round((t + offset) / HOUR_MS) * HOUR_MS - offset;
}

/**
 * The stripe's 12 h: centred on the middle of tonight's dark band and rounded
 * to the hour, or on local solar midnight where there is no dark band (OQ-33).
 */
export function tonightSpan(bands: readonly SkyBand[], observer: { lon: number; timeZone: string | null }, now: EpochMs): Span {
  const dark = tonightsDark(bands, now);
  const middle = dark ? (dark.from + dark.to) / 2 : solarMidnight(observer.lon, now);
  const centre = roundToLocalHour(middle, observer.timeZone);
  const half = (TONIGHT_STRIPE_HOURS * HOUR_MS) / 2;
  return { start: centre - half, end: centre + half };
}

export interface StripeCell {
  char: string;
  /** The band holding the cell's middle; null where the bands do not reach (drawn as a space). */
  sky: SkyState | null;
}

export interface TonightStripe {
  /** `18   20   22   00   02   04   06`: zero-padded hours, one every `TONIGHT_STRIPE_LABEL_STEP_H`, five characters apart. */
  labels: string;
  cells: StripeCell[];
  /** The cells holding a pass's peak, ascending and each once. */
  ticks: number[];
}

/** The hour of `t` on `timeZone`'s clock, two digits. */
function hourLabel(t: EpochMs, timeZone: string | null): string {
  const local = t + zoneOffsetMs(t, timeZone);
  const hour = Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS);
  return String(hour).padStart(2, '0');
}

export function tonightStripe(bands: readonly SkyBand[], passes: readonly Pass[], span: Span, timeZone: string | null): TonightStripe {
  const labels: string[] = [];
  for (let h = 0; h <= TONIGHT_STRIPE_HOURS; h += TONIGHT_STRIPE_LABEL_STEP_H) labels.push(hourLabel(span.start + h * HOUR_MS, timeZone));
  const cells: StripeCell[] = [];
  for (let i = 0; i < TONIGHT_STRIPE_CELLS; i++) {
    const middle = span.start + (i + 0.5) * TONIGHT_STRIPE_CELL_MS;
    const sky = bands.find((band) => band.from <= middle && middle < band.to)?.sky ?? null;
    cells.push({ char: sky === null ? ' ' : STRIPE_CHARS[sky], sky });
  }
  const ticks = new Set<number>();
  for (const pass of passes) {
    if (pass.peak.t < span.start || pass.peak.t >= span.end) continue;
    ticks.add(Math.floor((pass.peak.t - span.start) / TONIGHT_STRIPE_CELL_MS));
  }
  // Two spaces between labels of two digits: the label step is five cells (FR-FIRST-8).
  const gap = ' '.repeat((TONIGHT_STRIPE_LABEL_STEP_H * HOUR_MS) / TONIGHT_STRIPE_CELL_MS - 2);
  return { labels: labels.join(gap), cells, ticks: [...ticks].sort((a, b) => a - b) };
}

/** The tick line: `▲` under each tick cell, spaces elsewhere, as long as the band. */
export function tickLine(ticks: readonly number[]): string {
  const line = Array.from({ length: TONIGHT_STRIPE_CELLS }, () => ' ');
  for (const cell of ticks) line[cell] = STRIPE_TICK;
  return line.join('');
}
