import { useMemo } from 'react';
import { isLiveRoute, liveLinkFromHash, type LiveLink } from '../../lib/shareLinks';
import { useHash } from '../navigation';

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
 * R92 (FR-ROUTE-1, D-533): the route writes no history of its own. R222
 * (D-1230): live is a tab — it has no `leave`, no Back, and its `Esc` closes
 * only what is open on it (the sheet, the facts; `Live.tsx`).
 */
export interface LiveRoute {
  active: boolean;
  link: LiveLink | null;
}

export function useLiveRoute(): LiveRoute {
  const hash = useHash();
  // Parsed once per hash: `link` is a fresh object each time it is parsed, and the page keys its instant on it.
  return useMemo(() => ({ active: isLiveRoute(hash), link: liveLinkFromHash(hash) }), [hash]);
}
