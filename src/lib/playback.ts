import type { EpochMs } from '../model';

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
