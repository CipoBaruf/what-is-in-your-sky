import type { EpochMs } from '../model';
// D-896 keeps FR-TONIGHT-5's thresholds in `physics/constants.ts` beside FR-TRAJ-2's, read here as `arcReveal.ts` reads those.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
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

/**
 * R141 (FR-TONIGHT-5, D-899): the rate at `t`. `AUTO_SPEED_NEAR` while a
 * visible pass is up (`start ≤ t ≤ end`) or one rises within `AUTO_NEAR_MIN`
 * after `t` (inclusive: a rise exactly five minutes ahead is near), the gap
 * speed otherwise. `passes` are the visible ones (D-897): the caller's list.
 */
export function autoSpeed(t: EpochMs, passes: readonly PassTimes[]): AutoSpeed {
  for (const pass of passes) {
    if (pass.start.t <= t && t <= pass.end.t) return AUTO_SPEED_NEAR;
    if (pass.start.t > t && pass.start.t - t <= NEAR_MS) return AUTO_SPEED_NEAR;
  }
  return AUTO_SPEED_GAP;
}

/** The first instant after `t` where the rate drops to `AUTO_SPEED_NEAR`: the earliest `rise − AUTO_NEAR_MIN` past `t`, or `null`. */
export function slowDownAfter(t: EpochMs, passes: readonly Pick<PassTimes, 'start'>[]): EpochMs | null {
  let best: EpochMs | null = null;
  for (const pass of passes) {
    const boundary = pass.start.t - NEAR_MS;
    if (boundary > t && (best === null || boundary < best)) best = boundary;
  }
  return best;
}

export interface AutoAdvance extends Advance {
  /** The rate the frame ended at, for the readout. */
  speed: AutoSpeed;
}

/**
 * R141 (FR-TONIGHT-5, D-899): one frame at the automatic speed. The rate is
 * read at the frame's start; a frame at the gap speed that would cross a
 * slow-down boundary is split there — the wall time to reach it at 600×, the
 * rest at 60× — so no rise is passed at 600× however long the frame. Each
 * piece is `advance`, whose contract is unchanged.
 */
export function advanceAuto(t: EpochMs, wallDeltaMs: number, passes: readonly PassTimes[], end: EpochMs): AutoAdvance {
  let wall = Number.isFinite(wallDeltaMs) && wallDeltaMs > 0 ? wallDeltaMs : 0;
  let at = t;
  let speed = autoSpeed(at, passes);
  if (speed === AUTO_SPEED_GAP) {
    const boundary = slowDownAfter(at, passes);
    if (boundary !== null && boundary < end && at + wall * speed > boundary) {
      wall -= (boundary - at) / speed;
      at = boundary;
      speed = autoSpeed(at, passes);
    }
  }
  return { ...advance(at, wall, speed, end), speed };
}

/** The nights of a run of bands: each stretch of consecutive non-`day` bands (twilight, dark, twilight) as one interval (D-897). */
export function nightRuns(bands: readonly SkyBand[]): { from: EpochMs; to: EpochMs }[] {
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
 * R141 (FR-TONIGHT-5, D-899): where playback started at `t` stops — the end
 * of the night holding `t`, or of the next night when `t` is in the day.
 * `Infinity` when the bands hold no such night (not loaded yet, a polar
 * summer): the span's end, which the caller takes the minimum with, wins.
 */
export function nightEnd(bands: readonly SkyBand[], t: EpochMs): EpochMs {
  for (const run of nightRuns(bands)) if (run.to > t) return run.to;
  return Number.POSITIVE_INFINITY;
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
