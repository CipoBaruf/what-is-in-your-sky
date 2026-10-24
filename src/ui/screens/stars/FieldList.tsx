import { useLocale, useT } from '../../../i18n/useT';
import { degrees } from '../../../lib/format';
import { formatStarMag, type FieldObject } from './field';
import styles from './FieldList.module.css';

/**
 * R115 (FR-STAR-7, FR-GUIDE-7, FR-LEG-4; D-756): `In this field` — the
 * `FIELD_LIST_MAX` brightest objects drawn in the field, brightest first, one
 * row each: the name, the magnitude, the altitude and the 16-point direction.
 * It is the drawing's text alternative (the drawing is `aria-hidden`), so it
 * is a list with the heading's name.
 *
 * A row is a button: its activation or its focus names its mark, as a tap on
 * the mark does — FR-LEG-4's rule, the legend's two handlers — through the
 * page's one `namedStar`, which the window draws the label from (R116) and
 * clears after `STAR_LABEL_HOLD_S`. Focus and a click both name; a click on a
 * row already named names it again, which restarts the hold, so a mouse down
 * that focuses and the click that follows it never cancel each other.
 *
 * Pointed at the ground (FR-FOL-5's second step, no sky in the field) the list
 * is the note instead, in the window's own words for it; with sky in the field
 * and nothing drawn in it — every object layer off — it says so, once.
 */
export interface FieldListProps {
  objects: readonly FieldObject[];
  named: number | null;
  onName: (index: number) => void;
  /** No sky left in the field (FR-FOL-5): the note stands in for the list. */
  buried: boolean;
  /** The heading's id, which names the list. */
  labelledBy: string;
}

export function FieldList({ objects, named, onName, buried, labelledBy }: FieldListProps) {
  const t = useT();
  const locale = useLocale();
  if (buried) {
    return (
      <p className={styles.note} role="status" data-testid="field-list-note">
        {t.window.buried}
      </p>
    );
  }
  if (objects.length === 0) {
    return (
      <p className={styles.note} role="status" data-testid="field-list-empty">
        {t.stars.fieldEmpty}
      </p>
    );
  }
  return (
    <ul className={styles.list} aria-labelledby={labelledBy} data-testid="field-list">
      {objects.map((object) => {
        const name = object.planet === null ? (object.name ?? '') : t.stars.planets[object.planet];
        const mag = formatStarMag(object.mag, locale);
        const altitude = degrees(object.altDeg);
        return (
          <li key={object.index} className={styles.item}>
            <button
              type="button"
              className={styles.row}
              data-index={object.index}
              data-kind={object.planet === null ? 'star' : 'planet'}
              aria-pressed={named === object.index}
              aria-label={t.stars.named({ name, mag, altitude, point: object.point })}
              onClick={() => {
                onName(object.index);
              }}
              onFocus={() => {
                onName(object.index);
              }}
            >
              <span className={styles.name}>{name}</span>
              <span className={styles.mag}>{t.stars.mag({ mag })}</span>
              <span className={styles.alt}>{altitude}</span>
              <span className={styles.point}>{object.point}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
