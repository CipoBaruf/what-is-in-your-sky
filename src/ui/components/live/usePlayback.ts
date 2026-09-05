import { useCallback, useEffect, useRef, useState } from 'react';
import { advance, DEFAULT_SPEED, type Speed } from '../../../lib/playback';
import { clampToSpan, type Span } from '../../../lib/timeStripe';
import type { EpochMs } from '../../../model';

/**
 * R33 (FR-LIVE-4, FR-LIVE-5, D-81): the live page's instant. It is either
 * **real time** — the 10 s tick the caller passes as `realNow` — or a **held**
 * instant, set by a scrub or moved by playback. Playing is a
 * `requestAnimationFrame` loop that advances the held instant by the wall time
 * between frames times the speed (`advance`), so a dropped frame loses no
 * simulated time, and stops at the end of the span. `toNow` drops the held
 * instant and the page follows the tick again.
 *
 * The held instant is clamped to the span on the way out rather than when it
 * is set: the span's start is real time and moves under it, and an instant
 * that real time has passed reads as "now" without anyone writing it.
 */
export interface Playback {
  /** The shown instant: real time, or the held one clamped to the span. */
  t: EpochMs;
  /** True while the shown instant is real time (no `t` in the link). */
  realTime: boolean;
  playing: boolean;
  speed: Speed;
  /** FR-LIVE-4: sets the held instant (a scrub, a click, a key step); playback, if running, continues from it. */
  scrub: (t: EpochMs) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: Speed) => void;
  /** FR-LIVE-5's `now` action: back to real time, stopped. */
  toNow: () => void;
}

export interface PlaybackOptions {
  span: Span;
  realNow: EpochMs;
  /** A link's instant, held from the first render; `null` starts at real time (FR-LIVE-9). */
  initial: EpochMs | null;
  /** Injected for tests; the window's by default. */
  raf?: { request: (callback: (wall: number) => void) => number; cancel: (id: number) => void };
}

const windowRaf = {
  request: (callback: (wall: number) => void): number => window.requestAnimationFrame(callback),
  cancel: (id: number): void => {
    window.cancelAnimationFrame(id);
  },
};

export function usePlayback({ span, realNow, initial, raf = windowRaf }: PlaybackOptions): Playback {
  const [held, setHeldState] = useState<EpochMs | null>(initial);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  // The frame loop reads and writes the instant synchronously between frames, then publishes it;
  // every other writer goes through `setHeld` so the ref and the state never disagree.
  const heldRef = useRef<EpochMs | null>(initial);
  const setHeld = useCallback((next: EpochMs | null) => {
    heldRef.current = next;
    setHeldState(next);
  }, []);
  const spanEnd = span.end;

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let id = 0;
    const frame = (wall: number): void => {
      if (last !== null) {
        const from = heldRef.current ?? realNow;
        const next = advance(from, wall - last, speed, spanEnd);
        setHeld(next.t);
        if (next.atEnd) {
          setPlaying(false);
          return;
        }
      }
      last = wall;
      id = raf.request(frame);
    };
    id = raf.request(frame);
    return () => {
      raf.cancel(id);
    };
    // `realNow` is only the starting point when nothing is held; a tick must not restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, spanEnd, raf, setHeld]);

  const scrub = useCallback(
    (t: EpochMs) => {
      setHeld(clampToSpan(t, span));
    },
    [span, setHeld],
  );
  const play = useCallback(() => {
    // From real time, playback starts where the tick is; from the end of the span there is nowhere to go.
    // R39 (F-36): the held instant is clamped here, not only on the way out. It is set unclamped — a link's
    // `t` before the span, or one real time has walked past — and the frame loop reads the held value itself,
    // so without this playback would run from outside the span while the page went on showing its edge.
    const from = heldRef.current === null ? realNow : clampToSpan(heldRef.current, span);
    if (from >= spanEnd) return;
    setHeld(from);
    setPlaying(true);
  }, [realNow, span, spanEnd, setHeld]);
  const pause = useCallback(() => {
    setPlaying(false);
  }, []);
  const toNow = useCallback(() => {
    setPlaying(false);
    setHeld(null);
  }, [setHeld]);

  return {
    t: held === null ? realNow : clampToSpan(held, span),
    realTime: held === null,
    playing,
    speed,
    scrub,
    play,
    pause,
    setSpeed,
    toNow,
  };
}
