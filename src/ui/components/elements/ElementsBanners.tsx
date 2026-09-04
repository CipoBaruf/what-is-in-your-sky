import { useLocale, useT } from '../../../i18n/useT';
import { ageParts, EPOCH_WARN_MS, epochIsOld, newestEpoch } from '../../../lib/elementsAge';
import { formatList } from '../../../lib/format';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { EpochMs, Locale } from '../../../model';
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

export function ElementsBanners({ now: nowProp }: ElementsBannersProps) {
  const t = useT();
  const locale = useLocale();
  const elements = useAppStore((s) => s.elements);
  const timeZone = useAppStore((s) => s.observer?.timeZone ?? null);
  const clock = useNow(AGE_TICK_MS);
  const now = nowProp ?? clock;
  /** Date and time: the elements can be days old, so the clock alone would mislead. */
  const stamp = (at: EpochMs, zone: string | null, active: Locale): string => t.passes.stamp({ date: formatDate(at, zone, active), time: formatClock(at, zone, active) });
  if (elements.status !== 'ready') return null;
  const newest = newestEpoch(elements.records);
  const old = newest !== null && epochIsOld(newest, now);
  const checked = stamp(elements.fetchedAt, timeZone, locale);
  const age = newest === null ? '' : t.elements.age(ageParts(now - newest));
  return (
    <section aria-label={t.elements.region} className={styles.section} data-testid="elements-banners">
      <p className={styles.age} data-testid="elements-age">
        {newest === null ? t.elements.none(checked) : t.elements.newest({ age, epoch: stamp(newest, timeZone, locale), checked })}
      </p>
      {elements.stale && (
        <Banner variant="warning" testId="stale-banner">
          {t.elements.stale(checked)}
        </Banner>
      )}
      {old && newest !== null && (
        <Banner variant="warning" testId="epoch-banner">
          {t.elements.oldEpoch({ age, days: Math.round(EPOCH_WARN_MS / 86_400_000) })}
        </Banner>
      )}
      {!elements.persistent && (
        <Banner variant="info" testId="not-cached-banner">
          {t.elements.notCached}
        </Banner>
      )}
      {elements.unavailable.length > 0 && (
        <Banner variant="info" testId="unavailable-banner">
          {t.elements.unavailable({ count: elements.unavailable.length, names: formatList(elements.unavailable.map(catalogName), locale) })}
        </Banner>
      )}
    </section>
  );
}
