import { useMemo, useSyncExternalStore } from 'react';

/**
 * R61 (D-315): whether a media query matches, as `useLayoutMode` reads
 * `WIDE_QUERY` — a `matchMedia` listener that fires on the crossing and not on
 * every pixel of a drag, through `useSyncExternalStore` so the first render
 * already has the answer. Without `matchMedia` (jsdom, a server) it is false.
 */
export function useMediaQuery(query: string): boolean {
  const store = useMemo(() => {
    const list = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
    return {
      subscribe: (onChange: () => void): (() => void) => {
        list?.addEventListener('change', onChange);
        return () => {
          list?.removeEventListener('change', onChange);
        };
      },
      snapshot: (): boolean => list?.matches ?? false,
    };
  }, [query]);
  return useSyncExternalStore(store.subscribe, store.snapshot, never);
}

const never = (): boolean => false;
