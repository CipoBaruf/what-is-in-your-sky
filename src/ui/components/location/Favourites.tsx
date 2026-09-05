import { useT } from '../../../i18n/useT';
import { MAX_FAVOURITES } from '../../../model';
import { favouriteCellKey, useAppStore } from '../../../state';
import styles from './Favourites.module.css';

/**
 * FR-OFF-7, US-17: the saved places, at the foot of the location section.
 * Save the active place under its own label, pick one, remove one; the limit
 * and what happens at it are stated.
 *
 * The store does all of it (D-139): picking is a `setObserver`, so the ordinary
 * FR-VIS-5 recompute follows and the list, the Now panel and the readiness line
 * all speak for the new observer without this component knowing they exist.
 * Saving keeps the observer's own label, which US-17 AC1 asks for and which is
 * already the geocoded place name or the rounded coordinates — there is no
 * second name to invent, and no text field to fill in before a place can be
 * kept.
 *
 * Three readings, recorded in D-155. The section is drawn whenever there is
 * something to say — a place to save or a place already saved — so an empty
 * first visit carries no dead control. The save button stays enabled for a
 * place already on the list, because saving it again is a real operation
 * (D-138 refreshes the label and the use, which is what keeps it out of the
 * eviction's way); the entry it lands on is marked "in use" instead, which is
 * the feedback. And removing is one click with nothing in front of it, which
 * US-17 AC2 asks for by name: the cost of a mistake is re-saving a place that
 * is one tap away.
 */
export function Favourites() {
  const t = useT();
  const observer = useAppStore((s) => s.observer);
  const favourites = useAppStore((s) => s.favourites);
  const add = useAppStore((s) => s.addFavourite);
  const select = useAppStore((s) => s.selectFavourite);
  const remove = useAppStore((s) => s.removeFavourite);

  if (observer === null && favourites.length === 0) return null;
  const activeCell = observer === null ? null : favouriteCellKey(observer);

  return (
    <div className={styles.block} data-testid="favourites">
      <p className={styles.heading}>{t.favourites.heading}</p>
      {favourites.length === 0 ? (
        <p className={styles.empty}>{t.favourites.empty}</p>
      ) : (
        <ul className={styles.list}>
          {favourites.map((favourite) => {
            const current = favourite.cellKey === activeCell;
            return (
              <li key={favourite.cellKey} className={styles.item} data-testid="favourite" data-current={current ? 'yes' : 'no'}>
                <button
                  type="button"
                  className={`inline-control ${styles.use}`}
                  aria-label={t.favourites.use(favourite.observer.label)}
                  {...(current ? { 'aria-current': true as const } : {})}
                  onClick={() => {
                    select(favourite.cellKey);
                  }}
                >
                  {favourite.observer.label}
                </button>
                {current && <span className={styles.current}>({t.favourites.current})</span>}
                <button
                  type="button"
                  className={`inline-control ${styles.remove}`}
                  aria-label={t.favourites.remove(favourite.observer.label)}
                  onClick={() => {
                    remove(favourite.cellKey);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {observer !== null && (
        <p className={styles.saveRow}>
          <button
            type="button"
            className={`inline-control ${styles.save}`}
            data-testid="save-favourite"
            onClick={() => {
              add(observer);
            }}
          >
            {t.favourites.save}
          </button>
        </p>
      )}
      <p className={styles.limit}>{t.favourites.limit(MAX_FAVOURITES)}</p>
    </div>
  );
}
