import type { StateCreator } from 'zustand/vanilla';
import type { NoradId, Observer, Pass, TimeWindow } from '../../model';

/**
 * The current pass job as it streams in (PLAN §6.2). Every action carries the
 * job id and is ignored when it is not the current job's: the worker client
 * already drops stale responses, this keeps the slice safe on its own.
 * `passes` stays sorted by start time (US-5 AC2 default) as objects arrive.
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
};

export interface PassesSlice {
  passes: PassesState;
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
    startJob: (jobId, observer, window) => {
      set({ passes: { ...IDLE_PASSES, jobId, status: 'computing', observer, window } });
    },
    addPasses: (jobId, passes) => {
      update(jobId, (current) => ({ passes: [...current.passes, ...passes].sort(byStart) }));
    },
    setProgress: (jobId, done, total) => {
      update(jobId, () => ({ done, total }));
    },
    finishJob: (jobId, { cancelled, elapsedMs, hasDarkness }) => {
      update(jobId, () => (cancelled ? {} : { status: 'done', elapsedMs, hasDarkness }));
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
