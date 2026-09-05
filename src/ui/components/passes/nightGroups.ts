import type { EpochMs, Pass, TimeWindow } from '../../../model';
import { NIGHT_MS } from '../../../state';

/**
 * US-16 AC5 / FR-OFF-2: the 72 h list cut into the nights it was searched as.
 *
 * The rule is the worker's own (D-95), restated here because `src/ui` may not
 * import `src/worker` (PLAN §3): a night is a 24 h slice of the run's window,
 * and it owns the passes whose *start* falls in `[startMs, endMs)`, the last
 * night keeping everything from its start on. So a pass that straddles a
 * boundary is listed once, under the night it began in, and the groups the list
 * shows are exactly the groups the worker computed.
 *
 * Every night of the window is returned, empty ones included: three headings
 * with one of them saying "no visible passes" is a truthful answer about that
 * night, and a group that disappears when nothing is found would leave the
 * reader counting. A run with no window at all — the MVP shape, and what the
 * slice holds before a job starts — is one group, and the list renders it
 * without any heading (PassList).
 */
export interface NightGroup {
  /** 0, 1, 2 — the `nightIndex` the worker emitted these under. */
  index: number;
  startMs: EpochMs;
  endMs: EpochMs;
  passes: Pass[];
}

export function groupByNight(passes: readonly Pass[], window: TimeWindow | null): NightGroup[] {
  if (window === null) return [{ index: 0, startMs: 0, endMs: 0, passes: [...passes] }];
  const count = Math.max(1, Math.ceil((window.endMs - window.startMs) / NIGHT_MS));
  const groups: NightGroup[] = Array.from({ length: count }, (_, index) => ({
    index,
    startMs: window.startMs + index * NIGHT_MS,
    endMs: Math.min(window.startMs + (index + 1) * NIGHT_MS, window.endMs),
    passes: [],
  }));
  for (const pass of passes) {
    // Clamped, not dropped: a stored run read back after its window has moved on is still the whole
    // answer offline (D-105), and a pass outside it belongs at the near end rather than nowhere.
    const raw = Math.floor((pass.start.t - window.startMs) / NIGHT_MS);
    const index = Math.min(count - 1, Math.max(0, raw));
    groups[index]?.passes.push(pass);
  }
  return groups;
}
