import { useMemo, useSyncExternalStore } from 'react';
import { LANDSCAPE_PHONE_QUERY, pageShape, type PageShape } from '../../../lib/layout';

/**
 * R78 (FR-SHP-1, FR-WATCH-5; D-448): the live page's shape — portrait, or the
 * landscape phone — as `useLayoutMode` reads the mode: a `matchMedia` listener
 * on the query the stylesheet uses (`Live.module.css`'s D-173 block, held to
 * `lib/layout.ts`'s `LANDSCAPE_PHONE_QUERY` by `tests/styles/liveShape.test.ts`),
 * through `useSyncExternalStore`, so the first render already has the answer.
 *
 * D-173 had no hook, since nothing in React changed between the two layouts.
 * Something does now: on the landscape phone the indicator, the clock and
 * `[ back to live ]` are the rail's (`liveRows.ts`), and `scrubPlacement` asks
 * the shape. The shape says nothing of the mode — a short wide window matches
 * this query too — so every reader asks the mode first (FR-SHP-1).
 */
export function usePageShape(): PageShape {
  const store = useMemo(() => {
    const query = typeof window.matchMedia === 'function' ? window.matchMedia(LANDSCAPE_PHONE_QUERY) : null;
    return {
      subscribe: (onChange: () => void): (() => void) => {
        query?.addEventListener('change', onChange);
        return () => {
          query?.removeEventListener('change', onChange);
        };
      },
      snapshot: (): PageShape => pageShape(query?.matches ?? false),
    };
  }, []);
  return useSyncExternalStore(store.subscribe, store.snapshot, portrait);
}

const portrait = (): PageShape => 'portrait';
