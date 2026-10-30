import type { StateCreator } from 'zustand/vanilla';
import type { OpenLinkResult } from '../openLink';

/**
 * R83 (D-539): what the last link did — own place, visit, adopted, unreadable
 * or unknown, with the moment's note — kept for the session so the notice and
 * the one-line notes (R87, R89) have something to read. Never persisted: the
 * write-through in `store.ts` watches the observer only.
 *
 * R144 (FR-TONIGHT-1, FR-TONIGHT-4; D-898): `stayOnNow` is the visit's flag
 * that the compact live page's `now` tap sets, so the opening jump never runs
 * again before the app is reloaded. In memory only, like `linkResult`: a
 * reload clears it, which is what FR-TONIGHT-4 asks.
 */
export interface UiSlice {
  linkResult: OpenLinkResult | null;
  setLinkResult: (result: OpenLinkResult | null) => void;
  stayOnNow: boolean;
  setStayOnNow: (on: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  linkResult: null,
  setLinkResult: (linkResult) => {
    set({ linkResult });
  },
  stayOnNow: false,
  setStayOnNow: (stayOnNow) => {
    set({ stayOnNow });
  },
});
