import { useLocale, useT } from '../../../i18n/useT';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatDuration, formatMagnitude, formatRange, formatSignedDegrees } from '../../../lib/format';
import type { LegendColor } from '../../../lib/legend';
import { brightnessBand } from '../../../lib/phrases';
import { formatClock } from '../../../lib/timeFormat';
import type { Pass } from '../../../model';
import { LegendSwatch } from './skychart/LegendSwatch';
import styles from './PassNumbers.module.css';

/**
 * US-6 AC2 / FR-VIS-3 / FR-X-5: every number of the pass as text. Start,
 * peak and end each with time to the second, azimuth in degrees and 16-point
 * compass, elevation and range; then duration, magnitude with its phrase,
 * range at peak, the start and end reasons in words, and the sun altitude
 * at peak with the FR-VIS-7 label. This table is the text alternative the
 * sky chart (R13) points to.
 *
 * R51 (FR-LEG-3, US-23 AC3): on the pass detail this table *is* the legend.
 * It sits directly under the drawing, in the legend's slot, and its caption
 * carries the same key the drawing puts at the arc's peak and a swatch in the
 * arc's colour, so the reader ties the numbers to the line they are looking
 * at. A boundary the satellite crosses in Earth's shadow names itself: the
 * drawing swaps the rise or end marker for the shadow marker there rather
 * than adding a fourth point (`Pass` has three), so the row is renamed rather
 * than repeated under a second heading (D-273).
 */
export interface PassNumbersProps {
  pass: Pass;
  timeZone: string | null;
  /** FR-LEG-3: the one-character key the drawing carries at this arc's peak, where the table is the legend. */
  legendKey?: string | undefined;
  /** FR-LEG-3: the arc's colour token, for the swatch beside the key. */
  colorToken?: LegendColor | undefined;
}

const POINTS = ['start', 'peak', 'end'] as const;

export function PassNumbers({ pass, timeZone, legendKey, colorToken }: PassNumbersProps) {
  const t = useT();
  const locale = useLocale();
  const numbers = t.guide.numbers;
  // The shadow boundary, where there is one: the row is the drawing's shadow marker, so it is named for it (D-273).
  const shadow = (key: (typeof POINTS)[number]): boolean => (key === 'start' && pass.startReason === 'shadow') || (key === 'end' && pass.endReason === 'shadow');
  const pointLabel = (key: (typeof POINTS)[number]): string => (shadow(key) ? (key === 'start' ? numbers.leavesShadow : numbers.entersShadow) : numbers[key]);
  return (
    <div className={styles.numbers}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className={styles.caption}>
            {legendKey !== undefined && <span className={styles.key}>{legendKey}</span>}
            {colorToken !== undefined && <LegendSwatch color={colorToken} className={styles.swatch} />}
            {numbers.caption}
          </caption>
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
              <tr key={key} data-point={shadow(key) ? 'shadow' : key}>
                <th scope="row">{pointLabel(key)}</th>
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
