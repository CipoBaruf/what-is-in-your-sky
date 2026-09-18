import { useId } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatClockDuration, formatMagnitude } from '../../../lib/format';
import { isNoEvent, nextEvent, type NextEvent, type NextEventContext } from '../../../lib/nextEvent';
import { brightnessBand } from '../../../lib/phrases';
import type { EpochMs, Pass, WeatherSnapshot } from '../../../model';
import { useNow } from '../../hooks/useNow';
import styles from './NextEventBlock.module.css';

/**
 * R76 (FR-FIRST-3, D-442): the next event as a countdown — "Next up", then
 * "ISS appears NW in 4:12", then the peak's direction, altitude and brightness
 * with the cloud verdict where a forecast covers the pass. One component with
 * two hosts: the home page's When reading here, the live page's watching
 * headline in R77 (FR-WATCH-2), each passing the passes it already holds.
 *
 * It ticks once a second from the wall clock (`NEXT_EVENT_TICK_MS`, US-5 AC4's
 * countdown at the rate a person reads seconds) against those passes; nothing
 * is asked of the worker and nothing is written to the store. `lib/nextEvent`
 * picks the event and `formatClockDuration` writes the time to it, as the hero
 * card writes its own: "m:ss" under an hour and "h:mm:ss" above, so the two
 * readings on one page agree (D-442 as amended).
 */
export const NEXT_EVENT_TICK_MS = 1000;

/** The headline, "ISS appears NW in 4:12" — the verb by the boundary reason of the end it counts to. */
export function nextEventHeadline(event: NextEvent, now: EpochMs, t: Messages): string {
  const { pass, kind } = event;
  return t.nextEvent.headline({
    name: pass.name,
    kind,
    reason: kind === 'end' ? pass.endReason : pass.startReason,
    point: compassPoint(event.azimuth),
    altitude: degrees(pass.peak.elDeg),
    countdown: formatClockDuration((event.at - now) / 1000),
  });
}

export interface NextEventBlockProps {
  passes: readonly Pass[];
  /** Why there may be none (`nextEvent`'s context). */
  context?: NextEventContext;
  /** True while the passes are still arriving, so an empty list is not yet "no pass". */
  pending?: boolean;
  /** The forecast the peak's cloud verdict is read from; null or omitted says nothing about clouds. */
  weather?: WeatherSnapshot | null;
  /** The clock, for tests; the block ticks itself otherwise. */
  now?: EpochMs;
  /** The window's length in hours, for the "no pass" line. */
  hours: number;
}

export function NextEventBlock({ passes, context, pending = false, weather = null, now: nowProp, hours }: NextEventBlockProps) {
  const t = useT();
  const locale = useLocale();
  const labelId = useId();
  const clock = useNow(NEXT_EVENT_TICK_MS);
  const now = nowProp ?? clock;
  const result = nextEvent(passes, now, context);

  let body;
  if (isNoEvent(result)) {
    body = (
      <p className={styles.none} data-testid="next-event-none" data-reason={pending ? 'pending' : result.reason}>
        {pending ? t.nextEvent.pending : t.nextEvent.none({ reason: result.reason, hours })}
      </p>
    );
  } else {
    const { pass } = result;
    const verdict = cloudVerdict(weather, pass.peak.t);
    body = (
      <>
        <p role="timer" aria-live="off" className={styles.headline} data-kind={result.kind} data-testid="next-event-headline">
          {nextEventHeadline(result, now, t)}
        </p>
        <p className={styles.peak} data-testid="next-event-peak">
          {t.nextEvent.peakLine({ point: compassPoint(pass.peak.azDeg), altitude: degrees(pass.peak.elDeg), band: brightnessBand(pass.peakMagnitude), magnitude: formatMagnitude(pass.peakMagnitude, locale) })}
          {verdict.state !== 'unknown' && (
            <>
              <span className={styles.separator} aria-hidden="true">
                {' · '}
              </span>
              <span className={styles.cloud} data-cloud={verdict.state}>
                {t.weather.state[verdict.state]}
              </span>
            </>
          )}
        </p>
      </>
    );
  }

  return (
    <section aria-labelledby={labelId} className={styles.block} data-testid="next-event">
      <p id={labelId} className={styles.eventLabel}>
        {t.nextEvent.label}
      </p>
      {body}
    </section>
  );
}
