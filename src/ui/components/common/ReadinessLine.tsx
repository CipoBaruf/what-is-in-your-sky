import { useLocale, useT } from '../../../i18n/useT';
import { formatList } from '../../../lib/format';
import { readiness } from '../../../lib/readiness';
import { formatDate, formatShortClock } from '../../../lib/timeFormat';
import type { EpochMs, Locale } from '../../../model';
import { useAppStore } from '../../../state';
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
 * waits for a finished run, a stored one standing in for it (D-105), or an
 * elements load that failed — the cold start with no signal, which is exactly
 * the case the line exists for.
 */
export function readinessStamp(at: EpochMs, timeZone: string | null, locale: Locale): string {
  return `${formatDate(at, timeZone, locale)} ${formatShortClock(at, timeZone, locale)}`;
}

export function ReadinessLine() {
  const t = useT();
  const locale = useLocale();
  const observer = useAppStore((s) => s.observer);
  const passes = useAppStore((s) => s.passes);
  const elements = useAppStore((s) => s.elements);
  const weather = useAppStore((s) => s.weather);
  const timeZone = observer?.timeZone ?? null;
  const settled = passes.storedAt !== null || passes.status === 'done' || elements.status === 'error';
  if (observer === null || !settled) return null;
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const state = readiness({
    passes: passes.passes,
    storedAt: passes.storedAt,
    forecast: snapshot,
    hasElements: elements.status === 'ready' && elements.records.length > 0,
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
