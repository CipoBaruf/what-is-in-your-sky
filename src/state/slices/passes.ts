import type { StateCreator } from 'zustand/vanilla';
import type { EpochMs, NoradId, Observer, Pass, PassRun, TimeWindow } from '../../model';
import type { Failure } from '../failure';
import { SEARCH_WINDOW_HOURS } from '../passWindow';
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
 *
 * R86: a failed job stores a `Failure` (D-540). A stored run is as old as it
 * is (FR-NIGHT-3, D-536): one whose window has ended is not shown at all — the
 * slice goes back to idle and the recompute reads as a first load — and one
 * partly elapsed carries `spanHours`, what is left of its window, for the
 * count line. A recompute for the same place, the stale one of FR-NIGHT-4
 * included (D-537), keeps the finished list on screen as a stand-in under the
 * progress line, as the stored run always was.
 */
type PassesStatus = 'idle' | 'computing' | 'done' | 'error';

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
  error: Failure | null;
  /** The count line's span: `windowEnd − max(now, windowStart)` rounded down to the hour (D-536). */
  spanHours: number;
  /** The passes on screen are an earlier run's, standing in until this job has one of its own. */
  standIn: boolean;
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
  spanHours: SEARCH_WINDOW_HOURS,
  standIn: false,
};

export interface PassesSlice {
  passes: PassesState;
  /** FR-OFF-2: what was stored for this observer, shown as a finished list until a job replaces it. */
  showStoredPasses: (run: PassRun, nowMs: EpochMs) => void;
  startJob: (jobId: string, observer: Observer, window: TimeWindow) => void;
  addPasses: (jobId: string, passes: Pass[]) => void;
  setProgress: (jobId: string, done: number, total: number) => void;
  finishJob: (jobId: string, result: { cancelled: boolean; elapsedMs: number; hasDarkness: boolean }) => void;
  skipObject: (jobId: string, message: string) => void;
  failJob: (jobId: string, failure: Failure) => void;
  resetPasses: () => void;
}

const byStart = (a: Pass, b: Pass): number => a.start.t - b.start.t;

const HOUR_MS = 3_600_000;

/** D-536: what is left of a window at `nowMs`, in whole hours. */
function spanHoursLeft(window: TimeWindow, nowMs: EpochMs): number {
  return Math.max(0, Math.floor((window.endMs - Math.max(nowMs, window.startMs)) / HOUR_MS));
}

export const createPassesSlice: StateCreator<PassesSlice, [], [], PassesSlice> = (set) => {
  const update = (jobId: string, patch: (current: PassesState) => Partial<PassesState>): void => {
    set((state) => (state.passes.jobId === jobId ? { passes: { ...state.passes, ...patch(state.passes) } } : {}));
  };
  return {
    passes: IDLE_PASSES,
    showStoredPasses: (run, nowMs) => {
      // FR-NIGHT-3: a run whose window has ended is not a list; the page reads as a first load until the recompute answers.
      if (run.window.endMs <= nowMs) {
        set({ passes: IDLE_PASSES });
        return;
      }
      set({
        // `hasDarkness` comes back with the run: without it an empty stored run would report
        // "no visible passes" when the truth is that the window held no darkness at all (D-108).
        passes: { ...IDLE_PASSES, status: 'done', observer: run.observer, window: run.window, passes: [...run.passes].sort(byStart), hasDarkness: run.hasDarkness, storedAt: run.computedAt, spanHours: spanHoursLeft(run.window, nowMs), standIn: true },
      });
    },
    startJob: (jobId, observer, window) => {
      set((state) => {
        // Same place, a finished list on screen (stored, or this session's own): keep it until this job has something of
        // its own to show. A list still streaming from a cancelled job is not finished and is not kept.
        const current = state.passes;
        const keep = sameLocation(current.observer, observer) && current.passes.length > 0 && (current.standIn || current.status !== 'computing');
        const fresh = { ...IDLE_PASSES, jobId, status: 'computing' as const, observer, window, spanHours: spanHoursLeft(window, window.startMs) };
        return { passes: keep ? { ...fresh, passes: current.passes, storedAt: current.storedAt, standIn: true } : fresh };
      });
    },
    addPasses: (jobId, passes) => {
      update(jobId, (current) => {
        if (!current.standIn) return { passes: [...current.passes, ...passes].sort(byStart) };
        // An earlier run is still standing in. The worker emits a `passes` message for every
        // (night, object) pair, empty ones included, so an empty batch is not yet something of
        // this job's own to show: taking over on one would blank the list a moment into a
        // multi-second recompute, which is the blanking D-105 forbids. The first batch that
        // carries a pass takes over.
        if (passes.length === 0) return {};
        return { passes: [...passes].sort(byStart), storedAt: null, standIn: false };
      });
    },
    setProgress: (jobId, done, total) => {
      update(jobId, () => ({ done, total }));
    },
    finishJob: (jobId, { cancelled, elapsedMs, hasDarkness }) => {
      // A job that ends without emitting anything found nothing: the passes it was standing in for go with it.
      update(jobId, (current) => (cancelled ? {} : { status: 'done', elapsedMs, hasDarkness, ...(current.standIn ? { passes: [], storedAt: null, standIn: false } : {}) }));
    },
    skipObject: (jobId, message) => {
      update(jobId, (current) => ({ skipped: [...current.skipped, { noradId: null, message }] }));
    },
    failJob: (jobId, failure) => {
      update(jobId, () => ({ status: 'error', error: failure }));
    },
    resetPasses: () => {
      set({ passes: IDLE_PASSES });
    },
  };
};
