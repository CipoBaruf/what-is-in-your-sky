import { useLocale, useT } from '../../../i18n/useT';
import type { ContextParts } from '../../../lib/contextLine';
import { chipFor } from '../../../lib/shownTime';
import { formatClock, formatCountdown, formatShortClock } from '../../../lib/timeFormat';
import { shortWeekday, type SkyBand } from '../../../lib/timeStripe';
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
  /** The shown instant; equal to `now` while the page watches real time. */
  t: EpochMs;
  now: EpochMs;
  /** The sky bands the stripe draws (`useSkyBands`, D-170), for tonight's night band. */
  bands: readonly SkyBand[];
  timeZone: string | null;
}

/** The headline as one string — the time and the chip — for the time track's value text (FR-TONIGHT-3, D-900). */
export function shownTimeText(m: Messages, locale: Locale, { t, now, bands, timeZone }: ShownTimeProps): string {
  const chip = chipFor(t, now, bands, timeZone);
  const clock = chip.kind === 'now' ? formatClock(t, timeZone, locale) : formatShortClock(t, timeZone, locale, true);
  return `${clock} ${chipWords(m, locale, chip, t, timeZone)}`;
}

function chipWords(m: Messages, locale: Locale, chip: ReturnType<typeof chipFor>, t: EpochMs, timeZone: string | null): string {
  return m.live.chip(chip.kind === 'now' ? chip : { ...chip, weekday: chip.weekday ? shortWeekday(t, timeZone, locale) : null });
}

export function ShownTime(props: ShownTimeProps) {
  const { t, now, bands, timeZone } = props;
  const m = useT();
  const locale = useLocale();
  const chip = chipFor(t, now, bands, timeZone);
  const clock = chip.kind === 'now' ? formatClock(t, timeZone, locale) : formatShortClock(t, timeZone, locale, true);
  const split = clock.indexOf(' ');
  return (
    <p className={styles.headline} data-testid="shown-time">
      <VisuallyHidden>{`${m.live.shownTime}: `}</VisuallyHidden>
      <time className={styles.clock} dateTime={new Date(t).toISOString()}>
        {clock.slice(0, split)}
        <VisuallyHidden>{clock.slice(split)}</VisuallyHidden>
      </time>{' '}
      <span className={styles.chip} data-kind={chip.kind} data-testid="shown-chip">
        {chipWords(m, locale, chip, t, timeZone)}
      </span>
    </p>
  );
}

/**
 * R143 (FR-TONIGHT-7): the context line under the headline, one line at `--small`. The parts are `contextLine`'s;
 * a pass's name gives way first (it ellipsises) so what it does next always shows. An abbreviated cloud word
 * (`S/d`) is drawn and its whole form said, as the conditions line does (FR-COMP-7).
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
    const tail = words.up({ name: '', event: parts.event, point: parts.point, countdown: formatCountdown(parts.inMs) });
    return (
      <p className={styles.context} data-testid="context-line" data-kind="up">
        <span className={styles.name}>{parts.name}</span>
        <span className={styles.tail}>{tail}</span>
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
  const next = parts.nextAt === null ? null : formatShortClock(parts.nextAt, timeZone, locale);
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
