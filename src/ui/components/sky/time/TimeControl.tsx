import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useT } from '../../../../i18n/useT';
import type { SkyBand } from '../../../../lib/timeStripe';
import type { EpochMs, HourlyCloud, Pass } from '../../../../model';
import { TimeReadout } from '../../live/TimeReadout';
import { SectionHeading } from '../../primitives/SectionHeading';
import { TextButton } from '../../primitives/TextButton';
import { PlaybackControls } from './PlaybackControls';
import { StripeOverview } from './StripeOverview';
import styles from './TimeControl.module.css';
import { TimeStripe } from './TimeStripe';
import type { Playback } from './usePlayback';

/**
 * R187 (FR-WIDE-4, FR-WIDE-8, D-1100): the desk's one time control, the rail's `Time` row on the live page, the stars
 * page and the pass detail — the overview while watching; while scrubbing the time row (the readout and the playback
 * row), the overview, the stripe; then the page's own row (`under`); all under the `Time` heading, over `playback`.
 * It does not know which page it is on: what each page adds is `under`, and what it draws is the props.
 */
export interface TimeControlProps {
  playback: Playback;
  passes: readonly Pass[];
  bands: readonly SkyBand[];
  /** Real time, for the readout's offset. */
  now: EpochMs;
  timeZone: string | null;
  /** FR-WIDE-8: the forecast's hours for the cloud band, where the place has one. */
  clouds?: readonly HourlyCloud[] | undefined;
  /** The page's own row under the rest: the live page's steps, the stars page's day steps. */
  under?: ReactNode;
  /** FR-WIDE-4: a `[ now ]` row last while the instant is held, where the page has no way back of its own (the live page's is its head's). */
  withNow?: boolean;
}

export function TimeControl({ playback, passes, bands, now, timeZone, clouds, under, withNow = false }: TimeControlProps) {
  const m = useT();
  const headingId = useId();
  const heading = <SectionHeading id={headingId}>{m.skyView.time}</SectionHeading>;
  const { t, span } = playback;
  const scrubbing = !playback.realTime;
  const speed = playback.playing ? playback.speed : null;
  /*
   * The overview moves from the group's head into the scrub block as the state changes, so it is a new element: a
   * reader stepping it with the arrow keys — which is how a key enters scrubbing — would lose focus at the first key.
   * The row remembers that it held focus, and the new one takes it back (R78's rule, moved here with the row).
   */
  const overviewFocus = useRef(false);
  useLayoutEffect(() => {
    if (!overviewFocus.current || (document.activeElement !== null && document.activeElement !== document.body)) return;
    document.querySelector<SVGElement>('[data-testid="stripe-overview"]')?.focus();
  }, [scrubbing]);
  const overview = (
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
      <StripeOverview span={span} passes={passes} bands={bands} t={t} timeZone={timeZone} speed={speed} onScrub={playback.scrub} clouds={clouds} />
    </div>
  );
  if (!scrubbing) {
    return (
      <section className={styles.time} aria-labelledby={headingId} data-testid="time-control" data-state="watching">
        {heading}
        {overview}
        {under}
      </section>
    );
  }
  return (
    <section className={styles.time} aria-labelledby={headingId} data-testid="time-control" data-state="scrubbing">
      {heading}
      <div className={styles.block} data-testid="stripe-block" data-placement="under">
        <div className={styles.timeRow} data-testid="time-row">
          <TimeReadout t={t} now={now} timeZone={timeZone} />
          <div className={styles.timeRow} data-testid="playback-row">
            <PlaybackControls playing={playback.playing} speed={playback.speed} onPlay={playback.play} onPause={playback.pause} onSpeed={playback.setSpeed} />
          </div>
        </div>
        {overview}
        <TimeStripe span={span} passes={passes} bands={bands} t={t} timeZone={timeZone} speed={speed} onScrub={playback.scrub} clouds={clouds} />
        {under}
        {withNow && (
          <div className={styles.nowRow} data-testid="time-now-row">
            <TextButton className="target" label={m.skyView.now} data-testid="time-now" onClick={() => playback.toNow()} />
          </div>
        )}
      </div>
    </section>
  );
}
