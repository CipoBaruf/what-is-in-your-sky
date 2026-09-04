import type { EpochMs, TimeWindow } from '../model';

/**
 * The pass list window. It was 24 h from "now" in the MVP (FR-VIS-1's
 * minimum, PLAN D-20); v1 makes it 72 h — three 24 h nights from the moment
 * of computation (FR-VIS-1 amended, FR-OFF-2, D-20 amended). The window is
 * still one `TimeWindow`: the worker is what cuts it into nights (D-95), and
 * it searches them night-outer so tonight is complete in the MVP's time
 * (D-77). The effect builds the window when the observer changes; the UI only
 * reads the number for its status text.
 */
export const NIGHT_HOURS = 24;
export const SEARCH_WINDOW_NIGHTS = 3;
export const SEARCH_WINDOW_HOURS = SEARCH_WINDOW_NIGHTS * NIGHT_HOURS;
export const SEARCH_WINDOW_MS = SEARCH_WINDOW_HOURS * 3_600_000;

export function searchWindow(nowMs: EpochMs): TimeWindow {
  return { startMs: nowMs, endMs: nowMs + SEARCH_WINDOW_MS };
}
