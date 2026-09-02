import { useId } from 'react';
import { compassPoint } from '../../../lib/compass';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { Pass } from '../../../model';
import styles from './PassCard.module.css';

/**
 * R3 plain card (US-5 AC1 fields that exist without weather): name, start
 * time, max elevation, peak compass point + degrees, duration, magnitude.
 * Brightness phrase, "sky still bright" label and the detail screen are R6;
 * the cloud verdict is R8; local time zone is R8.
 */
export interface PassCardProps {
  pass: Pass;
  timeZone: string | null;
}

export const degrees = (n: number): string => `${String(Math.round(n))}°`;

/** "4 min 32 s", "48 s". */
export function formatDuration(durationS: number): string {
  const total = Math.round(durationS);
  const min = Math.floor(total / 60);
  const s = total % 60;
  return min > 0 ? `${String(min)} min ${String(s)} s` : `${String(s)} s`;
}

/** Signed, one decimal, real minus sign: "+1.2", "−0.3", "+0.0". */
export function formatMagnitude(mag: number): string {
  const rounded = Math.round(mag * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return '+0.0';
  return rounded < 0 ? `−${Math.abs(rounded).toFixed(1)}` : `+${rounded.toFixed(1)}`;
}

export function PassCard({ pass, timeZone }: PassCardProps) {
  const headingId = useId();
  return (
    <article className={styles.card} aria-labelledby={headingId} data-pass-id={pass.id}>
      <h2 id={headingId} className={styles.name}>
        {pass.name}
      </h2>
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
        <dd>{formatMagnitude(pass.peakMagnitude)}</dd>
      </dl>
    </article>
  );
}
