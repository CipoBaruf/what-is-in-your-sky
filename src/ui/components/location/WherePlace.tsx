import { useT } from '../../../i18n/useT';
import type { Messages } from '../../../i18n/messages';
import { coordsLabel } from '../../../lib/place';
import type { Observer } from '../../../model';
import { useActiveObserver } from '../../../state';
import styles from './WherePlace.module.css';

/**
 * R81 (FR-FIRST-11, D-511): the Where reading's head once there is a place, in
 * place of R52/R76's one-line summary. The place in `--fg` with its
 * coordinates after it in `--fg-dim` (`Cipolletti (−38.93, −67.99)`), or the
 * coordinates alone; then at `--small` one sentence by where the place came
 * from — the centre of a place picked by name, coordinates typed in, or the
 * device with its accuracy (US-3 AC3) — then "Saved in this browser only." and
 * `[ change ]`, which opens the home page's input group (FR-FIRST-2) in place
 * and closes it again (`aria-expanded`, `aria-controls`). It never sends the
 * reader to `#settings`, which is not where a place is set (FR-SET-3).
 *
 * The group itself is the Where reading's (`screens/Home.tsx`), not this
 * component's: it is one mounted instance across the cold open and the
 * reading (D-467), so a reader typing a place in it keeps the field they are
 * typing in when the place arrives.
 */
export interface WherePlaceProps {
  /** Whether the input group is open. */
  open: boolean;
  onToggle: () => void;
  /** The id of the group `[ change ]` opens. */
  controls: string;
}

/** A geocoded label's first part is the place itself ("Cipolletti, Río Negro, Argentina" → "Cipolletti"). */
export function placeName(observer: Observer): string | null {
  if (observer.source !== 'geocode') return null;
  return observer.label.split(',')[0]?.trim() || observer.label;
}

/** The sentence under the place, by its source. */
function whereSentence(observer: Observer, t: Messages): string {
  switch (observer.source) {
    case 'geocode':
      return t.home.where.centre(placeName(observer) ?? observer.label);
    case 'coords':
      return t.home.where.coords;
    case 'device':
      return t.home.where.device(observer.accuracyM === undefined ? null : String(Math.round(observer.accuracyM)));
  }
}

export function WherePlace({ open, onToggle, controls }: WherePlaceProps) {
  const t = useT();
  const observer = useActiveObserver();
  if (observer === null) return null;
  const place = placeName(observer);
  const coords = coordsLabel(observer.lat, observer.lon);
  return (
    <div className={styles.where}>
      <p className={styles.place} data-testid="location-summary">
        {place === null ? (
          <span className={styles.name}>{coords}</span>
        ) : (
          <>
            <span className={styles.name}>{place}</span> <span className={styles.coords}>({coords})</span>
          </>
        )}
      </p>
      <p className={styles.sentence} data-testid="where-sentence">
        {whereSentence(observer, t)} {t.location.savedHere}{' '}
        <button type="button" className={`inline-control ${styles.change}`} aria-expanded={open} aria-controls={controls} data-testid="location-summary-change" onClick={onToggle}>
          {t.location.summaryChange}
        </button>
      </p>
    </div>
  );
}
