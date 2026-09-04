import type { StateCreator } from 'zustand/vanilla';

/**
 * A new version of the app shell, downloaded and waiting (FR-OFF-1, OQ-14,
 * D-79). The service worker is registered with `registerType: 'prompt'`, so a
 * new worker installs and then *stops*: it does not take over until something
 * calls `skipWaiting`. This slice is the one place that knows a version is
 * waiting; `state/serviceWorker.ts` sets it, `UpdateBanner.tsx` (R28) reads it
 * and is the only caller of `applyUpdate`, which is what keeps an update from
 * swapping the shell under an open pass or a running live page.
 *
 * `applyUpdate` is a function held in the store rather than a flag the UI acts
 * on, so the banner needs to know nothing about workers or `postMessage`: the
 * registration hands it whatever reloading means for the worker that is
 * actually waiting (D-126).
 */
export interface AppUpdateSlice {
  /** True once a new worker is installed and waiting. Never goes back to false in a page's lifetime. */
  updateReady: boolean;
  /** null until then; afterwards, tells the waiting worker to take over and reloads. */
  applyUpdate: (() => void) | null;
  offerUpdate: (apply: () => void) => void;
}

export const createAppUpdateSlice: StateCreator<AppUpdateSlice, [], [], AppUpdateSlice> = (set) => ({
  updateReady: false,
  applyUpdate: null,
  offerUpdate: (apply) => {
    set({ updateReady: true, applyUpdate: apply });
  },
});
