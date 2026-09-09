import type { ReactNode } from 'react';
import { useLocale, useT } from '../../../../i18n/useT';
import { degrees, formatSignedDegrees } from '../../../../lib/format';
import type { BodyLine, LegendRow } from '../../../../lib/legend';
import { formatClock } from '../../../../lib/timeFormat';
import { moonGlyph } from './bodies';
import { LegendSwatch } from './LegendSwatch';
import styles from './Legend.module.css';

/**
 * FR-LEG-1..5 / D-186 (R45): the legend. A list — the text alternative
 * FR-GUIDE-7 as amended asks for — with one button per drawn pass: the key
 * the drawing carries at the arc's peak, a two-cell swatch in the arc's
 * colour (the same `--chart-*` token in both themes, FR-LEG-5), the name,
 * the rise, peak and end clock times in the observer's zone and the state at
 * the shown instant (`up`, `soon`, `gone`; nothing for a whole arc). A tap,
 * a click or keyboard focus on a row highlights its arc and dims the others
 * (FR-LEG-4); R54 (D-271, F-53): a click or tap *activates* — pins the row
 * and moves it to the top — while focus only highlights, so the list holds
 * still under a keyboard walking it. A hidden object (FR-LIVE-6) gets a dim row with the words the
 * page gave it; the Sun and the Moon get one line each with azimuth and
 * altitude (FR-DOME-6 as amended). Inside `skychart/` so the chart's palette
 * is the swatch's; rendered by `SkyChart` from the props the drawing gets
 * and placed by `ChartFrame`.
 *
 * R51 (FR-LEG-3, US-23 AC3): on the pass detail the FR-GUIDE-1 numeric table
 * is the legend, so the caller hands in a `lead` — the table, already
 * rendered against the row it stands for — and it takes that row's place at
 * the head of the list. The rows left are the passes drawn dim, and they
 * carry rise and end only: the explained pass's peak is in the table, and a
 * dim arc on the detail is context, not a second pass to time to the second.
 * `data-lead` says so on the list itself, which is how `ChartFrame` knows to
 * keep this legend under the drawing at every width (D-259): a five-column
 * table does not go in a 24-cell column.
 */
export interface LegendProps {
  rows: readonly LegendRow[];
  bodies: readonly BodyLine[];
  timeZone: string | null;
  /** The pass the drawing emphasises alone, or null when every arc is at full weight. */
  highlightedPassId: string | null;
  /** A click or a tap: pin the row and promote it (FR-LEG-4). */
  onActivate: (passId: string) => void;
  /** Keyboard focus: highlight the row's arc without reordering the list (R54, D-271). */
  onFocusRow: (passId: string) => void;
  /**
   * FR-LEG-3 (R51): the pass detail's numeric table, standing in for the row
   * of the pass it explains. Given one, the list opens with it and drops that
   * pass's own row; the rest of the rows read as the detail's dim arcs.
   */
  lead?: { passId: string; node: ReactNode } | undefined;
  /**
   * FR-FSC-3 / FR-LEG-2 as amended v1.3 (R62, D-322): the follow screen's
   * strip. The rows are FR-LEG-3's short form — key, swatch, name, rise and end
   * — on one line each, so the two rows the strip is allowed are two lines of
   * text at 844 px and the drawing keeps the rest of the screen. The peak time
   * is what goes: on a screen the picture is the peak.
   */
  screen?: boolean;
}

export function Legend({ rows, bodies, timeZone, highlightedPassId, onActivate, onFocusRow, lead, screen = false }: LegendProps) {
  const t = useT();
  const locale = useLocale();
  const words = t.chart.legend;
  const clock = (ms: number | null): string => (ms === null ? '' : formatClock(ms, timeZone, locale));
  // The lead's row is the table itself, so it is not repeated as a button below it (FR-LEG-3).
  const listed = lead === undefined ? rows : rows.filter((row) => row.passId !== lead.passId);
  return (
    <ol className={[styles.legend, screen ? styles.screen : undefined].filter(Boolean).join(' ')} aria-label={words.label} data-testid="chart-legend" data-lead={lead !== undefined} data-screen={screen}>
      {lead !== undefined && (
        <li className={[styles.item, styles.lead].join(' ')} data-testid="legend-lead" data-pass-id={lead.passId}>
          {lead.node}
        </li>
      )}
      {/* FR-LEG-7 (R71): a legend with no rows says so, once, and says it live — the panel is two rows tall
          whether or not the sky has anything in it. Never on the sky screen, whose strip is the drawing's own
          bottom edge and stays empty (FR-FSC-3, out of scope), and never where a lead is the first row. */}
      {!screen && lead === undefined && listed.length === 0 && (
        <li className={[styles.item, styles.empty].join(' ')} data-testid="legend-empty">
          <span role="status">{words.empty}</span>
        </li>
      )}
      {listed.map((row) => (
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
              onFocusRow(row.passId);
            }}
          >
            <span className={styles.key}>{row.key}</span>
            <LegendSwatch color={row.colorToken} />
            <span className={styles.name}>{row.name}</span>
            {row.riseMs !== null && (
              <span className={styles.times}>
                <span className={styles.time}>{clock(row.riseMs)}</span>
                {lead === undefined && !screen && <span className={styles.time}>{clock(row.peakMs)}</span>}
                <span className={styles.time}>{clock(row.endMs)}</span>
                {(row.state === 'live' || row.state === 'ahead' || row.state === 'linger') && <span className={styles.state}>{words.state[row.state]}</span>}
              </span>
            )}
          </button>
        </li>
      ))}
      {bodies.map((line) => (
        <li key={line.body} className={[styles.item, styles.body].join(' ')} data-body={line.body}>
          <LegendSwatch color={line.body} />
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
