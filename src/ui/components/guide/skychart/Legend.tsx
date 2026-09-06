import { useLocale, useT } from '../../../../i18n/useT';
import { degrees, formatSignedDegrees } from '../../../../lib/format';
import type { BodyLine, LegendRow } from '../../../../lib/legend';
import { formatClock } from '../../../../lib/timeFormat';
import { moonGlyph } from './bodies';
import styles from './Legend.module.css';

/**
 * FR-LEG-1..5 / D-186 (R45): the legend. A list — the text alternative
 * FR-GUIDE-7 as amended asks for — with one button per drawn pass: the key
 * the drawing carries at the arc's peak, a two-cell swatch in the arc's
 * colour (the same `--chart-*` token in both themes, FR-LEG-5), the name,
 * the rise, peak and end clock times in the observer's zone and the state at
 * the shown instant (`up`, `soon`, `gone`; nothing for a whole arc). A tap,
 * a click or keyboard focus on a row highlights its arc and dims the others
 * (FR-LEG-4). A hidden object (FR-LIVE-6) gets a dim row with the words the
 * page gave it; the Sun and the Moon get one line each with azimuth and
 * altitude (FR-DOME-6 as amended). Inside `skychart/` so the chart's palette
 * is the swatch's; rendered by `SkyChart` from the props the drawing gets
 * and placed by `ChartFrame`.
 */
export interface LegendProps {
  rows: readonly LegendRow[];
  bodies: readonly BodyLine[];
  timeZone: string | null;
  /** The pass the drawing emphasises alone, or null when every arc is at full weight. */
  highlightedPassId: string | null;
  onActivate: (passId: string) => void;
}

export function Legend({ rows, bodies, timeZone, highlightedPassId, onActivate }: LegendProps) {
  const t = useT();
  const locale = useLocale();
  const words = t.chart.legend;
  const clock = (ms: number | null): string => (ms === null ? '' : formatClock(ms, timeZone, locale));
  return (
    <ol className={styles.legend} aria-label={words.label} data-testid="chart-legend">
      {rows.map((row) => (
        <li key={row.passId} className={styles.item}>
          <button
            type="button"
            className={styles.row}
            data-pass-id={row.passId}
            data-key={row.key}
            data-state={row.state}
            data-highlighted={row.highlighted}
            aria-pressed={highlightedPassId === row.passId}
            onClick={() => {
              onActivate(row.passId);
            }}
            onFocus={() => {
              onActivate(row.passId);
            }}
          >
            <span className={styles.key}>{row.key}</span>
            <span className={styles.swatch} data-color={row.colorToken} aria-hidden="true" />
            <span className={styles.name}>{row.name}</span>
            {row.riseMs !== null && (
              <span className={styles.times}>
                <span className={styles.time}>{clock(row.riseMs)}</span>
                <span className={styles.time}>{clock(row.peakMs)}</span>
                <span className={styles.time}>{clock(row.endMs)}</span>
                {(row.state === 'live' || row.state === 'ahead' || row.state === 'linger') && <span className={styles.state}>{words.state[row.state]}</span>}
              </span>
            )}
          </button>
        </li>
      ))}
      {bodies.map((line) => (
        <li key={line.body} className={[styles.item, styles.body].join(' ')} data-body={line.body}>
          <span className={styles.bodySwatch} data-color={line.body} aria-hidden="true" />
          <span className={styles.name}>
            {line.body === 'sun'
              ? words.sun({ azimuth: degrees(line.azDeg), altitude: formatSignedDegrees(line.altDeg, locale) })
              : words.moon({ glyph: line.moon ? moonGlyph(line.moon) : '', azimuth: degrees(line.azDeg), altitude: formatSignedDegrees(line.altDeg, locale) })}
          </span>
        </li>
      ))}
    </ol>
  );
}
