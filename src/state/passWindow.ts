import type { EpochMs, TimeWindow } from '../model';

/**
 * The pass list window is 24 h from "now" (FR-VIS-1's MVP minimum, PLAN
 * D-20). Moved here from `ui/components/passes/passSearch.ts` in R5: the
 * effect builds the window when the observer changes; the UI only reads the
 * number for its status text.
 */
export const SEARCH_WINDOW_HOURS = 24;
export const SEARCH_WINDOW_MS = SEARCH_WINDOW_HOURS * 3_600_000;

export function searchWindow(nowMs: EpochMs): TimeWindow {
  return { startMs: nowMs, endMs: nowMs + SEARCH_WINDOW_MS };
}
