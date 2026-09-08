/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314): the hook reports the highest step
 * of the dome ladder the viewport fits on both sides, follows the viewport
 * across a step in either direction, and detaches every listener on unmount.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { stubMatchMedia, type MatchMediaStub } from '../../../tests/support/matchMedia';
import { DOME_STEPS } from '../../lib/layout';
import { useDomeStep } from './useDomeStep';

let media: MatchMediaStub | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

describe('useDomeStep', () => {
  it('is the step each reference viewport was cut for, and none below the first', () => {
    for (const entry of DOME_STEPS) {
      media = stubMatchMedia(entry.reference.widthPx, entry.reference.heightPx);
      expect(renderHook(() => useDomeStep()).result.current?.step, `${String(entry.reference.widthPx)} × ${String(entry.reference.heightPx)}`).toBe(entry.step);
      media.restore();
    }
    media = stubMatchMedia(1257, 800);
    expect(renderHook(() => useDomeStep()).result.current).toBeNull();
  });

  it('asks the height as well as the width: a wide but short window drops a step', () => {
    media = stubMatchMedia(1920, 1080);
    const { result } = renderHook(() => useDomeStep());
    expect(result.current?.step).toBe(2);
    act(() => {
      media?.setSize(1920, 1060);
    });
    expect(result.current?.step).toBe(1);
    act(() => {
      media?.setSize(1920, 663);
    });
    expect(result.current).toBeNull();
    act(() => {
      media?.setSize(3840, 2160);
    });
    expect(result.current?.step).toBe(4);
  });

  it('detaches its listeners on unmount', () => {
    media = stubMatchMedia(1280, 800);
    const { unmount } = renderHook(() => useDomeStep());
    expect(media.listeners()).toBe(DOME_STEPS.length);
    unmount();
    expect(media.listeners()).toBe(0);
  });

  it('is the fluid box where there is no matchMedia at all', () => {
    media = stubMatchMedia(3840, 2160);
    const real = window.matchMedia;
    delete (window as Partial<Window>).matchMedia;
    expect(renderHook(() => useDomeStep()).result.current).toBeNull();
    window.matchMedia = real;
  });
});
