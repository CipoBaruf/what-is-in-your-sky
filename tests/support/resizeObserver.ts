import { vi } from 'vitest';

/**
 * R79 (FR-GUT-7, D-451): jsdom has no `ResizeObserver`, so a box that decides
 * its own layout by measuring — the sky screen, upright when its measured box
 * is taller than wide — is told a size here. Every observer reports the one
 * size on `observe`, which is what a screen whose box and probe are both the
 * viewport would see. Undone by `vi.unstubAllGlobals()`.
 */
export function stubResizeObserver(width: number, height: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve(): void {
        /* nothing is held per element */
      }
      disconnect(): void {
        /* nothing to detach */
      }
    },
  );
}
