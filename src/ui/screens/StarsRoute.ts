import { lazy, useMemo } from 'react';
import { isStarsRoute } from '../../lib/shareLinks';
import { close, useHash } from '../navigation';
import { loadStarsChunk } from './starsChunk';

/**
 * R115 (FR-STAR-3, D-756): the `#stars` route, read from the hash as the live
 * and settings routes are (D-13: no router, the hash is the route), and the
 * page behind it as a lazy component over `starsChunk`'s one import. The route
 * writes no history of its own (FR-ROUTE-1, D-533): `leave` is
 * `navigation.close`, back to where the page was opened from.
 */
export interface StarsRoute {
  active: boolean;
  /** Returns to where the page was opened from (FR-ROUTE-1): `Esc`, and the browser's Back by clearing the hash. */
  leave: () => void;
}

export function useStarsRoute(): StarsRoute {
  const hash = useHash();
  return useMemo(() => ({ active: isStarsRoute(hash), leave: close }), [hash]);
}

/** The page, fetched the first time the route is drawn (or ahead of it, from the header's link). */
export const StarsPage = lazy(() => loadStarsChunk().then((module) => ({ default: module.StarsPage })));
