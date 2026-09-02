import { EPOCH_WARN_MS, epochIsOld, formatAge, newestEpoch } from '../../../lib/elementsAge';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { EpochMs } from '../../../model';
import { catalogName, useAppStore } from '../../../state';
import { useNow } from '../../hooks/useNow';
import { Banner } from '../common/Banner';
import styles from './ElementsBanners.module.css';

/**
 * R11 (FR-SAT-4, FR-SAT-6, FR-X-4, PLAN §7.1): what the user should know
 * about the orbital elements behind the list. Always, once loaded: the age
 * of the newest epoch and when the set was last confirmed with CelesTrak
 * (FR-SAT-4 "display the epoch age"). Warnings: the newest epoch is older
 * than 5 days (FR-SAT-4), or CelesTrak could not be reached and a copy past
 * the 2 h rule is in use (FR-SAT-6). Notes: the copy could not be saved in
 * this browser (§7.1 "not cached"), and catalog objects with no elements in
 * either group (FR-SAT-2, left out of the list). Times are in the observer's
 * zone when known, else UTC (D-3). Nothing shows before the elements load:
 * the pass list's status line covers loading and errors.
 */
export const AGE_TICK_MS = 60_000;

export interface ElementsBannersProps {
  /** The clock, for tests; the app re-reads it every minute. */
  now?: EpochMs;
}

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? '' : 's'}`;
/** Date and time: the elements can be days old, so the clock alone would mislead. */
const stamp = (t: EpochMs, timeZone: string | null): string => `${formatDate(t, timeZone)} ${formatClock(t, timeZone)}`;

export function ElementsBanners({ now: nowProp }: ElementsBannersProps) {
  const elements = useAppStore((s) => s.elements);
  const timeZone = useAppStore((s) => s.observer?.timeZone ?? null);
  const clock = useNow(AGE_TICK_MS);
  const now = nowProp ?? clock;
  if (elements.status !== 'ready') return null;
  const newest = newestEpoch(elements.records);
  const old = newest !== null && epochIsOld(newest, now);
  return (
    <section aria-label="Orbital elements" className={styles.section} data-testid="elements-banners">
      <p className={styles.age} data-testid="elements-age">
        {newest === null
          ? `No orbital elements in use. Last checked with CelesTrak ${stamp(elements.fetchedAt, timeZone)}.`
          : `Orbital elements: newest epoch ${formatAge(now - newest)} old (${stamp(newest, timeZone)}), confirmed with CelesTrak ${stamp(elements.fetchedAt, timeZone)}.`}
      </p>
      {elements.stale && (
        <Banner variant="warning" testId="stale-banner">
          CelesTrak could not be reached, so the elements fetched {stamp(elements.fetchedAt, timeZone)} are in use. They are refreshed again as soon as the connection is back; until then passes may be off by a few minutes.
        </Banner>
      )}
      {old && newest !== null && (
        <Banner variant="warning" testId="epoch-banner">
          The orbital elements are {formatAge(now - newest)} old. Predictions lose accuracy after {String(Math.round(EPOCH_WARN_MS / 86_400_000))} days, and the ISS in particular changes orbit often: expect times to be off by minutes.
        </Banner>
      )}
      {!elements.persistent && (
        <Banner variant="info" testId="not-cached-banner">
          The elements could not be saved in this browser, so they are kept in memory for this session only and will be fetched again next time.
        </Banner>
      )}
      {elements.unavailable.length > 0 && (
        <Banner variant="info" testId="unavailable-banner">
          No current elements from CelesTrak for {plural(elements.unavailable.length, 'catalog object')}: {elements.unavailable.map(catalogName).join(', ')}. Left out of the list.
        </Banner>
      )}
    </section>
  );
}
