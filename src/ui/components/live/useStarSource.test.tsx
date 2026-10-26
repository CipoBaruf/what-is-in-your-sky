import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StarSource } from '../guide/skychart/useSkyScene';

/**
 * R123 (FR-SKY-3, FR-SKY-10, D-791): with `[ stars ]` on the page asks for the
 * `stars` chunk when it mounts; with it off it only prefetches it on idle, and
 * the source is there for the next tick once that lands. The chunk module is
 * stubbed: what is under test is when it is asked for, not the catalogue.
 */
const source = { catalog: { ra: [], dec: [], mag: [], name: [], desig: [], con: [], figures: [] } } as unknown as StarSource;
const module = { starSource: () => source };
const load = vi.fn(() => Promise.resolve(module));
let idle: ((m: typeof module) => void) | null = null;
const cancel = vi.fn();
const prefetch = vi.fn((onLoad: (m: typeof module) => void) => {
  idle = onLoad;
  return cancel;
});

vi.mock('../../screens/starsChunk', () => ({ loadStarsChunk: load, prefetchStarsWhenIdle: prefetch }));

/** A fresh copy of the hook each test: it keeps the loaded source at module level, which is the point of it. */
async function freshHook() {
  vi.resetModules();
  return (await import('./useStarSource')).useStarSource;
}

describe('useStarSource (FR-SKY-3, FR-SKY-10; D-791)', () => {
  beforeEach(() => {
    load.mockClear();
    prefetch.mockClear();
    cancel.mockClear();
    idle = null;
  });
  afterEach(() => {
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

  it('only prefetches on idle with the toggle off, has the source once that lands, and cancels on unmount', async () => {
    const useStarSource = await freshHook();
    const { result, unmount } = renderHook(() => useStarSource(false));
    expect(load).not.toHaveBeenCalled();
    expect(prefetch).toHaveBeenCalledTimes(1);
    act(() => {
      idle?.(module);
    });
    expect(result.current).toBe(source);
    unmount();
    // A page left before the browser was idle takes its prefetch back.
    cancel.mockClear();
    const other = await freshHook();
    renderHook(() => other(false)).unmount();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
