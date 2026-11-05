import { useMemo } from 'react';
import { useLocale, useT } from '../../../../i18n/useT';
import { CLOUD_BAND_PX, cloudCells, cloudRuns, type CloudBand as Band, type CloudRun } from '../../../../lib/cloudBand';
import { formatShortClock } from '../../../../lib/timeFormat';
import { xAt, type Span } from '../../../../lib/timeStripe';
import type { EpochMs, HourlyCloud, Locale } from '../../../../model';
import type { Messages } from '../../../../i18n/messages';
import styles from './CloudBand.module.css';

/**
 * R187 (FR-WIDE-8, D-1100): the cloud band along the foot of the overview and the stripe — one `<path>` per shaded
 * band over the hours `drawn` holds, `CLOUD_BAND_PX` high; clear and an hour with no forecast are both left blank.
 * The sentence is the band's text alternative. It cannot say a cloud's height or kind, only the cover's band.
 */

const SHADED = ['some', 'mostly', 'overcast'] as const satisfies readonly Band[];

export function CloudBandPaths({ hourly, drawn, width, height }: { hourly: readonly HourlyCloud[]; drawn: Span; width: number; height: number }) {
  const paths = useMemo(() => {
    const top = height - CLOUD_BAND_PX;
    const d: Record<(typeof SHADED)[number], string> = { some: '', mostly: '', overcast: '' };
    for (const run of cloudRuns(cloudCells(hourly, drawn.start, drawn.end))) {
      if (run.band === null || run.band === 'clear') continue;
      const x0 = xAt(Math.max(run.from, drawn.start), drawn, width);
      const x1 = xAt(Math.min(run.to, drawn.end), drawn, width);
      if (x1 <= x0) continue;
      d[run.band] += `M${fmt(x0)} ${fmt(top)}H${fmt(x1)}V${fmt(height)}H${fmt(x0)}Z`;
    }
    return d;
  }, [hourly, drawn, width, height]);
  return (
    <g data-row="clouds" aria-hidden="true">
      {SHADED.map((band) => (paths[band] === '' ? null : <path key={band} className={styles[band]} data-cloud={band} d={paths[band]} />))}
    </g>
  );
}

/** FR-WIDE-8: "Clouds: clear until 23:00, mostly cloudy 23:00–02:00, then clear" — the runs over `span`, joined. */
export function cloudSentence(runs: readonly CloudRun[], timeZone: string | null, locale: Locale, words: Messages['live']['clouds']): string {
  const name = (run: CloudRun): string => words.band[run.band ?? 'none'];
  const at = (t: EpochMs): string => formatShortClock(t, timeZone, locale);
  const parts = runs.map((run, index) => {
    if (runs.length === 1) return name(run);
    if (index === 0) return words.until(name(run), at(run.to));
    if (index === runs.length - 1) return words.then(name(run));
    return words.between(name(run), at(run.from), at(run.to));
  });
  return words.sentence(parts);
}

/** The sentence over `span` in the active language, or `null` with no forecast to describe. */
export function useCloudSentence(hourly: readonly HourlyCloud[] | undefined, span: Span, timeZone: string | null): string | null {
  const m = useT();
  const locale = useLocale();
  return useMemo(() => {
    if (hourly === undefined || hourly.length === 0) return null;
    const runs = cloudRuns(cloudCells(hourly, span.start, span.end));
    if (runs.every((run) => run.band === null)) return null;
    return cloudSentence(runs, timeZone, locale, m.live.clouds);
  }, [hourly, span, timeZone, locale, m]);
}

const fmt = (n: number): string => n.toFixed(1);
