import { SEARCH_WINDOW_HOURS, useAppStore, type ElementsState, type PassesState } from '../../../state';
import type { Observer } from '../../../model';
import { PassCard } from './PassCard';
import styles from './PassList.module.css';

/**
 * Every upcoming visible pass of the catalog as plain cards, chronological
 * (US-5 AC2 default). R5: the cards render as the worker streams each object's
 * passes into the store, the ISS first (PLAN §6.2); the status line shows the
 * progress meanwhile. R6: each card opens the detail screen through
 * `onOpenPass`. R8: every card gets the forecast for this observer (null
 * until it arrives or when it failed, which the card shows as "weather
 * unknown"). The ISS hero card and the sort toggle come in R12.
 */
export function statusText(observer: Observer | null, elements: ElementsState, passes: PassesState): string {
  const hours = String(SEARCH_WINDOW_HOURS);
  if (!observer) return 'Enter a place name or coordinates to see the visible passes.';
  if (elements.status === 'idle' || elements.status === 'loading') return 'Loading orbital elements from CelesTrak…';
  if (elements.status === 'error') return `Could not load orbital elements: ${elements.message}`;
  if (elements.records.length === 0) return 'No catalog objects have orbital elements right now.';
  switch (passes.status) {
    case 'idle':
      return 'Computing passes…';
    case 'computing':
      return `Computing passes… ${String(passes.done)} of ${String(passes.total)} objects, ${String(passes.passes.length)} visible so far`;
    case 'error':
      return `Could not compute passes: ${passes.error ?? 'unknown error'}`;
    case 'done':
      if (passes.passes.length === 0 && passes.hasDarkness === false) {
        return `No darkness tonight at this latitude: the sun never gets low enough in the next ${hours} h from ${observer.label}.`;
      }
      if (passes.passes.length === 0) return `No visible passes in the next ${hours} h from ${observer.label}.`;
      return `${String(passes.passes.length)} visible passes in the next ${hours} h from ${observer.label}`;
  }
}

export interface PassListProps {
  /** Opens the detail screen for a pass (R6). Without it the cards are read-only. */
  onOpenPass?: (passId: string) => void;
}

export function PassList({ onOpenPass }: PassListProps) {
  const observer = useAppStore((s) => s.observer);
  const elements = useAppStore((s) => s.elements);
  const passes = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const showList = observer !== null && elements.status === 'ready' && passes.passes.length > 0;
  // Busy from the moment there is something to compute until the job ends (the worker may still be booting).
  const busy = observer !== null && elements.status === 'ready' && elements.records.length > 0 && (passes.status === 'idle' || passes.status === 'computing');
  return (
    <section aria-label="Upcoming passes" className={styles.section}>
      <p role="status" aria-live="polite" aria-busy={busy} className={styles.status}>
        {statusText(observer, elements, passes)}
      </p>
      {showList && (
        <ol className={styles.list}>
          {passes.passes.map((pass) => (
            <li key={pass.id}>
              <PassCard pass={pass} timeZone={observer.timeZone} weather={snapshot} {...(onOpenPass ? { onOpen: onOpenPass } : {})} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
