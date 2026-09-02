import type { StateCreator } from 'zustand/vanilla';
import type { NowState, Observer } from '../../model';

/**
 * The latest "Now" state (US-4, FR-VIS-5): what the worker answered to the
 * most recent `computeNow`, and the observer it was computed for, so the
 * panel never shows one location's sky under another's label. The effect
 * refreshes it every 10 s while the tab is visible (PLAN §4 `effects.ts`).
 */
export interface NowSliceState {
  observer: Observer | null;
  state: NowState | null;
  error: string | null;
}

export const IDLE_NOW: NowSliceState = { observer: null, state: null, error: null };

export interface NowSlice {
  now: NowSliceState;
  setNow: (observer: Observer, state: NowState) => void;
  setNowError: (observer: Observer, error: string) => void;
  resetNow: () => void;
}

export const createNowSlice: StateCreator<NowSlice, [], [], NowSlice> = (set) => ({
  now: IDLE_NOW,
  setNow: (observer, state) => {
    set({ now: { observer, state, error: null } });
  },
  setNowError: (observer, error) => {
    set((current) => ({ now: { observer, state: current.now.observer === observer ? current.now.state : null, error } }));
  },
  resetNow: () => {
    set({ now: IDLE_NOW });
  },
});
