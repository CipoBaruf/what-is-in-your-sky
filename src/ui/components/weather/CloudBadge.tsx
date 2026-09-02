import { useId } from 'react';
import { CLEAR_BELOW_PCT, OBSCURED_ABOVE_PCT } from '../../../lib/cloudVerdict';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { CloudState, CloudVerdict, EpochMs } from '../../../model';
import styles from './CloudBadge.module.css';

/**
 * US-7 AC2/AC3, FR-WX-3: the three-state cloud indicator (plus `unknown`,
 * US-7 AC4) with a tooltip that states the thresholds, the effective cloud
 * figure, the provider and when the forecast was fetched. The badge is
 * focusable so the tooltip opens from the keyboard too (FR-X-5); the tooltip
 * is the badge's accessible description.
 */
export interface CloudBadgeProps {
  verdict: CloudVerdict;
  /** Provider and fetch time of the snapshot behind the verdict; null when there is no forecast. */
  forecast: { provider: string; fetchedAt: EpochMs } | null;
  timeZone: string | null;
  /** The instant the verdict is for, as it reads in the tooltip: "at the pass peak", "right now". */
  moment: string;
}

export const CLOUD_LABELS: Record<CloudState, string> = {
  clear: 'Clear',
  partly: 'Partly cloudy',
  obscured: 'Likely obscured',
  unknown: 'Weather unknown',
};

const PROVIDER_NAMES: Record<string, string> = { 'open-meteo': 'Open-Meteo' };

export const THRESHOLDS_TEXT = `Clear below ${String(CLEAR_BELOW_PCT)} %, partly cloudy ${String(CLEAR_BELOW_PCT)}–${String(OBSCURED_ABOVE_PCT)} %, likely obscured above ${String(OBSCURED_ABOVE_PCT)} % effective cloud (low and mid cloud weigh more than high cloud).`;

/** "Clear, 12 % cloud" / "Weather unknown". */
export function badgeText(verdict: CloudVerdict): string {
  const label = CLOUD_LABELS[verdict.state];
  return verdict.effectivePct === null ? label : `${label}, ${String(Math.round(verdict.effectivePct))} % cloud`;
}

export function tooltipText(verdict: CloudVerdict, forecast: CloudBadgeProps['forecast'], timeZone: string | null, moment: string): string {
  const head = verdict.effectivePct === null ? `No cloud forecast ${moment}.` : `${String(Math.round(verdict.effectivePct))} % effective cloud ${moment}.`;
  const source = forecast
    ? `Forecast by ${PROVIDER_NAMES[forecast.provider] ?? forecast.provider}, fetched ${formatDate(forecast.fetchedAt, timeZone)} ${formatClock(forecast.fetchedAt, timeZone)}.`
    : 'No forecast is available.';
  return `${head} ${THRESHOLDS_TEXT} ${source}`;
}

export function CloudBadge({ verdict, forecast, timeZone, moment }: CloudBadgeProps) {
  const tipId = useId();
  return (
    <span className={styles.wrap}>
      <span className={styles.badge} data-state={verdict.state} tabIndex={0} aria-describedby={tipId}>
        {badgeText(verdict)}
      </span>
      <span role="tooltip" id={tipId} className={styles.tip}>
        {tooltipText(verdict, forecast, timeZone, moment)}
      </span>
    </span>
  );
}
