import type { EpochMs, Observer, OmmRecord, Pass, TimeWindow } from '../../../model';
import { DEFAULT_THRESHOLDS, findPasses, ommToSatrec, parseOmmEpoch } from '../../../physics';

/**
 * R2 only: the ISS on the main thread. The catalog (with `stdMag` provenance,
 * FR-SAT-5) arrives in R3 and the worker in R5; until then the seed value from
 * the R1 spike is used and the search runs synchronously.
 */
export const ISS_NORAD_ID = 25544;
/** Seed from the spike (tests/support/heavensAbove.ts); R3 settles the provenance. */
export const ISS_STD_MAG_SEED = -1.8;
export const SEARCH_DAYS = 10;

export function searchWindow(nowMs: EpochMs): TimeWindow {
  return { startMs: nowMs, endMs: nowMs + SEARCH_DAYS * 86_400_000 };
}

export type NextPassResult = { kind: 'no-elements' } | { kind: 'none' } | { kind: 'pass'; pass: Pass };

/** The first visible ISS pass starting at or after `nowMs`, from the given OMM records. Pure (D-15). */
export function nextIssPass(records: OmmRecord[], observer: Observer, nowMs: EpochMs): NextPassResult {
  const iss = records.find((r) => r.NORAD_CAT_ID === ISS_NORAD_ID);
  if (!iss) return { kind: 'no-elements' };
  const passes = findPasses(ommToSatrec(iss), observer, searchWindow(nowMs), DEFAULT_THRESHOLDS, {
    noradId: ISS_NORAD_ID,
    name: iss.OBJECT_NAME,
    stdMag: ISS_STD_MAG_SEED,
    elementsEpochMs: parseOmmEpoch(iss.EPOCH),
  });
  const first = passes[0];
  return first ? { kind: 'pass', pass: first } : { kind: 'none' };
}
