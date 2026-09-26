import type { EpochMs, Pass } from '../model';

/**
 * R76 (FR-FIRST-3, FR-WATCH-2, D-442): the next thing to look up for. Of the
 * passes the page already holds, the one whose next event — its rise, its
 * peak or its end, whichever is still ahead — comes soonest after `t`, and
 * which of the three that is. The home page's next-event block and the live
 * page's watching headline both read this, so the two can never word the
 * same fact differently.
 *
 * Pure: `t` is a parameter and never the wall clock (D-15, PLAN §9.3), and
 * nothing here asks the worker for anything — the passes are the stored run's
 * on the home page and FR-LIVE-11's set on the live page.
 *
 * A pass that starts at its own peak (it leaves Earth's shadow already at its
 * highest, `start.t === peak.t`) has no peak left to count to once it has
 * risen, so its next event after the rise is its end.
 */
export type NextEventKind = 'rise' | 'peak' | 'end';

export interface NextEvent {
  pass: Pass;
  kind: NextEventKind;
  /** When the event happens, epoch ms. */
  at: EpochMs;
  /** Where to look at that instant, degrees clockwise from north. */
  azimuth: number;
}

/**
 * Why there is nothing to count down to (FR-FIRST-3's one line, with FR-LIVE-1's
 * reasons where they apply): no elements to compute from, no darkness in the
 * window, or simply no visible pass left in it.
 */
export type NoEventReason = 'no-passes' | 'no-darkness' | 'no-elements';

export interface NoEvent {
  reason: NoEventReason;
}

/**
 * What the page knows beyond the passes, for the reason alone. Left out, the
 * reason is `no-passes`: the passes are what `nextEvent` is about, and these two
 * only say why there are none.
 */
export interface NextEventContext {
  /** The run's `hasDarkness` (FR-VIS-6): `false` when the sun never got low enough in the window. */
  hasDarkness?: boolean | null;
  /** How many objects have elements; `0` means there was nothing to compute from. */
  elementCount?: number | null;
}

/** The event still ahead of `t` for one pass, or null once the pass has ended. */
function eventOf(pass: Pass, t: EpochMs): NextEvent | null {
  if (t < pass.start.t) return { pass, kind: 'rise', at: pass.start.t, azimuth: pass.start.azDeg };
  if (t < pass.peak.t) return { pass, kind: 'peak', at: pass.peak.t, azimuth: pass.peak.azDeg };
  if (t < pass.end.t) return { pass, kind: 'end', at: pass.end.t, azimuth: pass.end.azDeg };
  return null;
}

export function nextEvent(passes: readonly Pass[], t: EpochMs, context: NextEventContext = {}): NextEvent | NoEvent {
  let best: NextEvent | null = null;
  for (const pass of passes) {
    const event = eventOf(pass, t);
    // Ties go to the pass that rose first, then to the list's own order.
    if (event && (best === null || event.at < best.at || (event.at === best.at && pass.start.t < best.pass.start.t))) best = event;
  }
  if (best) return best;
  if (context.elementCount === 0) return { reason: 'no-elements' };
  if (context.hasDarkness === false) return { reason: 'no-darkness' };
  return { reason: 'no-passes' };
}

export function isNoEvent(result: NextEvent | NoEvent): result is NoEvent {
  return 'reason' in result;
}
