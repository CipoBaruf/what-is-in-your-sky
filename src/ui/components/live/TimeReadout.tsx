import { useLocale } from '../../../i18n/useT';
import { formatDate, formatShortClock } from '../../../lib/timeFormat';
import { shortWeekday } from '../../../lib/timeStripe';
import type { EpochMs } from '../../../model';
import styles from './TimeReadout.module.css';

/**
 * R48 (FR-TRAJ-4, US-22 AC5, D-190): the clock readout above the stripe, in
 * the heading size — the shown instant to the minute in the observer's zone,
 * with the weekday in front of it when the instant is not today, so a scrub
 * past midnight reads "Sat 02:15" and not as an hour that has passed. The
 * stripe's own value text (its `aria-valuetext`) and the strip's time field
 * carry the seconds and the zone; this is the one meant to be read at arm's
 * length, and it says no more than the eye needs.
 *
 * Not a live region: it moves sixty times a second at 3600×.
 */
export interface TimeReadoutProps {
  /** The shown instant. */
  t: EpochMs;
  /** Real time, which decides whether `t` is today. */
  now: EpochMs;
  timeZone: string | null;
}

export function TimeReadout({ t, now, timeZone }: TimeReadoutProps) {
  const locale = useLocale();
  const today = formatDate(t, timeZone, locale) === formatDate(now, timeZone, locale);
  const weekday = today ? null : shortWeekday(t, timeZone, locale);
  return (
    <p className={styles.readout} data-testid="time-readout" data-today={today}>
      {weekday !== null && weekday !== '' && <span className={styles.weekday}>{weekday} </span>}
      <span className={styles.clock}>{formatShortClock(t, timeZone, locale)}</span>
    </p>
  );
}
