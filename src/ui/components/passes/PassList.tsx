import { useId, useState } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { nextFeaturedPass, sortPasses } from '../../../lib/passSort';
import { formatDate } from '../../../lib/timeFormat';
import type { EpochMs, Locale, Observer } from '../../../model';
import { NIGHT_MS, SEARCH_WINDOW_HOURS, isFeatured, useAppStore, type ElementsState, type PassesState } from '../../../state';
import { SectionHeading } from '../common/SectionHeading';
import { useNow } from '../../hooks/useNow';
import { IssHeroCard } from './IssHeroCard';
import { groupByNight, type NightGroup } from './nightGroups';
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
 * with the choice persisted through the store (US-5 AC2). R27 (US-16 AC5): the
 * 72 h window is three nights, so the list is one disclosure per night with
 * tonight open and the others closed; the sort still orders each night's own
 * cards, because "best first" over three nights would put a Thursday pass above
 * a Tuesday one and lose the thing the grouping is for.
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

/**
 * What a night is called (US-16 AC5). The relative words are used only while
 * they are true of the reader's own clock: a night is "tonight" when it begins
 * on today's date in the observer's zone and "tomorrow night" when it begins on
 * the next one. A stored run computed yesterday therefore names its first night
 * by its date rather than calling a night that has already passed tonight
 * (D-146). The date is the night's *start*, which is the calendar day the
 * evening in it belongs to for every start time but the last hour before
 * midnight.
 */
export function nightLabel(group: NightGroup, now: EpochMs, timeZone: string | null, locale: Locale, t: Messages): string {
  const date = formatDate(group.startMs, timeZone, locale);
  if (date === formatDate(now, timeZone, locale)) return t.passes.nights.tonight;
  if (date === formatDate(now + NIGHT_MS, timeZone, locale)) return t.passes.nights.tomorrow;
  return t.passes.nights.dated(date);
}

/**
 * The night open when the list first renders: the first one still holding a
 * pass that has not ended — tonight, for a run computed now, and the first
 * night still worth reading for a stored run that is a day old. Falls back to
 * the first night with anything in it, and then to the first night.
 */
export function defaultOpenNight(groups: NightGroup[], now: EpochMs): number {
  const live = groups.find((group) => group.passes.some((pass) => pass.end.t > now));
  return (live ?? groups.find((group) => group.passes.length > 0) ?? groups[0])?.index ?? 0;
}

export interface PassListProps {
  /** Opens the detail screen for a pass (R6). Without it the cards are read-only. */
  onOpenPass?: (passId: string) => void;
  /** The open pass, marked on its card (FR-DESK-3). The wide layout leaves the list on screen beside the guide, so it has to say which one is open. */
  selectedPassId?: string | null;
}

export function PassList({ onOpenPass, selectedPassId = null }: PassListProps) {
  const t = useT();
  const locale = useLocale();
  const observer = useAppStore((s) => s.observer);
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const sort = useAppStore((s) => s.sort);
  const setSort = useAppStore((s) => s.setSort);
  const headingId = useId();
  const now = useNow(HERO_CHECK_MS);
  /**
   * Which nights the reader has opened or closed. Only the ones actually
   * touched are here: every other night follows `defaultOpenNight`, so the
   * default keeps moving with the clock and the arriving passes until the
   * reader has an opinion about that night.
   */
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  // A stored run is shown whatever the elements are doing: it was computed from elements that had
  // already loaded once, and gating it on this load would hide it for the whole fetch and for good
  // when the fetch fails — which is the cold start with no signal that FR-OFF-2 is about (D-108).
  const showList = observer !== null && passes.passes.length > 0 && (elements.status === 'ready' || passes.storedAt !== null);
  // Busy from the moment there is something to compute until the job ends (the worker may still be booting).
  const busy = observer !== null && elements.status === 'ready' && elements.records.length > 0 && (passes.status === 'idle' || passes.status === 'computing');
  const hero = showList ? nextFeaturedPass(passes.passes, isFeatured, now) : null;
  const open = onOpenPass ? { onOpen: onOpenPass } : {};
  const groups = showList ? groupByNight(passes.passes, passes.window) : [];
  const openDefault = defaultOpenNight(groups, now);
  const zone = observer?.timeZone ?? null;
  const cards = (items: readonly (typeof passes.passes)[number][]) =>
    items.length === 0 || !observer ? null : (
      <ol className={styles.list}>
        {items.map((pass) => (
          <li key={pass.id}>
            <PassCard pass={pass} timeZone={observer.timeZone} weather={snapshot} selected={pass.id === selectedPassId} {...open} />
          </li>
        ))}
      </ol>
    );
  /** The night's own list: everything it claimed except the pass the hero card is already showing. */
  const listOf = (group: NightGroup) => sortPasses(hero ? group.passes.filter((pass) => pass.id !== hero.id) : group.passes, sort);
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeading id={headingId}>{t.passes.heading}</SectionHeading>
      <p role="status" aria-live="polite" aria-busy={busy} className={styles.status}>
        {statusText(observer, elements, passes, t)}
      </p>
      {showList && hero && observer && <IssHeroCard pass={hero} timeZone={observer.timeZone} weather={snapshot} selected={hero.id === selectedPassId} {...open} />}
      {showList && <SortToggle value={sort} onChange={setSort} />}
      {/* One night is no grouping at all: an MVP-width window, and every list before R24, is a
          single disclosure with nothing to disclose it from (D-146). */}
      {showList && groups.length === 1 && cards(listOf(groups[0] as NightGroup))}
      {showList &&
        groups.length > 1 &&
        groups.map((group) => {
          const items = listOf(group);
          return (
            <details
              key={group.index}
              className={styles.night}
              data-testid="night-group"
              data-night={group.index}
              open={overrides[group.index] ?? group.index === openDefault}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setOverrides((current) => ({ ...current, [group.index]: isOpen }));
              }}
            >
              <summary className={styles.nightHeading}>
                <span className={styles.nightName}>{nightLabel(group, now, zone, locale, t)}</span>
                <span className={styles.nightCount}>{t.passes.nights.count(group.passes.length)}</span>
              </summary>
              {items.length > 0 && cards(items)}
              {items.length === 0 && <p className={styles.nightEmpty}>{group.passes.length === 0 ? t.passes.nights.empty : t.passes.nights.heroOnly}</p>}
            </details>
          );
        })}
    </section>
  );
}
