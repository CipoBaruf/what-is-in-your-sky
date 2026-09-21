import type { StateCreator } from 'zustand/vanilla';
import type { OpenLinkResult } from '../openLink';

/**
 * R83 (D-539): what the last link did — own place, visit, adopted, unreadable
 * or unknown, with the moment's note — kept for the session so the notice and
 * the one-line notes (R87, R89) have something to read. Never persisted: the
 * write-through in `store.ts` watches the observer only.
 */
export interface UiSlice {
  linkResult: OpenLinkResult | null;
  setLinkResult: (result: OpenLinkResult | null) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  linkResult: null,
  setLinkResult: (linkResult) => {
    set({ linkResult });
  },
});
