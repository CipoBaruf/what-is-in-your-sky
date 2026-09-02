import { useId } from 'react';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatDuration, formatMagnitude } from '../../../lib/format';
import { TWILIGHT_LABEL, brightnessPhrase } from '../../../lib/phrases';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { Pass, WeatherSnapshot } from '../../../model';
import { CloudBadge } from '../weather/CloudBadge';
import styles from './PassCard.module.css';

/**
 * Plain card (US-5 AC1 fields that exist without weather): name, start
 * time, max elevation, peak compass point + degrees, duration, magnitude
 * number and phrase (FR-GUIDE-3), the "sky still bright" label when the
 * pass is a twilight one (FR-VIS-7), the control that opens the detail
 * screen (R6) and, from R8, the cloud verdict at the pass peak (FR-WX-2/3)
 * when the list passes a forecast (or null for "unknown"); times are in
 * `timeZone`, which the forecast fills in for coordinate input (FR-LOC-3).
 */
export interface PassCardProps {
  pass: Pass;
  timeZone: string | null;
  /** When given, the card shows an "Open guide" control (the whole card is its hit area). */
  onOpen?: (passId: string) => void;
  /** The forecast to judge the peak by; `null` shows "weather unknown"; omitted hides the row. */
  weather?: WeatherSnapshot | null;
}

export function PassCard({ pass, timeZone, onOpen, weather }: PassCardProps) {
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
        {weather !== undefined && (
          <>
            <dt>Clouds</dt>
            <dd>
              <CloudBadge
                verdict={cloudVerdict(weather, pass.peak.t)}
                forecast={weather ? { provider: weather.provider, fetchedAt: weather.fetchedAt } : null}
                timeZone={timeZone}
                moment="at the pass peak"
              />
            </dd>
          </>
        )}
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
