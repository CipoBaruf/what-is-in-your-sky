import type { EpochMs } from '../model';
import { LIVE_WINDOW_MS } from './livePasses';
import { passUp, type PassTimes } from './playback';
import { TONIGHT_LEAD_MS } from './tonightJump';

/**
 * R213 (FR-STRIP-1..3, D-1232): what the next-pass strip says at the shown instant. `passes` are the visible ones;
 * the span is FR-LIVE-2's, from real time, so a scrub never brings in a pass the page does not draw.
 */
export type NextPassStrip<P extends PassTimes = PassTimes> = { kind: 'next' | 'up'; pass: P } | { kind: 'none' };

export function nextPassStrip<P extends PassTimes>({ passes, shownMs, nowMs }: { passes: readonly P[]; shownMs: EpochMs; nowMs: EpochMs }): NextPassStrip<P> {
  let up: P | null = null;
  let next: P | null = null;
  for (const pass of passes) {
    const start = pass.start.t;
    if (passUp(pass, shownMs)) {
      if (up === null || start < up.start.t) up = pass;
    } else if (start > shownMs && start <= nowMs + LIVE_WINDOW_MS) {
      if (next === null || start < next.start.t) next = pass;
    }
  }
  if (up !== null) return { kind: 'up', pass: up };
  return next === null ? { kind: 'none' } : { kind: 'next', pass: next };
}

/** FR-STRIP-2: where `▶ watch` lands; the playback clamps it to the span, so never before now. */
export function watchInstant(pass: PassTimes): EpochMs {
  return pass.start.t - TONIGHT_LEAD_MS;
}
