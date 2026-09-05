import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { isLiveRoute, liveLinkFromHash, type LiveLink } from '../../lib/shareLinks';

/**
 * R32 (FR-LIVE-1, FR-LIVE-9): the `#live` route, read from the hash the way
 * the pass selection is (D-13: no router, the hash is the source of truth).
 * `active` is the route itself — `#live`, or any `#live?…` whether or not it
 * parses — and `link` is the shared moment when the hash carries one, whose
 * observer `startApp` has already set (D-135) and whose instant the page
 * shows. A hash that is not the live route leaves both false and `null`.
 *
 * `useSyncExternalStore` rather than an effect writing state: the first
 * render already knows which page it is on, so the home screen is never
 * painted for a frame under a `#live` URL.
 */
export interface LiveRoute {
  active: boolean;
  link: LiveLink | null;
  /** Returns to the home page: clears the hash in place and tells every hash subscriber. */
  leave: () => void;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

const snapshot = (): string => window.location.hash;
const none = (): string => '';

/**
 * Clears the hash without a history entry (the way a closed guide does, D-13)
 * and dispatches the `hashchange` that `replaceState` does not, so the pass
 * selection and this route both see the home page at once.
 */
export function leaveLive(): void {
  if (window.location.hash !== '') {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useLiveRoute(): LiveRoute {
  const hash = useSyncExternalStore(subscribe, snapshot, none);
  const leave = useCallback(() => {
    leaveLive();
  }, []);
  // Parsed once per hash: `link` is a fresh object each time it is parsed, and the page keys its instant on it.
  return useMemo(() => ({ active: isLiveRoute(hash), link: liveLinkFromHash(hash), leave }), [hash, leave]);
}
