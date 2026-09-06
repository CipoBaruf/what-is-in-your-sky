import { useLocale, useT } from '../../../i18n/useT';
import { formatList } from '../../../lib/format';
import { readiness } from '../../../lib/readiness';
import { formatDate, formatShortClock } from '../../../lib/timeFormat';
import type { EpochMs, Locale } from '../../../model';
import { useAppStore } from '../../../state';
import { useNow } from '../../hooks/useNow';
import styles from './ReadinessLine.module.css';

/**
 * FR-OFF-4 (US-16 AC2): one line under the location saying how long the app
 * will keep working with no signal — "Ready offline until <date time>" from
 * `lib/readiness.ts`, or the names of whatever is not on the device yet. A
 * second, dimmer line gives the storage time, and only for a run that came out
 * of the store: this session's own list was computed a moment ago and has no
 * age worth stating (D-145).
 *
 * Nothing is said until there is something true to say. A first visit spends
 * seconds loading elements and computing, and "not ready" during those seconds
 * would be a verdict on a job in progress rather than on the device: the line
 * waits until every input it reads has an answer for this observer.
 *
 * R46 (F-21) that is every input and not just the passes. A warm start puts the
 * stored run on screen first, by design (PLAN §7.5), and the old gate took that
 * as the whole answer — so every second visit flashed "Not ready offline: no
 * orbital elements and cloud forecast" for as long as those two requests were in
 * the air, which is a verdict on the network rather than on the device. A gap is
 * now named only once the request that would have filled it has come back. The
 * cold start with no signal still gets there: the elements load fails, the
 * forecast fails, and no job runs without elements, so all three answers land
 * within the same second or two.
 *
 * The stamp carries its zone (F-27). Every other time on the page sits beside
 * one that names it; this line stands alone under the location, and with no
 * observer zone its digits are UTC — read as local, a promise off by hours.
 */
export function readinessStamp(at: EpochMs, timeZone: string | null, locale: Locale): string {
  return `${formatDate(at, timeZone, locale)} ${formatShortClock(at, timeZone, locale, true)}`;
}

/** How often the line re-checks whether its own date has gone past (F-23). A minute is finer than the date it states. */
export const READINESS_CHECK_MS = 60_000;

export function ReadinessLine() {
  const t = useT();
  const locale = useLocale();
  const observer = useAppStore((s) => s.observer);
  const passes = useAppStore((s) => s.passes);
  const elements = useAppStore((s) => s.elements);
  const weather = useAppStore((s) => s.weather);
  const now = useNow(READINESS_CHECK_MS);
  const timeZone = observer?.timeZone ?? null;
  const elementsAnswered = elements.status === 'ready' || elements.status === 'error';
  const forecastAnswered = weather.observer === observer && (weather.status === 'ready' || weather.status === 'error');
  // No job is started without a usable element set, so a failed or empty load is the passes' answer too.
  const noJob = elements.status === 'error' || (elements.status === 'ready' && elements.records.length === 0);
  const passesAnswered = passes.storedAt !== null || passes.status === 'done' || passes.status === 'error' || noJob;
  if (observer === null || !elementsAnswered || !forecastAnswered || !passesAnswered) return null;
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const state = readiness({
    passes: passes.passes,
    storedAt: passes.storedAt,
    forecast: snapshot,
    hasElements: elements.status === 'ready' && elements.records.length > 0,
    now,
  });
  return (
    <div className={styles.block}>
      <p className={styles.line} data-testid="readiness">
        {state.missing.length === 0 && state.offlineUntil !== null
          ? t.readiness.ready(readinessStamp(state.offlineUntil, timeZone, locale))
          : t.readiness.notReady(formatList(state.missing.map((gap) => t.readiness.gaps[gap]), locale))}
      </p>
      {state.storedAt !== null && (
        <p className={styles.line} data-testid="readiness-stored">
          {t.readiness.stored(readinessStamp(state.storedAt, timeZone, locale))}
        </p>
      )}
    </div>
  );
}
