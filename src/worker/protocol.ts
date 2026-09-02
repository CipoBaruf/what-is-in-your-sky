import type { EpochMs, NoradId, NowState, Observer, Pass, SatelliteRecord, TimeWindow, VisibilityThresholds } from '../model';

/**
 * PLAN §6.2, verbatim, plus `jobDone.hasDarkness` (R5; PLAN §2.6). Every
 * payload is structured-clone safe: plain objects, no `Date`, no satrec.
 * A long-running request carries a `jobId`, a one-shot one a `requestId`;
 * every response echoes the id it answers.
 */
export type WorkerRequest =
  | { type: 'loadElements'; requestId: string; records: SatelliteRecord[] }
  | { type: 'computePasses'; jobId: string; observer: Observer; window: TimeWindow; thresholds: VisibilityThresholds }
  | { type: 'computeNow'; requestId: string; observer: Observer; t: EpochMs; thresholds: VisibilityThresholds }
  | { type: 'cancel'; jobId: string };

export type WorkerResponse =
  | { type: 'elementsLoaded'; requestId: string; loaded: NoradId[]; rejected: RejectedElement[] }
  | { type: 'passes'; jobId: string; noradId: NoradId; passes: Pass[] } // streamed, one per object
  | { type: 'progress'; jobId: string; done: number; total: number }
  | { type: 'jobDone'; jobId: string; cancelled: boolean; elapsedMs: number; hasDarkness: boolean }
  | { type: 'nowState'; requestId: string; state: NowState }
  | { type: 'error'; ref: { jobId?: string; requestId?: string }; code: WorkerErrorCode; message: string };

export type WorkerErrorCode = 'NO_ELEMENTS' | 'BAD_OMM' | 'PROPAGATION_FAILED' | 'INTERNAL';

export interface RejectedElement {
  noradId: NoradId;
  reason: string;
}
