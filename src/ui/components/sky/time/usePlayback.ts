import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { advance, advanceAuto, autoRates, autoSpeed, spanFor, type Advance, type PassTimes, type Speed } from '../../../../lib/playback';
import { clampToSpan, DAY_MS, type Span } from '../../../../lib/timeStripe';
import type { EpochMs } from '../../../../model';
import { appStore, useAppStore } from '../../../../state';
import { REDUCED_MOTION, useMediaQuery } from '../../../hooks/useMediaQuery';

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
 *
 * R187 (FR-WIDE-4, D-1100): with `shift` a move past the span moves the span with it — `goTo` and `shiftDays` — to
 * the 24 h from the noon before the new instant, up to `maxDays` from real time either way; `toNow` brings it back.
 *
 * R208 (FR-STRIP-4, D-1233): with `opening` a page opens playing. At 1× that is real time itself, read each second,
 * nothing held (D-1253); with a loop it is the rise to the set, over again, until the reader's first write (D-1254).
 */

/** Who made a write: the page itself (the jump, FR-TONIGHT-1) passes `'page'`; anything else is the reader's. */
type WriteOrigin = 'page';

/** A second of real time while it runs at 1× (D-1253). */
const CLOCK_MS = 1_000;

/** FR-STRIP-4 (D-1233): how a page opens playing — real time at 1×, or a loop between two instants at a speed. */
export type Opening = { speed: 1; loop?: undefined } | { speed: Speed; loop: { fromMs: EpochMs; toMs: EpochMs; holdMs: number } };

export interface Playback {
  /** The shown instant: real time, or the held one clamped to the span. */
  t: EpochMs;
  /** True while the shown instant is real time (no `t` in the link). */
  realTime: boolean;
  /** True while time runs: playback, the opening's loop, or real time at 1× (R208). */
  playing: boolean;
  /** The chosen speed; with `'auto'`, the rate the last frame ran at while playing and the rate at `t` otherwise. */
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
  /** R187 (FR-WIDE-4): the span the instant is in — the caller's, or the 24 h a move past it went to (`shift`). */
  span: Span;
  /** R187 (FR-WIDE-4): sets the held instant, moving the span where it falls outside it (with `shift`; a scrub otherwise). */
  goTo: (t: EpochMs, origin?: WriteOrigin) => void;
  /** R187 (FR-WIDE-4): moves the shown instant by `days` (an hour is 1/24), the span with it where it leaves it. */
  shiftDays: (days: number) => void;
  /** R141 (FR-TONIGHT-1): true once the reader has written the instant or tapped a time control; the frame loop and `'page'` writes never set it. */
  readerWrote: RefObject<boolean>;
}

export interface PlaybackOptions {
  span: Span;
  realNow: EpochMs;
  /** A link's instant, held from the first render; `null` starts at real time (FR-LIVE-9). */
  initial: EpochMs | null;
  /**
   * R141 (FR-TONIGHT-5): `'auto'` reads the rate from `passes` each frame; a speed (or nothing) is the chosen one,
   * `DEFAULT_SPEED` first. A new speed here (or a switch from `'auto'` to one) becomes the chosen one; `setSpeed`
   * changes it in between.
   */
  speed?: Speed | 'auto';
  /** The visible passes `'auto'` reads its rate from (D-897). */
  passes?: readonly PassTimes[];
  /**
   * R141 (FR-TONIGHT-5, D-899): where playback started at `from` stops, before the span's end if earlier (the
   * night's end, `nightEnd`). Asked when playing starts and again whenever the instant is moved, so a move while
   * playing runs on to its own night's end; a new rule (the bands arriving after `play`) is asked again for the same
   * instant.
   */
  end?: (from: EpochMs) => EpochMs;
  /**
   * R144 (FR-TONIGHT-7): where `play` starts while the shown instant is real time — the clock the page's headline
   * shows, which ticks each second where `realNow` ticks every ten, so a play from real time never steps back to the
   * last tick. Read at the tap and clamped to the span; `realNow` without it.
   */
  realFrom?: () => EpochMs;
  /** R187 (FR-WIDE-4, D-1100): lets a move past the span move it, within `maxDays` of real time; the noon is the zone's. */
  shift?: { maxDays: number; timeZone: string | null };
  /**
   * R208 (FR-STRIP-4, D-1233): how the page opens. An `initial` that is not the loop's start is a link's and opens
   * paused, and so does reduced motion, whatever is passed here.
   */
  opening?: Opening | undefined;
  /** Injected for tests; the window's by default. */
  raf?: { request: (callback: (wall: number) => void) => number; cancel: (id: number) => void };
}

const windowRaf = {
  request: (callback: (wall: number) => void): number => window.requestAnimationFrame(callback),
  cancel: (id: number): void => {
    window.cancelAnimationFrame(id);
  },
};

const NO_PASSES: readonly PassTimes[] = [];

export function usePlayback({ span: base, realNow, initial, speed: speedOption, passes = NO_PASSES, end, realFrom, shift, opening, raf = windowRaf }: PlaybackOptions): Playback {
  // R187 (D-1100): the start of the 24 h a move past the caller's span went to; `null` is the caller's span.
  const [anchor, setAnchor] = useState<EpochMs | null>(null);
  const baseLength = base.end - base.start;
  const span = useMemo<Span>(() => (anchor === null ? base : { start: anchor, end: anchor + baseLength }), [anchor, base, baseLength]);
  const auto = speedOption === 'auto';
  const [held, setHeldState] = useState<EpochMs | null>(initial);
  const [playing, setPlaying] = useState(false);
  const still = useMediaQuery(REDUCED_MOTION);
  // Read at open: a pass refined later does not restart a loop the reader is watching, or one they have stopped.
  const [loop, setLoop] = useState(() => (!still && opening?.loop?.fromMs === initial ? (opening?.loop ?? null) : null));
  const looping = loop !== null && opening?.loop !== undefined && !still;
  // D-1253: real time running is nothing held, so the hash, the share link and the watching state read as real time.
  const followsClock = opening !== undefined && opening.loop === undefined && !still;
  const following = followsClock && held === null && !playing;
  const fixed = speedOption === undefined || auto ? null : speedOption;
  /*
   * R190 (FR-KEEP-1, FR-KEEP-2; D-1097): the rate `play` starts at is the saved `playSpeed`, read once; a speed the
   * reader picks is saved. The instant is never read from the store: every open is at `initial` (a link's) or now,
   * watching, whatever rate is saved.
   */
  const savePlaySpeed = useAppStore((s) => s.setPlaySpeed);
  const [chosen, setChosen] = useState<Speed>(() => fixed ?? (looping ? opening.speed : appStore.getState().playSpeed));
  // A new fixed speed from the caller is adopted during render, as React's "a prop changed" pattern does.
  const [lastFixed, setLastFixed] = useState(fixed);
  if (fixed !== lastFixed) {
    setLastFixed(fixed);
    if (fixed !== null) setChosen(fixed);
  }
  // The rate the last frame ran at; the ref keeps the frame loop from publishing the same rate every frame.
  const [rate, setRate] = useState<Speed>(() => autoSpeed(initial ?? realNow, passes));
  const rateRef = useRef<Speed>(rate);
  const publishRate = useCallback((next: Speed) => {
    if (next === rateRef.current) return;
    rateRef.current = next;
    setRate(next);
  }, []);
  // The frame loop reads and writes the instant synchronously between frames, then publishes it;
  // every other writer goes through `setHeld` so the ref and the state never disagree.
  const heldRef = useRef<EpochMs | null>(initial);
  const setHeld = useCallback((next: EpochMs | null) => {
    heldRef.current = next;
    setHeldState(next);
  }, []);
  const readerWrote = useRef(false);
  const mark = useCallback((origin: WriteOrigin | undefined) => {
    if (origin === 'page') return;
    readerWrote.current = true;
    setLoop(null);
  }, []);
  const spanEnd = span.end;

  // The frame loop reads these per frame, so new passes, a new end rule or a new speed do not restart it.
  // `rates` keeps the last rate span (`autoRates`), so a frame scans the passes only when `t` crosses an edge.
  const passesRef = useRef(passes);
  const ratesRef = useRef(autoRates(passes));
  useEffect(() => {
    passesRef.current = passes;
    ratesRef.current = autoRates(passes);
  }, [passes]);
  const chosenRef = useRef(chosen);
  useEffect(() => {
    chosenRef.current = chosen;
  }, [chosen]);
  /** The override's answer for the instant playing started from (or was last moved to); the span's end bounds it. */
  const endRuleRef = useRef(end);
  const anchorRef = useRef<EpochMs | null>(null);
  const stopRef = useRef<EpochMs>(Number.POSITIVE_INFINITY);
  const anchorStop = useCallback((from: EpochMs) => {
    anchorRef.current = from;
    stopRef.current = endRuleRef.current ? endRuleRef.current(from) : Number.POSITIVE_INFINITY;
  }, []);
  // A new rule is asked again for the same instant: `play('page')` before the bands load anchors at `Infinity`,
  // and the night's end has to reach that run once they arrive.
  useEffect(() => {
    endRuleRef.current = end;
    if (anchorRef.current !== null) anchorStop(anchorRef.current);
  }, [end, anchorStop]);

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
  // D-1253: the second last read while following. It outlives a pause: the instant paused on is not ahead of real time.
  const [clock, setClock] = useState<EpochMs | null>(null);
  const live = clock === null ? realNow : Math.max(realNow, clock);
  const realNowRef = useRef(live);
  useEffect(() => {
    realNowRef.current = live;
  }, [live]);
  // Read at the tap, so a new reader each render (an inline arrow) does not remake `play`.
  const realFromRef = useRef(realFrom);
  useEffect(() => {
    realFromRef.current = realFrom;
  }, [realFrom]);
  const readClock = useCallback((): EpochMs => realFromRef.current?.() ?? Date.now(), []);
  useEffect(() => {
    if (!following) return;
    const id = window.setInterval(() => {
      setClock(readClock());
    }, CLOCK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [following, readClock]);
  const aheadRef = useRef(initial !== null && initial > realNow);
  useEffect(() => {
    aheadRef.current = held !== null && held > realNowRef.current;
  }, [held]);
  useEffect(() => {
    if (playing || looping || held === null || !aheadRef.current || realNow < held) return;
    setPlaying(false);
    setHeld(null);
    setAnchor(null);
  }, [realNow, held, playing, looping, setHeld]);

  const heldAtSetRef = useRef(0);
  // The loop has its own end, so the span's moving with the tick does not restart its frames.
  const runEnd = looping ? loop.toMs : spanEnd;
  useEffect(() => {
    if (!playing && !looping) return;
    let last: number | null = null;
    let id = 0;
    const frame = (wall: number): void => {
      if (last !== null) {
        const from = heldRef.current ?? realNow;
        if (looping) {
          if (from < runEnd) setHeld(advance(from, wall - last, chosenRef.current, runEnd).t);
          else {
            heldAtSetRef.current += wall - last;
            if (heldAtSetRef.current >= loop.holdMs) {
              heldAtSetRef.current = 0;
              setHeld(loop.fromMs);
            }
          }
          last = wall;
          id = raf.request(frame);
          return;
        }
        const stop = Math.min(runEnd, stopRef.current);
        let next: Advance;
        // A stop that a new rule moved behind the instant (the bands late, the run already past the night) stops it where it is.
        if (from >= stop) next = { t: from, atEnd: true };
        else if (auto) {
          const moved = advanceAuto(from, wall - last, ratesRef.current, stop);
          publishRate(moved.speed);
          next = moved;
        } else next = advance(from, wall - last, chosenRef.current, stop);
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
  }, [playing, looping, loop, auto, runEnd, raf, setHeld, publishRate]);

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
      // From real time, playback starts where the tick is (or the clock `realFrom` reads, R144); from the end of
      // the span there is nowhere to go. R39 (F-36): the held instant is clamped here, not only on the way out. It is set unclamped — a link's
      // `t` before the span, or one real time has walked past — and the frame loop reads the held value itself,
      // so without this playback would run from outside the span while the page went on showing its edge.
      const from = clampToSpan(heldRef.current ?? realFromRef.current?.() ?? live, span);
      anchorStop(from);
      if (from >= Math.min(spanEnd, stopRef.current)) return;
      if (auto) publishRate(autoSpeed(from, passesRef.current));
      setHeld(from);
      setPlaying(true);
    },
    [live, span, spanEnd, auto, setHeld, mark, anchorStop, publishRate],
  );
  const pause = useCallback(
    (origin?: WriteOrigin) => {
      mark(origin);
      setPlaying(false);
      // D-1253: pausing real time holds the second on screen (FR-LIVE-5's pause at now).
      if (following) setHeld(clampToSpan(realNowRef.current, span));
    },
    [mark, following, span, setHeld],
  );
  const setSpeed = useCallback(
    (next: Speed) => {
      // Not `mark`: a speed is neither a pause nor a move, so the opening's loop goes on at it (D-1254).
      readerWrote.current = true;
      setChosen(next);
      savePlaySpeed(next);
    },
    [savePlaySpeed],
  );
  const toNow = useCallback(
    (origin?: WriteOrigin) => {
      mark(origin);
      setPlaying(false);
      setHeld(null);
      setAnchor(null);
      if (followsClock) setClock(readClock());
    },
    [setHeld, mark, followsClock, readClock],
  );
  const maxDays = shift?.maxDays ?? null;
  const shiftZone = shift?.timeZone ?? null;
  const goTo = useCallback(
    (target: EpochMs, origin?: WriteOrigin) => {
      if (maxDays === null) {
        scrub(target, origin);
        return;
      }
      mark(origin);
      const reach = maxDays * DAY_MS;
      const at = Math.min(Math.max(target, realNowRef.current - reach), realNowRef.current + reach);
      const next = spanFor(at, base, span, shiftZone);
      setAnchor(next);
      anchorStop(at);
      setHeld(next === null ? clampToSpan(at, base) : at);
    },
    [maxDays, shiftZone, base, span, scrub, mark, anchorStop, setHeld],
  );
  const shiftDays = useCallback(
    (days: number) => {
      // From real time the step is from the instant shown, the tick, so +1 h reads as one hour on the readout.
      const from = heldRef.current === null ? realNowRef.current : clampToSpan(heldRef.current, span);
      goTo(from + days * DAY_MS);
    },
    [goTo, span],
  );

  // A loop is not clamped: a pass that rises inside the span may set past its end.
  const t = held === null ? live : looping ? held : clampToSpan(held, span);
  return {
    t,
    span,
    goTo,
    shiftDays,
    realTime: held === null,
    playing: playing || looping || following,
    // Paused (a scrub, `now`, the stop at the night's end) no frame runs, so the readout is the rate at `t` itself.
    speed: auto ? (playing ? rate : autoSpeed(t, passes)) : following ? 1 : chosen,
    scrub,
    stepTo: scrub,
    play,
    pause,
    setSpeed,
    toNow,
    readerWrote,
  };
}
