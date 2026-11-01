import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatTimesRow } from '../../../lib/format';
import { formatClock } from '../../../lib/timeFormat';
import type { Pass } from '../../../model';
import styles from './TimesRow.module.css';

/**
 * R132 (FR-FLOW-7, D-849): the pass detail's head ends with the rise, the peak
 * and the set as one row of three cells — the time under its word, and the
 * peak's cell with the altitude and the direction as well ("peak 07:23:55 ·
 * 63° SW"). It stands in for the countdown's step list (`Countdown`'s
 * `steps`), which read the same three times on one wrapped line; the words
 * are the countdown's own (`t.countdown.rise/peak/set`), so the head and the
 * legend's `rise · peak · set` (R131) say the same thing.
 */
export interface TimesRowProps {
  pass: Pass;
  timeZone: string | null;
  /**
   * R156 (FR-PHONE-14, D-972): the compact form — one line at `--small`, "07:20 → 07:23 at 48° NNE → 07:27", within
   * `DETAIL_TIMES_CELLS` (`formatTimesRow`), with no zone: the head's date line says it once. Wide keeps the cells.
   */
  compact?: boolean;
}

const CELLS = ['start', 'peak', 'end'] as const;
const WORD = { start: 'rise', peak: 'peak', end: 'set' } as const;

export function TimesRow({ pass, timeZone, compact = false }: TimesRowProps) {
  const t = useT();
  const locale = useLocale();
  if (compact) {
    return (
      // A group named as the cells' row is, so a screen reader says what the three times are before it reads them.
      <p role="group" aria-label={t.countdown.steps} className={styles.line} data-testid="pass-times" data-form="row">
        {formatTimesRow(pass, timeZone, locale, t.countdown.row)}
      </p>
    );
  }
  return (
    <dl className={styles.row} data-testid="pass-times" aria-label={t.countdown.steps}>
      {CELLS.map((key) => (
        <div key={key} className={styles.cell} data-cell={WORD[key]}>
          <dt className={styles.word}>{t.countdown[WORD[key]]}</dt>
          <dd className={styles.value}>
            <time dateTime={new Date(pass[key].t).toISOString()}>{formatClock(pass[key].t, timeZone, locale)}</time>
            {key === 'peak' && (
              <span className={styles.peak} data-testid="pass-times-peak">
                {` · ${degrees(Math.round(pass.peak.elDeg))} ${compassPoint(pass.peak.azDeg)}`}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
