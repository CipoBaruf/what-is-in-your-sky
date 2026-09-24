import { useMemo } from 'react';
import { isLiveRoute, liveLinkFromHash, type LiveLink } from '../../lib/shareLinks';
import { close, useHash } from '../navigation';

/**
 * R32 (FR-LIVE-1, FR-LIVE-9): the `#live` route, read from the hash the way
 * the pass selection is (D-13: no router, the hash is the source of truth).
 * `active` is the route itself — `#live`, or any `#live?…` whether or not it
 * parses — and `link` is the shared moment when the hash carries one, whose
 * observer `startApp` has already set (D-135) and whose instant the page
 * shows. A hash that is not the live route leaves both false and `null`.
 *
 * `useSyncExternalStore` (through `navigation.useHash`) rather than an effect
 * writing state: the first render already knows which page it is on, so the
 * home screen is never painted for a frame under a `#live` URL.
 *
 * R92 (FR-ROUTE-1, D-533): the route writes no history of its own. `leave` is
 * `navigation.close` — back to the entry the page was opened from, or home in
 * place when `#live` was the load's entry.
 */
export interface LiveRoute {
  active: boolean;
  link: LiveLink | null;
  /** Returns to where the page was opened from (FR-ROUTE-1). */
  leave: () => void;
}

export function useLiveRoute(): LiveRoute {
  const hash = useHash();
  // Parsed once per hash: `link` is a fresh object each time it is parsed, and the page keys its instant on it.
  return useMemo(() => ({ active: isLiveRoute(hash), link: liveLinkFromHash(hash), leave: close }), [hash]);
}
