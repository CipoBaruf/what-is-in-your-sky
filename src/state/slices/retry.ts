import type { StateCreator } from 'zustand/vanilla';

/**
 * R86 (FR-FAIL-1, D-541): one retry action per thing that can fail, callable
 * from wherever its failure is shown. Each re-enters the effect the first
 * attempt used, so the actions are the effects' own: `startEffects` installs
 * them and puts the no-ops back when it stops. No backoff is added — the
 * 15-minute recheck stays the automatic path.
 */
export interface RetrySlice {
  /** The elements load, and the pass job for the place on screen after it. The live page's `[ retry ]` is this one. */
  retryElements: () => void;
  /** The forecast for the place on screen. */
  retryWeather: () => void;
  /** The pass job over a window from now, on a new worker when the last one died or stalled (D-543). */
  retryPasses: () => void;
}

const noop = (): void => undefined;

export const IDLE_RETRY: RetrySlice = { retryElements: noop, retryWeather: noop, retryPasses: noop };

export const createRetrySlice: StateCreator<RetrySlice, [], [], RetrySlice> = () => ({ ...IDLE_RETRY });
