/**
 * R32 (FR-LIVE-1, FR-LIVE-9): the `#live` route as the hash carries it —
 * active for the bare route and for any `#live?…`, the link only when it
 * parses, following `hashchange`, and `leave` clearing the hash in place while
 * telling every subscriber.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leaveLive, useLiveRoute } from './LiveRoute';

const go = (hash: string): void => {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

describe('useLiveRoute', () => {
  afterEach(() => {
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('is inactive on the home page and on a pass hash', () => {
    const { result } = renderHook(() => useLiveRoute());
    expect(result.current.active).toBe(false);
    expect(result.current.link).toBeNull();
    go('#pass=25544-1');
    expect(result.current.active).toBe(false);
  });

  it('is active on #live with no link, and carries the link of a #live?… hash', () => {
    const { result } = renderHook(() => useLiveRoute());
    go('#live');
    expect(result.current.active).toBe(true);
    expect(result.current.link).toBeNull();
    go('#live?lat=-38.93&lon=-67.99&alt=270&t=2026-09-02T03:04:05Z');
    expect(result.current.active).toBe(true);
    expect(result.current.link).toEqual({ kind: 'live', observer: { lat: -38.93, lon: -67.99, altM: 270 }, t: Date.UTC(2026, 8, 2, 3, 4, 5) });
    // A link that does not parse still opens the page (the page then says it has no observer).
    go('#live?lat=-99&lon=0');
    expect(result.current.active).toBe(true);
    expect(result.current.link).toBeNull();
  });

  it('reads the route on the first render, so a #live URL never paints the home page first', () => {
    window.location.hash = '#live';
    const { result } = renderHook(() => useLiveRoute());
    expect(result.current.active).toBe(true);
  });

  it('leave clears the hash without a history entry and dispatches hashchange for every other subscriber', () => {
    const { result } = renderHook(() => useLiveRoute());
    go('#live');
    const heard = vi.fn();
    window.addEventListener('hashchange', heard);
    const entries = window.history.length;
    act(() => {
      result.current.leave();
    });
    window.removeEventListener('hashchange', heard);
    expect(window.location.hash).toBe('');
    expect(result.current.active).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(window.history.length).toBe(entries);
  });

  it('leaveLive on the home page still tells the subscribers, and changes nothing else', () => {
    const heard = vi.fn();
    window.addEventListener('hashchange', heard);
    leaveLive();
    window.removeEventListener('hashchange', heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('');
  });
});
