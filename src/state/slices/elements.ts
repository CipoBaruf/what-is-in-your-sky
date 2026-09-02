import type { StateCreator } from 'zustand/vanilla';
import type { EpochMs, NoradId, SatelliteRecord } from '../../model';
import type { RejectedElement } from '../../worker/protocol';

/**
 * Orbital elements as the main thread knows them: loaded through the cache
 * (R3 loader, R11 IndexedDB cache with the 2 h rule), then handed to the
 * worker, which reports the records it could not turn into a satrec
 * (`rejected`, BAD_OMM). R11: `fetchedAt` is when the set in use was last
 * confirmed with CelesTrak, `stale` means that confirmation failed and a copy
 * past the 2 h rule is in use (FR-SAT-6), `persistent` is false when the copy
 * lives only in memory for this session (PLAN §7.1); the banners read these.
 */
export type ElementsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      records: SatelliteRecord[];
      unavailable: NoradId[];
      rejected: RejectedElement[];
      fetchedAt: EpochMs;
      stale: boolean;
      persistent: boolean;
    };

export interface ElementsSlice {
  elements: ElementsState;
  setElements: (elements: ElementsState) => void;
  setRejected: (rejected: RejectedElement[]) => void;
}

export const createElementsSlice: StateCreator<ElementsSlice, [], [], ElementsSlice> = (set) => ({
  elements: { status: 'idle' },
  setElements: (elements) => {
    set({ elements });
  },
  setRejected: (rejected) => {
    set((state) => (state.elements.status === 'ready' ? { elements: { ...state.elements, rejected } } : {}));
  },
});
