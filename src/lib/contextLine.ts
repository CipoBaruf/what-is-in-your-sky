import type { CloudState, EpochMs, Pass, PassBoundaryReason, SkyState } from '../model';
import { compassPoint, type CompassPoint } from './compass';
import { isTonight, type Interval } from './shownTime';
import type { Span } from './timeStripe';

/**
 * R143 (FR-TONIGHT-7, D-903): the compact live page's one context line under the shown time, as parts the catalog
 * words. Pure: `t` is a parameter (D-15), and the passes are the visible ones — the caller has already
 * left out what FR-LIVE-6's saved state hides, as D-897's targets do.
 *
 * - **up** — a visible pass is up at `t` (`start ≤ t ≤ end`): its name and what it does next, where and in how
 *   long, "Tiangong · peaks SE 0:40"; past its peak, its end by the end's reason ("sets", "into shadow", "fades").
 *   Two passes up at once: the one that rose first, as `nextEvent` breaks its ties.
 * - **none** — FR-TONIGHT-4's "No visible pass tonight" when `t` is inside tonight's night band and no visible pass
 *   is in what is left of it; otherwise FR-TONIGHT-1's "No visible pass in 24 h" when no visible pass touches the
 *   span, or none is left after `t` (a `t` past the span's last pass, D-912).
 * - **sky** — otherwise the sky state, the cloud word and the next visible pass's rise after `t`, "Dark · Clear ·
 *   next 21:47". The time needs no weekday: the span is 24 h, so the next 02:30 in it is the only one.
 */
export type UpEvent = 'peak' | PassBoundaryReason;

export type ContextParts =
  | { kind: 'up'; name: string; event: UpEvent; point: CompassPoint; inMs: number }
  | { kind: 'none'; reason: NoPassReason }
  | { kind: 'sky'; sky: SkyState | null; cloud: CloudState; nextAt: EpochMs };

type NoPassReason = 'span' | 'tonight';

export interface ContextInput {
  /** The visible passes of the stored run. */
  passes: readonly Pass[];
  t: EpochMs;
  /** FR-LIVE-2's 24 h span. */
  span: Span;
  /**
   * Tonight's night band, `tonightBand(bands, now)` over the bands `useSkyBands` gives the stripe (D-170): the page
   * works it out once per tick for this line and the chip, not on every frame of playback.
   */
  night: Interval | null;
  /** The sky state at `t`; `null` until the astronomy chunk has evaluated the Sun. */
  sky: SkyState | null;
  cloud: CloudState;
}

export function contextLine({ passes, t, span, night, sky, cloud }: ContextInput): ContextParts {
  const up = passes
    .filter((pass) => pass.start.t <= t && t <= pass.end.t)
    .sort((a, b) => a.start.t - b.start.t)
    .at(0);
  if (up) {
    const beforePeak = t < up.peak.t;
    const at = beforePeak ? up.peak : up.end;
    return { kind: 'up', name: up.name, event: beforePeak ? 'peak' : up.endReason, point: compassPoint(at.azDeg), inMs: Math.max(0, at.t - t) };
  }
  if (!passes.some((pass) => pass.end.t >= span.start && pass.start.t <= span.end)) return { kind: 'none', reason: 'span' };
  // Only what is still ahead of `t` counts: a pass that ended before it is neither next nor tonight's.
  const ahead = passes.filter((pass) => pass.end.t >= t && pass.start.t <= span.end);
  if (night !== null && isTonight(t, night) && !ahead.some((pass) => pass.start.t < night.to)) return { kind: 'none', reason: 'tonight' };
  const next = ahead.reduce<EpochMs | null>((best, pass) => (best === null || pass.start.t < best ? pass.start.t : best), null);
  return next === null ? { kind: 'none', reason: 'span' } : { kind: 'sky', sky, cloud, nextAt: next };
}
