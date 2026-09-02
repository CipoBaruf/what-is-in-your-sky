import type { StateCreator } from 'zustand/vanilla';
import type { NoradId, SatelliteRecord } from '../../model';
import type { RejectedElement } from '../../worker/protocol';

/**
 * Orbital elements as the main thread knows them: fetched once (R3 loader,
 * cache in R11), then handed to the worker, which reports the records it
 * could not turn into a satrec (`rejected`, BAD_OMM).
 */
export type ElementsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: SatelliteRecord[]; unavailable: NoradId[]; rejected: RejectedElement[] };

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
