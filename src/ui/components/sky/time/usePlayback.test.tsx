/**
 * R33 (FR-LIVE-5, D-81): the playback loop under a scripted animation-frame
 * clock. A dropped frame loses no simulated time, the instant stops at the
 * end of the span, `now` returns to the tick, and a scrub during playback
 * moves the instant without stopping it. R208 (FR-STRIP-4, D-1233): how a page opens — real time at 1×, the pass's
 * loop, or paused under a link's instant and under reduced motion.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia, WIDE_PX, type MatchMediaStub } from '../../../../../tests/support/matchMedia';
import { nightEnd, type Speed } from '../../../../lib/playback';
import { HOUR_MS, type SkyBand, type Span } from '../../../../lib/timeStripe';
import { DEFAULT_PLAY_SPEED } from '../../../../model';
import { appStore } from '../../../../state';
import { usePlayback, type Opening, type Playback } from './usePlayback';

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

  // R48 (FR-TRAJ-5, D-190): the stepping control's one contract.
  it('`stepTo` lands the instant, clamped, and playback goes on from there', () => {
    const { raf, tick } = scriptedRaf();
    const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, raf }));
    act(() => {
      result.current.stepTo(NOW + 2 * HOUR_MS);
    });
    expect(result.current).toMatchObject({ t: NOW + 2 * HOUR_MS, realTime: false, playing: false });
    act(() => {
      result.current.stepTo(NOW - HOUR_MS);
    });
    expect(result.current.t).toBe(NOW);
    act(() => {
      result.current.play();
    });
    tick(1000);
    act(() => {
      result.current.stepTo(NOW + 3 * HOUR_MS);
    });
    tick(2000);
    expect(result.current.playing).toBe(true);
    expect(result.current.t).toBe(NOW + 3 * HOUR_MS + 60 * 1000);
  });

  // R89 (FR-VISIT-3): a held instant that real time overtakes releases to watching.
  it('releases a held instant to real time once real time overtakes it', () => {
    let realNow = NOW;
    const spanAt = (now: number): Span => ({ start: now, end: now + 24 * HOUR_MS });
    const { result, rerender } = renderHook(() => usePlayback({ span: spanAt(realNow), realNow, initial: NOW + 20_000 }));
    expect(result.current.realTime).toBe(false);
    realNow = NOW + 10_000;
    rerender();
    expect(result.current).toMatchObject({ t: NOW + 20_000, realTime: false });
    realNow = NOW + 20_000;
    rerender();
    expect(result.current).toMatchObject({ t: NOW + 20_000, realTime: true });
  });

  it('keeps the instant [ scrub ] holds at real time, however far the tick moves past it', () => {
    let realNow = NOW;
    const spanAt = (now: number): Span => ({ start: now, end: now + 24 * HOUR_MS });
    const { result, rerender } = renderHook(() => usePlayback({ span: spanAt(realNow), realNow, initial: null }));
    act(() => {
      result.current.scrub(NOW);
    });
    realNow = NOW + 60_000;
    rerender();
    expect(result.current.realTime).toBe(false);
  });

  // R141 (FR-TONIGHT-5, D-899): the automatic speed.
  describe("speed 'auto'", () => {
    const MIN = 60_000;
    const rise = NOW + HOUR_MS;
    const passes = [{ start: { t: rise }, end: { t: rise + 6 * MIN } }];

    it('runs a gap at 600× and reports the rate it ran at', () => {
      const { raf, tick } = scriptedRaf();
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', passes, raf }));
      expect(result.current.speed).toBe(600);
      act(() => {
        result.current.play();
      });
      tick(0);
      tick(1000);
      expect(result.current.t).toBe(NOW + 600_000);
      expect(result.current.speed).toBe(600);
    });

    it('splits a frame that crosses the slow-down boundary, so the rise is not passed at 600× (the frame-split test)', () => {
      const { raf, tick } = scriptedRaf();
      const boundary = rise - 5 * MIN;
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: boundary - 300_000, speed: 'auto', passes, raf }));
      act(() => {
        result.current.play();
      });
      tick(0);
      // One frame of a whole second: half of it reaches the boundary at 600×, the rest runs at 60×.
      tick(1000);
      expect(result.current.t).toBe(boundary + 500 * 60);
      expect(result.current.speed).toBe(60);
      // A long dropped frame still crosses the rise at 60×: five minutes before it is five seconds of wall.
      tick(5500);
      expect(result.current.t).toBe(boundary + 5000 * 60);
      expect(result.current.t).toBe(rise);
    });

    it('stops, paused, at the `end` override before the span’s end (the night’s end)', () => {
      const { raf, tick, pending } = scriptedRaf();
      const nightEnd = NOW + 2 * HOUR_MS;
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', passes: [], end: () => nightEnd, raf }));
      act(() => {
        result.current.play();
      });
      tick(0);
      tick(60_000);
      expect(result.current.t).toBe(nightEnd);
      expect(result.current.playing).toBe(false);
      expect(pending()).toBe(0);
      // From the end there is nowhere to go.
      act(() => {
        result.current.play();
      });
      expect(result.current.playing).toBe(false);
    });

    it('asks the `end` rule for the instant playing starts from', () => {
      const { raf, tick } = scriptedRaf();
      const asked: number[] = [];
      const end = (from: number): number => {
        asked.push(from);
        return from + HOUR_MS;
      };
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: NOW + 3 * HOUR_MS, speed: 'auto', passes, end, raf }));
      act(() => {
        result.current.play();
      });
      expect(asked).toEqual([NOW + 3 * HOUR_MS]);
      tick(0);
      tick(60_000);
      expect(result.current.t).toBe(NOW + 4 * HOUR_MS);
      expect(result.current.playing).toBe(false);
    });
    // R141's review: the findings on the end rule, the rate's readout and the speed option.
    it('play from the stop at the night’s end does nothing, with the real `nightEnd` (D-908)', () => {
      const { raf, tick, pending } = scriptedRaf();
      const bands: SkyBand[] = [
        { from: NOW, to: NOW + HOUR_MS, sky: 'dark' },
        { from: NOW + HOUR_MS, to: NOW + 12 * HOUR_MS, sky: 'day' },
        { from: NOW + 12 * HOUR_MS, to: NOW + 20 * HOUR_MS, sky: 'dark' },
      ];
      const end = (from: number): number => nightEnd(bands, from);
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', passes: [], end, raf }));
      act(() => {
        result.current.play();
      });
      tick(0);
      tick(60_000);
      expect(result.current.t).toBe(NOW + HOUR_MS);
      expect(result.current.playing).toBe(false);
      act(() => {
        result.current.play();
      });
      expect(result.current.playing).toBe(false);
      expect(pending()).toBe(0);
    });

    it('asks a new end rule again for the instant playing started from (the bands arriving after the jump)', () => {
      const { raf, tick } = scriptedRaf();
      let end = (_from: number): number => Number.POSITIVE_INFINITY;
      const { result, rerender } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', passes: [], end, raf }));
      act(() => {
        result.current.play('page');
      });
      tick(0);
      tick(1000);
      expect(result.current.t).toBe(NOW + 600_000);
      end = (from) => (from === NOW ? NOW + 2 * HOUR_MS : Number.NaN);
      rerender();
      tick(60_000);
      expect(result.current.t).toBe(NOW + 2 * HOUR_MS);
      expect(result.current.playing).toBe(false);
    });

    it('stops where it is when a new rule puts the stop behind the instant', () => {
      const { raf, tick } = scriptedRaf();
      let end = (_from: number): number => Number.POSITIVE_INFINITY;
      const { result, rerender } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', passes: [], end, raf }));
      act(() => {
        result.current.play();
      });
      tick(0);
      tick(1000);
      end = () => NOW + 60_000;
      rerender();
      tick(2000);
      expect(result.current.t).toBe(NOW + 600_000);
      expect(result.current.playing).toBe(false);
    });

    it('reads out the rate at t while paused: after a scrub, after `now`, after the stop', () => {
      const { raf, tick } = scriptedRaf();
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', passes, end: () => rise + MIN, raf }));
      expect(result.current.speed).toBe(600);
      act(() => {
        result.current.scrub(rise - 4 * MIN);
      });
      expect(result.current.speed).toBe(60);
      act(() => {
        result.current.toNow();
      });
      expect(result.current.speed).toBe(600);
      act(() => {
        result.current.scrub(rise + 7 * MIN);
      });
      expect(result.current.speed).toBe(600);
      act(() => {
        result.current.scrub(NOW);
        result.current.play();
      });
      tick(0);
      tick(60_000);
      expect(result.current.playing).toBe(false);
      expect(result.current.t).toBe(rise + MIN);
      expect(result.current.speed).toBe(60);
    });

    it('a setSpeed while playing does not restart the loop, so no frame’s wall time is dropped', () => {
      const { raf, tick } = scriptedRaf();
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', passes: [], raf }));
      act(() => {
        result.current.play();
      });
      tick(0);
      tick(1000);
      act(() => {
        result.current.setSpeed(3600);
      });
      tick(2000);
      expect(result.current.t).toBe(NOW + 1_200_000);
    });
  });

  it('follows a new fixed speed option, and a switch from auto to one', () => {
    let speed: Speed | 'auto' = 60;
    const { result, rerender } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed }));
    expect(result.current.speed).toBe(60);
    speed = 600;
    rerender();
    expect(result.current.speed).toBe(600);
    speed = 'auto';
    rerender();
    expect(result.current.speed).toBe(600);
    speed = 3600;
    rerender();
    expect(result.current.speed).toBe(3600);
    // Between option changes the reader's choice holds.
    act(() => {
      result.current.setSpeed(1);
    });
    rerender();
    expect(result.current.speed).toBe(1);
  });

  // R141 (FR-TONIGHT-1, D-897): the reader's writes and the page's.
  describe('readerWrote', () => {
    it('starts false and stays false under the page’s writes and the frame loop', () => {
      const { raf, tick } = scriptedRaf();
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, speed: 'auto', raf }));
      expect(result.current.readerWrote.current).toBe(false);
      act(() => {
        result.current.stepTo(NOW + HOUR_MS, 'page');
        result.current.play('page');
      });
      tick(0);
      tick(1000);
      expect(result.current.playing).toBe(true);
      expect(result.current.readerWrote.current).toBe(false);
    });

    it.each([
      ['a scrub', (p: ReturnType<typeof usePlayback>) => p.scrub(NOW + HOUR_MS)],
      ['a step (the keys)', (p: ReturnType<typeof usePlayback>) => p.stepTo(NOW + HOUR_MS)],
      ['play', (p: ReturnType<typeof usePlayback>) => p.play()],
      ['pause', (p: ReturnType<typeof usePlayback>) => p.pause()],
      ['now', (p: ReturnType<typeof usePlayback>) => p.toNow()],
      ['a speed', (p: ReturnType<typeof usePlayback>) => p.setSpeed(600)],
    ])('is set by %s', (_name, write) => {
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null }));
      act(() => {
        write(result.current);
      });
      expect(result.current.readerWrote.current).toBe(true);
    });
  });

  it('releases a scrub into the coming hours when real time reaches it', () => {
    let realNow = NOW;
    const spanAt = (now: number): Span => ({ start: now, end: now + 24 * HOUR_MS });
    const { result, rerender } = renderHook(() => usePlayback({ span: spanAt(realNow), realNow, initial: null }));
    act(() => {
      result.current.scrub(NOW + 30_000);
    });
    realNow = NOW + 40_000;
    rerender();
    expect(result.current.realTime).toBe(true);
  });

  describe('shiftDays and goTo (R187, FR-WIDE-4, D-1100)', () => {
    const shift = { maxDays: 3, timeZone: 'Europe/London' };
    const DAY = 24 * HOUR_MS;

    it('FR-WIDE-4: a day step inside the span keeps it; past it the span is the 24 h from that night\'s noon', () => {
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, shift }));
      act(() => {
        result.current.shiftDays(1);
      });
      expect(result.current).toMatchObject({ t: NOW + DAY, realTime: false, span });
      act(() => {
        result.current.shiftDays(1);
      });
      // NOW is 09:30 UTC on 11 Sep (10:30 BST); two days on is 13 Sep 10:30 BST, whose night began at noon BST on 12 Sep.
      const noon = Date.UTC(2026, 8, 12, 11, 0, 0);
      expect(result.current.t).toBe(NOW + 2 * DAY);
      expect(result.current.span).toEqual({ start: noon, end: noon + DAY });
      act(() => {
        result.current.shiftDays(-1 / 24);
      });
      expect(result.current.span.start).toBe(noon);
      act(() => {
        result.current.toNow();
      });
      expect(result.current).toMatchObject({ t: NOW, realTime: true, span });
    });

    it('FR-WIDE-4: goes back as far as forward, and stops at maxDays from real time', () => {
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, shift }));
      act(() => {
        result.current.shiftDays(-1);
      });
      expect(result.current.t).toBe(NOW - DAY);
      expect(result.current.span.start).toBeLessThanOrEqual(NOW - DAY);
      act(() => {
        result.current.goTo(NOW + 10 * DAY);
      });
      expect(result.current.t).toBe(NOW + 3 * DAY);
    });

    it('without shift a move is a scrub, clamped to the span', () => {
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null }));
      act(() => {
        result.current.shiftDays(2);
      });
      expect(result.current).toMatchObject({ t: span.end, span });
    });

    it('plays to the end of the moved span, not the page\'s', () => {
      const { raf, tick } = scriptedRaf();
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null, shift, raf }));
      act(() => {
        result.current.shiftDays(2);
        result.current.setSpeed(3600);
      });
      act(() => {
        result.current.play();
      });
      tick(0);
      tick(100_000);
      expect(result.current.playing).toBe(false);
      expect(result.current.t).toBe(result.current.span.end);
    });
  });

  describe('the opening (FR-STRIP-4, D-1233)', () => {
    const LIVE: Opening = { speed: 1 };
    const RISE = NOW + 2 * HOUR_MS;
    const SET = RISE + 300_000;
    const PASS: Opening = { speed: 60, loop: { fromMs: RISE, toMs: SET, holdMs: 2_000 } };
    const spanAt = (now: number): Span => ({ start: now, end: now + 24 * HOUR_MS });
    let media: MatchMediaStub;
    beforeEach(() => {
      media = stubMatchMedia(WIDE_PX);
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => {
      vi.useRealTimers();
      media.restore();
      appStore.setState({ playSpeed: DEFAULT_PLAY_SPEED });
    });
    const seconds = (n: number): void => {
      act(() => {
        vi.advanceTimersByTime(n * 1_000);
      });
    };
    /** A live page's hook: the caller's tick stands still at `realNow` until the test moves it. */
    const live = (initial: number | null = null) =>
      renderHook(({ realNow }: { realNow: number }) => usePlayback({ span: spanAt(realNow), realNow, initial, opening: LIVE }), { initialProps: { realNow: NOW } });
    const looped = () => {
      const { raf, tick } = scriptedRaf();
      const hook = renderHook(() => usePlayback({ span, realNow: NOW, initial: RISE, opening: PASS, raf }));
      return { ...hook, tick };
    };

    it('FR-STRIP-4: live opens on real time running at 1×, by real seconds, nothing held, whatever speed is saved', () => {
      appStore.setState({ playSpeed: 3600 });
      const { result } = live();
      expect(result.current).toMatchObject({ t: NOW, realTime: true, playing: true, speed: 1 });
      seconds(3);
      expect(result.current).toMatchObject({ t: NOW + 3_000, realTime: true, playing: true });
      expect(result.current.readerWrote.current).toBe(false);
      expect(appStore.getState().playSpeed).toBe(3600);
    });

    it('FR-STRIP-4: the first pause holds the second on screen, and the next tick of real time does not release it', () => {
      const { result, rerender } = live();
      seconds(7);
      act(() => {
        result.current.pause();
      });
      expect(result.current).toMatchObject({ t: NOW + 7_000, realTime: false, playing: false });
      seconds(5);
      rerender({ realNow: NOW + 10_000 });
      // The span's start moves with the tick, so the held second reads as its start; it stays held.
      expect(result.current).toMatchObject({ realTime: false, playing: false });
    });

    it('FR-STRIP-4: a move holds it paused, and now runs again from the second it is', () => {
      const { result } = live();
      act(() => {
        result.current.scrub(NOW + HOUR_MS);
      });
      seconds(8);
      expect(result.current).toMatchObject({ t: NOW + HOUR_MS, realTime: false, playing: false });
      act(() => {
        result.current.toNow();
      });
      expect(result.current).toMatchObject({ t: NOW + 8_000, realTime: true, playing: true, speed: 1 });
    });

    it('FR-STRIP-4: a pass page opens at 60× from the rise, holds 2 s at the set and starts again from the rise', () => {
      appStore.setState({ playSpeed: 600 });
      const { result, tick } = looped();
      expect(result.current).toMatchObject({ t: RISE, realTime: false, playing: true, speed: 60 });
      tick(0);
      tick(1_000);
      expect(result.current.t).toBe(RISE + 60_000);
      tick(9_000);
      expect(result.current).toMatchObject({ t: SET, playing: true });
      tick(10_000);
      tick(10_900);
      expect(result.current.t).toBe(SET);
      tick(11_000);
      expect(result.current).toMatchObject({ t: RISE, playing: true });
      tick(12_000);
      expect(result.current.t).toBe(RISE + 60_000);
      // Round again: the hold is whole each time.
      tick(20_000);
      tick(21_500);
      expect(result.current.t).toBe(SET);
      tick(22_000);
      expect(result.current.t).toBe(RISE);
      expect(result.current.readerWrote.current).toBe(false);
      expect(appStore.getState().playSpeed).toBe(600);
    });

    it('FR-STRIP-4: the loop ends at the first pause; play then runs on past the set', () => {
      const { result, tick } = looped();
      tick(0);
      tick(4_000);
      act(() => {
        result.current.pause();
      });
      expect(result.current).toMatchObject({ t: RISE + 240_000, playing: false });
      act(() => {
        result.current.play();
      });
      tick(5_000);
      tick(9_000);
      expect(result.current).toMatchObject({ t: RISE + 480_000, playing: true });
    });

    it.each([
      ['a scrub', (p: Playback) => p.scrub(RISE + 90_000)],
      ['a time button', (p: Playback) => p.goTo(RISE + 90_000)],
      ['a key step', (p: Playback) => p.stepTo(RISE + 90_000)],
    ])('FR-STRIP-4: %s during the hold ends the loop for good, paused where it landed', (_name, move) => {
      const { result, tick } = looped();
      tick(0);
      tick(5_000);
      act(() => {
        move(result.current);
      });
      tick(8_000);
      expect(result.current).toMatchObject({ t: RISE + 90_000, playing: false });
    });

    it('FR-STRIP-4: now ends the loop at real time', () => {
      const { result } = looped();
      act(() => {
        result.current.toNow();
      });
      expect(result.current).toMatchObject({ t: NOW, realTime: true, playing: false });
    });

    it('FR-STRIP-4: a speed is neither, so the loop goes on at it', () => {
      const { result, tick } = looped();
      act(() => {
        result.current.setSpeed(1);
      });
      tick(0);
      tick(1_000);
      expect(result.current).toMatchObject({ t: RISE + 1_000, playing: true, speed: 1 });
    });

    it('FR-STRIP-4: the page placing a rise past the span keeps the loop, and the span’s moving drops no frame', () => {
      const { raf, tick } = scriptedRaf();
      const rise = NOW + 30 * HOUR_MS;
      const opening: Opening = { speed: 60, loop: { fromMs: rise, toMs: rise + 300_000, holdMs: 2_000 } };
      const shift = { maxDays: 3, timeZone: 'Europe/London' };
      const { result, rerender } = renderHook(({ realNow }: { realNow: number }) => usePlayback({ span: spanAt(realNow), realNow, initial: rise, opening, shift, raf }), {
        initialProps: { realNow: NOW },
      });
      act(() => {
        result.current.goTo(rise, 'page');
      });
      expect(result.current.span.end).toBeGreaterThan(rise);
      tick(0);
      rerender({ realNow: NOW + 1_000 });
      tick(1_000);
      expect(result.current).toMatchObject({ t: rise + 60_000, playing: true });
    });

    it('FR-STRIP-4: a pass that rises inside the span and sets past its end still reaches its set', () => {
      const { raf, tick } = scriptedRaf();
      const opening: Opening = { speed: 60, loop: { fromMs: span.end - 60_000, toMs: span.end + 120_000, holdMs: 2_000 } };
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: span.end - 60_000, opening, raf }));
      tick(0);
      tick(3_000);
      expect(result.current.t).toBe(span.end + 120_000);
    });

    it.each([
      ['live', LIVE],
      ['a pass', PASS],
    ])('FR-LIVE-9: a link’s instant opens %s paused, whatever is passed', (_name, opening) => {
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: NOW + HOUR_MS, opening }));
      seconds(2);
      expect(result.current).toMatchObject({ t: NOW + HOUR_MS, realTime: false, playing: false });
    });

    it.each([
      ['live', LIVE, null],
      ['a pass', PASS, RISE],
    ])('FR-STRIP-4: reduced motion opens %s paused', (_name, opening, initial) => {
      media.setReducedMotion(true);
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial, opening }));
      seconds(2);
      expect(result.current).toMatchObject({ t: initial ?? NOW, playing: false, speed: DEFAULT_PLAY_SPEED });
    });

    it('FR-LAND-2: with no opening, the compact page, real time stays on the caller’s tick', () => {
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null }));
      seconds(3);
      expect(result.current).toMatchObject({ t: NOW, playing: false });
    });
  });

  describe('the kept speed (FR-KEEP-1, FR-KEEP-2; D-1097)', () => {
    afterEach(() => {
      appStore.setState({ playSpeed: DEFAULT_PLAY_SPEED });
    });

    it('FR-KEEP-2: opens at now, watching, at the saved rate, and saves the rate the reader picks', () => {
      appStore.setState({ playSpeed: 3600 });
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: null }));
      expect(result.current).toMatchObject({ t: NOW, realTime: true, playing: false, speed: 3600 });
      act(() => {
        result.current.setSpeed(600);
      });
      expect(appStore.getState().playSpeed).toBe(600);
    });

    it('FR-KEEP-2: a link instant wins for the open and writes nothing', () => {
      const { result } = renderHook(() => usePlayback({ span, realNow: NOW, initial: NOW + HOUR_MS }));
      expect(result.current.t).toBe(NOW + HOUR_MS);
      expect(appStore.getState().playSpeed).toBe(DEFAULT_PLAY_SPEED);
    });
  });
});
