import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocale, useT } from '../../i18n/useT';
import { cloudVerdict } from '../../lib/cloudVerdict';
import { foldRows, hintFitsBeside, ROW_PX, scrubPlacement, type LiveFold, type PageShape, type ScrubPlacement } from '../../lib/layout';
import { landmarkLine, landmarkNames } from '../../lib/landmarkLine';
import { legendKeys, legendRows } from '../../lib/legend';
import { LIVE_WINDOW_MS, livePasses } from '../../lib/livePasses';
import { isNoEvent, nextEvent as nextEventOf } from '../../lib/nextEvent';
import { contextLine } from '../../lib/contextLine';
import { BODIES_EVERY_MS, due, HASH_EVERY_MS, linkInstant, nightEnd } from '../../lib/playback';
import { liveLinkHash, shareUrl, type LiveLink } from '../../lib/shareLinks';
import { tonightBand } from '../../lib/shownTime';
import { formatClock } from '../../lib/timeFormat';
import type { Span } from '../../lib/timeStripe';
import { nextTarget, openingChoice, TONIGHT_LEAD_MS, tonightTarget } from '../../lib/tonightJump';
import type { EpochMs, Observer, Pass } from '../../model';
import { useActiveObserver, useAppStore, type ElementsState, type PassesState } from '../../state';
import { sameLocation } from '../../state/slices/location';
import { FailureLine } from '../components/common/FailureLine';
import { Header } from '../components/common/Header';
import { ShareButton } from '../components/common/ShareButton';
import { PageNotices, type LinkNoteKind } from '../components/common/VisitNotice';
import { ChartFrameSlots } from '../components/guide/skychart/ChartFrame';
import { LegendInventoryContext, type LegendInventory } from '../components/guide/skychart/Legend';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { useChartHand } from '../components/guide/skychart/useChartHand';
import { defaultChartView } from './chartViewDefault';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { useSkyScene } from '../components/guide/skychart/useSkyScene';
import { ControlsSheet } from '../components/live/ControlsSheet';
import { drawnAt, hiddenMarkers } from '../components/live/hiddenObjects';
import { arcKey, withArcStates } from '../components/live/liveArcs';
import { OpeningCard, type CardChoice } from '../components/live/OpeningCard';
import { BackToLive, HiddenToggle, PlaybackControls, ScrubButton } from '../components/live/PlaybackControls';
import { ContextLine, shownTimeText, type ShownTimeProps } from '../components/live/ShownTime';
import { SkyHead } from '../components/live/SkyHead';
import { INDICATOR_MARK_PX, StateIndicator } from '../components/live/StateIndicator';
import { TextButton } from '../components/primitives/TextButton';
import { StatusStrip } from '../components/live/StatusStrip';
import { StarsToggle } from '../components/live/StarsToggle';
import { StepControls } from '../components/live/StepControls';
import { StripeOverview } from '../components/live/StripeOverview';
import { TimeReadout } from '../components/live/TimeReadout';
import { TimeStripe } from '../components/live/TimeStripe';
import { TimeTaps } from '../components/live/TimeTaps';
import { TimeTrack, type TimeTrackProps } from '../components/live/TimeTrack';
import { useHiddenObjects } from '../components/live/useHiddenObjects';
import { usePageShape } from '../components/live/usePageShape';
import { usePlayback } from '../components/live/usePlayback';
import { useSkyBands } from '../components/live/useSkyBands';
import { useWakeLock, type WakeLockState } from '../components/live/useWakeLock';
import { useStarSource } from '../components/live/useStarSource';
import { useWallThrottle } from '../components/live/useWallThrottle';
import { Mark } from '../components/mark/Mark';
import { JumpControl, NextEventBlock } from '../components/passes/NextEventBlock';
import { SkyScreen } from '../components/screen/SkyScreen';
import { SkyHint, useSkyHintLine, useSkyHintShown } from '../components/sky/SkyHint';
import { PICK_SELECTOR, SkyViewChartSlot, SkyViewLayout } from '../components/sky/SkyViewLayout';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { REDUCED_MOTION, useMediaQuery } from '../hooks/useMediaQuery';
import { useNow } from '../hooks/useNow';
import { VisuallyHidden } from '../components/primitives/VisuallyHidden';
import { SectionHeading } from '../components/primitives/SectionHeading';
import { requestPlace } from './home/placeRequest';
import styles from './Live.module.css';
import { inventoryClip, jumpFitsOnPath, jumpPlacement, liveShape, rowsFor, type LiveRow } from './liveRows';

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
 *
 * **Tonight on the phone (R144: FR-TONIGHT-1, 2, 4, 6, 9; FR-WATCH-1..5 as
 * amended v2.7; D-898, D-901, D-902, D-904, D-905).** On compact the two states
 * are still a fact read from `t`, but the page renders one inventory in both:
 * the shown time with its chip, the context line, the view row, the time
 * track, the three taps and `[ list (n) ] Share`. Wide is R77's page, untouched.
 *
 * **The full sky (R148: FR-FULL-1..7, FR-FULL-10; D-919..D-928, D-934..D-936).**
 * On compact the page is the layout's `full` form: the box is the screen, the
 * head (`[ ← ]` and the shown time) is the banner fixed over its top-left, and
 * `[ controls ]` at the bottom-right opens a sheet over the sky with the
 * context line, the track and the taps, the view row, the facing row and the
 * actions with the list panel. A `#live` with no `t` waits for the stored run's
 * passes and decides once: a visible pass up now keeps real time; otherwise a
 * card over the sky asks — `[ see next pass ]` lands a minute before the first
 * visible rise and plays (paused under reduced motion), `[ see now ]` stays —
 * and never when the reader moved first. `Esc` takes the screen, the card,
 * the sheet and then the page, in that order.
 *
 * **The sheet (R150: FR-GYRO-7, FR-GYRO-8, FR-GYRO-10; D-947..D-951).** The
 * sheet is a bottom sheet in both shapes and closes on its `×`, a swipe down,
 * `[ controls ]` or `Esc`; a tap on the sky with it open is the sky's. It ends
 * with the satellites: "Satellites (n)" with the hidden toggle at its end and
 * the list open under it, in place of `[ list (n) ]`.
 */
export interface LivePageProps {
  /** The `#live?…` link, or `null` for the bare route. */
  link: LiveLink | null;
  onLeave: () => void;
}

/** FR-VIS-5's tick: real time advances at the pace of the Now panel. */
export const TICK_MS = 10_000;

/** D-160: the satellites visible at `t` are the passes whose interval contains it — exactly the markers on the dome. */
export function visibleCount(passes: readonly Pass[], t: EpochMs): number {
  return passes.filter((pass) => pass.start.t <= t && t <= pass.end.t).length;
}

export function LivePage({ link, onLeave }: LivePageProps) {
  const t = useT();
  const observer = useActiveObserver();
  const elements = useAppStore((s) => s.elements);
  /*
   * R48 (FR-LIVE-7 as amended, FR-COMP-1, D-244): on compact the top row is one
   * row — the return control and the place, which ellipsises — and the language
   * and theme switches are not on it: with them it was three rows of 48 px
   * tap targets, and FR-COMP-2 puts both on the settings page on a phone
   * (R52). Wide has the room and keeps them, as R32 laid the page out.
   */
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
  /*
   * R148 (FR-FULL-5, FR-FULL-10; D-927): `Esc` in four steps, in this one listener — the sky screen up closes it;
   * else the card up is answered as `[ see now ]`; else the open sheet closes; else the page is left. The two
   * middle steps are the sky page's state (`LiveSky`, which is mounted only with a sky to draw), read through
   * `escRef`: it answers `true` when it took the key.
   */
  const escRef = useRef<() => boolean>(() => false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (screenOpen) {
        closeSkyScreen();
        return;
      }
      if (escRef.current()) return;
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

  const passes = useAppStore((s) => s.passes);
  const retryElements = useAppStore((s) => s.retryElements);
  const state = liveState(observer, elements, passes);
  // R34 (FR-LIVE-7): the screen stays awake while there is a sky to watch; an inert page asks for nothing.
  const wakeLock = useWakeLock(state === 'sky');
  /*
   * R92 (FR-A11Y-4): entering the page puts the focus on its Back control, as the settings page does — the
   * control the reader pressed is gone with the home page. The inert page and the sky are two trees, so the
   * control is a new element when the sky arrives; a focus the swap dropped to the body is put back on it.
   */
  const sky = state === 'sky';
  useEffect(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) document.querySelector<HTMLElement>('[data-testid="live-back"]')?.focus();
  }, [sky]);

  if (state !== 'sky' || observer === null) {
    return (
      <Page state="inert" wakeLock={wakeLock} fold={NO_FOLD} placement={null} top={<TopRow place={observer?.label ?? null} screenOpen={screenOpen} onLeave={onLeave} />}>
        <div className={styles.inert} data-testid="live-inert" data-inert={state}>
          {state === 'no-place' && (
            <>
              <p className={styles.inertLine}>{t.live.noPlace}</p>
              <TextButton label={t.live.setPlace} data-testid="live-set-place" onClick={requestPlace} />
            </>
          )}
          {state === 'loading' && (
            <p className={styles.inertLine}>
              <Mark tier="header32" sizePx={INDICATOR_MARK_PX} running />
              <span role="status" data-testid="live-loading">
                {t.live.loadingElements}
              </span>
            </p>
          )}
          {state === 'failed' && elements.status === 'error' && <FailureLine failure={elements.failure} what={t.failure.what.elements} instead={t.live.failedInstead} onRetry={retryElements} />}
        </div>
      </Page>
    );
  }
  return <LiveSky observer={observer} link={link} wakeLock={wakeLock} onLeave={onLeave} escRef={escRef} />;
}

/**
 * R89 (FR-LIVE-1 as amended v2.1, FR-OFF-8, FR-FAIL-6; F-92): what the page can be before it draws, told apart.
 * No observer is **no place**. With one, the page draws once the elements are ready — or, with no usable
 * elements, once the passes for this place are on screen from the stored run (FR-OFF-8: the stored passes'
 * tracks, rather than standing inert for want of a network). Otherwise a failed load is **failed** and anything
 * else — idle before the effects start, a load or a retry under way — is **loading**, so a cold `#live` opens on
 * loading and never flashes the failed text.
 */
export type LiveState = 'no-place' | 'loading' | 'failed' | 'sky';

export function liveState(observer: Observer | null, elements: ElementsState, passes: PassesState): LiveState {
  if (observer === null) return 'no-place';
  if (elements.status === 'ready') return 'sky';
  if (sameLocation(passes.observer, observer) && passes.passes.length > 0) return 'sky';
  return elements.status === 'error' ? 'failed' : 'loading';
}

const NO_FOLD: readonly LiveFold[] = [];

/**
 * The page's own element. R69 (FR-SHP-3, D-381) writes the fold on it as `data-fold` — the rows folded,
 * space-separated, or no attribute — and `Live.module.css` does the folding; the compact page keeps its own
 * rules (FR-LIVE-7 as amended v1.2: its gaps give, then its box), so it carries no fold whatever its height.
 *
 * R78 (D-448): the fold is `LiveSky`'s to say, since it is decided from what the chart's frame has measured and
 * from the state's rows, so the element is rendered by whichever of the two pages there is; the inert page has
 * no box and folds nothing. `data-scrub-placement` is `scrubPlacement`'s answer, for the stylesheet and the tests.
 */
function Page({ state, wakeLock, fold, placement, shape = 'portrait', form = 'rows', top, title, children }: { state: 'live' | 'inert'; wakeLock: WakeLockState; fold: readonly LiveFold[]; placement: ScrubPlacement | null; shape?: PageShape; form?: 'rows' | 'full'; top: ReactNode; title?: string; children: ReactNode }) {
  const t = useT();
  const compact = useLayoutMode() === 'compact';
  /*
   * R92 (FR-A11Y-1, D-529; F-71): the page's landmarks. The top row is the `banner` and everything under it the
   * `main`, both `display: contents`, so their children are still the cells of this grid and no area is re-cut
   * (FR-SHP-2). The `h1` is the page's name, for the outline and not the eye — the page already says where it is
   * with the `live` word beside the bead — and being absolutely positioned it takes no cell of the grid.
   */
  return (
    <div
      className={styles.page}
      data-testid="live-page"
      data-state={state}
      data-wake-lock={wakeLock}
      data-compact={compact}
      // R144 (FR-TONIGHT-9): every shape is one viewport high again — the compact column's box is what its rows leave (R132's scrolling column is gone).
      data-shape={shape}
      // R148 (FR-FULL-1, D-919): the compact sky page is the full form — the box is the screen, the head is fixed over it.
      data-form={form}
      {...(placement === null ? {} : { 'data-scrub-placement': placement })}
      {...(!compact && fold.length > 0 ? { 'data-fold': fold.join(' ') } : {})}
    >
      <header className="landmark-contents">{top}</header>
      <main className="landmark-contents">
        <VisuallyHidden as="h1">{title ?? t.live.open}</VisuallyHidden>
        {children}
      </main>
    </div>
  );
}

/**
 * The page's top row. R129 (FR-FLOW-3, D-845): the row is the app's one `Header`, told it is the live page — on wide
 * the one header row every page has, with `live` marked in its links; on compact `[ ← ]`, the page's name and the
 * place. The language and theme switches the wide row used to carry here (D-244) are the settings page's (V26-10).
 * It is a `div`: the `banner` is the page's own, in its grid.
 *
 * R148, R149 (FR-FULL-2, D-934): the compact page with a place has `SkyHead` over the sky in its stead, so on compact
 * this row is the inert page's alone; the mark and the state indicator it carried on compact (R77, R144) left with it.
 */
function TopRow({ place, screenOpen, onLeave }: { place: string | null; screenOpen: boolean; onLeave: () => void }) {
  return (
    /* R89 (FR-VISIT-2, FR-VISIT-3): the visit notice and the link's moment note head the page under this row,
       R87's components as home mounts them; empty, the strip is not drawn and the area is the row alone. */
    <div className={styles.topArea} data-testid="live-top-area">
      {/* FR-FSC-1 (D-321): the sky screen covers this row for the eye; `inert` is the other half — nothing under
          the layer is reachable, by Tab or by a tap that lands past it — and `aria-hidden` is what takes it out of
          the accessible tree, since `inert` alone is a browser behaviour and not a name a test can read. */}
      <div className={styles.topRow} data-testid="live-top-row" {...(screenOpen ? { inert: true, 'aria-hidden': true } : {})}>
        {/* R85 (FR-COMP-7, D-549): `[ ← ]`, named by the word it no longer draws, is the header's on every sub-page now. */}
        <Header page="live" landmark={false} context={place} onBack={onLeave} backClassName={styles.back} />
      </div>
      {!screenOpen && <PageNotices kinds={LIVE_NOTES} />}
    </div>
  );
}

/** FR-VISIT-3: the notes a live link can leave — its moment has passed, or is beyond the stripe's span. */
const LIVE_NOTES: readonly LinkNoteKind[] = ['past', 'far'];

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

/**
 * R85 (F-81, FR-CAP-5, D-549): the whole text rows the short wide rail leaves its inventory — or `null` where
 * there is no inventory to clip. The header row that names the three times comes off this budget where it is
 * drawn, which only the legend knows: it draws no header when no listed row has times. On that shape the frame's
 * legend scroll box is `flex: 1 1 0` (`Live.module.css`): it is what the rail's head and foot leave, whatever
 * the list holds, so its height is the budget and the list's own height never moves it — the answer cannot
 * feed itself. Observed with the dome row, since the box is the frame's and can be replaced under it.
 */
function useInventoryRows(active: boolean, domeRef: RefObject<HTMLDivElement | null>): number | null {
  const [rows, setRows] = useState<number | null>(null);
  useLayoutEffect(() => {
    const dome = domeRef.current;
    if (!active || !dome || typeof ResizeObserver === 'undefined') {
      setRows(null);
      return;
    }
    let observed: Element | null = null;
    const measure = (): void => {
      // R132 (D-864): the legend is the layout's `list` slot, beside the dome row, with the conditions line under it;
      // the budget is the slot's height less what the conditions take, in the legend's own rows.
      const box = dome.closest('[data-sky-layout]')?.querySelector<HTMLElement>('[data-slot="list"]') ?? null;
      if (!box) return;
      if (box !== observed) {
        if (observed) observer.unobserve(observed);
        observer.observe(box);
        observed = box;
      }
      const legend = box.querySelector('[data-testid="chart-legend"]');
      const rowPx = (legend && parseFloat(getComputedStyle(legend).lineHeight)) || ROW_PX;
      const others = [...box.children].filter((child) => !child.querySelector('[data-testid="chart-legend"]') && child.getAttribute('data-testid') !== 'chart-legend-slot');
      const taken = others.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0) + others.length * (parseFloat(getComputedStyle(box).rowGap) || 0);
      const next = Math.max(0, Math.floor((box.clientHeight - taken) / rowPx));
      setRows((last) => (last === next ? last : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(dome);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [active, domeRef]);
  return rows;
}

/**
 * R101 (FR-JUMP-1, D-624): whether `[ see this pass ]` fits after the headline's path line on the wide page, for
 * `liveRows.ts`'s `jumpPlacement`. Measured, since the path is the pass's words and the rail is what the box
 * leaves: where the path's last line ends (a range over its words, which lay out the same wherever the control
 * goes, so the answer cannot feed itself), and the control's own width wherever it last stood. Until the control
 * has been seen the answer is "fits", so it is drawn on the path first and measured there.
 */
function useJumpFitsOnPath(active: boolean, headlineRef: RefObject<HTMLDivElement | null>, cells: number, passes: readonly Pass[], placement: ScrubPlacement): boolean {
  const [fits, setFits] = useState(true);
  const controlPx = useRef<number | null>(null);
  useLayoutEffect(() => {
    const root = headlineRef.current;
    if (!active || !root || typeof ResizeObserver === 'undefined') return;
    const measure = (): void => {
      const control = document.querySelector('[data-testid="next-event-see"]');
      const width = control?.getBoundingClientRect().width ?? 0;
      if (width > 0) controlPx.current = width;
      const line = root.querySelector('[data-testid="next-event-path"]');
      const words = line?.querySelector('[data-path-text]');
      if (!line || !words || controlPx.current === null) return;
      const range = document.createRange();
      range.selectNodeContents(words);
      if (typeof range.getClientRects !== 'function') return;
      const rects = range.getClientRects();
      const last = rects[rects.length - 1];
      if (!last) return;
      const row = line.getBoundingClientRect();
      const next = jumpFitsOnPath({ lastLineEndPx: last.right - row.left, spacePx: controlPx.current / cells, controlPx: controlPx.current, rowPx: row.width });
      setFits((was) => (was === next ? was : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [active, headlineRef, cells, passes, placement]);
  return fits;
}

/**
 * R144 (FR-TONIGHT-7, D-911): the 1 s clock `ShownTime` reads its seconds from while `t` is real time. One clock for
 * the page, so the headline, the track's value text and `▶` from real time (`usePlayback`'s `realFrom`, through
 * `clockRef`) all read the same second. A provider of its own: its tick re-renders the readers below and not the
 * page, which hands it its children already made, so the page re-renders on its 10 s tick and the frames alone.
 */
const SecondClockContext = createContext<EpochMs>(0);

function SecondClock({ clockRef, children }: { clockRef: RefObject<EpochMs>; children: ReactNode }) {
  const clock = useNow(1_000);
  useLayoutEffect(() => {
    clockRef.current = clock;
  }, [clock, clockRef]);
  return <SecondClockContext.Provider value={clock}>{children}</SecondClockContext.Provider>;
}

/** R148 (FR-FULL-2, D-920): the head over the sky — `[ ← ]` and the shown time — on the page's 1 s clock. */
function ClockedHead({ onBack, ...props }: Omit<ShownTimeProps, 'clock'> & { onBack: () => void }) {
  const clock = useContext(SecondClockContext);
  return <SkyHead {...props} clock={clock} onBack={onBack} />;
}

/** The time track, its value text the headline's words on the same 1 s clock (FR-TONIGHT-3, D-900). */
function ClockedTrack({ shownTime, ...props }: Omit<TimeTrackProps, 'valueText'> & { shownTime: Omit<ShownTimeProps, 'clock'> }) {
  const m = useT();
  const locale = useLocale();
  const clock = useContext(SecondClockContext);
  return <TimeTrack {...props} valueText={shownTimeText(m, locale, { ...shownTime, clock })} />;
}

/** The page with something to draw: the chart, the headline, the conditions, the timelines, the controls and the share action, for one observer. */
function LiveSky({ observer, link, wakeLock, onLeave, escRef }: { observer: Observer; link: LiveLink | null; wakeLock: WakeLockState; onLeave: () => void; escRef: RefObject<() => boolean> }) {
  const t = useT();
  const mode = useLayoutMode();
  const compact = mode === 'compact';
  const shape = usePageShape();
  /*
   * R148 (FR-FULL-4, FR-FULL-5; D-921): the sheet's open state is the page's — `useState`, so every visit opens with
   * it closed, and held here rather than in the sheet so the turn of the phone, which keeps this page mounted
   * (D-877), keeps it. Nothing of it reaches the hash or the history.
   */
  const [sheetOpen, setSheetOpen] = useState(false);
  // FR-FULL-5: closing by the page's own way — `Esc` (R150: the tap on the sky is withdrawn, D-948) — returns the focus to `[ controls ]`.
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    document.querySelector<HTMLElement>('[data-testid="live-controls"]')?.focus();
  }, []);
  // R85 (F-81): the dome row, inside which the short wide inventory's scroll box is measured.
  const domeRef = useRef<HTMLDivElement>(null);
  /*
   * D-789 (R121 review): the window in the box is this page's, not its chart's. The page mounts no chart at all
   * while the sky screen is up, so the hand camera's facing is held here, where a turn of the phone, a trip to the
   * screen and back, or the screen opened from `[ hold up to the sky ]` keep it (FR-FLOW-15).
   */
  const chartHand = useChartHand();
  /*
   * R78 (FR-WATCH-5, FR-WATCH-6; D-448): where the scrub block goes, and what folds, from one measured number —
   * the height the chart's frame has for the box with nothing under it (`ChartFrame`'s `onBoxSpace`), not the
   * viewport's. Neither answer reads the state, so at the short shapes the box is one height in the two
   * (FR-WATCH-7). R132 (D-864): the box's slot spans every rail row, so a fold lets air out of the rail and gives
   * the box nothing back; the measurement is stored as it is, with no fold to take back out of it.
   */
  const [boxHeightPx, setBoxHeightPx] = useState<number | null>(null);
  const onBoxSpace = useCallback((measuredPx: number) => {
    setBoxHeightPx(measuredPx);
  }, []);
  const placement = scrubPlacement({ mode, shape, boxHeightPx });
  const locale = useLocale();
  const passesState = useAppStore((s) => s.passes);
  const elements = useAppStore((s) => s.elements);
  const weather = useAppStore((s) => s.weather);
  const liveHidden = useAppStore((s) => s.liveHidden);
  const setLiveHidden = useAppStore((s) => s.setLiveHidden);
  const now = useNow(TICK_MS);
  const span = useMemo<Span>(() => ({ start: now, end: now + LIVE_WINDOW_MS }), [now]);
  // The passes belong to this observer only once the slice says so; before that the dome is empty rather than someone else's.
  // R89 (FR-OFF-8): by place and not by object, since a stored run's observer is the one it was stored with.
  const ownPasses = sameLocation(passesState.observer, observer);
  const passes = useMemo(() => (ownPasses ? livePasses(passesState.passes, now) : []), [ownPasses, passesState.passes, now]);
  const bands = useSkyBands(observer, span);
  // FR-LIVE-4, FR-LIVE-5, FR-LIVE-9: the link's instant, real time, or wherever the stripe and playback have taken it.
  // R89 (FR-VISIT-3): a link's moment that has passed opens watching, and one beyond the span holds at its end.
  const [initial] = useState(() => linkInstant(link?.t ?? null, now, LIVE_WINDOW_MS));
  /*
   * R144 (FR-TONIGHT-5, D-899, D-908): on compact playback runs at the automatic rate — 60× while a pass is up or
   * near, 600× between — read each frame from the visible passes, and stops at the end of the night the instant is
   * in (`nightEnd`, over the stripe's bands). Wide keeps the chosen speed and the span's end.
   */
  const nightEndRule = useCallback((from: EpochMs) => nightEnd(bands, from), [bands]);
  // R144 (FR-TONIGHT-7): `▶` from real time starts at the second the headline shows, not at the 10 s tick before it.
  const clockRef = useRef<EpochMs>(now);
  const readClock = useCallback(() => clockRef.current, []);
  const playback = usePlayback({ span, realNow: now, initial, ...(compact ? { speed: 'auto' as const, passes, end: nightEndRule, realFrom: readClock } : {}) });
  // The members are each `usePlayback`'s own callbacks; the object around them is new every render (R144 review).
  const { scrub, play, pause, toNow, readerWrote } = playback;
  const shown = playback.t;
  /*
   * R148 (FR-FULL-10, FR-TONIGHT-1 and FR-TONIGHT-2 as amended v2.8; D-925): the card in place of R144's jump — one
   * effect, compact only, decided once when the passes arrive. A URL that carries `t` (FR-LIVE-9) or a reader who
   * moved the instant or touched a control before the passes landed (`readerWrote`) leaves the page where it is,
   * with no card. Otherwise `openingChoice` says: a visible pass up now is no card; a rise later in the span is the
   * card asking, with the pass and the instant `[ see next pass ]` lands on; none in the span is the card's advice.
   * The page stays on real time, not playing, until the reader answers. A wide render decides once too: never.
   */
  const jumpDecided = useRef(false);
  // The stored run's passes have arrived for this place (FR-OFF-8) — with or without one inside the span, since the
  // card's advice is for a span with none (R144's jump waited for one in the span, having nothing to say otherwise).
  const passesKnown = ownPasses && (passesState.passes.length > 0 || passesState.status === 'done');
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const [opening, setOpening] = useState<CardChoice | null>(null);
  useEffect(() => {
    if (!passesKnown || jumpDecided.current) return;
    jumpDecided.current = true;
    if (!compact || (link?.t ?? null) !== null || readerWrote.current) return;
    const choice = openingChoice(passes, now, span);
    // The decision is taken once, when the passes arrive, from a ref the render must not read (`readerWrote`): an effect, as the jump was.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (choice.kind !== 'up') setOpening(choice);
    // D-898, D-925: the decision is taken once, on the first render with passes; what it reads is what that render has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passesKnown]);
  /*
   * D-925: `[ see next pass ]` does what the jump did — lands on the lead instant and plays, paused under reduced
   * motion (FR-TONIGHT-2) — with the sheet closed, as it is until the reader opens it; `[ see now ]` and
   * `[ see the sky now ]` leave real time alone. Either way the card goes.
   */
  const onCardNext = useCallback(
    (at: EpochMs) => {
      setOpening(null);
      scrub(at);
      if (!reducedMotion) play();
    },
    [scrub, play, reducedMotion],
  );
  const onCardNow = useCallback(() => {
    setOpening(null);
  }, []);
  /*
   * D-925: the reader moving the time is an answer in itself — a drag or a tap on the track, `[ tonight ]`,
   * `[ next ]`, `[ now ]` or the play control, every one a reader's write (the ones that set `readerWrote`), so
   * each of the page's handlers for them answers the card first. A drag on the sky turns the camera and writes
   * nothing, so the card stays.
   */
  const answered = useCallback(() => {
    setOpening(null);
  }, []);
  const onPlay = useCallback(() => {
    answered();
    play();
  }, [answered, play]);
  const onPause = useCallback(() => {
    answered();
    pause();
  }, [answered, pause]);
  /*
   * FR-FULL-10: when the card goes, focus returns to `[ controls ]` — where the card held it (its first button took
   * it on appearing, and the card's unmount dropped it to the body). A reader who answered from the sheet keeps the
   * control under their finger (D-934).
   */
  const hadCard = useRef(false);
  useEffect(() => {
    if (opening !== null) {
      hadCard.current = true;
      return;
    }
    if (!hadCard.current) return;
    hadCard.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body) document.querySelector<HTMLElement>('[data-testid="live-controls"]')?.focus();
  }, [opening]);
  // D-927: the two middle steps of `Esc` — the card answered as `[ see now ]`, then the sheet closed.
  useLayoutEffect(() => {
    escRef.current = () => {
      if (opening !== null) {
        setOpening(null);
        return true;
      }
      if (sheetOpen) {
        closeSheet();
        return true;
      }
      return false;
    };
  });
  useEffect(
    () => () => {
      escRef.current = () => false;
    },
    [escRef],
  );
  /*
   * R77 (FR-WATCH-1, D-446): the page is watching while the shown instant is real time and scrubbing while it is
   * held — paused, or playing at a speed. The state is that predicate over the instant `usePlayback` already
   * holds, and nothing else: no flag in the store, nothing new in the hash. So a `#live?t=` link opens scrubbing
   * (its `t` is held from the first render), a bare `#live` opens watching, and no code here knows about states
   * beyond this line. `rowsFor` (D-447) is what the page renders in each.
   */
  const scrubbing = !playback.realTime;
  const inventory = useMemo(() => rowsFor(scrubbing ? 'scrubbing' : 'watching', mode, liveShape(placement)), [scrubbing, mode, placement]);
  const rows = useMemo(() => new Set(inventory), [inventory]);
  const has = (row: LiveRow): boolean => rows.has(row);
  // FR-SHP-3 as amended v2.0: the wide page's fold, from the same number and the state's own rows (D-447).
  const foldKey = (compact ? NO_FOLD : foldRows(boxHeightPx, inventory)).join(' ');
  const fold = useMemo<readonly LiveFold[]>(() => (foldKey === '' ? NO_FOLD : (foldKey.split(' ') as LiveFold[])), [foldKey]);
  // FR-LIVE-5: the two bodies at most once per second of wall time, whatever the speed.
  const bodiesAt = useWallThrottle(shown, BODIES_EVERY_MS);
  const bodies = useSkyBodies({ observer, now: bodiesAt });
  /*
   * R123 (FR-SKY-3, FR-SKY-8, FR-STAR-13; D-791): the stars under the arcs, at the shown instant — one scene for
   * whichever view the page draws and for the screen, rotated once per shown instant, so at 3600× the stars turn
   * with the arcs. The twilight step reads the Sun at the same shown instant (the positions carry it), not the
   * once-a-second bodies, so a fast scrub into the day never draws a night sky.
   */
  const starsLayer = useAppStore((s) => s.starsLayer);
  const starSource = useStarSource(starsLayer);
  /*
   * R127 (FR-SKY-11, FR-SKY-13; D-796, D-797): the highlighted pass is the one the headline is about — `nextEvent` on
   * the page's clock, as the next-event block reads it (the block ticks on the real time, not the shown instant) — so
   * the scene's landmark is its peak's, the window's picker offers its key and `f` faces it; a scrub does not move it.
   */
  const headline = useMemo(() => nextEventOf(passes, now), [passes, now]);
  const highlighted = isNoEvent(headline) ? null : headline.pass;
  const scene = useSkyScene({ observer, now: shown, starsLayer, source: starSource, pass: highlighted });
  // FR-SKY-11: the line under the headline's name line, worded once (`lib/landmarkLine.ts`) in the active language (D-832).
  const landmarkText = useMemo(() => {
    if (!starSource || !highlighted || scene.landmark?.passId !== highlighted.id) return null;
    return landmarkLine(
      scene.landmark,
      landmarkNames(starSource.names, starSource.catalog.con, locale),
      t.live,
    );
  }, [starSource, highlighted, scene.landmark, locale, t]);
  // FR-SKY-11 as amended v2.5 (V25-19, D-840): on a short wide window — the scrub block over the box — the line is
  // the headline's first row to fold, before the overview row; the ring still marks the star and the pass detail keeps it.
  const headlineLine = placement === 'overlay' ? null : landmarkText;
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
  /*
   * R144 (FR-FSC-2, D-914): the corner picker's open state is the page's, not the layout's, since the layout is not
   * mounted while the screen is up: the screen is opened from `[ hold up to the sky ]` inside the open picker, and
   * the `×` gives focus back to that control, which is only there if the row comes back open.
   */
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const legendRowsNow = useMemo(() => legendRows({ passes: chartPasses, highlightedPassId: null, now: shown, hidden, colorBy: 'pass' }), [chartPasses, shown, hidden]);
  const legendCount = legendRowsNow.length;
  // R132 (FR-FLOW-6): the hint's view, as the chart narrows the saved one on compact (`SkyChart`'s rule).
  const chartView = useAppStore((s) => s.chartView);
  // R150 (FR-GYRO-10, D-949): the satellites' heading, which names the list at the sheet's end.
  const satellitesId = useId();
  // FR-SHARE-1's live form: the place, and the instant only when this page is showing one (real time is the recipient's own).
  const url = shareUrl(window.location.href, liveLinkHash({ observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: playback.realTime ? null : shown }));
  // R77 (FR-WATCH-8): the same action and the same link; the name says what the link carries.
  const shareName = scrubbing ? t.live.shareMoment : t.live.share;
  // R77 (FR-WATCH-1 a, D-446): `[ scrub ]` is the pause at now — the instant of the tap, which is the one on screen.
  const scrubHere = useCallback(() => {
    pause();
    scrub(shown);
  }, [pause, scrub, shown]);
  /*
   * R76 (FR-FIRST-3) and R77 (FR-WATCH-2, V20-18): the watching headline is the home page's next-event block,
   * from the same stored run the drawing uses, at real time — the passes of the coming 24 h, so "no pass" says 24.
   */
  // R89 (FR-OFF-8): with no usable elements the page runs on the stored run, whose count is not known here.
  const elementCount = elements.status === 'ready' ? elements.records.length : null;
  const passesPending = !ownPasses || (passesState.status !== 'done' && passesState.status !== 'error');

  const indicator = has('indicator') ? <StateIndicator held={scrubbing} /> : null;
  /*
   * R101 (FR-JUMP-1, FR-JUMP-2; D-624): `[ see this pass ]` dispatches the hold that exists — `stepTo`, the landing
   * `pass ▶|` makes (FR-SPAN-4) — at the rise the headline names. Holding is scrubbing (FR-WATCH-1), so the stripe
   * comes out with its chunk around the instant, the hash takes `t` (D-171) and `[ back to live ]` undoes it.
   * `liveRows.ts` says which row it rides on; it is only ever in the watching inventory, since its rows are.
   */
  const seePass = playback.stepTo;
  const nextEventContext = useMemo(() => ({ hasDarkness: passesState.hasDarkness, elementCount }), [passesState.hasDarkness, elementCount]);
  const liveHours = LIVE_WINDOW_MS / 3_600_000;
  const headlineRef = useRef<HTMLDivElement>(null);
  // The control's cells with its brackets, so one of them is the space before it; re-measured as the passes change.
  const fitsOnPath = useJumpFitsOnPath(!compact && has('next-event'), headlineRef, t.live.seeThisPass.length + 4, passes, placement);
  const jumpAt = scrubbing ? null : jumpPlacement(mode, fitsOnPath);
  const nextEvent = has('next-event') ? (
    <div className={styles.headline} ref={headlineRef}>
      {/* R105 (D-720): on compact the block is the page's headline and not a pane's last block — no rule above it. */}
      <NextEventBlock passes={passes} timeZone={observer.timeZone} context={nextEventContext} pending={passesPending} hours={liveHours} liveLink={false} ruled={!compact} line={headlineLine} {...(jumpAt === 'path' ? { onSee: seePass } : {})} />
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
  /*
   * On wide the overview moves from the rail to the head of the scrub block as the state changes, so it is a new
   * element: a reader stepping it with the arrow keys — which is how a key enters scrubbing — would lose focus
   * at the first key. The row remembers that it held focus, and the new one takes it back.
   */
  const overviewFocus = useRef(false);
  useLayoutEffect(() => {
    if (!overviewFocus.current || (document.activeElement !== null && document.activeElement !== document.body)) return;
    document.querySelector<SVGElement>('[data-testid="stripe-overview"]')?.focus();
    // R78 review: the placement moves it too. On a short wide window `scrubPlacement` flips between `under` and
    // `overlay` as the box is resized, and the overlay's block is a different parent, so the row the reader was
    // stepping is replaced without the state changing. Same loss of focus, same restore.
  }, [scrubbing, placement]);
  const overview = has('overview') ? (
    <div
      className={styles.overviewRow}
      data-testid="overview-row"
      onFocus={() => {
        overviewFocus.current = true;
      }}
      onBlur={() => {
        overviewFocus.current = false;
      }}
    >
      <StripeOverview span={span} passes={passes} bands={bands} t={shown} timeZone={observer.timeZone} speed={playback.playing ? playback.speed : null} onScrub={playback.scrub} />
    </div>
  ) : null;
  const stripe = has('stripe') ? <TimeStripe span={span} passes={passes} bands={bands} t={shown} timeZone={observer.timeZone} speed={playback.playing ? playback.speed : null} onScrub={playback.scrub} /> : null;
  const steps = has('steps') ? <StepControls t={shown} span={span} passes={passes} onStep={playback.stepTo} /> : null;
  const conditions = has('conditions') ? <StatusStrip sky={bodies.sky} cloud={cloud} count={count} moon={bodies.moon} /> : null;
  /*
   * R144 (FR-TONIGHT-3, FR-TONIGHT-4, FR-TONIGHT-7; D-897, D-900, D-901, D-911): the compact page's own rows. Tonight's
   * band is worked out once per tick for the chip and the context line (D-911). Every seek on the track pauses and
   * holds the instant; `tonight` and `next` land where `lib/tonightJump.ts` says (and `tonight` plays, or pauses at
   * an empty night's start); `now` is FR-LIVE-5's action. None of these pass `'page'`: they are the reader's writes,
   * and each answers the card (D-925).
   */
  const night = useMemo(() => tonightBand(bands, now), [bands, now]);
  const seek = useCallback(
    (at: EpochMs) => {
      answered();
      pause();
      scrub(at);
    },
    [answered, pause, scrub],
  );
  const onTonight = useCallback(() => {
    const target = tonightTarget(bands, passes, now, shown, span);
    if (target === null) return;
    answered();
    scrub(target.t);
    if (target.play) play();
    else pause();
  }, [bands, passes, now, shown, span, answered, scrub, play, pause]);
  const withTaps = rows.has('taps');
  // `tonight` has nowhere to land with no night in the bands (none yet, or a polar summer): disabled, as `next` and `now` are.
  const noTonight = useMemo(() => withTaps && tonightTarget(bands, passes, now, now, span) === null, [withTaps, bands, passes, now, span]);
  const nextAt = useMemo(() => (withTaps ? nextTarget(passes, shown) : null), [withTaps, passes, shown]);
  const onNext = useCallback(() => {
    if (nextAt === null) return;
    answered();
    scrub(nextAt);
  }, [nextAt, answered, scrub]);
  // R148 (FR-TONIGHT-4 as amended v2.8, D-926): `now` returns to real time and stops, and marks nothing — the card is asked on every visit.
  const onNow = useCallback(() => {
    answered();
    toNow();
  }, [answered, toNow]);
  const shownTimeProps = { t: shown, realTime: playback.realTime, now, night, timeZone: observer.timeZone };
  const context = has('context') ? (
    <div data-testid="live-context" {...(compact ? { 'data-rhythm': 'group' } : {})}>
      <ContextLine parts={contextLine({ passes, t: shown, span, night, sky: bodies.sky, cloud: cloud.state })} timeZone={observer.timeZone} />
    </div>
  ) : null;
  const track = has('track') ? (
    <div className={styles.trackRow} data-testid="live-track" data-rhythm="row">
      <ClockedTrack span={span} bands={bands} passes={passes} t={shown} onSeek={seek} leadMs={TONIGHT_LEAD_MS} timeZone={observer.timeZone} shownTime={shownTimeProps} />
    </div>
  ) : null;
  const taps = has('taps') ? (
    <div className={styles.tapsRow} data-rhythm="row">
      <TimeTaps playing={playback.playing} onPlay={onPlay} onPause={onPause} onTonight={onTonight} tonightDisabled={noTonight} onNext={onNext} nextDisabled={nextAt === null} onNow={onNow} nowDisabled={playback.realTime} />
    </div>
  ) : null;
  /*
   * R78 (FR-WATCH-5, FR-WATCH-6): on wide the rail's head is the indicator with the clock, or with
   * `[ back to live ]` while scrubbing, so the way out of the state stands in one place and never scrolls away with
   * the rows under it. The compact page has no such head: its time and chip are `SkyHead`'s and its `now` is
   * `TimeTaps`'s, in the sheet (FR-FULL-2, FR-FULL-4).
   */
  const indicatorLine = (
    <div className={styles.indicatorLine}>
      {indicator}
      {has('clock') && (
        <time className={styles.clock} data-testid="live-clock" dateTime={new Date(now).toISOString()}>
          {formatClock(now, observer.timeZone, locale)}
        </time>
      )}
      {has('back-to-live') && <BackToLive onNow={playback.toNow} />}
    </div>
  );
  const actions = (
    <div className={styles.actions} data-testid="live-actions" {...(compact ? { 'data-rhythm': 'group' } : {})}>
      {has('scrub') && <ScrubButton onScrub={scrubHere} />}
      {has('next-event') && jumpAt === 'actions' && <JumpControl passes={passes} context={nextEventContext} hours={liveHours} onSee={seePass} />}
      {has('hidden') && <HiddenToggle hidden={liveHidden} onToggle={toggleHidden} />}
      {/* R132 (FR-FLOW-4, D-846): `[x] stars` is the view row's, at both widths; it was this row's on wide (R123). */}
      {/* R85 (FR-COMP-7, D-549): bracketed again on compact, as every other action; the Spanish labels beside it were shortened instead (D-411 withdrawn). */}
      <div className={styles.share} data-testid="live-share">
        <ShareButton url={url} title={t.live.shareTitle} text={t.live.shareText(observer.label)} label={compact ? t.live.shareShort : shareName} ariaLabel={shareName} />
      </div>
    </div>
  );

  /*
   * FR-FSC-1 (D-321): while the control holds, the layer is what this page draws. The page's own hooks are
   * all above this line and stay mounted — the passes and the stored set, playback and the `now` effect, the
   * wake lock, the hash — so closing gives back the page that has been running underneath all along; only its
   * grid is not built. The one-row header is left mounted and covered, `inert` (FR-FSC-1).
   */
  /*
   * R85 (F-81, FR-CAP-5, D-549): on the short wide window the legend between the rail's head and foot is an
   * inventory that ends on a whole entry, with a `+n` line — `liveRows.ts`'s `inventoryClip` over what the rail
   * leaves it, measured here in whole text rows; no times header takes one of them (D-863). R132 (D-864): the
   * legend is the layout's `list` slot now, so the budget is that slot's height less the conditions line under it.
   */
  const inventoryRows = useInventoryRows(!compact && placement === 'overlay' && !screenOpen, domeRef);
  const legendInventory = useMemo<LegendInventory | null>(
    () =>
      inventoryRows === null
        ? null
        : { clip: (entryRows) => inventoryClip(entryRows, inventoryRows), moreLabel: t.live.more },
    [inventoryRows, t],
  );
  /*
   * R148 (FR-FULL-2, FR-FLOW-3 as amended v2.8; D-920, D-934): on compact the top row and the mark leave the page.
   * The head over the sky — `[ ← ]` and the shown time on the 1 s clock — is the page's banner still (FR-A11Y-1,
   * F-71), fixed at the box's top-left inside the safe area by `Live.module.css`, with R89's link notes under it;
   * the page's name and the place are the `h1`, visually hidden. While the sky screen is up it is covered and inert,
   * as the top row was (FR-FSC-1). Wide keeps R129's top row.
   */
  const top = compact ? (
    <div className={styles.fullTop} data-testid="live-top-area" {...(screenOpen ? { inert: true, 'aria-hidden': true } : {})}>
      <ClockedHead {...shownTimeProps} onBack={onLeave} />
      {!screenOpen && <PageNotices kinds={LIVE_NOTES} />}
    </div>
  ) : (
    <TopRow place={observer.label} screenOpen={screenOpen} onLeave={onLeave} />
  );
  const page = (children: ReactNode): ReactNode => (
    <SecondClock clockRef={clockRef}>
      <Page state="live" wakeLock={wakeLock} fold={fold} placement={placement} shape={shape} top={top} {...(compact ? { form: 'full' as const, title: `${t.header.pages.live} · ${observer.label}` } : {})}>
        {children}
      </Page>
    </SecondClock>
  );
  // FR-FLOW-6: the hint's view is the chart's — the saved view, else the window on a phone and the dome on a desk (D-876).
  const hintView = defaultChartView(mode, chartView);
  const hintShown = useSkyHintShown(hintView);
  const highlightedId = highlighted?.id ?? null;
  const followKey = useMemo(() => (highlightedId === null ? null : (legendKeys(legendRowsNow)[highlightedId] ?? null)), [legendRowsNow, highlightedId]);
  // R148 (FR-FULL-3, D-924): the hint's line, for where it stands beside `[ controls ]`.
  const hintLine = useSkyHintLine(hintView, followKey);
  const hintBeside = hintLine !== null && hintFitsBeside(hintLine.text, t.sheet.controls);
  /*
   * R148 (FR-FULL-4, D-923): the facing row in the sheet — the chart's readout as a button that opens the picker under
   * it, D-904's corner moved into the sheet. The chart portals both parts into the page's slots; the picker's slot is
   * on the page only while the row is open, so the chart places its facing row there on the tap and nowhere before
   * it. A pick — one of the row's options — closes it, read off the DOM, since a portal's events bubble through the
   * chart's tree and not through this row (D-904); `[ hold up to the sky ]` beside the points leaves it open. On
   * the dome, which has no picker, the readout stands alone.
   */
  const facingLabelId = useId();
  const facingPickerId = useId();
  const hasPicker = hintView !== 'dome';
  const facingPickerRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      element.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest(PICK_SELECTOR)) setPickerOpen(false);
      });
    },
    [],
  );
  const facing = (
    <div className={styles.facing} data-testid="live-facing" data-rhythm="group">
      <div className={styles.facingReadout}>
        <div className={styles.facingWords} id={facingLabelId} {...(hasPicker ? { 'aria-hidden': true } : {})}>
          <SkyViewChartSlot name="readout" />
        </div>
        {hasPicker && (
          <button
            type="button"
            className={styles.facingHit}
            data-testid="sky-readout-toggle"
            aria-labelledby={facingLabelId}
            aria-expanded={pickerOpen}
            {...(pickerOpen ? { 'aria-controls': facingPickerId } : {})}
            onClick={() => {
              setPickerOpen(!pickerOpen);
            }}
          />
        )}
      </div>
      {hasPicker && pickerOpen && (
        <div className={styles.facingPicker} id={facingPickerId} ref={facingPickerRef} data-testid="live-facing-picker">
          <SkyViewChartSlot name="picker" />
        </div>
      )}
    </div>
  );
  if (screenOpen) {
    return page(<SkyScreen passes={chartPasses} observer={observer} now={shown} sun={bodies.sun} moon={bodies.moon} scene={scene} initialFacingAzDeg={0} onClose={closeScreen} />);
  }

  /*
   * R132 (FR-FLOW-4, FR-FLOW-6; D-842, D-846, D-848): the page is `SkyViewLayout`'s slots, at every width and
   * shape — the layout is what knows whether it is the column, the box beside the rail, or the landscape phone.
   *
   * `answer` is the headline block: the indicator line where the page has a rail (wide, the landscape phone),
   * the next-event block (or the held instant, `liveRows.ts`) and, on compact, the time row. The view row is
   * the chart's control with `[x] stars` at its end; the readout and the facing picker are the chart's, placed
   * by the layout; the hint is `SkyHint`, with the highlighted pass's key to follow (FR-SKY-13). On compact the
   * actions row is `action`, the legend panel (behind `[ list (n) ]`), the conditions line and the overview are
   * `list`, and the stripe, the step row and the playback row — scrubbing — are `foot`. On wide the legend and
   * the conditions are `list`, and the rail's foot is the overview, the scrub block (R78: the time row with the
   * playback controls, the overview, the stripe and the step row) and the actions. On a short wide window
   * (`overlay`) the scrub block is still the frame's bar over the drawing (D-449) and the overview stays in the foot.
   */
  const overlaid = placement === 'overlay';
  const scrubBlock =
    scrubbing && !compact ? (
      <div className={styles.stripeBlock} data-testid="stripe-block" data-placement={placement}>
        {has('time-row') && (
          <div className={styles.timeRow} data-testid="time-row">
            {readout}
            {playbackRow}
          </div>
        )}
        {!overlaid && overview}
        {stripe}
        {steps}
      </div>
    ) : null;
  /*
   * R144 (FR-TONIGHT-6, D-902, D-905): on compact the answer is the shown time and the context line; the list slot
   * is the legend panel behind `[ list (n) ]`, with the hidden-objects toggle in its head while it is open (its
   * saved state unchanged, FR-LIVE-6); the timeline slot is the track and the taps; and nothing stands in the foot.
   * Wide and its scrub block are as R77 and R78 left them.
   */
  const answer = (
    <div className={styles.railHead} data-testid="live-rail-head">
      {!compact && indicatorLine}
      {nextEvent}
      {context}
    </div>
  );
  const viewRow = (
    <>
      <SkyViewChartSlot name="control" />
      <StarsToggle />
    </>
  );
  const list = (
    <>
      <SkyViewChartSlot name="list" />
      {conditions}
    </>
  );
  const timeline =
    track !== null || taps !== null ? (
      <div className={styles.timeline} data-testid="live-timeline" {...(compact ? { 'data-rhythm': 'group' } : {})}>
        {track}
        {taps}
      </div>
    ) : null;
  const foot = compact ? null : (
    <div className={styles.railFoot} data-testid="live-rail-foot">
      {(!scrubbing || overlaid) && overview}
      {!overlaid && scrubBlock}
      {actions}
    </div>
  );
  const drawing = (
    <div className={styles.dome} data-testid="live-dome" data-stripe-under={false} ref={domeRef}>
      {/* R77 (FR-WATCH-3, FR-MOON-3 as amended v2.0): `moonPhase` is the compact page's alone — the phase and the illumination
          its conditions line gave up. The wide page leaves the legend's plain Moon line. R61 (D-312) → R132: on wide the box is
          cut inside the drawing slot (`stacked`, `measureBox`); the rail is the layout's, not the frame's. */}
      <ChartFrameSlots.Provider value={{ onBoxSpace, ...(overlaid && scrubBlock !== null ? { bottomOverlay: scrubBlock } : {}) }}>
        <LegendInventoryContext.Provider value={legendInventory}>
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
            {...(compact ? { legendOpen: true } : {})}
            moonPhase={compact}
            chartHand={chartHand}
            scene={scene}
            facingPassId={highlighted?.id ?? null}
            {...(compact ? {} : { stacked: true, measureBox: true })}
          />
        </LegendInventoryContext.Provider>
      </ChartFrameSlots.Provider>
    </div>
  );
  /*
   * R148 (FR-FULL-1..7, FR-FULL-10; D-919, D-922..D-925): the compact page is the layout's full form — the box is the
   * screen, and over it the overlay (the card while it asks, the hint until the first gesture) and the sheet slot
   * (`[ controls ]` at the bottom-right, and the sheet it opens). The sheet's rows are FR-FULL-4's, in order: the
   * context line; the track and the taps; the view row; the facing row; `[ Share ]`; and (R150, FR-GYRO-10, D-949)
   * the satellites, open, under their heading with the hidden toggle at its end. R152's `[ follow the phone ]` row
   * goes between the view row and the facing row (FR-GYRO-10). They stay mounted while the sheet is closed, inert (D-932), so a turn of the phone keeps every state.
   * The hint stands on the button's row where both fit in 36 cells and in the row above it otherwise (D-924).
   */
  if (compact) {
    const overlay = (
      <>
        {opening !== null && (
          <div className={styles.cardArea}>
            <OpeningCard choice={opening} now={now} timeZone={observer.timeZone} onNext={onCardNext} onNow={onCardNow} />
          </div>
        )}
        {hintLine !== null && (
          <div className={styles.hintArea} data-beside={hintBeside ? 'true' : 'false'}>
            <SkyHint view={hintView} followKey={followKey} />
          </div>
        )}
      </>
    );
    const sheet = (
      <ControlsSheet open={sheetOpen} onOpenChange={setSheetOpen} place={observer.label} className={styles.controls}>
        {context}
        {timeline}
        <div className={styles.viewRow} data-testid="live-view-row" data-rhythm="group">
          {viewRow}
        </div>
        {facing}
        {actions}
        <section className={styles.satellites} aria-labelledby={satellitesId} data-testid="live-satellites" data-rhythm="group">
          <div className={styles.satellitesHead} data-testid="live-satellites-head">
            <SectionHeading id={satellitesId}>{t.live.satellites({ count: legendCount })}</SectionHeading>
            <HiddenToggle hidden={liveHidden} onToggle={toggleHidden} />
          </div>
          <SkyViewChartSlot name="list" />
        </section>
      </ControlsSheet>
    );
    return page(<SkyViewLayout className={styles.layout} data-testid="live-layout" fill form="full" readoutIn="sheet" drawing={drawing} overlay={overlay} sheet={sheet} />);
  }
  return page(
    <SkyViewLayout
      className={styles.layout}
      data-testid="live-layout"
      fill
      readoutIn="row"
      pickerOpen={pickerOpen}
      onPickerOpen={setPickerOpen}
      answer={answer}
      viewRow={viewRow}
      readout={<SkyViewChartSlot name="readout" />}
      drawing={drawing}
      picker={<SkyViewChartSlot name="picker" />}
      hint={hintShown && <SkyHint view={hintView} followKey={followKey} />}
      {...(timeline === null ? {} : { timeline })}
      list={list}
      {...(foot === null ? {} : { foot })}
    />,
  );
}
