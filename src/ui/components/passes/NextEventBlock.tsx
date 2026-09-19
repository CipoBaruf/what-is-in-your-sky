import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { formatClockDuration, formatMagnitude } from '../../../lib/format';
import { isNoEvent, nextEvent, type NextEvent, type NextEventContext } from '../../../lib/nextEvent';
import { passPath } from '../../../lib/passPath';
import { brightnessBand } from '../../../lib/phrases';
import { formatShortClock } from '../../../lib/timeFormat';
import type { EpochMs, Pass } from '../../../model';
import { useNow } from '../../hooks/useNow';
import styles from './NextEventBlock.module.css';

/**
 * R76 (FR-FIRST-3, D-442), re-cut by R81 (FR-FIRST-3 as amended v2.0.2,
 * D-508): the next event as board 1B draws it. The label line with its
 * countdown (`Next up · in 3:45:07`, `Up now · peaks in 1:10`, `Up now · sets
 * in 2:05`), the event's clock time in the accent, the path line
 * (`ISS · NW low → 68° N → SE`, `lib/passPath`), and `[ Open the live sky ]`
 * under the block (FR-LIVE-1). One component with two hosts: the home page's
 * When reading here, the live page's watching headline in R77 (FR-WATCH-2),
 * each passing the passes it already holds.
 *
 * `form: 'card'` is the phone's third step's first card (FR-FIRST-4, R82):
 * `First up · in 12:34`, the time and the name, the path with the duration and
 * the brightness phrase with the magnitude, in a box ruled in the accent.
 *
 * It ticks once a second from the wall clock (`NEXT_EVENT_TICK_MS`, US-5 AC4)
 * against those passes; nothing is asked of the worker and nothing is written
 * to the store, and the tick stays here so a host never re-renders every
 * second. `formatClockDuration` writes the countdown, "m:ss" under an hour and
 * "h:mm:ss" above (D-502).
 */
export const NEXT_EVENT_TICK_MS = 1000;

/** The label line, `Next up · in 3:45:07` — the verb by the boundary reason of the end it counts to. */
export function nextEventLabel(event: NextEvent, now: EpochMs, t: Messages, first = false): string {
  const { pass, kind } = event;
  return t.nextEvent.label({ kind, reason: kind === 'end' ? pass.endReason : pass.startReason, countdown: formatClockDuration((event.at - now) / 1000), first });
}

/** The path, `NW low → 68° N → SE` (D-507). */
export function nextEventPath(pass: Pass, t: Messages): string {
  return t.nextEvent.path(passPath(pass));
}

/** Whole minutes, at least one: a card's duration. */
export const passMinutes = (pass: Pass): number => Math.max(1, Math.round(pass.durationS / 60));

/** FR-LIVE-1, FR-FIRST-6: the Now panel's way to the live page, which the block carries now — with or without a pass to count to. */
function LiveLink() {
  const t = useT();
  return (
    <p className={styles.live}>
      <a href="#live" className={styles.liveLink} data-testid="now-live-link">
        {t.nextEvent.openLive}
      </a>
    </p>
  );
}

export interface NextEventBlockProps {
  passes: readonly Pass[];
  /** The observer's zone, for the event's clock time; null reads UTC and says so. */
  timeZone: string | null;
  /** Why there may be none (`nextEvent`'s context). */
  context?: NextEventContext;
  /** True while the passes are still arriving, so an empty list is not yet "no pass". */
  pending?: boolean;
  /** The clock, for tests; the block ticks itself otherwise. */
  now?: EpochMs;
  /** The window's length in hours, for the "no pass" line. */
  hours: number;
  /** `block` on the home page and the live page; `card` for the phone's first card (FR-FIRST-4). */
  form?: 'block' | 'card';
  /**
   * R77 (FR-WATCH-2): whether the block carries `[ Open the live sky ]` under it. The live page's watching
   * headline is the same block (V20-18) on the page the link opens, so it passes `false`.
   */
  liveLink?: boolean;
}

export function NextEventBlock({ passes, timeZone, context, pending = false, now: nowProp, hours, form = 'block', liveLink = true }: NextEventBlockProps) {
  const t = useT();
  const locale = useLocale();
  const clock = useNow(NEXT_EVENT_TICK_MS);
  const now = nowProp ?? clock;
  const result = nextEvent(passes, now, context);
  const card = form === 'card';

  if (isNoEvent(result)) {
    return (
      <section aria-label={t.nextEvent.region} className={card ? styles.card : styles.block} data-testid="next-event" data-form={form}>
        <p className={styles.none} data-testid="next-event-none" data-reason={pending ? 'pending' : result.reason}>
          {pending ? t.nextEvent.pending : t.nextEvent.none({ reason: result.reason, hours })}
        </p>
        {!card && liveLink && <LiveLink />}
      </section>
    );
  }

  const { pass } = result;
  // The time stands alone at 32 px; with no zone for the observer yet the digits are UTC, and say so (F-27).
  const time = formatShortClock(result.at, timeZone, locale, timeZone === null);
  const path = nextEventPath(pass, t);
  return (
    <section aria-label={t.nextEvent.region} className={card ? styles.card : styles.block} data-testid="next-event" data-form={form}>
      <p role="timer" aria-live="off" className={styles.label} data-kind={result.kind} data-testid="next-event-label">
        {nextEventLabel(result, now, t, card)}
      </p>
      {card ? (
        <>
          <p className={styles.cardTime} data-testid="next-event-time">
            {`${time}   ${pass.name}`}
          </p>
          <p className={styles.path} data-testid="next-event-path">
            {t.nextEvent.withDuration({ path, minutes: passMinutes(pass) })}
          </p>
          <p className={styles.brightness} data-testid="next-event-brightness">
            {t.nextEvent.brightness({ band: brightnessBand(pass.peakMagnitude), magnitude: formatMagnitude(pass.peakMagnitude, locale) })}
          </p>
        </>
      ) : (
        <>
          <p className={styles.time} data-testid="next-event-time">
            {time}
          </p>
          <p className={styles.path} data-testid="next-event-path">
            {t.nextEvent.named({ name: pass.name, path })}
          </p>
          {liveLink && <LiveLink />}
        </>
      )}
    </section>
  );
}
