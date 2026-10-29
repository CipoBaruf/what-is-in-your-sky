import type { EpochMs } from '../model';
// D-896 keeps FR-TONIGHT-5's thresholds in `physics/constants.ts` beside FR-TRAJ-2's (`eslint.config.js` allows this one import, D-907).
import { AUTO_NEAR_MIN, AUTO_SPEED_GAP, AUTO_SPEED_NEAR } from '../physics/constants';
import type { SkyBand } from './timeStripe';

/**
 * R33 (FR-LIVE-5, D-81): playback arithmetic, pure and clock-free (D-15).
 * The live page runs a `requestAnimationFrame` loop and, on each frame, moves
 * the shown instant by the wall time since the previous frame times the
 * speed. A dropped frame therefore loses no simulated time: the next frame's
 * delta is simply longer. At 3600× the whole 24 h span runs in 24 s, and the
 * instant stops at the span's end.
 */
export const SPEEDS = [1, 60, 600, 3600] as const;
export type Speed = (typeof SPEEDS)[number];
export const DEFAULT_SPEED: Speed = 60;

export function isSpeed(value: number): value is Speed {
  return (SPEEDS as readonly number[]).includes(value);
}

export interface Advance {
  t: EpochMs;
  /** True once the instant has reached the end of the span: playback stops there (FR-LIVE-5). */
  atEnd: boolean;
}

/**
 * The instant one frame later: `t + wallDeltaMs × speed`, clamped to `end`.
 * A negative or non-finite delta (a clock that went backwards, a first frame
 * with no previous one) moves nothing.
 */
export function advance(t: EpochMs, wallDeltaMs: number, speed: Speed, end: EpochMs): Advance {
  const delta = Number.isFinite(wallDeltaMs) && wallDeltaMs > 0 ? wallDeltaMs : 0;
  const next = Math.min(end, t + delta * speed);
  return { t: next, atEnd: next >= end };
}

/** FR-TONIGHT-5: the two rates the compact page's playback runs at. */
export type AutoSpeed = typeof AUTO_SPEED_NEAR | typeof AUTO_SPEED_GAP;

const NEAR_MS = AUTO_NEAR_MIN * 60_000;

/** A pass as the rate and the targets read it: its rise and its set (a `Pass` is one). */
export interface PassTimes {
  start: { t: EpochMs };
  end: { t: EpochMs };
}

/** A visible pass is up at `t`: `start ≤ t ≤ end`, both edges included. The jump's "stay on real time" and the near rate's first case (FR-TONIGHT-1, FR-TONIGHT-5). */
export function passUp(pass: PassTimes, t: EpochMs): boolean {
  return pass.start.t <= t && t <= pass.end.t;
}

/**
 * R141 (FR-TONIGHT-5, D-899): the rate at `t`. `AUTO_SPEED_NEAR` while a
 * visible pass is up (`passUp`) or one rises within `AUTO_NEAR_MIN`
 * after `t` (inclusive: a rise exactly five minutes ahead is near), the gap
 * speed otherwise. `passes` are the visible ones (D-897): the caller's list.
 */
export function autoSpeed(t: EpochMs, passes: readonly PassTimes[]): AutoSpeed {
  for (const pass of passes) {
    if (passUp(pass, t)) return AUTO_SPEED_NEAR;
    if (pass.start.t > t && pass.start.t - t <= NEAR_MS) return AUTO_SPEED_NEAR;
  }
  return AUTO_SPEED_GAP;
}

/** The rate at `from` and the instant it holds until: the rate is the same for every instant in `[from, until)`. */
export interface RateSpan {
  speed: AutoSpeed;
  from: EpochMs;
  until: EpochMs;
}

/**
 * R141's review (D-908): the rate at `t` and the first instant it may change
 * at — the nearest `rise − AUTO_NEAR_MIN` after `t` or set at or after it
 * (a set is near up to its own instant, so the span stops there and the next
 * read, just past it, finds the gap). At the gap speed the nearest edge is
 * always a slow-down boundary: a pass whose set is ahead and that is not near
 * has its boundary ahead too, and before its set. `Infinity` when nothing
 * changes again.
 */
export function rateSpan(t: EpochMs, passes: readonly PassTimes[]): RateSpan {
  let until = Number.POSITIVE_INFINITY;
  for (const pass of passes) {
    const boundary = pass.start.t - NEAR_MS;
    if (boundary > t && boundary < until) until = boundary;
    if (pass.end.t >= t && pass.end.t < until) until = pass.end.t;
  }
  return { speed: autoSpeed(t, passes), from: t, until };
}

/** A frame loop's rate reader: `rateSpan` again only once `t` leaves the span the last answer holds for. */
export type AutoRates = (t: EpochMs) => RateSpan;

/** The reader over one list of passes; a new list is a new reader. */
export function autoRates(passes: readonly PassTimes[]): AutoRates {
  let last: RateSpan | null = null;
  return (t) => {
    if (last === null || t < last.from || t >= last.until) last = rateSpan(t, passes);
    return last;
  };
}

export interface AutoAdvance extends Advance {
  /** The rate the frame ended at, for the readout. */
  speed: AutoSpeed;
}

/**
 * R141 (FR-TONIGHT-5, D-899): one frame at the automatic speed. The rate is
 * read at the frame's start; a frame at the gap speed that would cross a
 * slow-down boundary (the rate span's end, at the gap speed) is split there —
 * the wall time to reach it at 600×, the rest at 60× — so no rise is passed at
 * 600× however long the frame. Each piece is `advance`, whose contract is
 * unchanged. `rates` is `autoRates(passes)`, kept across frames so the passes
 * are scanned only when `t` crosses an edge.
 */
export function advanceAuto(t: EpochMs, wallDeltaMs: number, rates: AutoRates, end: EpochMs): AutoAdvance {
  let wall = Number.isFinite(wallDeltaMs) && wallDeltaMs > 0 ? wallDeltaMs : 0;
  let at = t;
  const first = rates(at);
  let speed = first.speed;
  if (speed === AUTO_SPEED_GAP && first.until < end && at + wall * speed > first.until) {
    wall -= (first.until - at) / speed;
    at = first.until;
    speed = rates(at).speed;
  }
  return { ...advance(at, wall, speed, end), speed };
}

/** The nights of a run of bands: each stretch of consecutive non-`day` bands (twilight, dark, twilight) as one interval (D-897). */
function nightRuns(bands: readonly SkyBand[]): { from: EpochMs; to: EpochMs }[] {
  const runs: { from: EpochMs; to: EpochMs }[] = [];
  for (const band of bands) {
    if (band.sky === 'day') continue;
    const last = runs[runs.length - 1];
    if (last && last.to >= band.from) last.to = Math.max(last.to, band.to);
    else runs.push({ from: band.from, to: band.to });
  }
  return runs;
}

/**
 * The night holding `t`, or the next one when `t` is in the day; `null` when
 * the bands hold none. A night's last instant is the day's, so the night that
 * ends at `t` is over — unless `endIncluded`, where it is that night's own
 * (where playback stopped, D-908). `tonightTarget` and `nightEnd` both read it.
 */
export function nightAt(bands: readonly SkyBand[], t: EpochMs, endIncluded = false): { from: EpochMs; to: EpochMs } | null {
  return nightRuns(bands).find((run) => (endIncluded ? run.to >= t : run.to > t)) ?? null;
}

/**
 * R141 (FR-TONIGHT-5, D-899): where playback started at `t` stops — the end
 * of the night holding `t`, or of the next night when `t` is in the day.
 * A start at a night's end is that night's (D-908): playback stopped there,
 * and `play` from the stop goes nowhere rather than on through the day.
 * `Infinity` when the bands hold no such night (not loaded yet, a polar
 * summer): the span's end, which the caller takes the minimum with, wins.
 */
export function nightEnd(bands: readonly SkyBand[], t: EpochMs): EpochMs {
  return nightAt(bands, t, true)?.to ?? Number.POSITIVE_INFINITY;
}

/**
 * FR-LIVE-5: the Sun and the Moon are evaluated at most once per second of
 * wall time whatever the speed; FR-LIVE-6: the hidden-objects request goes
 * out at most once per 250 ms of wall time. Both are this one rule: given
 * the wall time of the last evaluation, is it time for another?
 */
export function due(lastWallMs: number | null, nowWallMs: number, everyMs: number): boolean {
  return lastWallMs === null || nowWallMs - lastWallMs >= everyMs;
}

/** FR-LIVE-5: the bodies' wall-time budget. */
export const BODIES_EVERY_MS = 1_000;
/** FR-LIVE-6: the hidden-objects request's wall-time budget. */
export const HIDDEN_EVERY_MS = 250;
/** PLAN §8.8: the hash is written at most twice a second while scrubbing. */
export const HASH_EVERY_MS = 500;

/** R77 (FR-WATCH-2): a held instant's offset from real time, in whole minutes, as the headline reads it. */
export interface HeldOffset {
  sign: '+' | '−';
  hours: number;
  minutes: number;
}

/**
 * R77 (FR-WATCH-2): `21:47 · +33 min` — how far the held instant is from real
 * time, rounded to the minute, the hours split off past sixty minutes. Zero is
 * `+0 min`, never `−0`: the instant a `[ scrub ]` holds is the one real time was
 * showing.
 */
export function heldOffset(t: EpochMs, now: EpochMs): HeldOffset {
  const total = Math.round((t - now) / 60_000);
  const magnitude = Math.abs(total);
  return { sign: total < 0 ? '−' : '+', hours: Math.floor(magnitude / 60), minutes: magnitude % 60 };
}

/**
 * R143 (FR-WATCH-2, FR-TONIGHT-7): an offset's size as both catalogs write it — `12 min`, `6 h 12 min`, `6 h 05 min`,
 * the hours split off past sixty. Locale-neutral, `h` and `min` being the same in English and Spanish, so the held
 * readout and the chip share it. `lessThanOne` writes a zero as `<1 min` (the chip, D-911); the held readout keeps
 * `+0 min`.
 */
export function offsetSpan({ hours, minutes }: Pick<HeldOffset, 'hours' | 'minutes'>, lessThanOne = false): string {
  if (hours === 0) return minutes === 0 && lessThanOne ? '<1 min' : `${String(minutes)} min`;
  return `${String(hours)} h ${String(minutes).padStart(2, '0')} min`;
}

/**
 * R89 (FR-VISIT-3): the instant a live link opens on. A `t` behind the clock
 * is a moment that has passed, so the page opens at real time — watching, not
 * held — and says so (`null`); a `t` beyond the stripe's span is held at the
 * span's end, the latest the page can show; anything between is held as the
 * link says. The note is `openLink()`'s; this is only where the page stands.
 */
export function linkInstant(t: EpochMs | null, now: EpochMs, spanMs: number): EpochMs | null {
  if (t === null || t < now) return null;
  return Math.min(t, now + spanMs);
}
