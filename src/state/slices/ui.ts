import type { StateCreator } from 'zustand/vanilla';
import type { OpenLinkResult } from '../openLink';

/**
 * R83 (D-539): what the last link did — own place, visit, adopted, unreadable
 * or unknown, with the moment's note — kept for the session so the notice and
 * the one-line notes (R87, R89) have something to read. Never persisted: the
 * write-through in `store.ts` watches the observer only.
 *
 * R148 (FR-TONIGHT-4 as amended v2.8, D-926): `stayOnNow`, the visit's flag the
 * compact live page's `now` tap set so the opening jump never ran again, is
 * gone with the jump — the page asks with a card on every visit (FR-FULL-10)
 * and there is nothing for the flag to suppress.
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
