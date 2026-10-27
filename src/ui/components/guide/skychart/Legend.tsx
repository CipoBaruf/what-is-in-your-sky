import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { useLocale, useT } from '../../../../i18n/useT';
import { degrees, formatSignedDegrees } from '../../../../lib/format';
import type { BodyLine, LegendRow } from '../../../../lib/legend';
import { formatClock } from '../../../../lib/timeFormat';
import { moonFacts } from '../../../../lib/moonPhrases';
import type { Messages } from '../../../../i18n/messages';
import { VisuallyHidden } from '../../primitives/VisuallyHidden';
import { moonGlyph } from './bodies';
import { LegendSwatch } from './LegendSwatch';
import styles from './Legend.module.css';

/**
 * FR-LEG-1..5 / D-186 (R45): the legend. A list — the text alternative
 * FR-GUIDE-7 as amended asks for — with one button per drawn pass: the key
 * the drawing carries at the arc's peak, a two-cell swatch in the arc's
 * colour (the same `--chart-*` token in both themes, FR-LEG-5), the name and
 * the state at the shown instant (`up`, `soon`, `gone`; nothing for a whole
 * arc), then on a second line the rise, peak and end clock times in the
 * observer's zone, each after its word (FR-FLOW-13, D-852). A tap,
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
  /**
   * R77 (FR-WATCH-3, FR-MOON-3 as amended v2.0): the Moon line carries the phase and the illumination.
   * The compact live page alone sets it, because that is the line its conditions line gives them to;
   * FR-MOON-3 leaves the Now panel and the wide live page unchanged, so everywhere else reads the
   * plain line. R79's sky screen draws the legend too, and is not this page.
   */
  moonPhase?: boolean;
}

/**
 * R77 (FR-WATCH-3, FR-MOON-3 as amended v2.0): the Moon line's phase and illumination — `☽ Moon waxing
 * crescent, 18 % · az …` — which the compact live page's conditions line gives to the list panel.
 */
function moonLitFacts(line: BodyLine, t: Messages): { phase: string; illumination: string } {
  if (!line.moon) return { phase: '', illumination: '' };
  const facts = moonFacts(line.moon);
  return { phase: t.moon.phase[facts.phase], illumination: facts.illumination };
}

/**
 * R85 (F-81, FR-CAP-5, D-549): a page that has only so many rows for the list — the short wide live window's
 * rail — says so here, past the view that renders the legend, as `ChartFrameSlots` does for the frame. Given
 * one, the list is an inventory: every entry a whole number of text rows (a pass two, the tap target; a body
 * line one), a header row naming the three times, the list's `max-height` whatever whole entries `clip` says
 * fit, and a `+n` line under it for the rest. The arithmetic is the page's (`liveRows.ts`, `inventoryClip`).
 */
export interface LegendInventory {
  /**
   * The entries' heights in text rows, in list order, and the rows the times header takes above them — one
   * where it is drawn, none where no listed row has times → the rows the list shows and the entries it leaves out.
   */
  clip: (entryRows: readonly number[], headerRows: number) => { rows: number; more: number };
  /** The line under a clipped list: `+2 more`. */
  moreLabel: (n: number) => string;
}

export const LegendInventoryContext = createContext<LegendInventory | null>(null);

/** An entry's height in text rows on the inventory: a row button is the tap target, two rows; a line is one. */
const ENTRY_ROWS = { row: 2, line: 1 } as const;

type TimeKey = 'rise' | 'peak' | 'end';

export function Legend({ rows, bodies, timeZone, highlightedPassId, onActivate, onFocusRow, lead, screen = false, moonPhase = false }: LegendProps) {
  const t = useT();
  const locale = useLocale();
  const words = t.chart.legend;
  const clock = (ms: number | null): string => (ms === null ? '' : formatClock(ms, timeZone, locale));
  // The lead's row is the table itself, so it is not repeated as a button below it (FR-LEG-3).
  const listed = lead === undefined ? rows : rows.filter((row) => row.passId !== lead.passId);
  const inventory = useContext(LegendInventoryContext);
  const clipped = inventory !== null && !screen && lead === undefined;
  const entryRows = [...(listed.length === 0 ? [ENTRY_ROWS.line] : listed.map(() => ENTRY_ROWS.row)), ...bodies.map(() => ENTRY_ROWS.line)];
  // The header row lines its words up over the first timed row's three clock strings, so with no timed row
  // there is no header and the budget keeps that row for the list.
  const clip = clipped ? inventory.clip(entryRows, 0) : null;
  // FR-FLOW-13 (D-852, V26-13): each time is written with its word on the row's second line, the zone once after
  // the last — `rise 09:48:24 · peak 09:48:38 · end 09:49:02 UTC`. The separator closes the time before it, and a
  // time never breaks inside, so a narrow column wraps between whole times and no line starts with `·` (D-863). The
  // sky screen's one-line strip keeps its bare figures and says the words to a screen reader alone (R85, F-81),
  // since its width is the name's.
  const time = (key: TimeKey, ms: number | null, last: boolean): ReactNode => (
    <span className={styles.time}>
      {screen ? <VisuallyHidden>{`${words[key]} `}</VisuallyHidden> : `${words[key]} `}
      {screen || last ? clock(ms) : clock(ms).split(' ', 1)[0]}
      {!screen && !last && ' · '}
    </span>
  );
  const stateOf = (row: LegendRow): ReactNode =>
    (row.state === 'live' || row.state === 'ahead' || row.state === 'linger') && <span className={styles.state}>{words.state[row.state]}</span>;
  const list = (
    <ol
      className={[styles.legend, screen ? styles.screen : undefined, clip !== null ? styles.clipped : undefined].filter(Boolean).join(' ')}
      aria-label={words.label}
      data-testid="chart-legend"
      data-lead={lead !== undefined}
      data-screen={screen}
      {...(clip === null ? {} : { 'data-clip-rows': clip.rows, style: { ['--inventory-rows' as string]: String(clip.rows) } as CSSProperties })}
    >
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
      {listed.map((row) => {
        const state = stateOf(row);
        return (
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
              {/* FR-FLOW-13: the name and the state are the first line, the named times the second. The state stands
                  outside the name's text, so a name cut by an ellipsis never takes the state with it (D-863). */}
              <span className={styles.name}>
                <span className={styles.nameText}>{row.name}</span>
                {!screen && row.riseMs !== null && state !== false && <> {state}</>}
              </span>
              {row.riseMs !== null && (
                <span className={styles.times}>
                  {time('rise', row.riseMs, false)}
                  {/* D-863: the short wide inventory keeps rise and end, as the strip and the dim rows do: its line
                      does not wrap, and three named times with a zone are wider than its rail. */}
                  {lead === undefined && !screen && clip === null && time('peak', row.peakMs, false)}
                  {time('end', row.endMs, true)}
                  {screen && state}
                </span>
              )}
            </button>
          </li>
        );
      })}
      {bodies.map((line) => (
        <li key={line.body} className={[styles.item, styles.body].join(' ')} data-body={line.body}>
          <LegendSwatch color={line.body} />
          <span className={styles.name}>
            {line.body === 'sun'
              ? words.sun({ azimuth: degrees(line.azDeg), altitude: formatSignedDegrees(line.altDeg, locale) })
              : moonPhase
                ? words.moonLit({ glyph: line.moon ? moonGlyph(line.moon) : '', ...moonLitFacts(line, t), azimuth: degrees(line.azDeg), altitude: formatSignedDegrees(line.altDeg, locale) })
                : words.moon({ glyph: line.moon ? moonGlyph(line.moon) : '', azimuth: degrees(line.azDeg), altitude: formatSignedDegrees(line.altDeg, locale) })}
          </span>
        </li>
      ))}
    </ol>
  );
  if (clip === null) return list;
  // D-863: no header row over the times — each row writes its own words (FR-FLOW-13), so a header would repeat them.
  return (
    <div className={styles.inventory} data-testid="legend-inventory">
      {list}
      {clip.more > 0 && (
        <p className={styles.more} data-testid="legend-more">
          {inventory?.moreLabel(clip.more)}
        </p>
      )}
    </div>
  );
}
