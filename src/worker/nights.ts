import type { EpochMs, TimeWindow } from '../model';

/**
 * The 72 h search window cut into nights (PLAN D-77). The handler loops nights
 * on the outside and objects on the inside, so tonight is complete in the MVP's
 * time and the other two nights stream in behind it; `nightIndex` is what
 * FR-OFF-2's grouping uses.
 *
 * Pure and window-driven: the request still carries one `window`, so an MVP
 * caller's 24 h window yields exactly one night and one `passes` message per
 * object, as before.
 */

/** One night is a calendar-free 24 h slice of the request window; three of them make FR-VIS-1's amended window. */
export const NIGHT_MS = 24 * 3_600_000;

/**
 * How far a night's search reaches past its own bounds so a pass straddling a
 * boundary is found whole by the night that claims it. No LEO pass spends this
 * long above 10° (the same reasoning as `now.ts`'s MAX_LOOKAHEAD_MS), and the
 * value is a whole number of coarse steps, so the widened search samples the
 * same 30 s grid a single search over the full window would.
 */
export const MAX_PASS_SPAN_MS = 30 * 60_000;

export interface Night {
  /** 0, 1, 2 — the `nightIndex` of the `passes` messages this night emits. */
  index: number;
  /** The night itself: a pass belongs to it when its `start.t` falls in `[startMs, endMs)`. */
  startMs: EpochMs;
  endMs: EpochMs;
  /** True for the night that ends at the request window's end; it claims everything from `startMs` on. */
  isLast: boolean;
  /** What `findPasses` is given: the night widened by `MAX_PASS_SPAN_MS` on each side, clamped to the request window. */
  search: TimeWindow;
}

/**
 * Cut `window` into 24 h nights, always at least one (a zero-length window
 * still produces the single empty night an MVP caller would have seen).
 */
export function splitIntoNights(window: TimeWindow): Night[] {
  const count = Math.max(1, Math.ceil((window.endMs - window.startMs) / NIGHT_MS));
  const nights: Night[] = [];
  for (let index = 0; index < count; index++) {
    const startMs = window.startMs + index * NIGHT_MS;
    const endMs = Math.min(startMs + NIGHT_MS, window.endMs);
    nights.push({
      index,
      startMs,
      endMs,
      isLast: index === count - 1,
      search: {
        startMs: Math.max(window.startMs, startMs - MAX_PASS_SPAN_MS),
        endMs: Math.min(window.endMs, endMs + MAX_PASS_SPAN_MS),
      },
    });
  }
  return nights;
}

/**
 * Which night owns a pass, so the overlap cannot emit one twice: the night
 * whose `[startMs, endMs)` contains the pass's start. The last night keeps
 * everything from its start on, so a pass beginning in the window's final
 * seconds — truncated at `window.endMs` exactly as the MVP truncated it — is
 * not dropped.
 */
export function claimsPass(night: Night, passStartMs: EpochMs): boolean {
  return passStartMs >= night.startMs && (night.isLast || passStartMs < night.endMs);
}
