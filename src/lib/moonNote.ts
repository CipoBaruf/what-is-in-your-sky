import type { EpochMs, MoonState } from '../model';

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, D-513): the phone's **when** step closes
 * its sky box with one sentence about the Moon — "A bright moon washes out the
 * faint ones. Tonight it will." or "… Tonight it will not." — and this is the
 * rule that picks it: the Moon *will* wash them out when, at some instant
 * inside tonight's dark window, it is above the horizon and at least
 * `MOON_BRIGHT_PCT` lit. The percentage is the one the row beside it shows
 * (whole percent, as `moonFacts` rounds it), so "50 %" never sits beside "it
 * will not".
 *
 * Pure and clock-free (D-15): the Moon arrives as samples the caller took
 * across the window (`moonSampleTimes`), because the Moon's position is the
 * astronomy chunk's (`lib/skyBodies.ts`), which the page loads on demand.
 */
export const MOON_BRIGHT_PCT = 50;

/** A Moon sample every quarter hour: it rises or sets a degree in four minutes, so a window's edge is missed by a few degrees at most. */
export const MOON_NOTE_STEP_MS = 15 * 60_000;

export type MoonNote = 'bright' | 'dim';

/** The rule: up and at least `MOON_BRIGHT_PCT` lit at any sampled instant of the window. */
export function moonNote(samples: readonly Pick<MoonState, 'elDeg' | 'illuminatedFraction'>[]): MoonNote {
  return samples.some((moon) => moon.elDeg > 0 && Math.round(moon.illuminatedFraction * 100) >= MOON_BRIGHT_PCT) ? 'bright' : 'dim';
}

/** The instants to sample the window at: its start, every `stepMs`, and its end. */
export function moonSampleTimes(window: { start: EpochMs; end: EpochMs }, stepMs: number = MOON_NOTE_STEP_MS): EpochMs[] {
  if (window.end <= window.start) return [window.start];
  const times: EpochMs[] = [];
  for (let t = window.start; t < window.end; t += stepMs) times.push(t);
  times.push(window.end);
  return times;
}
