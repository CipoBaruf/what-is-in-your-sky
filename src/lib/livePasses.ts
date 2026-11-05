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

/**
 * v2.14.1 (FR-CLEAN-14 as amended, D-1134): the pass the header's `[ satellites ]` opens — the one up at `now`
 * (`arcState === 'live'`: its rise at or before `now`, its set at or after it), else the first of the span's passes
 * with a rise after `now`; `null` when the span (`livePasses`) holds none.
 */
export function firstPassFor(passes: readonly Pass[], now: EpochMs): Pass | null {
  const span = livePasses(passes, now);
  const up = span.find((pass) => pass.start.t <= now && pass.end.t >= now);
  if (up) return up;
  let next: Pass | null = null;
  for (const pass of span) if (pass.start.t > now && (next === null || pass.start.t < next.start.t)) next = pass;
  return next;
}
