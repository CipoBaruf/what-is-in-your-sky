import type { ExampleOutcome } from '../../lib/exampleOutcome';
import type { Observer } from '../../model';
import { useActiveObserver, useAppStore } from '../../state';

/**
 * R202 (FR-OPEN-2, D-1178): the reader's own place — the visited one, else the saved one — and never the example.
 * What the place fields, the saved places and the first-visit test read, where the example must not pass for a place.
 */
export function useOwnObserver(): Observer | null {
  const active = useActiveObserver();
  return active?.source === 'example' ? null : active;
}

/** D-1178: the outcomes under which the example is drawn; every other one is FR-OPEN-6's fallback. */
export const EXAMPLE_SHOWN: readonly ExampleOutcome[] = ['pending', 'pass'];

/**
 * R203 (FR-OPEN-6, FR-OPEN-7; D-1205): the observer the pages open for — the active one, but never an example the
 * fallback replaced. The latch keeps the example in the store (D-1199), so the pages ask the outcome as well.
 */
export function usePageObserver(): Observer | null {
  const active = useActiveObserver();
  const outcome = useAppStore((s) => s.exampleOutcome);
  return active?.source === 'example' && !EXAMPLE_SHOWN.includes(outcome) ? null : active;
}
