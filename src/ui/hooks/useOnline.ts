import { useSyncExternalStore } from 'react';

/**
 * Whether the browser believes it has a connection (FR-OFF-8). One
 * `useSyncExternalStore` over the `online`/`offline` events, beside
 * `useLayoutMode` and for the same reason (D-116): an effect writing state
 * would render one frame in the wrong answer.
 *
 * `navigator.onLine` is a floor, not a guarantee — it is true on a wifi that
 * goes nowhere — so it is used only to say "there is certainly no point asking"
 * and never to claim a request will succeed. Everything that fails soft still
 * fails soft when it is wrong.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
