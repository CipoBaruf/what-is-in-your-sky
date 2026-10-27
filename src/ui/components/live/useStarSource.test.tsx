import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarSource } from '../guide/skychart/useSkyScene';

/**
 * R123 (FR-SKY-3, FR-SKY-10, D-791): with `[ stars ]` on the page asks for the
 * `stars` chunk when it mounts and builds the source; with it off it only
 * prefetches the module on idle and builds nothing; a failed load is asked for
 * again. The chunk module is stubbed: what is under test is when it is asked
 * for and when the catalogue is built, not the catalogue.
 */
const source = { catalog: { ra: [], dec: [], mag: [], name: [], desig: [], con: [], figures: [] } } as unknown as StarSource;
const module = { starSource: vi.fn(() => source) };
const load = vi.fn(() => Promise.resolve(module));
const cancel = vi.fn();
const prefetch = vi.fn(() => cancel);

vi.mock('../../screens/starsChunk', () => ({ loadStarsChunk: load, prefetchStarsWhenIdle: prefetch }));

/** A fresh copy of the hook each test: it keeps the loaded source at module level, which is the point of it. */
async function freshHook() {
  vi.resetModules();
  return (await import('./useStarSource')).useStarSource;
}

describe('useStarSource (FR-SKY-3, FR-SKY-10; D-791)', () => {
  beforeEach(() => {
    load.mockClear();
    load.mockImplementation(() => Promise.resolve(module));
    prefetch.mockClear();
    cancel.mockClear();
    module.starSource.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('loads the chunk on mount with the toggle on, and hands out its source', async () => {
    const useStarSource = await freshHook();
    const { result } = renderHook(() => useStarSource(true));
    expect(result.current).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    expect(prefetch).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(source);
    // A later page — the next pass detail — has it from its first render and asks for nothing.
    const again = renderHook(() => useStarSource(true));
    expect(again.result.current).toBe(source);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('only prefetches the module on idle with the toggle off, builds no catalogue, builds it when turned on, and cancels on unmount', async () => {
    const useStarSource = await freshHook();
    const { result, rerender, unmount } = renderHook((on: boolean) => useStarSource(on), { initialProps: false });
    expect(load).not.toHaveBeenCalled();
    expect(prefetch).toHaveBeenCalledTimes(1);
    // Off: nothing is built from the prefetched module (finding: the catalogue cost a reader with the stars off).
    expect(module.starSource).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
    // On: the module in hand gives the source on the next tick.
    rerender(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(module.starSource).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(source);
    unmount();
    // A page left before the browser was idle takes its prefetch back.
    cancel.mockClear();
    const other = await freshHook();
    renderHook(() => other(false)).unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('asks again for a chunk that failed, on the browser’s online event or after the retry delay', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const { STARS_RETRY_MS, useStarSource } = await import('./useStarSource');
    load.mockImplementation(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useStarSource(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();
    // Back online: asked again at once.
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(2);
    // Still failing, and no event: asked again after the delay, and this time it loads.
    load.mockImplementation(() => Promise.resolve(module));
    await act(async () => {
      vi.advanceTimersByTime(STARS_RETRY_MS);
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(source);
  });
});
