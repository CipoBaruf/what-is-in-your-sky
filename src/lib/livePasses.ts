import type { EpochMs, Pass } from '../model';

/**
 * FR-LIVE-2, FR-SKY-6, FR-TRAJ-1: the passes a sky of tonight carries — the
 * live page's chart and, with `[ passes ]` on, the stars page's (R126). One
 * module so the two pages cannot drift apart; it lives in `src/lib` so the
 * `stars` chunk takes it without the live page's.
 */

/** FR-LIVE-2: the span of passes drawn, from now. */
export const LIVE_WINDOW_MS = 24 * 3_600_000;

/** The passes drawn: every one with `start ≤ now + 24 h` and `end ≥ now`, in the list's own (start) order, which is the series order (FR-LIVE-2). */
export function livePasses(passes: readonly Pass[], now: EpochMs): Pass[] {
  const until = now + LIVE_WINDOW_MS;
  return passes.filter((pass) => pass.start.t <= until && pass.end.t >= now);
}
