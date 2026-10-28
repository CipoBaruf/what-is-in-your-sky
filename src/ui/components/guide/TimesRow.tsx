import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import { degrees } from '../../../lib/format';
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
}

const CELLS = ['start', 'peak', 'end'] as const;
const WORD = { start: 'rise', peak: 'peak', end: 'set' } as const;

export function TimesRow({ pass, timeZone }: TimesRowProps) {
  const t = useT();
  const locale = useLocale();
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
