import { useMemo, useSyncExternalStore } from 'react';
import { DOME_STEPS, domeStepFor, domeStepQuery, type DomeStep } from '../../lib/layout';

/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314): which step of the dome's size
 * ladder the viewport fits, or `null` for the fluid box. One `matchMedia`
 * query per step, each on the width *and* the height, and the highest that
 * matches wins — `useSyncExternalStore` like `useLayoutMode`, so the first
 * render already knows the step and the listeners fire on a crossing rather
 * than on every pixel of a resize. Anywhere without `matchMedia` (jsdom, a
 * server) is the fluid box, which works at any size.
 */
export function useDomeStep(): DomeStep | null {
  const store = useMemo(() => {
    const queries = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? DOME_STEPS.map((entry) => [entry, window.matchMedia(domeStepQuery(entry))] as const) : [];
    const matched = new Map(queries.map(([entry, list]) => [entry, list]));
    return {
      subscribe: (onChange: () => void): (() => void) => {
        for (const [, list] of queries) list.addEventListener('change', onChange);
        return () => {
          for (const [, list] of queries) list.removeEventListener('change', onChange);
        };
      },
      snapshot: (): DomeStep | null => domeStepFor((entry) => matched.get(entry)?.matches ?? false),
    };
  }, []);
  return useSyncExternalStore(store.subscribe, store.snapshot, fluid);
}

const fluid = (): DomeStep | null => null;
