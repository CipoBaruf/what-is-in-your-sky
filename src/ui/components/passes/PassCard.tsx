import { useId } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { compassPoint } from '../../../lib/compass';
import { degrees, formatDuration, formatMagnitude } from '../../../lib/format';
import { brightnessBand } from '../../../lib/phrases';
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
 * R12: the field list and the open control are exported for the hero card,
 * which lays them out under its own heading.
 */
export interface PassCardProps {
  pass: Pass;
  timeZone: string | null;
  /** When given, the card shows an "Open guide" control (the whole card is its hit area). */
  onOpen?: (passId: string) => void;
  /** The forecast to judge the peak by; `null` shows "weather unknown"; omitted hides the row. */
  weather?: WeatherSnapshot | null;
}

export function PassFields({ pass, timeZone, weather }: Omit<PassCardProps, 'onOpen'>) {
  const t = useT();
  const locale = useLocale();
  return (
    <dl className={styles.fields}>
      <dt>{t.passes.fields.start}</dt>
      <dd>{t.passes.stamp({ date: formatDate(pass.start.t, timeZone, locale), time: formatClock(pass.start.t, timeZone, locale) })}</dd>
      <dt>{t.passes.fields.maxElevation}</dt>
      <dd>{degrees(pass.peak.elDeg)}</dd>
      <dt>{t.passes.fields.peakDirection}</dt>
      <dd>{t.passes.direction({ point: compassPoint(pass.peak.azDeg), degrees: degrees(pass.peak.azDeg) })}</dd>
      <dt>{t.passes.fields.duration}</dt>
      <dd>{formatDuration(pass.durationS)}</dd>
      <dt>{t.passes.fields.magnitude}</dt>
      <dd>{t.passes.magnitudeWithBand({ magnitude: formatMagnitude(pass.peakMagnitude, locale), band: brightnessBand(pass.peakMagnitude) })}</dd>
      {weather !== undefined && (
        <>
          <dt>{t.passes.fields.clouds}</dt>
          <dd>
            <CloudBadge
              verdict={cloudVerdict(weather, pass.peak.t)}
              forecast={weather ? { provider: weather.provider, fetchedAt: weather.fetchedAt } : null}
              timeZone={timeZone}
              moment={t.weather.momentPeak}
            />
          </dd>
        </>
      )}
    </dl>
  );
}

/** The accessible control ("Open guide → <name>"); its `::after` stretches the hit area over the positioned parent. */
export function OpenGuide({ pass, headingId, onOpen }: { pass: Pass; headingId: string; onOpen: (passId: string) => void }) {
  const t = useT();
  const openId = useId();
  return (
    <button
      type="button"
      id={openId}
      className={styles.open}
      aria-labelledby={`${openId} ${headingId}`}
      onClick={() => {
        onOpen(pass.id);
      }}
    >
      {t.passes.openGuide}
    </button>
  );
}

export function PassCard({ pass, timeZone, onOpen, weather }: PassCardProps) {
  const t = useT();
  const headingId = useId();
  return (
    <article className={styles.card} aria-labelledby={headingId} data-pass-id={pass.id}>
      <h2 id={headingId} className={styles.name}>
        {pass.name}
      </h2>
      {pass.twilight && <p className={styles.twilight}>{t.passes.twilightLabel}</p>}
      <PassFields pass={pass} timeZone={timeZone} {...(weather !== undefined ? { weather } : {})} />
      {onOpen && <OpenGuide pass={pass} headingId={headingId} onOpen={onOpen} />}
    </article>
  );
}
