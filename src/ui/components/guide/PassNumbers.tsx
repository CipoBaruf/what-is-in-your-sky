import { compassPoint } from '../../../lib/compass';
import { degrees, formatDuration, formatMagnitude, formatRange } from '../../../lib/format';
import { TWILIGHT_LABEL, brightnessPhrase, endReasonPhrase, startReasonPhrase } from '../../../lib/phrases';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { Pass, PassPoint } from '../../../model';
import styles from './PassNumbers.module.css';

/**
 * US-6 AC2 / FR-VIS-3 / FR-X-5: every number of the pass as text. Start,
 * peak and end each with time to the second, azimuth in degrees and 16-point
 * compass, elevation and range; then duration, magnitude with its phrase,
 * range at peak, the start and end reasons in words, and the sun altitude
 * at peak with the FR-VIS-7 label. This table is the text alternative the
 * sky chart (R13) points to.
 */
export interface PassNumbersProps {
  pass: Pass;
  timeZone: string | null;
}

const POINTS: { key: 'start' | 'peak' | 'end'; name: string }[] = [
  { key: 'start', name: 'Start' },
  { key: 'peak', name: 'Peak' },
  { key: 'end', name: 'End' },
];

const azimuth = (p: PassPoint): string => `${compassPoint(p.azDeg)} ${degrees(p.azDeg)}`;
const signedDegrees = (n: number): string => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(1)}°`;

export function PassNumbers({ pass, timeZone }: PassNumbersProps) {
  return (
    <div className={styles.numbers}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className={styles.caption}>Times, directions and heights on {formatDate(pass.start.t, timeZone)}</caption>
          <thead>
            <tr>
              <th scope="col">Point</th>
              <th scope="col">Time</th>
              <th scope="col">Azimuth</th>
              <th scope="col">Elevation</th>
              <th scope="col">Range</th>
            </tr>
          </thead>
          <tbody>
            {POINTS.map(({ key, name }) => (
              <tr key={key}>
                <th scope="row">{name}</th>
                <td>{formatClock(pass[key].t, timeZone)}</td>
                <td>{azimuth(pass[key])}</td>
                <td>{degrees(pass[key].elDeg)}</td>
                <td>{formatRange(pass[key].rangeKm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className={styles.fields}>
        <dt>Duration</dt>
        <dd>{formatDuration(pass.durationS)}</dd>
        <dt>Magnitude</dt>
        <dd>
          {formatMagnitude(pass.peakMagnitude)}, {brightnessPhrase(pass.peakMagnitude)}
        </dd>
        <dt>Range at peak</dt>
        <dd>{formatRange(pass.peak.rangeKm)}</dd>
        <dt>Starts when it</dt>
        <dd data-reason={pass.startReason}>{startReasonPhrase(pass.startReason).replace(/,$/, '')}</dd>
        <dt>Ends when it</dt>
        <dd data-reason={pass.endReason}>{endReasonPhrase(pass.endReason)}</dd>
        <dt>Sun at peak</dt>
        <dd>
          {signedDegrees(pass.sunAltAtPeakDeg)}
          {pass.twilight && ` (${TWILIGHT_LABEL})`}
        </dd>
      </dl>
    </div>
  );
}
