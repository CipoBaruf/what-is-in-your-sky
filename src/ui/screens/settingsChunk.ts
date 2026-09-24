/**
 * R93 (D-545, F-69): the settings page is its own chunk, and this is the one
 * place that fetches it, so the route, the header's link and the idle prefetch
 * share a single request. The module is not React (a link's `pointerenter`
 * and an idle callback both call it), so `App.tsx`'s `lazy` and `Header.tsx`
 * can both import it without importing each other.
 */
type SettingsModule = typeof import('./Settings');

let chunk: Promise<SettingsModule> | undefined;

/**
 * Fetch the settings chunk once; later calls return the same promise — but a
 * failure is not kept. Caching the rejection would make one dropped request
 * permanent: the idle prefetch runs seconds after the first paint, when a
 * phone may still be finding the network, and `lazy` would then throw that
 * same old rejection at the first tap on `[ settings ]` without ever asking
 * for the file again. The only boundary above it is the root's, so the whole
 * app would go to the failure page over a prefetch nobody asked for. A plain
 * `lazy(() => import(…))` retries on its own; sharing one promise is what
 * takes that away, so the promise is dropped when it rejects.
 */
export function loadSettingsChunk(): Promise<SettingsModule> {
  chunk ??= import('./Settings').catch((reason: unknown) => {
    chunk = undefined;
    throw reason;
  });
  return chunk;
}

/**
 * Prefetch the chunk after first paint, when the browser has nothing better
 * to do — `requestIdleCallback` where it exists (not on iOS Safari), a short
 * timer otherwise — so a tap on `[ settings ]` does not wait on the network
 * twice (D-545). Returns the cancel, for an unmount before it fires.
 */
export function prefetchSettingsWhenIdle(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const idle = (window as Window & { requestIdleCallback?: (fn: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }).requestIdleCallback;
  if (idle) {
    const id = idle(() => void loadSettingsChunk().catch(() => undefined), { timeout: 5_000 });
    return () => {
      (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    };
  }
  const id = window.setTimeout(() => void loadSettingsChunk().catch(() => undefined), 2_000);
  return () => {
    window.clearTimeout(id);
  };
}
