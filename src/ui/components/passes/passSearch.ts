import type { EpochMs, Observer, Pass, SatelliteRecord, TimeWindow } from '../../../model';
import { DEFAULT_THRESHOLDS, findPasses, ommToSatrec } from '../../../physics';

/**
 * R3: every catalog object over the next 24 h, still on the main thread and
 * still importing `src/physics` directly (the worker and the §3 boundary rules
 * arrive in R5). Pure: "now" enters as a parameter (D-15).
 *
 * The window is FR-VIS-1's MVP minimum (24 h; PLAN D-20). R2's 10-day ISS
 * search is gone: ~30 objects × 10 days would block the page for seconds.
 */
export const SEARCH_WINDOW_HOURS = 24;
export const SEARCH_WINDOW_MS = SEARCH_WINDOW_HOURS * 3_600_000;

export function searchWindow(nowMs: EpochMs): TimeWindow {
  return { startMs: nowMs, endMs: nowMs + SEARCH_WINDOW_MS };
}

export interface PassSearchResult {
  /** Every visible pass of every object, sorted by start time (US-5 AC2 default). */
  passes: Pass[];
  /** Objects whose elements could not be turned into a satrec, skipped with a warning. */
  skipped: { noradId: number; reason: string }[];
}

/** Featured objects first, so the ISS is processed first (PLAN §6.2) once results stream in R5. */
export function computeOrder(records: readonly SatelliteRecord[]): SatelliteRecord[] {
  return [...records].sort((a, b) => Number(Boolean(b.catalog.featured)) - Number(Boolean(a.catalog.featured)));
}

export function findAllPasses(records: readonly SatelliteRecord[], observer: Observer, nowMs: EpochMs, warn: (m: string) => void = (m) => console.warn(m)): PassSearchResult {
  const window = searchWindow(nowMs);
  const passes: Pass[] = [];
  const skipped: PassSearchResult['skipped'] = [];
  for (const record of computeOrder(records)) {
    let satrec;
    try {
      satrec = ommToSatrec(record.omm);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({ noradId: record.catalog.noradId, reason });
      warn(`Skipping ${record.catalog.name} (${String(record.catalog.noradId)}): ${reason}`);
      continue;
    }
    passes.push(
      ...findPasses(satrec, observer, window, DEFAULT_THRESHOLDS, {
        noradId: record.catalog.noradId,
        name: record.catalog.name,
        stdMag: record.catalog.stdMag,
        elementsEpochMs: record.epochMs,
      }),
    );
  }
  passes.sort((a, b) => a.start.t - b.start.t);
  return { passes, skipped };
}
