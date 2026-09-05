import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useT } from '../../i18n/useT';
import { cloudVerdict } from '../../lib/cloudVerdict';
import { BODIES_EVERY_MS, due, HASH_EVERY_MS } from '../../lib/playback';
import { liveLinkHash, shareUrl, type LiveLink } from '../../lib/shareLinks';
import type { Span } from '../../lib/timeStripe';
import type { EpochMs, Observer, Pass } from '../../model';
import { useAppStore } from '../../state';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { ShareButton } from '../components/common/ShareButton';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { drawnAt, hiddenMarkers } from '../components/live/hiddenObjects';
import { PlaybackControls } from '../components/live/PlaybackControls';
import { StatusStrip } from '../components/live/StatusStrip';
import { TimeStripe } from '../components/live/TimeStripe';
import { useHiddenObjects } from '../components/live/useHiddenObjects';
import { usePlayback } from '../components/live/usePlayback';
import { useSkyBands } from '../components/live/useSkyBands';
import { useWallThrottle } from '../components/live/useWallThrottle';
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
 * still reachable on a page with no header.
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

  // FR-LIVE-1: Esc returns. R35 moves this into the app-wide listener.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onLeave();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onLeave]);

  const inert = observer === null ? t.live.noObserver : elements.status !== 'ready' ? t.live.noElements : null;

  return (
    <div className={styles.page} data-testid="live-page" data-state={inert === null ? 'live' : 'inert'}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={onLeave}>
          {t.live.back}
        </button>
        {observer && (
          <span className={styles.place} data-testid="live-place">
            {observer.label}
          </span>
        )}
        <div className={styles.controls}>
          <LanguageToggle />
          <ThemeToggle />
        </div>
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

/** The page with something to draw: the chart, the stripe, the controls, the strip and the share action, for one observer. */
function LiveSky({ observer, link }: { observer: Observer; link: LiveLink | null }) {
  const t = useT();
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
  // FR-LIVE-6: the dimmed set at the shown instant, minus what is already on an arc (D-102), worded here (FR-I18N-2).
  const hiddenState = useHiddenObjects(observer, shown, liveHidden);
  const hidden = useMemo(
    () => hiddenMarkers(hiddenState, drawnAt(passes, shown), (name, reason) => t.live.hiddenLabel({ name, reason: t.live.hiddenReason[reason] })),
    [hiddenState, passes, shown, t],
  );
  const toggleHidden = useCallback(() => {
    setLiveHidden(!liveHidden);
  }, [liveHidden, setLiveHidden]);
  useHashFollows(observer, shown, playback.realTime, playback.playing);
  // FR-SHARE-1's live form: the place, and the instant only when this page is showing one (real time is the recipient's own).
  const url = shareUrl(window.location.href, liveLinkHash({ observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: playback.realTime ? null : shown }));
  return (
    <>
      <div className={styles.dome} data-testid="live-dome">
        <SkyChart passes={passes} observer={observer} highlightedPassId={null} now={shown} sun={bodies.sun} moon={bodies.moon} hidden={hidden} colorBy="pass" fill initialFacingAzDeg={0} />
      </div>
      <TimeStripe span={span} passes={passes} bands={bands} t={shown} timeZone={observer.timeZone} onScrub={playback.scrub} />
      <div className={styles.actions}>
        <PlaybackControls
          playing={playback.playing}
          speed={playback.speed}
          realTime={playback.realTime}
          hidden={liveHidden}
          onPlay={playback.play}
          onPause={playback.pause}
          onSpeed={playback.setSpeed}
          onNow={playback.toNow}
          onToggleHidden={toggleHidden}
        />
        <ShareButton url={url} title={t.live.shareTitle} text={t.live.shareText(observer.label)} label={t.live.share} />
      </div>
      <StatusStrip t={shown} timeZone={observer.timeZone} sky={bodies.sky} cloud={cloud} count={count} moon={bodies.moon} speed={playback.playing ? playback.speed : null} />
    </>
  );
}
