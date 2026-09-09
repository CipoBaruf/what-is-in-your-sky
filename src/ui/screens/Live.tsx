import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useT } from '../../i18n/useT';
import { cloudVerdict } from '../../lib/cloudVerdict';
import { foldRows } from '../../lib/layout';
import { BODIES_EVERY_MS, due, HASH_EVERY_MS } from '../../lib/playback';
import { liveLinkHash, shareUrl, type LiveLink } from '../../lib/shareLinks';
import type { Span } from '../../lib/timeStripe';
import type { EpochMs, Observer, Pass } from '../../model';
import { useAppStore } from '../../state';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { ShareButton } from '../components/common/ShareButton';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { DOME_BOX_ASPECT } from '../components/guide/skychart/dome/camera';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { drawnAt, hiddenMarkers } from '../components/live/hiddenObjects';
import { arcKey, withArcStates } from '../components/live/liveArcs';
import { HiddenToggle, PlaybackControls } from '../components/live/PlaybackControls';
import { StatusStrip } from '../components/live/StatusStrip';
import { StepControls } from '../components/live/StepControls';
import { StripeOverview } from '../components/live/StripeOverview';
import { TimeReadout } from '../components/live/TimeReadout';
import { TimeStripe } from '../components/live/TimeStripe';
import { useHiddenObjects } from '../components/live/useHiddenObjects';
import { usePlayback } from '../components/live/usePlayback';
import { useSkyBands } from '../components/live/useSkyBands';
import { useWakeLock } from '../components/live/useWakeLock';
import { useWallThrottle } from '../components/live/useWallThrottle';
import { SkyScreen } from '../components/screen/SkyScreen';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import styles from './Live.module.css';

/**
 * R32 (FR-LIVE-1, FR-LIVE-2, FR-LIVE-3, FR-LIVE-9, FR-LIVE-10; US-15 AC1, AC2,
 * AC9): the live page at `#live`. The whole viewport is the dome, with a row
 * of controls above it and, under it, the time stripe, the playback controls
 * and the status strip; `Esc` and the return control go back to the home
 * page, and the header and the Now panel are where it is reached from. The
 * route itself is `LiveRoute.ts`; `App.tsx` mounts this page instead of the
 * home screen, as a lazy chunk of its own (PLAN §11).
 *
 * **One geometry (FR-LIVE-10).** Every satellite on this page is drawn by
 * `SkyChart` from `Pass.track`, with `now = t` and the passes whose interval
 * overlaps `now … now + 24 h`, coloured per satellite in pass order
 * (`colorBy="pass"`, D-158). The hidden objects (FR-LIVE-6) go through the
 * same props as pre-worded markers (D-168). Nothing here draws a satellite
 * any other way, and the count in the strip is the number of markers the
 * chart draws (D-160).
 *
 * **The instant (R33: FR-LIVE-4, FR-LIVE-5, FR-LIVE-9; D-81).** `usePlayback`
 * owns it: real time on the 10 s tick, or an instant held by the link, a
 * scrub or playback. The window's `now` is always real time: what is drawn
 * is the coming 24 h, whatever instant inside it is shown. The hash follows
 * the shown instant at most twice a second while scrubbing and never while
 * playing (D-171), so a reload or a share lands on the same moment.
 *
 * **Sun, Moon and sky (FR-DOME-6, FR-LIVE-3, FR-LIVE-5).** `useSkyBodies`
 * evaluates them here, at most once per second of wall time whatever the
 * speed, and hands them to the chart, so the page owns the one evaluation
 * the strip and the dome both read (D-149).
 *
 * **Inert states (FR-LIVE-1).** No observer, or no elements, is one line and
 * the return control — the top row stays, so the language and the theme are
 * still reachable on a page with no header (on wide; compact is D-244).
 *
 * **Trajectories (R48: FR-TRAJ-1..5, FR-WIN-6, FR-LIVE-7 as amended).** Each
 * pass carries its arc state at the shown instant (`liveArcs.ts`, D-189), so
 * the tracks appear, grow and fade as time moves; the stripe block is the
 * readout, the three-row stripe and the stepping row (D-190); the window view
 * shows real time and hides the block and the playback row (FR-WIN-6).
 */
export interface LivePageProps {
  /** The `#live?…` link, or `null` for the bare route. */
  link: LiveLink | null;
  onLeave: () => void;
}

/** FR-LIVE-2: the span of passes the page draws, from now. */
export const LIVE_WINDOW_MS = 24 * 3_600_000;
/** FR-VIS-5's tick: real time advances at the pace of the Now panel. */
export const TICK_MS = 10_000;

/** The passes drawn: every one with `start ≤ now + 24 h` and `end ≥ now`, in the list's own (start) order, which is the series order (FR-LIVE-2). */
export function livePasses(passes: readonly Pass[], now: EpochMs): Pass[] {
  const until = now + LIVE_WINDOW_MS;
  return passes.filter((pass) => pass.start.t <= until && pass.end.t >= now);
}

/** D-160: the satellites visible at `t` are the passes whose interval contains it — exactly the markers on the dome. */
export function visibleCount(passes: readonly Pass[], t: EpochMs): number {
  return passes.filter((pass) => pass.start.t <= t && t <= pass.end.t).length;
}

export function LivePage({ link, onLeave }: LivePageProps) {
  const t = useT();
  const observer = useAppStore((s) => s.observer);
  const elements = useAppStore((s) => s.elements);
  /*
   * R48 (FR-LIVE-7 as amended, FR-COMP-1, D-244): on compact the top row is one
   * row — the return control and the place, which ellipsises — and the language
   * and theme switches are not on it: with them it was three rows of 48 px
   * tap targets, and FR-COMP-2 puts both on the settings page on a phone
   * (R52). Wide has the room and keeps them, as R32 laid the page out.
   */
  const compact = useLayoutMode() === 'compact';
  /*
   * R69 (FR-SHP-3, F-65, D-381, D-389): on a wide window too short for the box's floor the rows under the box
   * fold, in `lib/layout.ts`'s order, rather than the page scrolling. The answer is written on the page as
   * `data-fold` — the rows folded, space-separated, or no attribute — and `Live.module.css` does the folding.
   * The compact page keeps its own rules (FR-LIVE-7 as amended v1.2: its gaps give, then its box), so it
   * carries no fold whatever its height.
   */
  const fold = useFold();

  /*
   * FR-LIVE-1: Esc returns. R35 moves this into the app-wide listener.
   *
   * R64 (FR-FSC-2, D-321): with the sky screen up, Esc closes the screen and
   * stops — the branch is here, in the page's one listener, rather than in a
   * second listener racing this one for the same key. R66 (D-351): what closes
   * it is the store's own flag, since the screen is no longer this page's to
   * own; leaving the page closes it too, on the way out.
   */
  const screenOpen = useAppStore((s) => s.skyScreen);
  const closeSkyScreen = useAppStore((s) => s.closeSkyScreen);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (screenOpen) {
        closeSkyScreen();
        return;
      }
      onLeave();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onLeave, screenOpen, closeSkyScreen]);
  // FR-FSC-2: leaving the live page by any route closes the screen; the ref is the last committed answer, so the
  // cleanup that runs on unmount reads it without depending on it.
  const openRef = useRef(screenOpen);
  useEffect(() => {
    openRef.current = screenOpen;
  }, [screenOpen]);
  useEffect(
    () => () => {
      if (openRef.current) closeSkyScreen();
    },
    [closeSkyScreen],
  );

  const inert = observer === null ? t.live.noObserver : elements.status !== 'ready' ? t.live.noElements : null;
  // R34 (FR-LIVE-7): the screen stays awake while there is a sky to watch; an inert page asks for nothing.
  const wakeLock = useWakeLock(inert === null);

  return (
    <div
      className={styles.page}
      data-testid="live-page"
      data-state={inert === null ? 'live' : 'inert'}
      data-wake-lock={wakeLock}
      data-compact={compact}
      {...(!compact && fold !== '' ? { 'data-fold': fold } : {})}
    >
      {/* FR-FSC-1 (D-321): the sky screen covers this row for the eye; `inert` is the other half — nothing under
          the layer is reachable, by Tab or by a tap that lands past it — and `aria-hidden` is what takes it out of
          the accessible tree, since `inert` alone is a browser behaviour and not a name a test can read. */}
      <div className={styles.topRow} data-testid="live-top-row" {...(screenOpen ? { inert: true, 'aria-hidden': true } : {})}>
        <button type="button" className={styles.back} onClick={onLeave}>
          {t.live.back}
        </button>
        {observer && (
          <span className={styles.place} data-testid="live-place">
            {observer.label}
          </span>
        )}
        {!compact && (
          <div className={styles.controls}>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        )}
      </div>
      {inert !== null || observer === null ? (
        <p className={styles.inert} data-testid="live-inert">
          {inert}
        </p>
      ) : (
        <LiveSky observer={observer} link={link} />
      )}
    </div>
  );
}

/**
 * R69 (FR-SHP-3): which rows the wide page folds at the viewport's height,
 * as `foldRows` answers for `innerHeight` — read through `useSyncExternalStore`
 * on `resize`, and stored as the joined answer rather than the height, so a
 * drag that crosses no fold threshold re-renders nothing. Without a window
 * (jsdom's tests mount the page with one; a server would not) nothing folds.
 */
function useFold(): string {
  return useSyncExternalStore(subscribeResize, foldSnapshot, noFold);
}

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
  };
}

const foldSnapshot = (): string => foldRows(window.innerHeight).join(' ');
const noFold = (): string => '';

/**
 * D-171: the hash follows the shown instant so a reload or a share lands on
 * it — written with `replaceState` (no history entry, no `hashchange`), at
 * most twice a second while scrubbing and never while playing, where it would
 * be a write per frame for a URL nobody can copy in time. Real time is the
 * bare route, `#live`, not a link: a reload then opens on the saved observer
 * with its own label, where a `#live?lat=…` would rename it to coordinates
 * (D-162); the share action is where the observer goes into a URL.
 */
export const LIVE_ROUTE_HASH = '#live';

function useHashFollows(observer: Observer, shown: EpochMs, realTime: boolean, playing: boolean): void {
  const lastWrite = useRef<number | null>(null);
  useEffect(() => {
    if (playing) return;
    const hash = realTime ? LIVE_ROUTE_HASH : liveLinkHash({ observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: shown });
    const write = (): void => {
      if (window.location.hash === hash) return;
      lastWrite.current = Date.now();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`);
    };
    const wall = Date.now();
    if (due(lastWrite.current, wall, HASH_EVERY_MS)) {
      write();
      return;
    }
    const timer = window.setTimeout(write, (lastWrite.current ?? wall) + HASH_EVERY_MS - wall);
    return () => {
      window.clearTimeout(timer);
    };
  }, [observer, shown, realTime, playing]);
}

/** The page with something to draw: the chart, the strip, the stripe block, the controls and the share action, for one observer. */
function LiveSky({ observer, link }: { observer: Observer; link: LiveLink | null }) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  /*
   * R61 (FR-LIVE-7 as amended v1.2.1, D-314, D-315): on wide the box is cut to the dome's own aspect from what
   * the frame leaves it (`boxAspect`), and the stripe block stands under the box rather than in the rail — the
   * owner's stripe at the bottom of the dome, at every wide width (V12-12).
   *
   * R71 (FR-LEG-6, FR-LIVE-7 as amended v1.4; V14-4, D-386): and the rail is beside the box at every wide
   * width. `LIVE_TWO_COLUMN_MIN_PX` and the one centred column it gated are withdrawn — there is one wide
   * layout again, so the page has no column count to hold and nothing here to switch on but the mode.
   */
  const stripeUnder = !compact;
  const passesState = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const liveHidden = useAppStore((s) => s.liveHidden);
  const setLiveHidden = useAppStore((s) => s.setLiveHidden);
  const now = useNow(TICK_MS);
  const span = useMemo<Span>(() => ({ start: now, end: now + LIVE_WINDOW_MS }), [now]);
  // FR-LIVE-4, FR-LIVE-5, FR-LIVE-9: the link's instant, real time, or wherever the stripe and playback have taken it.
  const playback = usePlayback({ span, realNow: now, initial: link?.t ?? null });
  const shown = playback.t;
  // The passes belong to this observer only once the slice says so; before that the dome is empty rather than someone else's.
  const passes = useMemo(() => (passesState.observer === observer ? livePasses(passesState.passes, now) : []), [passesState.observer, passesState.passes, observer, now]);
  // FR-LIVE-5: the two bodies at most once per second of wall time, whatever the speed.
  const bodiesAt = useWallThrottle(shown, BODIES_EVERY_MS);
  const bodies = useSkyBodies({ observer, now: bodiesAt });
  const bands = useSkyBands(observer, span);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const cloud = cloudVerdict(snapshot, shown);
  const count = visibleCount(passes, shown);
  // R59 (FR-FOL-1, FR-LIVE-8 as amended v1.2, D-276): the control opens the sky window; R64 (FR-FSC-1, D-321) makes
  // what it opens a screen of its own rather than a view of this page. The dome's facing is the drag's alone
  // (FR-GUIDE-4), so the page passes none: the screen's window reads the sensor itself.
  /*
   * R66 (FR-FSC-1, FR-FSC-6; V13-6, D-350, D-351): the screen is opened from the chart's own view control and
   * held in the store, so what this page needs is the one flag that says whether it is drawn at all. The page
   * still decides everything *around* the layer: the inert header, `Esc`, the hidden objects, and closing on
   * the way out.
   */
  const screenOpen = useAppStore((s) => s.skyScreen);
  const closeScreen = useAppStore((s) => s.closeSkyScreen);
  // FR-LIVE-6: the dimmed set at the shown instant, minus what is already on an arc (D-102), worded here (FR-I18N-2).
  // FR-FSC-5 (D-325): held off the sky screen at the hook — while it is up the worker is not asked at all, so
  // no `computeAt` message leaves the page and there is nothing dimmed for the screen to draw even by accident.
  const hiddenState = useHiddenObjects(observer, shown, liveHidden && !screenOpen);
  const hidden = useMemo(
    () => hiddenMarkers(hiddenState, drawnAt(passes, shown), (name, reason) => t.live.hiddenLabel({ name, reason: t.live.hiddenReason[reason] })),
    [hiddenState, passes, shown, t],
  );
  const toggleHidden = useCallback(() => {
    setLiveHidden(!liveHidden);
  }, [liveHidden, setLiveHidden]);
  useHashFollows(observer, shown, playback.realTime, playback.playing);
  /*
   * R54 (FR-TRAJ-5, FR-LIVE-7 as amended v1.1.1) put the stepping row behind `pageHasTouch()`: it was for
   * fingers, and a pointer had the arrow keys. R70 (FR-TRAJ-5 as amended v1.4, V14-6) drops the guard — the row
   * is rendered wherever the stripe is — because `pass ▶|` is not a substitute for a gesture but the one tap
   * FR-SPAN-4 promises, and a mouse has no equivalent of it. `pageHasTouch` is left in the lane unused.
   */
  /*
   * R66 (FR-FSC-8, FR-WIN-6 and FR-FOL-3 as amended v1.3.1; V13-7, D-353): the screen shows *this* instant.
   * R48's `if (following) toNow()` is gone — opening the window used to reset the page to real time, which is
   * exactly what stopped a reader watching a pass that has not happened yet. The layer replaces the page's grid
   * with every hook still mounted, so `usePlayback` keeps its interval and the screen advances at the page's own
   * speed; closing gives the page back at the instant playback has reached, which is `shown` and needs no restore.
   */
  // R48 (FR-TRAJ-1, FR-TRAJ-3, D-189): each pass carries the state its arc is drawn in at the shown instant; the
  // legend reads the same value. Memoised on the states, not the instant, so a frame that changes no state remakes nothing.
  const arcs = arcKey(passes, shown);
  const chartPasses = useMemo(() => withArcStates(passes, arcs), [passes, arcs]);
  // FR-SHARE-1's live form: the place, and the instant only when this page is showing one (real time is the recipient's own).
  const url = shareUrl(window.location.href, liveLinkHash({ observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: playback.realTime ? null : shown }));
  /*
   * R61 (FR-LIVE-7 as amended v1.2, D-312, F-59): where the side column goes.
   * On compact it is the page's own row under the box, as it has been since
   * R34. On wide it is handed to the chart, which puts it in the column beside
   * the drawing under the legend (`aside`): the box then has every row of the
   * page's height and a shape close to the drawing's own, instead of a box
   * wider than the drawing can ever be with a third of its width left over.
   * The same children in the same order either way — the block is built once
   * and placed twice.
   */
  /*
   * R61 (FR-LIVE-7 as amended v1.2.1, V12-13, D-318): the playback controls belong with the stripe they drive.
   * On wide they share the clock readout's row above the stripe — the time row — and the rail keeps what is
   * about the sky: the strip, then the actions (hidden objects, share — the follow control went with R66). On compact the rows are R48's,
   * unchanged: the readout over the stripe, the playback row and the actions under it.
   */
  const playbackControls = <PlaybackControls playing={playback.playing} speed={playback.speed} realTime={playback.realTime} onPlay={playback.play} onPause={playback.pause} onSpeed={playback.setSpeed} onNow={playback.toNow} />;
  const readout = <TimeReadout t={shown} now={now} timeZone={observer.timeZone} />;
  /*
   * R70 (FR-SPAN-2, FR-SPAN-3; D-383, D-384, D-389; V14-6): the block is four rows now. The overview carries the
   * whole 24 h and stands directly above the stripe, under the clock readout; the stripe draws the four hours
   * that hold the shown instant, which is `drawnSpan`'s and not this page's to decide — the same `span` and the
   * same speed go to both, so the bracket is the window the stripe draws at every speed, the whole row at 600×
   * and 3600× (FR-SPAN-6), and the two cannot disagree. The stepping row is no longer behind
   * `touch`: `pass ▶|` is a control a pointer wants as much as a thumb, and it is FR-SPAN-4's one tap.
   */
  const stripeBlock = (
    <div className={styles.stripeBlock} data-testid="stripe-block">
      {stripeUnder ? (
        <div className={styles.timeRow} data-testid="time-row">
          {readout}
          <div className={styles.playbackRow} data-testid="playback-row">
            {playbackControls}
          </div>
        </div>
      ) : (
        readout
      )}
      <div className={styles.overviewRow} data-testid="overview-row">
        <StripeOverview span={span} passes={passes} bands={bands} t={shown} timeZone={observer.timeZone} speed={playback.playing ? playback.speed : null} onScrub={playback.scrub} />
      </div>
      <TimeStripe span={span} passes={passes} bands={bands} t={shown} timeZone={observer.timeZone} speed={playback.playing ? playback.speed : null} onScrub={playback.scrub} />
      <StepControls t={shown} span={span} passes={passes} onStep={playback.stepTo} />
    </div>
  );
  /*
   * R64 (FR-WIN-6 as amended v1.3, D-185's loose end): the strip's true-north line went with the window's
   * being a view of this page. The declination is the sky screen's readout line now (FR-FSC-4), and the
   * strip — which the screen does not carry — has no state left in which it would say it.
   */
  const side = (
    <div className={styles.side} data-testid="live-side">
      <StatusStrip t={shown} timeZone={observer.timeZone} sky={bodies.sky} cloud={cloud} count={count} moon={bodies.moon} speed={playback.playing ? playback.speed : null} />
      {!stripeUnder && stripeBlock}
      {!stripeUnder && (
        <div className={styles.playbackRow} data-testid="playback-row">
          {playbackControls}
        </div>
      )}
      <div className={styles.actions} data-testid="live-actions">
        <HiddenToggle hidden={liveHidden} onToggle={toggleHidden} />
        <ShareButton url={url} title={t.live.shareTitle} text={t.live.shareText(observer.label)} label={compact ? t.live.shareShort : t.live.share} ariaLabel={t.live.share} />
      </div>
    </div>
  );

  /*
   * FR-FSC-1 (D-321): while the control holds, the layer is what this page draws. The page's own hooks are
   * all above this line and stay mounted — the passes and the stored set, playback and the `now` effect, the
   * wake lock, the hash — so closing gives back the page that has been running underneath all along; only its
   * grid is not built. `LivePage`'s one-row header is left mounted and covered, `inert` (FR-FSC-1).
   */
  if (screenOpen) return <SkyScreen passes={chartPasses} observer={observer} now={shown} sun={bodies.sun} moon={bodies.moon} initialFacingAzDeg={0} onClose={closeScreen} />;

  return (
    <>
      <div className={styles.dome} data-testid="live-dome" data-stripe-under={stripeUnder}>
        <SkyChart
          passes={chartPasses}
          observer={observer}
          highlightedPassId={null}
          now={shown}
          sun={bodies.sun}
          moon={bodies.moon}
          hidden={hidden}
          colorBy="pass"
          fill
          initialFacingAzDeg={0}
          {...(compact ? {} : { aside: side, boxAspect: DOME_BOX_ASPECT })}
          {...(stripeUnder ? { stripe: stripeBlock } : {})}
        />
      </div>
      {compact && side}
    </>
  );
}
