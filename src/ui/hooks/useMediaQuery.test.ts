/**
 * R61 (D-315): the hook answers a query, follows it across its edge in both
 * directions, detaches on unmount, and is false where there is no `matchMedia`.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { stubMatchMedia, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { useMediaQuery } from './useMediaQuery';

let media: MatchMediaStub | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

describe('useMediaQuery', () => {
  it('answers the query and follows it across its edge', () => {
    media = stubMatchMedia(1665);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1666px)'));
    expect(result.current).toBe(false);
    act(() => {
      media?.setWidth(1666);
    });
    expect(result.current).toBe(true);
    act(() => {
      media?.setWidth(1000);
    });
    expect(result.current).toBe(false);
  });

  it('detaches its listener on unmount', () => {
    media = stubMatchMedia(1280);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1666px)'));
    expect(media.listeners()).toBe(1);
    unmount();
    expect(media.listeners()).toBe(0);
  });

  it('is false where there is no matchMedia at all', () => {
    media = stubMatchMedia(3840);
    const real = window.matchMedia;
    delete (window as Partial<Window>).matchMedia;
    expect(renderHook(() => useMediaQuery('(min-width: 1666px)')).result.current).toBe(false);
    window.matchMedia = real;
  });
});
