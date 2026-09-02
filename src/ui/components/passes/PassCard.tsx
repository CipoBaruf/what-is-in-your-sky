import { useId } from 'react';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatDuration, formatMagnitude } from '../../../lib/format';
import { TWILIGHT_LABEL, brightnessPhrase } from '../../../lib/phrases';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { Pass } from '../../../model';
import styles from './PassCard.module.css';

/**
 * Plain card (US-5 AC1 fields that exist without weather): name, start
 * time, max elevation, peak compass point + degrees, duration, magnitude
 * number and phrase (FR-GUIDE-3), the "sky still bright" label when the
 * pass is a twilight one (FR-VIS-7), and the control that opens the detail
 * screen (R6). The cloud verdict is R8; local time zone is R8.
 */
export interface PassCardProps {
  pass: Pass;
  timeZone: string | null;
  /** When given, the card shows an "Open guide" control (the whole card is its hit area). */
  onOpen?: (passId: string) => void;
}

export function PassCard({ pass, timeZone, onOpen }: PassCardProps) {
  const headingId = useId();
  const openId = useId();
  return (
    <article className={styles.card} aria-labelledby={headingId} data-pass-id={pass.id}>
      <h2 id={headingId} className={styles.name}>
        {pass.name}
      </h2>
      {pass.twilight && <p className={styles.twilight}>{TWILIGHT_LABEL}</p>}
      <dl className={styles.fields}>
        <dt>Start</dt>
        <dd>
          {formatDate(pass.start.t, timeZone)} {formatClock(pass.start.t, timeZone)}
        </dd>
        <dt>Max elevation</dt>
        <dd>{degrees(pass.peak.elDeg)}</dd>
        <dt>Peak direction</dt>
        <dd>
          {compassPoint(pass.peak.azDeg)} ({degrees(pass.peak.azDeg)})
        </dd>
        <dt>Duration</dt>
        <dd>{formatDuration(pass.durationS)}</dd>
        <dt>Magnitude</dt>
        <dd>
          {formatMagnitude(pass.peakMagnitude)}, {brightnessPhrase(pass.peakMagnitude)}
        </dd>
      </dl>
      {onOpen && (
        <button
          type="button"
          id={openId}
          className={styles.open}
          aria-labelledby={`${openId} ${headingId}`}
          onClick={() => {
            onOpen(pass.id);
          }}
        >
          Open guide →
        </button>
      )}
    </article>
  );
}
