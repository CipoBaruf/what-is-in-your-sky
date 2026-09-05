/**
 * R33 (FR-LIVE-5, D-81): the playback loop under a scripted animation-frame
 * clock. A dropped frame loses no simulated time, the instant stops at the
 * end of the span, `now` returns to the tick, and a scrub during playback
 * moves the instant without stopping it.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HOUR_MS, type Span } from '../../../lib/timeStripe';
import { usePlayback } from './usePlayback';

const NOW = Date.UTC(2026, 8, 11, 9, 30, 0);
const span: Span = { start: NOW, end: NOW + 24 * HOUR_MS };

/** A hand-driven `requestAnimationFrame`: `tick(wall)` runs every pending callback with that timestamp. */
function scriptedRaf() {
  let next = 1;
  const pending = new Map<number, (wall: number) => void>();
  return {
    raf: {
      request: (callback: (wall: number) => void): number => {
        const id = next++;
        pending.set(id, callback);
        return id;
      },
      cancel: (id: number): void => {
        pending.delete(id);
      },
    },
    tick: (wall: number): void => {
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => {
        for (const callback of callbacks) callback(wall);
      });
    },
    pending: (): number => pending.size,
  };
}

describe('usePlayback', () => {
  it('shows real time until something holds the instant, and a link instant from the first render', () => {
    const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null }));
    expect(result.current).toMatchObject({ t: NOW, realTime: true, playing: false, speed: 60 });
    const linked = renderHook(() => usePlayback({ span, realNow: NOW, initial: NOW + HOUR_MS }));
    expect(linked.result.current).toMatchObject({ t: NOW + HOUR_MS, realTime: false });
  });

  it('advances by wall delta × speed on every frame, so a dropped frame loses no simulated time', () => {
    const { raf, tick, pending } = scriptedRaf();
    const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, raf }));
    act(() => {
      result.current.setSpeed(600);
    });
    act(() => {
      result.current.play();
    });
    expect(result.current.playing).toBe(true);
    expect(pending()).toBe(1);
    tick(1000); // the first frame only anchors the wall clock
    expect(result.current.t).toBe(NOW);
    tick(1016);
    expect(result.current.t).toBe(NOW + 16 * 600);
    tick(1032);
    tick(1232); // a 200 ms gap: two hundred milliseconds of simulated minutes, not one frame's worth
    tick(1248);
    expect(result.current.t).toBe(NOW + (16 + 16 + 200 + 16) * 600);
    expect(result.current.realTime).toBe(false);
    act(() => {
      result.current.pause();
    });
    expect(result.current.playing).toBe(false);
    expect(pending()).toBe(0);
    expect(result.current.t).toBe(NOW + 248 * 600);
  });

  it('stops at the end of the span, and play from the end goes nowhere', () => {
    const { raf, tick, pending } = scriptedRaf();
    const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: span.end - 3_600_000, raf }));
    act(() => {
      result.current.setSpeed(3600);
      result.current.play();
    });
    tick(0);
    tick(500); // half a second at 3600× is half an hour: not there yet
    expect(result.current.t).toBe(span.end - 1_800_000);
    expect(result.current.playing).toBe(true);
    tick(2000); // well past the end
    expect(result.current.t).toBe(span.end);
    expect(result.current.playing).toBe(false);
    expect(pending()).toBe(0);
    act(() => {
      result.current.play();
    });
    expect(result.current.playing).toBe(false);
  });

  // R39 (F-36): a link whose `t` is before the span — the span starts at real time, so any `t` in the past is —
  // showed the span's start but played from the link's instant, an hour of wall time before anything moved.
  it('clamps the held instant into the span on resume, so playback starts where the page is (F-36)', () => {
    const { raf, tick } = scriptedRaf();
    const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: NOW - 2 * HOUR_MS, raf }));
    expect(result.current.t).toBe(span.start);
    act(() => {
      result.current.setSpeed(60);
      result.current.play();
    });
    tick(0);
    tick(1000); // one second at 60× is one minute — from the span's start, not from two hours before it
    expect(result.current.t).toBe(span.start + 60_000);
  });

  it('a scrub moves the instant, playing on from there; `now` returns to real time and stops', () => {
    const { raf, tick } = scriptedRaf();
    let realNow = NOW;
    let current = span;
    const { result, rerender } = renderHook(() => usePlayback({ span: current, realNow, initial: null, raf }));
    act(() => {
      result.current.scrub(NOW + 2 * HOUR_MS);
    });
    expect(result.current.t).toBe(NOW + 2 * HOUR_MS);
    expect(result.current.realTime).toBe(false);
    act(() => {
      result.current.play();
    });
    tick(0);
    tick(1000);
    expect(result.current.t).toBe(NOW + 2 * HOUR_MS + 60_000);
    act(() => {
      result.current.scrub(NOW + 5 * HOUR_MS);
    });
    expect(result.current.playing).toBe(true);
    tick(2000);
    expect(result.current.t).toBe(NOW + 5 * HOUR_MS + 60_000);
    act(() => {
      result.current.toNow();
    });
    expect(result.current).toMatchObject({ t: NOW, realTime: true, playing: false });
    // Real time follows the tick again, and the span moves with it.
    realNow = NOW + 10_000;
    current = { start: realNow, end: realNow + 24 * HOUR_MS };
    rerender();
    expect(result.current.t).toBe(NOW + 10_000);
    // A held instant the span has moved past reads as the span's start.
    act(() => {
      result.current.scrub(NOW + 5_000);
    });
    expect(result.current.t).toBe(NOW + 10_000);
    // A scrub past the end clamps.
    act(() => {
      result.current.scrub(current.end + HOUR_MS);
    });
    expect(result.current.t).toBe(current.end);
  });
});
