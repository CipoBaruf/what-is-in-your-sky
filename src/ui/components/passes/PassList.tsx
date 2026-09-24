import { useId, useMemo, useState } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useT } from '../../../i18n/useT';
import { nextNight, nightAt, type NightKey } from '../../../lib/nights';
import { nextFeaturedPass, sortPasses } from '../../../lib/passSort';
import type { EpochMs, Observer, Pass } from '../../../model';
import { isFeatured, useActiveObserver, useAppStore, type ElementsState, type PassesState } from '../../../state';
import { hasEnded, useShownClock, useShownPasses } from '../../screens/home/shownPasses';
import { SectionHeading } from '../common/SectionHeading';
import { ListFailure, listFailure } from './ListFailure';
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
 *
 * R81 (FR-FIRST-10, D-510): board 1B's list. The count and the sort share one
 * line at `--small` (`7 visible passes in 72 h · Sort: [ Soonest ] Best`),
 * which wraps at its separator where a phone's 36 cells cannot hold both.
 * The hero card is gone: the next featured pass stays in the list, in its
 * place, and its card carries the `Next ISS` tag. The nights' toggles stand
 * on one row under the cards (`[−] Tonight 5 passes   [+] Tomorrow night 2
 * passes`), each a button that opens or closes its night's cards above it,
 * which keep their document order under their night (US-16 AC5).
 *
 * R88 (FR-NIGHT-1, FR-NIGHT-2, US-31): the list is about the nights ahead. The
 * nights are cut on local noon (`nightGroups`), so a pass before dawn sits
 * under the evening before it; the passes are the shown ones
 * (`useShownPasses`), so an ended pass leaves within a minute and the count
 * line, the nights' counts and the cards agree; and the clock is the store's
 * (`useShownClock`), so the headings turn over at local noon on the tick that
 * already exists and no test here reads the wall clock (F-67, F-68).
 */
export function statusText(observer: Observer | null, elements: ElementsState, passes: PassesState, shown: number, t: Messages): string {
  // D-536: a stored run partly elapsed counts over what is left of its window, not its original span.
  const hours = passes.spanHours;
  if (!observer) return t.passes.noObserver;
  if (elements.status === 'idle' || elements.status === 'loading') return t.passes.loadingElements;
  // R91 (FR-FAIL-2): a failure is its sentence alone; the component draws `ListFailure` with the detail behind `[ details ]`.
  if (elements.status === 'error') return t.failure[elements.failure.kind](t.failure.what.elements);
  if (elements.records.length === 0) return t.passes.noElements;
  const place = observer.label;
  switch (passes.status) {
    case 'idle':
      return t.passes.computing;
    case 'computing':
      return t.passes.computingProgress({ done: passes.done, total: passes.total, found: shown });
    case 'error':
      return t.failure[passes.error?.kind ?? 'unknown'](t.failure.what.passes);
    case 'done':
      if (shown === 0 && passes.hasDarkness === false) return t.passes.noDarkness({ hours, place });
      if (shown === 0) return t.passes.none({ hours, place });
      return t.passes.countLine({ count: shown, hours });
  }
}

/**
 * Which night is "tonight" (FR-NIGHT-1): the night holding the shown clock's
 * instant — before local noon, the one that began yesterday evening, but only
 * while a pass of it is still to come or under way, and otherwise the coming
 * one. A reader at 01:00 with a pass before dawn is still in last night; a
 * reader at 01:00 with nothing left before dawn is reading about the coming
 * evening, and the headings say so. From noon on, the coming night is the
 * one under way.
 */
export function tonightKey(groups: readonly NightGroup[], now: EpochMs, timeZone: string | null): NightKey {
  const { key, beforeNoon } = nightAt(now, timeZone);
  if (!beforeNoon) return key;
  const live = groups.find((group) => group.key === key)?.passes.some((pass) => pass.end.t > now) ?? false;
  return live ? key : nextNight(key);
}

/**
 * What a night is called (US-16 AC5 as amended v2.1). The relative words are
 * used only while they are true of the shown clock: "tonight" is
 * `tonightKey`'s night and "tomorrow night" the one after it; every other
 * night is named by its date, the local date of the noon it began at, which
 * is the calendar day of the evening in it (D-146). The headings are
 * recomputed on the tick, so they turn over as the clock crosses local noon,
 * with no recompute of the passes.
 *
 * R46 (F-26): tomorrow is the next date on the observer's calendar and not
 * now + 24 h. The two agree on every ordinary day and part on the two that are
 * not: a spring-forward day is 23 h long, so now + 24 h lands on the day after
 * tomorrow and the night that is genuinely tomorrow's gets called by its date;
 * an autumn day is 25 h long, so now + 24 h stays on today and tomorrow's
 * heading reads "tonight" twice.
 */
export function nightLabel(group: NightGroup, tonight: NightKey, t: Messages): string {
  if (group.key === tonight) return t.passes.nights.tonight;
  if (group.key === nextNight(tonight)) return t.passes.nights.tomorrow;
  return t.passes.nights.dated(group.key);
}

/**
 * The night open when the list first renders: tonight, where it holds a
 * pass, and otherwise the first night that does — the first night still worth
 * reading for a stored run that is a day old. Null with no night at all.
 */
export function defaultOpenNight(groups: readonly NightGroup[], now: EpochMs, timeZone: string | null): NightKey | null {
  const tonight = tonightKey(groups, now, timeZone);
  return groups.some((group) => group.key === tonight) ? tonight : (groups[0]?.key ?? null);
}

export interface PassListProps {
  /** Opens the detail screen for a pass (R6). Without it the cards are read-only. */
  onOpenPass?: (passId: string) => void;
  /** The open pass, marked on its card (FR-DESK-3). The wide layout leaves the list on screen beside the guide, so it has to say which one is open. */
  selectedPassId?: string | null;
}

export function PassList({ onOpenPass, selectedPassId = null }: PassListProps) {
  const t = useT();
  const observer = useActiveObserver();
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const sort = useAppStore((s) => s.sort);
  const setSort = useAppStore((s) => s.setSort);
  const headingId = useId();
  const nightsId = useId();
  const now = useShownClock();
  const shown = useShownPasses(selectedPassId);
  /**
   * Which nights the reader has opened or closed. Only the ones actually
   * touched are here: every other night follows `defaultOpenNight`, so the
   * default keeps moving with the clock and the arriving passes until the
   * reader has an opinion about that night.
   *
   * R46 (F-24): the opinions belong to the location they were formed at. A
   * night index means a different night once the observer moves, so carrying
   * "night 0 closed" across a location change closed tonight over a list the
   * reader had never seen, and `defaultOpenNight` opens exactly one night —
   * the overridden one — so nothing else opened in its place and the new list
   * came up entirely shut. Keyed on the coordinates rather than on the run: a
   * re-compute for the same place (newer elements, the 15 min re-check) is the
   * same three nights, and slamming the reader's disclosures shut for it would
   * be its own bug. The zone arriving from the forecast replaces the observer
   * object without moving it, which is why this is not a reference check.
   *
   * R88: keyed by the night's key and not its place in the list, since the
   * first night leaves the list when its last pass does (FR-NIGHT-2) and the
   * choice about the next one must not slide onto it.
   */
  const placeKey = observer ? `${String(observer.lat)},${String(observer.lon)}` : '';
  const [nights, setNights] = useState<{ place: string; overrides: Record<NightKey, boolean> }>({ place: placeKey, overrides: {} });
  const overrides = nights.place === placeKey ? nights.overrides : {};
  if (nights.place !== placeKey) setNights({ place: placeKey, overrides: {} });
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  // A stored run is shown whatever the elements are doing: it was computed from elements that had
  // already loaded once, and gating it on this load would hide it for the whole fetch and for good
  // when the fetch fails — which is the cold start with no signal that FR-OFF-2 is about (D-108).
  // The selector holds that rule, and takes the passes that have left out (FR-NIGHT-2).
  const showList = observer !== null && shown.length > 0;
  // Busy from the moment there is something to compute until the job ends (the worker may still be booting).
  const busy = observer !== null && elements.status === 'ready' && elements.records.length > 0 && (passes.status === 'idle' || passes.status === 'computing');
  const failed = observer === null ? null : listFailure(elements, passes);
  const hero = showList ? nextFeaturedPass(shown, isFeatured, now) : null;
  const open = onOpenPass ? { onOpen: onOpenPass } : {};
  const zone = observer?.timeZone ?? null;
  const groups = useMemo(() => (showList ? groupByNight(shown, zone) : []), [showList, shown, zone]);
  const tonight = tonightKey(groups, now, zone);
  const openDefault = defaultOpenNight(groups, now, zone);
  const tag = hero ? t.passes.nextTag({ name: hero.name, iss: hero.name.startsWith('ISS') }) : undefined;
  const cards = (items: readonly Pass[]) =>
    items.length === 0 || !observer ? null : (
      <ol className={styles.list}>
        {items.map((pass) => (
          <li key={pass.id}>
            <PassCard
              pass={pass}
              timeZone={observer.timeZone}
              weather={snapshot}
              selected={pass.id === selectedPassId}
              ended={hasEnded(pass, now)}
              {...(pass.id === hero?.id && tag !== undefined ? { tag } : {})}
              {...open}
            />
          </li>
        ))}
      </ol>
    );
  const listOf = (group: NightGroup) => sortPasses(group.passes, sort);
  const isOpen = (group: NightGroup): boolean => overrides[group.key] ?? group.key === openDefault;
  const toggle = (group: NightGroup): void => {
    const next = !isOpen(group);
    setNights((current) => ({ place: placeKey, overrides: { ...(current.place === placeKey ? current.overrides : {}), [group.key]: next } }));
  };
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeading id={headingId}>{t.passes.heading}</SectionHeading>
      {/* R84 (FR-FIRST-10 as amended v2.1, D-548, F-78): the ` · ` is a node on the sort's side, so a wrap
          carries it to the start of the next line, where the row's clipped left margin hides it. */}
      <div className={styles.countLine} data-testid="count-line">
        <div className={styles.countRow}>
          {/* R91 (FR-FAIL-1, FR-FAIL-4): a failed load or job is the failure line, in the status line's place. */}
          {failed !== null ? (
            <div className={styles.failure} data-testid="list-failure">
              <ListFailure failed={failed} showingList={showList} />
            </div>
          ) : (
            <p role="status" aria-live="polite" aria-busy={busy} className={styles.status}>
              {statusText(observer, elements, passes, shown.length, t)}
            </p>
          )}
          {showList && (
            <div className={styles.sortSide}>
              <span className={styles.separator} aria-hidden="true" data-testid="count-separator">
                {' · '}
              </span>
              <SortToggle value={sort} onChange={setSort} short />
            </div>
          )}
        </div>
      </div>
      {/* One night is no grouping at all: an MVP-width window, and every list before R24, is a
          single disclosure with nothing to disclose it from (D-146). */}
      {showList && groups.length === 1 && cards(listOf(groups[0] as NightGroup))}
      {showList &&
        groups.length > 1 &&
        groups.map((group) => {
          const items = listOf(group);
          return (
            <div
              key={group.key}
              id={`${nightsId}-${group.key}`}
              role="group"
              aria-label={nightLabel(group, tonight, t)}
              className={styles.night}
              data-testid="night-group"
              data-night-group=""
              data-night={group.key}
              data-open={isOpen(group)}
              hidden={!isOpen(group)}
            >
              {cards(items)}
            </div>
          );
        })}
      {showList && groups.length > 1 && (
        <div role="group" aria-label={t.passes.nights.toggles} className={styles.toggles} data-testid="night-toggles">
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              className={`inline-control ${styles.toggle}`}
              aria-expanded={isOpen(group)}
              aria-controls={`${nightsId}-${group.key}`}
              data-testid="night-toggle"
              data-night={group.key}
              onClick={() => {
                toggle(group);
              }}
            >
              <span className={styles.nightName}>{nightLabel(group, tonight, t)}</span> <span className={styles.nightCount}>{t.passes.nights.count(listOf(group).length)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
