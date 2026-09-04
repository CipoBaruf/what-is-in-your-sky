import type { StateCreator } from 'zustand/vanilla';
import type { EpochMs, NoradId, Observer, Pass, PassRun, TimeWindow } from '../../model';
import { sameLocation } from './location';

/**
 * The current pass job as it streams in (PLAN §6.2). Every action carries the
 * job id and is ignored when it is not the current job's: the worker client
 * already drops stale responses, this keeps the slice safe on its own.
 * `passes` stays sorted by start time (US-5 AC2 default) as objects arrive.
 *
 * R24 (FR-OFF-2, D-78): a stored run is put in the slice before anything is
 * fetched, as a finished list with `storedAt` set — offline that is the whole
 * answer, and the readiness line (R27) reads the age from there. When a job
 * does start for the same location the stored passes stay on screen instead of
 * blanking it, until the first object of the new job replaces them; a job that
 * finds nothing clears them at `jobDone`, and a job that fails leaves them up,
 * because they are still the best thing the app has.
 */
export type PassesStatus = 'idle' | 'computing' | 'done' | 'error';

export interface PassesState {
  jobId: string | null;
  status: PassesStatus;
  /** The observer and window these results belong to. */
  observer: Observer | null;
  window: TimeWindow | null;
  passes: Pass[];
  /** Objects finished / objects in the job. */
  done: number;
  total: number;
  /** Null until `jobDone`. */
  hasDarkness: boolean | null;
  elapsedMs: number | null;
  /** Objects skipped with PROPAGATION_FAILED. */
  skipped: { noradId: NoradId | null; message: string }[];
  error: string | null;
  /** When the passes on screen were computed, if they came from the store; null when they are this session's (FR-OFF-2). */
  storedAt: EpochMs | null;
}

export const IDLE_PASSES: PassesState = {
  jobId: null,
  status: 'idle',
  observer: null,
  window: null,
  passes: [],
  done: 0,
  total: 0,
  hasDarkness: null,
  elapsedMs: null,
  skipped: [],
  error: null,
  storedAt: null,
};

export interface PassesSlice {
  passes: PassesState;
  /** FR-OFF-2: what was stored for this observer, shown as a finished list until a job replaces it. */
  showStoredPasses: (run: PassRun) => void;
  startJob: (jobId: string, observer: Observer, window: TimeWindow) => void;
  addPasses: (jobId: string, passes: Pass[]) => void;
  setProgress: (jobId: string, done: number, total: number) => void;
  finishJob: (jobId: string, result: { cancelled: boolean; elapsedMs: number; hasDarkness: boolean }) => void;
  skipObject: (jobId: string, message: string) => void;
  failJob: (jobId: string, message: string) => void;
  resetPasses: () => void;
}

const byStart = (a: Pass, b: Pass): number => a.start.t - b.start.t;

export const createPassesSlice: StateCreator<PassesSlice, [], [], PassesSlice> = (set) => {
  const update = (jobId: string, patch: (current: PassesState) => Partial<PassesState>): void => {
    set((state) => (state.passes.jobId === jobId ? { passes: { ...state.passes, ...patch(state.passes) } } : {}));
  };
  return {
    passes: IDLE_PASSES,
    showStoredPasses: (run) => {
      set({
        // `hasDarkness` comes back with the run: without it an empty stored run would report
        // "no visible passes" when the truth is that the window held no darkness at all (D-108).
        passes: { ...IDLE_PASSES, status: 'done', observer: run.observer, window: run.window, passes: [...run.passes].sort(byStart), hasDarkness: run.hasDarkness, storedAt: run.computedAt },
      });
    },
    startJob: (jobId, observer, window) => {
      set((state) => {
        // Same place, stored passes on screen: keep them until this job has something of its own to show.
        const keep = state.passes.storedAt !== null && sameLocation(state.passes.observer, observer);
        return { passes: { ...IDLE_PASSES, jobId, status: 'computing', observer, window, ...(keep ? { passes: state.passes.passes, storedAt: state.passes.storedAt } : {}) } };
      });
    },
    addPasses: (jobId, passes) => {
      update(jobId, (current) => {
        if (current.storedAt === null) return { passes: [...current.passes, ...passes].sort(byStart) };
        // Stored passes are still standing in. The worker emits a `passes` message for every
        // (night, object) pair, empty ones included, so an empty batch is not yet something of
        // this job's own to show: taking over on one would blank the list a moment into a
        // multi-second recompute, which is the blanking D-105 forbids. The first batch that
        // carries a pass takes over.
        if (passes.length === 0) return {};
        return { passes: [...passes].sort(byStart), storedAt: null };
      });
    },
    setProgress: (jobId, done, total) => {
      update(jobId, () => ({ done, total }));
    },
    finishJob: (jobId, { cancelled, elapsedMs, hasDarkness }) => {
      // A job that ends without emitting anything found nothing: the stored passes it was standing in for go with it.
      update(jobId, (current) => (cancelled ? {} : { status: 'done', elapsedMs, hasDarkness, ...(current.storedAt === null ? {} : { passes: [], storedAt: null }) }));
    },
    skipObject: (jobId, message) => {
      update(jobId, (current) => ({ skipped: [...current.skipped, { noradId: null, message }] }));
    },
    failJob: (jobId, message) => {
      update(jobId, () => ({ status: 'error', error: message }));
    },
    resetPasses: () => {
      set({ passes: IDLE_PASSES });
    },
  };
};
