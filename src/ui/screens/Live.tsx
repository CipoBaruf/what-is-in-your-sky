import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useLocale, useT } from '../../i18n/useT';
import { cloudVerdict } from '../../lib/cloudVerdict';
import { foldRows } from '../../lib/layout';
import { legendRows } from '../../lib/legend';
import { BODIES_EVERY_MS, due, HASH_EVERY_MS } from '../../lib/playback';
import { liveLinkHash, shareUrl, type LiveLink } from '../../lib/shareLinks';
import { formatClock } from '../../lib/timeFormat';
import type { Span } from '../../lib/timeStripe';
import type { EpochMs, Observer, Pass } from '../../model';
import { useAppStore } from '../../state';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { ShareButton } from '../components/common/ShareButton';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { LEGEND_PANEL_ID } from '../components/guide/skychart/ChartFrame';
import { DOME_BOX_ASPECT } from '../components/guide/skychart/dome/camera';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { drawnAt, hiddenMarkers } from '../components/live/hiddenObjects';
import { arcKey, withArcStates } from '../components/live/liveArcs';
import { BackToLive, HiddenToggle, LegendToggle, PlaybackControls, ScrubButton } from '../components/live/PlaybackControls';
import { StateIndicator } from '../components/live/StateIndicator';
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
import { NextEventBlock } from '../components/passes/NextEventBlock';
import { SkyScreen } from '../components/screen/SkyScreen';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { useNow } from '../hooks/useNow';
import styles from './Live.module.css';
import { rowsFor, type LiveRow } from './liveRows';

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
 *
 * **Two states (R77: FR-WATCH-1..4, FR-WATCH-8; D-446, D-447).** The page is
 * watching while the shown instant is real time — the next event as its
 * headline, the drawing, one conditions line and the 24 h overview — and
 * scrubbing while an instant is held, when the held instant is the headline and
 * the stripe, the step row and the playback row come out. `[ scrub ]` enters it
 * and `[ back to live ]` leaves it; what each state renders is `liveRows.ts`'s
 * table, and a row it does not list is not in the DOM.
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
      {inert !== null || observer === null ? (
        <>
          <TopRow place={observer?.label ?? null} indicator={null} screenOpen={screenOpen} onLeave={onLeave} />
          <p className={styles.inert} data-testid="live-inert">
            {inert}
          </p>
        </>
      ) : (
        <LiveSky observer={observer} link={link} onLeave={onLeave} />
      )}
    </div>
  );
}

/**
 * The return control, the place, and on wide the switches the header would have carried (D-244). R77
 * (FR-WATCH-2, V20-8): on compact the state indicator stands here, between the two — `[ ← Back ]` at the left,
 * the mark, the word and the place at the right — so the actions row keeps its cells. The live page renders it
 * from `LiveSky`, which owns the state; the inert page renders it without one.
 */
function TopRow({ place, indicator, screenOpen, onLeave }: { place: string | null; indicator: ReactNode; screenOpen: boolean; onLeave: () => void }) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  return (
    /* FR-FSC-1 (D-321): the sky screen covers this row for the eye; `inert` is the other half — nothing under
       the layer is reachable, by Tab or by a tap that lands past it — and `aria-hidden` is what takes it out of
       the accessible tree, since `inert` alone is a browser behaviour and not a name a test can read. */
    <div className={styles.topRow} data-testid="live-top-row" {...(screenOpen ? { inert: true, 'aria-hidden': true } : {})}>
      <button type="button" className={styles.back} onClick={onLeave}>
        {t.live.back}
      </button>
      {indicator}
      {place !== null && (
        <span className={styles.place} data-testid="live-place">
          {place}
        </span>
      )}
      {!compact && (
        <div className={styles.controls}>
          <LanguageToggle />
          <ThemeToggle />
        </div>
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

/** The page with something to draw: the chart, the headline, the conditions, the timelines, the controls and the share action, for one observer. */
function LiveSky({ observer, link, onLeave }: { observer: Observer; link: LiveLink | null; onLeave: () => void }) {
  const t = useT();
  const mode = useLayoutMode();
  const compact = mode === 'compact';
  const locale = useLocale();
  const passesState = useAppStore((s) => s.passes);
  const elements = useAppStore((s) => s.elements);
  const weather = useAppStore((s) => s.weather);
  const liveHidden = useAppStore((s) => s.liveHidden);
  const setLiveHidden = useAppStore((s) => s.setLiveHidden);
  const now = useNow(TICK_MS);
  const span = useMemo<Span>(() => ({ start: now, end: now + LIVE_WINDOW_MS }), [now]);
  // FR-LIVE-4, FR-LIVE-5, FR-LIVE-9: the link's instant, real time, or wherever the stripe and playback have taken it.
  const playback = usePlayback({ span, realNow: now, initial: link?.t ?? null });
  const shown = playback.t;
  /*
   * R77 (FR-WATCH-1, D-446): the page is watching while the shown instant is real time and scrubbing while it is
   * held — paused, or playing at a speed. The state is that predicate over the instant `usePlayback` already
   * holds, and nothing else: no flag in the store, nothing new in the hash. So a `#live?t=` link opens scrubbing
   * (its `t` is held from the first render), a bare `#live` opens watching, and no code here knows about states
   * beyond this line. `rowsFor` (D-447) is what the page renders in each.
   */
  const scrubbing = !playback.realTime;
  const rows = useMemo(() => new Set(rowsFor(scrubbing ? 'scrubbing' : 'watching', mode, 'tall')), [scrubbing, mode]);
  const has = (row: LiveRow): boolean => rows.has(row);
  // The passes belong to this observer only once the slice says so; before that the dome is empty rather than someone else's.
  const passes = useMemo(() => (passesState.observer === observer ? livePasses(passesState.passes, now) : []), [passesState.observer, passesState.passes, observer, now]);
  // FR-LIVE-5: the two bodies at most once per second of wall time, whatever the speed.
  const bodiesAt = useWallThrottle(shown, BODIES_EVERY_MS);
  const bodies = useSkyBodies({ observer, now: bodiesAt });
  const bands = useSkyBands(observer, span);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const cloud = cloudVerdict(snapshot, shown);
  const count = visibleCount(passes, shown);
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
  // R77 (FR-WATCH-4, V20-8): the toggle's saved state applies in both states wherever the control stands.
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
   * R66 (FR-FSC-8, FR-WIN-6 and FR-FOL-3 as amended v1.3.1; V13-7, D-353): the screen shows *this* instant.
   * The layer replaces the page's grid with every hook still mounted, so `usePlayback` keeps its interval and
   * the screen advances at the page's own speed; closing gives the page back at the instant playback has
   * reached, which is `shown` and needs no restore.
   */
  // R48 (FR-TRAJ-1, FR-TRAJ-3, D-189): each pass carries the state its arc is drawn in at the shown instant; the
  // legend reads the same value. Memoised on the states, not the instant, so a frame that changes no state remakes nothing.
  const arcs = arcKey(passes, shown);
  const chartPasses = useMemo(() => withArcStates(passes, arcs), [passes, arcs]);
  /*
   * R71 (FR-LEG-7, D-387, D-388): the compact page's legend control and what it says. `n` is the rows
   * `lib/legend.ts` derives from the props the chart is given — the drawn passes, and the FR-LIVE-6 markers
   * where they are shown — and not the Sun and Moon lines (OQ-26). The open state is the store's, so it
   * survives a reload (`prefs.liveLegendOpen`).
   *
   * R77 (FR-WATCH-4, V20-8): on compact the control is on the watching row only — the scrubbing row gives its
   * cells to `[ back to live ]` and the hidden-objects toggle — but the panel is the legend, which scrubbing
   * renders as watching does ("everything watching renders except the next-event block"): a list opened while
   * watching stays open through the scrub, with the arcs' states in it, and closes from the watching row.
   */
  const legendCount = useMemo(() => legendRows({ passes: chartPasses, highlightedPassId: null, now: shown, hidden, colorBy: 'pass' }).length, [chartPasses, shown, hidden]);
  const legendOpen = useAppStore((s) => s.liveLegendOpen);
  const setLegendOpen = useAppStore((s) => s.setLiveLegendOpen);
  const toggleLegend = useCallback(() => {
    setLegendOpen(!legendOpen);
  }, [legendOpen, setLegendOpen]);
  // FR-SHARE-1's live form: the place, and the instant only when this page is showing one (real time is the recipient's own).
  const url = shareUrl(window.location.href, liveLinkHash({ observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: playback.realTime ? null : shown }));
  // R77 (FR-WATCH-8): the same action and the same link; the name says what the link carries.
  const shareName = scrubbing ? t.live.shareMoment : t.live.share;
  // R77 (FR-WATCH-1 a, D-446): `[ scrub ]` is the pause at now — the instant of the tap, which is the one on screen.
  const scrubHere = useCallback(() => {
    playback.pause();
    playback.scrub(shown);
  }, [playback, shown]);
  /*
   * R76 (FR-FIRST-3) and R77 (FR-WATCH-2, V20-18): the watching headline is the home page's next-event block,
   * from the same stored run the drawing uses, at real time — the passes of the coming 24 h, so "no pass" says 24.
   */
  const elementCount = elements.status === 'ready' ? elements.records.length : elements.status === 'error' ? 0 : null;
  const passesPending = passesState.observer !== observer || (passesState.status !== 'done' && passesState.status !== 'error');

  const indicator = has('indicator') ? <StateIndicator held={scrubbing} /> : null;
  const nextEvent = has('next-event') ? (
    <div className={styles.headline}>
      <NextEventBlock passes={passes} timeZone={observer.timeZone} context={{ hasDarkness: passesState.hasDarkness, elementCount }} pending={passesPending} hours={LIVE_WINDOW_MS / 3_600_000} liveLink={false} />
    </div>
  ) : null;
  const readout = <TimeReadout t={shown} now={now} timeZone={observer.timeZone} />;
  const playbackRow = has('playback') ? (
    <div className={styles.playbackRow} data-testid="playback-row">
      <PlaybackControls playing={playback.playing} speed={playback.speed} onPlay={playback.play} onPause={playback.pause} onSpeed={playback.setSpeed} />
    </div>
  ) : null;
  /*
   * R70 (FR-SPAN-2): the overview carries the whole 24 h; a click, a drag or a key on it sets the shown instant,
   * which is also how it enters scrubbing from watching (FR-WATCH-1 b) — the same `scrub`, and so the same
   * predicate. While watching on compact it has one text row of end labels under it (FR-WATCH-4).
   */
  const overview = has('overview') ? (
    <div className={styles.overviewRow} data-testid="overview-row">
      <StripeOverview span={span} passes={passes} bands={bands} t={shown} timeZone={observer.timeZone} speed={playback.playing ? playback.speed : null} onScrub={playback.scrub} />
    </div>
  ) : null;
  const overviewLabels = has('overview-labels') ? (
    <p className={styles.overviewLabels} data-testid="overview-labels" aria-hidden="true">
      <span>{t.live.overviewStart}</span>
      <span>{t.live.overviewEnd}</span>
    </p>
  ) : null;
  const stripe = has('stripe') ? <TimeStripe span={span} passes={passes} bands={bands} t={shown} timeZone={observer.timeZone} speed={playback.playing ? playback.speed : null} onScrub={playback.scrub} /> : null;
  const steps = has('steps') ? <StepControls t={shown} span={span} passes={passes} onStep={playback.stepTo} /> : null;
  const conditions = <StatusStrip t={shown} timeZone={observer.timeZone} sky={bodies.sky} cloud={cloud} count={count} moon={bodies.moon} />;
  const actions = (
    <div className={styles.actions} data-testid="live-actions">
      {has('scrub') && <ScrubButton onScrub={scrubHere} />}
      {has('back-to-live') && compact && <BackToLive onNow={playback.toNow} />}
      {has('hidden') && <HiddenToggle hidden={liveHidden} onToggle={toggleHidden} />}
      {has('list') && <LegendToggle open={legendOpen} count={legendCount} controls={LEGEND_PANEL_ID} onToggle={toggleLegend} />}
      {/* D-411: plain on compact — the brackets are what the row cannot afford (FR-COMP-4). */}
      <div className={styles.share} data-testid="live-share">
        <ShareButton url={url} title={t.live.shareTitle} text={t.live.shareText(observer.label)} label={compact ? t.live.shareShort : shareName} ariaLabel={shareName} plain={compact} />
      </div>
    </div>
  );

  /*
   * FR-FSC-1 (D-321): while the control holds, the layer is what this page draws. The page's own hooks are
   * all above this line and stay mounted — the passes and the stored set, playback and the `now` effect, the
   * wake lock, the hash — so closing gives back the page that has been running underneath all along; only its
   * grid is not built. The one-row header is left mounted and covered, `inert` (FR-FSC-1).
   */
  const top = <TopRow place={observer.label} indicator={compact ? indicator : null} screenOpen={screenOpen} onLeave={onLeave} />;
  if (screenOpen) {
    return (
      <>
        {top}
        <SkyScreen passes={chartPasses} observer={observer} now={shown} sun={bodies.sun} moon={bodies.moon} initialFacingAzDeg={0} onClose={closeScreen} />
      </>
    );
  }

  if (compact) {
    /*
     * R77 (FR-WATCH-4, FR-WATCH-5): compact portrait, top to bottom — the top row with the indicator, the
     * headline (the next event while watching, the held instant while scrubbing), the frame (the view control,
     * the box, the facing readout, the list panel while open), then the rows under it: the conditions line,
     * the overview, and while scrubbing the stripe, the step row and the playback row, then the actions. The box
     * is what the rows leave, so it is taller while watching; the reader's tap is what changes it (FR-WATCH-7).
     */
    return (
      <>
        {top}
        <div className={styles.head} data-testid="live-head">
          {nextEvent}
          {has('time-row') && (
            <div className={styles.timeRow} data-testid="time-row">
              {readout}
            </div>
          )}
        </div>
        <div className={styles.dome} data-testid="live-dome" data-stripe-under={false}>
          <SkyChart passes={chartPasses} observer={observer} highlightedPassId={null} now={shown} sun={bodies.sun} moon={bodies.moon} hidden={hidden} colorBy="pass" fill initialFacingAzDeg={0} legendOpen={legendOpen} />
        </div>
        <div className={styles.side} data-testid="live-side">
          {conditions}
          {overview}
          {overviewLabels}
          {stripe}
          {steps}
          {playbackRow}
          {actions}
        </div>
      </>
    );
  }

  /*
   * R77 (FR-WATCH-4, FR-WATCH-5): wide. The rail is the sky's — its head is the indicator with the clock (or
   * `[ back to live ]` while scrubbing), the next-event block and the conditions line; the legend is the frame's,
   * under them; its foot is the overview while watching and the actions. While scrubbing the scrub block stands
   * under the box at the box's width — the time row with the playback controls beside the held instant (V12-13),
   * the overview, the stripe and the step row — and the frame re-fits the box to what the block leaves (D-314).
   * While watching there is no block, so the box takes the height down to the page's foot.
   */
  const railHead = (
    <div className={styles.railHead} data-testid="live-rail-head">
      <div className={styles.indicatorLine}>
        {indicator}
        {has('clock') && (
          <time className={styles.clock} data-testid="live-clock" dateTime={new Date(now).toISOString()}>
            {formatClock(now, observer.timeZone, locale)}
          </time>
        )}
        {has('back-to-live') && <BackToLive onNow={playback.toNow} />}
      </div>
      {nextEvent}
      {conditions}
    </div>
  );
  const side = (
    <div className={styles.side} data-testid="live-side">
      {railHead}
      <div className={styles.railFoot} data-testid="live-rail-foot">
        {!scrubbing && overview}
        {actions}
      </div>
    </div>
  );
  const scrubBlock = scrubbing ? (
    <div className={styles.stripeBlock} data-testid="stripe-block">
      {has('time-row') && (
        <div className={styles.timeRow} data-testid="time-row">
          {readout}
          {playbackRow}
        </div>
      )}
      {overview}
      {stripe}
      {steps}
    </div>
  ) : null;
  return (
    <>
      {top}
      <div className={styles.dome} data-testid="live-dome" data-stripe-under>
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
          aside={side}
          boxAspect={DOME_BOX_ASPECT}
          {...(scrubBlock === null ? {} : { stripe: scrubBlock })}
        />
      </div>
    </>
  );
}
