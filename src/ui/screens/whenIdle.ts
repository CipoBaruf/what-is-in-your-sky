type IdleWindow = Window & { requestIdleCallback?: (run: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/**
 * D-545 (R93), shared by R123 (D-791): run `task` after first paint, when the
 * browser has nothing better to do — `requestIdleCallback` where it exists
 * (not on iOS Safari), a short timer otherwise. The settings page's prefetch
 * and the `stars` chunk's are the two callers. Returns the cancel, for an
 * unmount before it fires.
 */
export function whenIdle(task: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const host = window as IdleWindow;
  if (host.requestIdleCallback) {
    const id = host.requestIdleCallback(task, { timeout: 5_000 });
    return () => {
      host.cancelIdleCallback?.(id);
    };
  }
  const id = window.setTimeout(task, 2_000);
  return () => {
    window.clearTimeout(id);
  };
}
