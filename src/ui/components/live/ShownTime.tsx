import { useLocale, useT } from '../../../i18n/useT';
import type { ContextParts } from '../../../lib/contextLine';
import { chipFor, type Interval, type ShownChip } from '../../../lib/shownTime';
import { formatClock, formatCountdown, formatShortClock } from '../../../lib/timeFormat';
import { shortWeekday } from '../../../lib/timeStripe';
import type { Messages } from '../../../i18n/messages';
import type { EpochMs, Locale } from '../../../model';
import { VisuallyHidden } from '../primitives/VisuallyHidden';
import styles from './ShownTime.module.css';

/**
 * R143 (FR-TONIGHT-7, D-903): the compact live page's headline — the shown time at the headline size, `HH:MM` in
 * the observer's zone (`HH:MM:SS` while `t` is real time, the zone spoken and not drawn, as the conditions line
 * did), then the chip: `now` in the accent, or the offset from real time with `tonight` or the weekday in front.
 * The chip's facts are `chipFor`'s, the words the catalog's. R144 mounts it; `StatusStrip` and the next-event
 * block stay for wide.
 *
 * Not a live region: at 600× it changes every frame.
 */
export interface ShownTimeProps {
  /** The shown instant, `usePlayback`'s `t`. */
  t: EpochMs;
  /** `usePlayback`'s `realTime`: the page watches real time and holds nothing (D-911). */
  realTime: boolean;
  /** The real clock the offset is measured from, `usePlayback`'s `realNow`. */
  now: EpochMs;
  /**
   * The clock the time is read from while on real time, with its seconds: a 1 s clock, so `HH:MM:SS` ticks each
   * second and not in `realNow`'s 10 s steps. Off real time the time is `t`'s.
   */
  clock: EpochMs;
  /** Tonight's night band, `tonightBand(bands, now)`, worked out once per tick by the page (D-911). */
  night: Interval | null;
  timeZone: string | null;
}

/** The time as drawn (with its zone after a space, which the component speaks and does not draw) and the chip. */
function headline(m: Messages, locale: Locale, { t, realTime, now, clock, night, timeZone }: ShownTimeProps): { time: string; chip: ShownChip; words: string } {
  const chip = chipFor(t, now, realTime, night, timeZone);
  const time = chip.kind === 'now' ? formatClock(clock, timeZone, locale) : formatShortClock(t, timeZone, locale, true);
  const words = m.live.chip(chip.kind === 'now' ? chip : { ...chip, weekday: chip.weekday ? shortWeekday(t, timeZone, locale) : null });
  return { time, chip, words };
}

/** The headline as one string — the time and the chip — for the time track's value text (FR-TONIGHT-3, D-900). */
export function shownTimeText(m: Messages, locale: Locale, props: ShownTimeProps): string {
  const { time, words } = headline(m, locale, props);
  return `${time} ${words}`;
}

export function ShownTime(props: ShownTimeProps) {
  const m = useT();
  const locale = useLocale();
  const { time, chip, words } = headline(m, locale, props);
  const split = time.indexOf(' ');
  return (
    <p className={styles.headline} data-testid="shown-time">
      <VisuallyHidden>{`${m.live.shownTime}: `}</VisuallyHidden>
      <time className={styles.clock} dateTime={new Date(chip.kind === 'now' ? props.clock : props.t).toISOString()}>
        {time.slice(0, split)}
        <VisuallyHidden>{time.slice(split)}</VisuallyHidden>
      </time>{' '}
      <span className={styles.chip} data-kind={chip.kind} data-testid="shown-chip">
        {words}
      </span>
    </p>
  );
}

/**
 * R143 (FR-TONIGHT-7): the context line under the headline, one line at `--small`. The parts are `contextLine`'s;
 * a pass's name gives way first (it ellipsises) so what it does next always shows. An abbreviated cloud word
 * (`S/d`) is drawn and its whole form said (FR-COMP-7).
 */
export interface ContextLineProps {
  parts: ContextParts;
  timeZone: string | null;
}

export function ContextLine({ parts, timeZone }: ContextLineProps) {
  const m = useT();
  const locale = useLocale();
  const words = m.live.context;
  if (parts.kind === 'up') {
    const tail = words.up({ event: parts.event, point: parts.point, countdown: formatCountdown(parts.inMs) });
    return (
      <p className={styles.context} data-testid="context-line" data-kind="up">
        <span className={styles.name}>{parts.name}</span>
        <span className={styles.tail}>
          {words.separator}
          {tail}
        </span>
      </p>
    );
  }
  if (parts.kind === 'none') {
    return (
      <p className={styles.context} data-testid="context-line" data-kind="none" data-reason={parts.reason}>
        {parts.reason === 'span' ? words.noneSpan : words.noneTonight}
      </p>
    );
  }
  const sky = parts.sky ? words.skyWord[parts.sky] : m.live.pending;
  const cloud = words.cloudWord[parts.cloud];
  const next = formatShortClock(parts.nextAt, timeZone, locale);
  const drawn = words.sky({ sky, cloud, next });
  const spoken = m.live.cloudSpoken[parts.cloud];
  return (
    <p className={styles.context} data-testid="context-line" data-kind="sky">
      {spoken.toLowerCase() === cloud.toLowerCase() ? (
        drawn
      ) : (
        <>
          <span aria-hidden="true">{drawn}</span>
          <VisuallyHidden>{words.sky({ sky, cloud: spoken, next })}</VisuallyHidden>
        </>
      )}
    </p>
  );
}
