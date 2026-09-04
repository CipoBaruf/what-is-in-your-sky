import type { EpochMs, NoradId, NowState, Observer, Pass, SatelliteRecord, TimeWindow, VisibilityThresholds } from '../model';

/**
 * PLAN §6.2, verbatim, plus `jobDone.hasDarkness` (R5; PLAN §2.6). Every
 * payload is structured-clone safe: plain objects, no `Date`, no satrec.
 * A long-running request carries a `jobId`, a one-shot one a `requestId`;
 * every response echoes the id it answers.
 *
 * v1 (R18): `computePasses` splits its window into 24 h nights and streams one
 * `passes` message per (night, object) pair, so `passes` carries `nightIndex`
 * and `progress` counts pairs (D-77). `computeNow` gains `includeHidden`
 * (D-76, FR-LIVE-6); there is no `computeAt` request.
 */
export type WorkerRequest =
  | { type: 'loadElements'; requestId: string; records: SatelliteRecord[] }
  | { type: 'computePasses'; jobId: string; observer: Observer; window: TimeWindow; thresholds: VisibilityThresholds }
  | { type: 'computeNow'; requestId: string; observer: Observer; t: EpochMs; thresholds: VisibilityThresholds; includeHidden?: boolean }
  | { type: 'cancel'; jobId: string };

export type WorkerResponse =
  | { type: 'elementsLoaded'; requestId: string; loaded: NoradId[]; rejected: RejectedElement[] }
  | { type: 'passes'; jobId: string; noradId: NoradId; nightIndex: number; passes: Pass[] } // streamed, one per (night, object) pair
  | { type: 'progress'; jobId: string; done: number; total: number } // (night, object) pairs finished of the pairs the window asks for, not objects
  | { type: 'jobDone'; jobId: string; cancelled: boolean; elapsedMs: number; hasDarkness: boolean } // darkness on night 1 only: it words SPEC §5.6's "tonight"
  | { type: 'nowState'; requestId: string; state: NowState }
  | { type: 'error'; ref: { jobId?: string; requestId?: string }; code: WorkerErrorCode; message: string };

export type WorkerErrorCode = 'NO_ELEMENTS' | 'BAD_OMM' | 'PROPAGATION_FAILED' | 'INTERNAL';

export interface RejectedElement {
  noradId: NoradId;
  reason: string;
}
