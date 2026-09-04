import { useId } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { nextFeaturedPass, sortPasses } from '../../../lib/passSort';
import type { Observer } from '../../../model';
import { SEARCH_WINDOW_HOURS, isFeatured, useAppStore, type ElementsState, type PassesState } from '../../../state';
import { SectionHeading } from '../common/SectionHeading';
import { useNow } from '../../hooks/useNow';
import { IssHeroCard } from './IssHeroCard';
import { PassCard } from './PassCard';
import styles from './PassList.module.css';
import { SortToggle } from './SortToggle';

/**
 * Every upcoming visible pass of the catalog as plain cards, chronological
 * (US-5 AC2 default). R5: the cards render as the worker streams each object's
 * passes into the store, the ISS first (PLAN §6.2); the status line shows the
 * progress meanwhile. R6: each card opens the detail screen through
 * `onOpenPass`. R8: every card gets the forecast for this observer (null
 * until it arrives or when it failed, which the card shows as "weather
 * unknown"). R12: the next pass of a featured object is pulled out of the
 * list into the hero card above it (spec §8 rank 1; it is not repeated
 * below), and the sort toggle orders the rest, chronological or best first,
 * with the choice persisted through the store (US-5 AC2).
 */
export function statusText(observer: Observer | null, elements: ElementsState, passes: PassesState, t: Messages): string {
  const hours = SEARCH_WINDOW_HOURS;
  if (!observer) return t.passes.noObserver;
  if (elements.status === 'idle' || elements.status === 'loading') return t.passes.loadingElements;
  if (elements.status === 'error') return t.passes.elementsError(elements.message);
  if (elements.records.length === 0) return t.passes.noElements;
  const place = observer.label;
  switch (passes.status) {
    case 'idle':
      return t.passes.computing;
    case 'computing':
      return t.passes.computingProgress({ done: passes.done, total: passes.total, found: passes.passes.length });
    case 'error':
      return t.passes.passesError(passes.error ?? t.passes.unknownError);
    case 'done':
      if (passes.passes.length === 0 && passes.hasDarkness === false) return t.passes.noDarkness({ hours, place });
      if (passes.passes.length === 0) return t.passes.none({ hours, place });
      return t.passes.found({ count: passes.passes.length, hours, place });
  }
}

/** How often the list re-checks which featured pass is next (the hero card itself ticks every second). */
export const HERO_CHECK_MS = 30_000;

export interface PassListProps {
  /** Opens the detail screen for a pass (R6). Without it the cards are read-only. */
  onOpenPass?: (passId: string) => void;
}

export function PassList({ onOpenPass }: PassListProps) {
  const t = useT();
  const observer = useAppStore((s) => s.observer);
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const sort = useAppStore((s) => s.sort);
  const setSort = useAppStore((s) => s.setSort);
  const headingId = useId();
  const now = useNow(HERO_CHECK_MS);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const showList = observer !== null && elements.status === 'ready' && passes.passes.length > 0;
  // Busy from the moment there is something to compute until the job ends (the worker may still be booting).
  const busy = observer !== null && elements.status === 'ready' && elements.records.length > 0 && (passes.status === 'idle' || passes.status === 'computing');
  const hero = showList ? nextFeaturedPass(passes.passes, isFeatured, now) : null;
  const rest = showList ? sortPasses(hero ? passes.passes.filter((pass) => pass.id !== hero.id) : passes.passes, sort) : [];
  const open = onOpenPass ? { onOpen: onOpenPass } : {};
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeading id={headingId}>{t.passes.heading}</SectionHeading>
      <p role="status" aria-live="polite" aria-busy={busy} className={styles.status}>
        {statusText(observer, elements, passes, t)}
      </p>
      {showList && hero && <IssHeroCard pass={hero} timeZone={observer.timeZone} weather={snapshot} {...open} />}
      {showList && <SortToggle value={sort} onChange={setSort} />}
      {showList && rest.length > 0 && (
        <ol className={styles.list}>
          {rest.map((pass) => (
            <li key={pass.id}>
              <PassCard pass={pass} timeZone={observer.timeZone} weather={snapshot} {...open} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
