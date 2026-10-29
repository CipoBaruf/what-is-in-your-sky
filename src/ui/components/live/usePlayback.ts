import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { advance, advanceAuto, autoSpeed, DEFAULT_SPEED, type Speed } from '../../../lib/playback';
import { clampToSpan, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Pass } from '../../../model';

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
 *
 * R141 (FR-TONIGHT-5, D-899): with `speed: 'auto'` the rate is not a choice but
 * read each frame from the visible passes (`advanceAuto`, which splits a frame
 * at a slow-down boundary), and an `end` override can stop playback before
 * the span's end — the compact page's night end. (FR-TONIGHT-1, D-897)
 * `readerWrote` records whether the reader has moved the instant or touched a
 * control; a write the page makes itself (the jump) passes `'page'` and leaves
 * it alone.
 */

/** Who made a write: the page itself (the jump, FR-TONIGHT-1) passes `'page'`; anything else is the reader's. */
export type WriteOrigin = 'page';

export interface Playback {
  /** The shown instant: real time, or the held one clamped to the span. */
  t: EpochMs;
  /** True while the shown instant is real time (no `t` in the link). */
  realTime: boolean;
  playing: boolean;
  /** The chosen speed, or with `'auto'` the rate the last frame ran at. */
  speed: Speed;
  /** FR-LIVE-4: sets the held instant (a scrub, a click, a key step); playback, if running, continues from it. */
  scrub: (t: EpochMs, origin?: WriteOrigin) => void;
  /**
   * R48 (FR-TRAJ-5, D-190): the stepping control's one contract — land the
   * shown instant on `t` (a rise, or the instant a minute or ten away),
   * clamped to the span. The same write as a scrub: playback, if running,
   * continues from there.
   */
  stepTo: (t: EpochMs, origin?: WriteOrigin) => void;
  play: (origin?: WriteOrigin) => void;
  pause: (origin?: WriteOrigin) => void;
  setSpeed: (speed: Speed) => void;
  /** FR-LIVE-5's `now` action: back to real time, stopped. */
  toNow: (origin?: WriteOrigin) => void;
  /** R141 (FR-TONIGHT-1): true once the reader has written the instant or tapped a time control; the frame loop and `'page'` writes never set it. */
  readerWrote: RefObject<boolean>;
}

export interface PlaybackOptions {
  span: Span;
  realNow: EpochMs;
  /** A link's instant, held from the first render; `null` starts at real time (FR-LIVE-9). */
  initial: EpochMs | null;
  /** R141 (FR-TONIGHT-5): `'auto'` reads the rate from `passes` each frame; a speed (or nothing) is the chosen one, `DEFAULT_SPEED` first. */
  speed?: Speed | 'auto';
  /** The visible passes `'auto'` reads its rate from (D-897). */
  passes?: readonly Pick<Pass, 'start' | 'end'>[];
  /**
   * R141 (FR-TONIGHT-5, D-899): where playback started at `from` stops, before the span's end if earlier (the
   * night's end, `nightEnd`). Asked when playing starts and again whenever the instant is moved, so a move while
   * playing runs on to its own night's end.
   */
  end?: (from: EpochMs) => EpochMs;
  /** Injected for tests; the window's by default. */
  raf?: { request: (callback: (wall: number) => void) => number; cancel: (id: number) => void };
}

const windowRaf = {
  request: (callback: (wall: number) => void): number => window.requestAnimationFrame(callback),
  cancel: (id: number): void => {
    window.cancelAnimationFrame(id);
  },
};

const NO_PASSES: readonly Pick<Pass, 'start' | 'end'>[] = [];

export function usePlayback({ span, realNow, initial, speed: speedOption, passes = NO_PASSES, end, raf = windowRaf }: PlaybackOptions): Playback {
  const auto = speedOption === 'auto';
  const [held, setHeldState] = useState<EpochMs | null>(initial);
  const [playing, setPlaying] = useState(false);
  const [chosen, setChosen] = useState<Speed>(speedOption === undefined || auto ? DEFAULT_SPEED : speedOption);
  const [rate, setRate] = useState<Speed>(() => autoSpeed(initial ?? realNow, passes));
  // The frame loop reads and writes the instant synchronously between frames, then publishes it;
  // every other writer goes through `setHeld` so the ref and the state never disagree.
  const heldRef = useRef<EpochMs | null>(initial);
  const setHeld = useCallback((next: EpochMs | null) => {
    heldRef.current = next;
    setHeldState(next);
  }, []);
  const readerWrote = useRef(false);
  const mark = useCallback((origin: WriteOrigin | undefined) => {
    if (origin !== 'page') readerWrote.current = true;
  }, []);
  const spanEnd = span.end;

  // The frame loop reads these per frame, so new passes or a new end rule do not restart it.
  const passesRef = useRef(passes);
  const endRuleRef = useRef(end);
  useEffect(() => {
    passesRef.current = passes;
    endRuleRef.current = end;
  }, [passes, end]);
  /** The override's answer for the instant playing started from (or was last moved to); the span's end bounds it. */
  const stopRef = useRef<EpochMs>(Number.POSITIVE_INFINITY);
  const anchorStop = useCallback((from: EpochMs) => {
    stopRef.current = endRuleRef.current ? endRuleRef.current(from) : Number.POSITIVE_INFINITY;
  }, []);

  /*
   * R89 (FR-VISIT-3): a held instant that real time overtakes releases to watching. "Overtakes" is read as
   * passing an instant that was *ahead* of real time when it was set — a link's moment, a scrub into the coming
   * hours — so `[ scrub ]`, which holds the instant real time is showing (FR-WATCH-1 a), is not released by the
   * next tick. Not while playing: playback moves the instant itself and stops at the span's end.
   *
   * "Was it ahead when it was set" is answered once per held instant, so the test below runs on `held` alone;
   * real time reaches it through a ref rather than the effect's deps, because a tick is not a new answer — with
   * `realNow` in the deps the flag would be recomputed ten times a minute and go false the moment real time
   * caught up, which is exactly the state the release is reading.
   */
  const realNowRef = useRef(realNow);
  useEffect(() => {
    realNowRef.current = realNow;
  }, [realNow]);
  const aheadRef = useRef(initial !== null && initial > realNow);
  useEffect(() => {
    aheadRef.current = held !== null && held > realNowRef.current;
  }, [held]);
  useEffect(() => {
    if (playing || held === null || !aheadRef.current || realNow < held) return;
    setPlaying(false);
    setHeld(null);
  }, [realNow, held, playing, setHeld]);

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let id = 0;
    const frame = (wall: number): void => {
      if (last !== null) {
        const from = heldRef.current ?? realNow;
        const stop = Math.min(spanEnd, stopRef.current);
        const next = auto ? advanceAuto(from, wall - last, passesRef.current, stop) : advance(from, wall - last, chosen, stop);
        if ('speed' in next) setRate(next.speed);
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
  }, [playing, auto, chosen, spanEnd, raf, setHeld]);

  const scrub = useCallback(
    (t: EpochMs, origin?: WriteOrigin) => {
      mark(origin);
      const at = clampToSpan(t, span);
      // A move while playing plays on to the end that instant's own night gives, not the one it left
      // (paused, the anchor is unread until `play` sets it again).
      anchorStop(at);
      setHeld(at);
    },
    [span, setHeld, mark, anchorStop],
  );
  const play = useCallback(
    (origin?: WriteOrigin) => {
      mark(origin);
      // From real time, playback starts where the tick is; from the end of the span there is nowhere to go.
      // R39 (F-36): the held instant is clamped here, not only on the way out. It is set unclamped — a link's
      // `t` before the span, or one real time has walked past — and the frame loop reads the held value itself,
      // so without this playback would run from outside the span while the page went on showing its edge.
      const from = heldRef.current === null ? realNow : clampToSpan(heldRef.current, span);
      anchorStop(from);
      if (from >= Math.min(spanEnd, stopRef.current)) return;
      if (auto) setRate(autoSpeed(from, passesRef.current));
      setHeld(from);
      setPlaying(true);
    },
    [realNow, span, spanEnd, auto, setHeld, mark, anchorStop],
  );
  const pause = useCallback(
    (origin?: WriteOrigin) => {
      mark(origin);
      setPlaying(false);
    },
    [mark],
  );
  const setSpeed = useCallback(
    (next: Speed) => {
      mark(undefined);
      setChosen(next);
    },
    [mark],
  );
  const toNow = useCallback(
    (origin?: WriteOrigin) => {
      mark(origin);
      setPlaying(false);
      setHeld(null);
    },
    [setHeld, mark],
  );

  return {
    t: held === null ? realNow : clampToSpan(held, span),
    realTime: held === null,
    playing,
    speed: auto ? rate : chosen,
    scrub,
    stepTo: scrub,
    play,
    pause,
    setSpeed,
    toNow,
    readerWrote,
  };
}
