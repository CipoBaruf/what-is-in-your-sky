import { useEffect, useMemo } from 'react';
import { useT } from '../../i18n/useT';
import { cloudVerdict } from '../../lib/cloudVerdict';
import { liveLinkHash, shareUrl, type LiveLink } from '../../lib/shareLinks';
import type { EpochMs, Observer, Pass } from '../../model';
import { useAppStore } from '../../state';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { ShareButton } from '../components/common/ShareButton';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { SkyChart } from '../components/guide/skychart/SkyChart';
import { useSkyBodies } from '../components/guide/skychart/useSkyBodies';
import { StatusStrip } from '../components/live/StatusStrip';
import { useNow } from '../hooks/useNow';
import styles from './Live.module.css';

/**
 * R32 (FR-LIVE-1, FR-LIVE-2, FR-LIVE-3, FR-LIVE-9, FR-LIVE-10; US-15 AC1, AC2,
 * AC9): the live page at `#live`. The whole viewport is the dome, with a row
 * of controls above it and the status strip below; `Esc` and the return
 * control go back to the home page, and the header and the Now panel are where
 * it is reached from. The route itself is `LiveRoute.ts`; `App.tsx` mounts
 * this page instead of the home screen, as a lazy chunk of its own (PLAN §11).
 *
 * **One geometry (FR-LIVE-10).** Every satellite on this page is drawn by
 * `SkyChart` from `Pass.track`, with `now = t` and the passes whose interval
 * overlaps `now … now + 24 h`, coloured per satellite in pass order
 * (`colorBy="pass"`, D-158). Nothing here draws a satellite any other way, and
 * the count in the strip is the number of markers the chart draws (D-160).
 *
 * **The instant (FR-LIVE-9).** `t` is the link's instant when the hash carries
 * one, else real time on the 10 s tick the rest of the app lives by. R33 adds
 * scrubbing and playback on top of this. The window's `now` is always real
 * time: what is drawn is the coming 24 h, whatever instant inside it is shown.
 *
 * **Sun, Moon and sky (FR-DOME-6, FR-LIVE-3).** `useSkyBodies` evaluates them
 * here, once per `t`, and hands them to the chart, so the page owns the one
 * evaluation the strip and the dome both read (D-149).
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

/** The page with something to draw: the chart, the strip and the share action, for one observer. */
function LiveSky({ observer, link }: { observer: Observer; link: LiveLink | null }) {
  const t = useT();
  const passesState = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const now = useNow(TICK_MS);
  // FR-LIVE-9: the link's instant, or real time.
  const shown = link?.t ?? now;
  // The passes belong to this observer only once the slice says so; before that the dome is empty rather than someone else's.
  const passes = useMemo(() => (passesState.observer === observer ? livePasses(passesState.passes, now) : []), [passesState.observer, passesState.passes, observer, now]);
  const bodies = useSkyBodies({ observer, now: shown });
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const cloud = cloudVerdict(snapshot, shown);
  const count = visibleCount(passes, shown);
  // FR-SHARE-1's live form: the place, and the instant only when this page is showing one (real time is the recipient's own).
  const url = shareUrl(window.location.href, liveLinkHash({ observer: { lat: observer.lat, lon: observer.lon, altM: observer.altM }, t: link?.t ?? null }));
  return (
    <>
      <div className={styles.dome} data-testid="live-dome">
        <SkyChart passes={passes} observer={observer} highlightedPassId={null} now={shown} sun={bodies.sun} moon={bodies.moon} colorBy="pass" fill initialFacingAzDeg={0} />
      </div>
      <StatusStrip t={shown} timeZone={observer.timeZone} sky={bodies.sky} cloud={cloud} count={count} moon={bodies.moon} />
      <ShareButton url={url} title={t.live.shareTitle} text={t.live.shareText(observer.label)} label={t.live.share} />
    </>
  );
}
