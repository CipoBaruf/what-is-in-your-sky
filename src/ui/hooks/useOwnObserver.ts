import type { Observer } from '../../model';
import { useActiveObserver } from '../../state';

/**
 * R202 (FR-OPEN-2, D-1178): the reader's own place — the visited one, else the saved one — and never the example.
 * What the place fields, the saved places and the first-visit test read, where the example must not pass for a place.
 */
export function useOwnObserver(): Observer | null {
  const active = useActiveObserver();
  return active?.source === 'example' ? null : active;
}
