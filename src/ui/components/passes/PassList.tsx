import { useMemo } from 'react';
import type { EpochMs, Observer, SatelliteRecord } from '../../../model';
import { PassCard } from './PassCard';
import { findAllPasses, SEARCH_WINDOW_HOURS } from './passSearch';
import styles from './PassList.module.css';

export type ElementsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: SatelliteRecord[]; unavailable: number[] };

export interface PassListProps {
  observer: Observer | null;
  elements: ElementsState;
  /** The instant "now" was read (by the caller, D-15); the search window starts here. */
  nowMs: EpochMs;
}

/**
 * R3: every upcoming visible pass of the catalog as plain cards, chronological
 * (US-5 AC2 default), computed synchronously on the main thread. Streaming,
 * the ISS hero card and the sort toggle come in R5 and R12.
 */
export function PassList({ observer, elements, nowMs }: PassListProps) {
  const result = useMemo(
    () => (observer && elements.status === 'ready' ? findAllPasses(elements.records, observer, nowMs) : null),
    [observer, elements, nowMs],
  );

  const status = ((): string | null => {
    if (!observer) return 'Enter coordinates to see the visible passes.';
    if (elements.status === 'loading') return 'Loading orbital elements from CelesTrak…';
    if (elements.status === 'error') return `Could not load orbital elements: ${elements.message}`;
    if (elements.status === 'ready' && elements.records.length === 0) return 'No catalog objects have orbital elements right now.';
    if (result && result.passes.length === 0) return `No visible passes in the next ${String(SEARCH_WINDOW_HOURS)} h from ${observer.label}.`;
    return null;
  })();

  return (
    <section aria-label="Upcoming passes" className={styles.section}>
      <p role="status" aria-live="polite" className={styles.status}>
        {status ?? `${String(result?.passes.length ?? 0)} visible passes in the next ${String(SEARCH_WINDOW_HOURS)} h from ${observer?.label ?? ''}`}
      </p>
      {result && result.passes.length > 0 && (
        <ol className={styles.list}>
          {result.passes.map((pass) => (
            <li key={pass.id}>
              <PassCard pass={pass} timeZone={observer?.timeZone ?? null} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
