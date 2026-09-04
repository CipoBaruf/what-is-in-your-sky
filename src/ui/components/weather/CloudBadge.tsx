import { useId } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { CLEAR_BELOW_PCT, OBSCURED_ABOVE_PCT } from '../../../lib/cloudVerdict';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { CloudVerdict, EpochMs, Locale } from '../../../model';
import styles from './CloudBadge.module.css';

/**
 * US-7 AC2/AC3, FR-WX-3: the three-state cloud indicator (plus `unknown`,
 * US-7 AC4) with a tooltip that states the thresholds, the effective cloud
 * figure, the provider and when the forecast was fetched. The badge is
 * focusable so the tooltip opens from the keyboard too (FR-X-5); the tooltip
 * is the badge's accessible description. R12: the tooltip is a box overlaid
 * under the badge (see the module CSS), opened by hover, focus or a tap.
 */
export interface CloudBadgeProps {
  verdict: CloudVerdict;
  /** Provider and fetch time of the snapshot behind the verdict; null when there is no forecast. */
  forecast: { provider: string; fetchedAt: EpochMs } | null;
  timeZone: string | null;
  /** The instant the verdict is for, as it reads in the tooltip: "at the pass peak", "right now". */
  moment: string;
}

/** FR-I18N-6: a provider's name is its own in every language; only the display casing is ours. */
const PROVIDER_NAMES: Record<string, string> = { 'open-meteo': 'Open-Meteo' };

const percent = (pct: number | null): string | null => (pct === null ? null : String(Math.round(pct)));

/** "Clear, 12 % cloud" / "Weather unknown". */
export function badgeText(verdict: CloudVerdict, t: Messages): string {
  return t.weather.badge({ state: verdict.state, percent: percent(verdict.effectivePct) });
}

export function tooltipText(verdict: CloudVerdict, forecast: CloudBadgeProps['forecast'], timeZone: string | null, moment: string, t: Messages, locale: Locale): string {
  const head = t.weather.tooltipHead({ percent: percent(verdict.effectivePct), moment });
  const thresholds = t.weather.thresholds({ clear: String(CLEAR_BELOW_PCT), obscured: String(OBSCURED_ABOVE_PCT) });
  const source = forecast
    ? t.weather.source({
        provider: PROVIDER_NAMES[forecast.provider] ?? forecast.provider,
        fetched: t.passes.stamp({ date: formatDate(forecast.fetchedAt, timeZone, locale), time: formatClock(forecast.fetchedAt, timeZone, locale) }),
      })
    : t.weather.noForecast;
  return `${head} ${thresholds} ${source}`;
}

export function CloudBadge({ verdict, forecast, timeZone, moment }: CloudBadgeProps) {
  const t = useT();
  const locale = useLocale();
  const tipId = useId();
  return (
    <span className={styles.wrap}>
      <span className={`inline-control ${styles.badge}`} data-state={verdict.state} tabIndex={0} aria-describedby={tipId}>
        {badgeText(verdict, t)}
      </span>
      <span role="tooltip" id={tipId} className={styles.tip}>
        {tooltipText(verdict, forecast, timeZone, moment, t, locale)}
      </span>
    </span>
  );
}
