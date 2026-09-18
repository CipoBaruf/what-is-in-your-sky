import { useId, type ReactNode } from 'react';
import { useT } from '../../../i18n/useT';
import { MAX_FAVOURITES } from '../../../model';
import { favouriteCellKey, useAppStore } from '../../../state';
import { SectionHeading } from '../common/SectionHeading';
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
/**
 * `footer` is the compact settings page's slot (the owner, 2026-09-09): the clear action belongs *in* the
 * saved places, where the reader is already looking at the places they keep, rather than at the foot of the
 * page. The block does not know what it is given — the page decides, as D-262 has it. R75 (FR-SET-1): it
 * sits on the save row, `[ Save this place ] [ Clear saved ]`.
 *
 * `titled` is the settings page's too (R75, FR-SET-1): there the saved places are a block of their own,
 * under a section heading like Location's, rather than the tail of the location section.
 *
 * `limit` is the third (R75, FR-SET-2): the settings page has to fit 390 × 844 with two places saved, and
 * FR-SET-1 draws the block as the list and one row. So there the sentence stating the limit is said where it
 * is news — with nothing saved yet, beside the empty line, and once the list is full, when the next save
 * forgets a place — and not under every list in between.
 *
 * `form: 'line'` is the home page's Where reading (R81, FR-FIRST-11, D-511): `Saved places · [ Save this
 * place ]` on one line and each saved place a line under it, with no empty-list sentence — the save
 * control is what says there is nothing yet — and the limit said only once the list is full, when the
 * next save would forget a place.
 */
export function Favourites({ footer, titled = false, limit = 'always', form = 'block' }: { footer?: ReactNode; titled?: boolean; limit?: 'always' | 'empty-or-full'; form?: 'block' | 'line' } = {}) {
  const t = useT();
  const headingId = useId();
  const observer = useAppStore((s) => s.observer);
  const favourites = useAppStore((s) => s.favourites);
  const add = useAppStore((s) => s.addFavourite);
  const select = useAppStore((s) => s.selectFavourite);
  const remove = useAppStore((s) => s.removeFavourite);

  if (observer === null && favourites.length === 0) return null;
  const activeCell = observer === null ? null : favouriteCellKey(observer);
  const Block = titled ? 'section' : 'div';
  const items = favourites.map((favourite) => {
    const current = favourite.cellKey === activeCell;
    return (
      <li key={favourite.cellKey} className={styles.item} data-testid="favourite" data-current={current ? 'yes' : 'no'}>
        <button
          type="button"
          className={styles.use}
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
          className={styles.remove}
          aria-label={t.favourites.remove(favourite.observer.label)}
          onClick={() => {
            remove(favourite.cellKey);
          }}
        >
          ×
        </button>
      </li>
    );
  });

  if (form === 'line') {
    return (
      <div className={styles.line} data-testid="favourites">
        <div className={styles.lineHead}>
          <span className={styles.lineTitle}>{t.favourites.heading}</span>
          {observer !== null && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                className={styles.save}
                data-testid="save-favourite"
                onClick={() => {
                  add(observer);
                }}
              >
                {t.favourites.save}
              </button>
            </>
          )}
        </div>
        {favourites.length > 0 && <ul className={styles.list}>{items}</ul>}
        {favourites.length >= MAX_FAVOURITES && <p className={styles.limit}>{t.favourites.limit(MAX_FAVOURITES)}</p>}
      </div>
    );
  }

  return (
    <Block className={titled ? styles.section : styles.block} data-testid="favourites" {...(titled ? { 'aria-labelledby': headingId } : {})}>
      {titled ? <SectionHeading id={headingId}>{t.favourites.heading}</SectionHeading> : <p className={styles.heading}>{t.favourites.heading}</p>}
      {favourites.length === 0 ? (
        <p className={styles.empty}>{t.favourites.empty}</p>
      ) : (
        <ul className={styles.list}>{items}</ul>
      )}
      {observer !== null && (
        <div className={styles.saveRow}>
          <button
            type="button"
            className={styles.save}
            data-testid="save-favourite"
            onClick={() => {
              add(observer);
            }}
          >
            {t.favourites.save}
          </button>
          {footer}
        </div>
      )}
      {(limit === 'always' || favourites.length === 0 || favourites.length >= MAX_FAVOURITES) && <p className={styles.limit}>{t.favourites.limit(MAX_FAVOURITES)}</p>}
    </Block>
  );
}
