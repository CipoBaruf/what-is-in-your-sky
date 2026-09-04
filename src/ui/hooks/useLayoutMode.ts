import { useMemo, useSyncExternalStore } from 'react';
import { layoutMode, WIDE_QUERY, type LayoutMode } from '../../lib/layout';

/**
 * R23 (D-72): which shell the screen is in, compact or wide. A `matchMedia`
 * listener, not a resize handler — it fires once when the breakpoint is
 * crossed rather than on every pixel of a drag, and it asks the same query
 * the stylesheet uses (`lib/layout.ts`, D-71). The hook lives here rather
 * than beside that query because PLAN §3 forbids React in `src/lib` (D-116).
 *
 * Anything without `matchMedia` is compact: it is the layout that works at
 * any width. The subscription is `useSyncExternalStore`'s rather than an
 * effect writing state, so the first render already reads the real width —
 * with an effect the app would mount compact and switch a frame later, which
 * on a desktop load is a visible reflow of the whole page.
 */
export function useLayoutMode(): LayoutMode {
  const store = useMemo(() => {
    const query = typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null;
    return {
      subscribe: (onChange: () => void): (() => void) => {
        query?.addEventListener('change', onChange);
        return () => {
          query?.removeEventListener('change', onChange);
        };
      },
      snapshot: (): LayoutMode => layoutMode(query?.matches ?? false),
    };
  }, []);
  return useSyncExternalStore(store.subscribe, store.snapshot, compact);
}

const compact = (): LayoutMode => 'compact';
