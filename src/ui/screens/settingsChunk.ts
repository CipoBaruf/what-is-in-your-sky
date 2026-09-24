/**
 * R93 (D-545, F-69): the settings page is its own chunk, and this is the one
 * place that fetches it, so the route, the header's link and the idle prefetch
 * share a single request. The module is not React (a link's `pointerenter`
 * and an idle callback both call it), so `App.tsx`'s `lazy` and `Header.tsx`
 * can both import it without importing each other.
 */
type SettingsModule = typeof import('./Settings');

let chunk: Promise<SettingsModule> | undefined;

/** Fetch the settings chunk once; later calls return the same promise. */
export function loadSettingsChunk(): Promise<SettingsModule> {
  chunk ??= import('./Settings');
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
    const id = idle(() => void loadSettingsChunk(), { timeout: 5_000 });
    return () => {
      (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    };
  }
  const id = window.setTimeout(() => void loadSettingsChunk(), 2_000);
  return () => {
    window.clearTimeout(id);
  };
}
