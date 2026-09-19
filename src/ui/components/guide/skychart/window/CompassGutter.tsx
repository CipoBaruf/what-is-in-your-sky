import type { CSSProperties } from 'react';
import { useT } from '../../../../../i18n/useT';
import { degrees } from '../../../../../lib/format';
import { LegendSwatch } from '../LegendSwatch';
import styles from './CompassGutter.module.css';
import { bandNames, bracketFor, edgeMarkers, type GutterMark } from './gutter';
import type { View } from './projection';

/**
 * R79 (FR-GUT-1..5, US-28 AC1..AC3; PLAN D-450): the sky screen's bottom
 * edge — where the reader faces, what they can see of it and where each pass
 * is. `GUTTER_PX` tall (`--gutter`) and the screen's whole width, on
 * `--screen-overlay`, in the slot the legend strip had (`ChartFrame`'s screen
 * mode places it; which component fills the slot changed, the slot did not).
 *
 * Thin: every position is `gutter.ts`'s, as a fraction of the band written as
 * a percentage, so nothing here measures and nothing stretches. It takes the
 * facing and the marks as props — the window owns the sensor and the smoothed
 * heading the readout shows (FR-GUT-2), and the marks are computed once there
 * because the empty-field chip reads them too (FR-GUT-6).
 *
 *   - the eight compass names where they fall on the band, each with a tick
 *     above it (FR-GUT-2);
 *   - the bracket: the horizontal field the projection draws (FR-GUT-3);
 *   - a tick per drawn pass on the band, at least 2 × 8 px, in its series
 *     colour, with its key under it only outside the bracket — inside, the key
 *     is at the arc's peak already (FR-GUT-4);
 *   - an edge marker per pass off the band, `◀ A 110°` / `A 110° ▶`, stacked
 *     nearest first then in legend order (FR-GUT-5).
 *
 * The drawing is `aria-hidden`; the same marks are a list of sentences beside
 * it, visually hidden, so the gutter is never a sighted-only channel (FR-X-5).
 * No transitions: the band is the same function of the facing the projection
 * is, and anything eased would lag behind the drawing.
 */
export interface CompassGutterProps {
  /** The facing the readout shows, degrees clockwise from north. */
  facingDeg: number;
  /** The window's measured view: its width and field are the bracket's. */
  view: View;
  /** `gutterMarks` for the drawn passes, in legend order. */
  marks: readonly GutterMark[];
}

const at = (x: number, width: number): CSSProperties => ({ left: `${((100 * x) / width).toFixed(3)}%` });

export function CompassGutter({ facingDeg, view, marks }: CompassGutterProps) {
  const t = useT();
  const width = view.width;
  const names = bandNames(facingDeg, width);
  const bracket = bracketFor(view);
  const left = edgeMarkers(marks, 'off-left');
  const right = edgeMarkers(marks, 'off-right');
  return (
    <div className={styles.gutter} data-testid="compass-gutter" role="group" aria-label={t.window.gutterLabel} data-facing={Math.round(facingDeg)}>
      <div className={styles.band} aria-hidden="true">
        <span className={styles.bracket} data-testid="gutter-bracket" style={{ ...at(bracket.x0, width), width: `${((100 * (bracket.x1 - bracket.x0)) / width).toFixed(3)}%` }} />
        {names.map(({ name, x }) => (
          <span key={name} className={styles.name} data-compass={name} style={at(x, width)}>
            {name}
          </span>
        ))}
        {marks.map((mark) =>
          mark.x === null ? null : (
            <span key={mark.id} className={styles.mark} data-gutter-mark={mark.id} data-branch={mark.branch} style={at(mark.x, width)}>
              <LegendSwatch color={mark.color} className={styles.tick} />
              {mark.branch === 'on-band' && (
                <span className={styles.key} data-color={mark.color}>
                  {mark.key}
                </span>
              )}
            </span>
          ),
        )}
      </div>
      {left.length > 0 && (
        <span className={[styles.edge, styles.edgeLeft].join(' ')} aria-hidden="true">
          {left.map((mark) => (
            <span key={mark.id} className={styles.marker} data-edge="left" data-gutter-mark={mark.id}>
              {'◀ '}
              <span className={styles.key} data-color={mark.color}>
                {mark.key}
              </span>{' '}
              {degrees(mark.angleDeg ?? 0)}
            </span>
          ))}
        </span>
      )}
      {right.length > 0 && (
        <span className={[styles.edge, styles.edgeRight].join(' ')} aria-hidden="true">
          {right.map((mark) => (
            <span key={mark.id} className={styles.marker} data-edge="right" data-gutter-mark={mark.id}>
              <span className={styles.key} data-color={mark.color}>
                {mark.key}
              </span>{' '}
              {degrees(mark.angleDeg ?? 0)}
              {' ▶'}
            </span>
          ))}
        </span>
      )}
      <ul className={styles.words} data-testid="gutter-words">
        {marks.map((mark) => (
          <li key={mark.id}>
            {t.window.gutterMark({
              name: mark.name,
              key: mark.key,
              place: mark.branch === 'in-bracket' ? 'in' : mark.turn.side,
              angle: degrees(mark.turn.angleDeg),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
