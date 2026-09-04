/**
 * R23 (FR-DESK-1, D-72): the hook reports the shell the width is in, follows
 * the breakpoint when it is crossed, and detaches its listener on unmount.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { COMPACT_PX, stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { WIDE_MIN_PX } from '../../lib/layout';
import { useLayoutMode } from './useLayoutMode';

let media: MatchMediaStub | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

describe('useLayoutMode', () => {
  it('is compact below the breakpoint and wide at it', () => {
    media = stubMatchMedia(WIDE_MIN_PX - 1);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('compact');
    media.restore();

    media = stubMatchMedia(WIDE_MIN_PX);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('wide');
  });

  it('follows the width across the breakpoint, in both directions', () => {
    media = stubMatchMedia(COMPACT_PX);
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current).toBe('compact');

    act(() => {
      media?.setWidth(WIDE_PX);
    });
    expect(result.current).toBe('wide');

    act(() => {
      media?.setWidth(COMPACT_PX);
    });
    expect(result.current).toBe('compact');
  });

  it('detaches its listener on unmount', () => {
    media = stubMatchMedia(COMPACT_PX);
    const { unmount } = renderHook(() => useLayoutMode());
    expect(media.listeners()).toBe(1);
    unmount();
    expect(media.listeners()).toBe(0);
  });

  it('is compact where there is no matchMedia at all', () => {
    media = stubMatchMedia(WIDE_PX);
    const real = window.matchMedia;
    delete (window as Partial<Window>).matchMedia;
    expect(renderHook(() => useLayoutMode()).result.current).toBe('compact');
    window.matchMedia = real;
  });
});
