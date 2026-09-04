import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatDuration, formatMagnitude, formatRange, formatSignedDegrees } from '../../../lib/format';
import { brightnessBand } from '../../../lib/phrases';
import { formatClock } from '../../../lib/timeFormat';
import type { Pass } from '../../../model';
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

const POINTS = ['start', 'peak', 'end'] as const;

export function PassNumbers({ pass, timeZone }: PassNumbersProps) {
  const t = useT();
  const locale = useLocale();
  const numbers = t.guide.numbers;
  return (
    <div className={styles.numbers}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className={styles.caption}>{numbers.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{numbers.point}</th>
              <th scope="col">{numbers.time}</th>
              <th scope="col">{numbers.azimuth}</th>
              <th scope="col">{numbers.elevation}</th>
              <th scope="col">{numbers.range}</th>
            </tr>
          </thead>
          <tbody>
            {POINTS.map((key) => (
              <tr key={key}>
                <th scope="row">{numbers[key]}</th>
                <td>{formatClock(pass[key].t, timeZone, locale)}</td>
                <td>{t.guide.azimuth({ point: compassPoint(pass[key].azDeg), degrees: degrees(pass[key].azDeg) })}</td>
                <td>{degrees(pass[key].elDeg)}</td>
                <td>{formatRange(pass[key].rangeKm, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className={styles.fields}>
        <dt>{numbers.duration}</dt>
        <dd>{formatDuration(pass.durationS)}</dd>
        <dt>{numbers.magnitude}</dt>
        <dd>{t.passes.magnitudeWithBand({ magnitude: formatMagnitude(pass.peakMagnitude, locale), band: brightnessBand(pass.peakMagnitude) })}</dd>
        <dt>{numbers.rangeAtPeak}</dt>
        <dd>{formatRange(pass.peak.rangeKm, locale)}</dd>
        <dt>{numbers.startsWhen}</dt>
        <dd data-reason={pass.startReason}>{t.guide.startReason[pass.startReason]}</dd>
        <dt>{numbers.endsWhen}</dt>
        <dd data-reason={pass.endReason}>{t.guide.endReason[pass.endReason]}</dd>
        <dt>{numbers.sunAtPeak}</dt>
        <dd>{numbers.sunWithLabel({ degrees: formatSignedDegrees(pass.sunAltAtPeakDeg, locale), twilight: pass.twilight })}</dd>
      </dl>
    </div>
  );
}
