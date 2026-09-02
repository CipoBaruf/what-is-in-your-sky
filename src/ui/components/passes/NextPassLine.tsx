import { useMemo } from 'react';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { EpochMs, Observer, OmmRecord, Pass } from '../../../model';
import { SEARCH_DAYS, nextIssPass } from './nextPass';
import styles from './NextPassLine.module.css';

export type ElementsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: OmmRecord[] };

export interface NextPassLineProps {
  observer: Observer | null;
  elements: ElementsState;
  /** The instant "now" was read (by the caller, D-15); the search window starts here. */
  nowMs: EpochMs;
}

/** One line: name, date, start time, start azimuth, max elevation, end time (TASKS R2). */
export function passLine(pass: Pass, timeZone: string | null): string {
  const deg = (n: number): string => `${String(Math.round(n))}°`;
  return [
    pass.name,
    formatDate(pass.start.t, timeZone),
    `start ${formatClock(pass.start.t, timeZone)} az ${deg(pass.start.azDeg)}`,
    `max ${deg(pass.peak.elDeg)}`,
    `end ${formatClock(pass.end.t, timeZone)}`,
  ].join(' | ');
}

export function NextPassLine({ observer, elements, nowMs }: NextPassLineProps) {
  const text = useMemo((): string => {
    if (!observer) return 'Enter coordinates to see the next visible ISS pass.';
    if (elements.status === 'loading') return 'Loading orbital elements from CelesTrak…';
    if (elements.status === 'error') return `Could not load orbital elements: ${elements.message}`;
    const result = nextIssPass(elements.records, observer, nowMs);
    switch (result.kind) {
      case 'no-elements':
        return 'ISS elements are missing from the CelesTrak stations group.';
      case 'none':
        return `No visible ISS pass in the next ${String(SEARCH_DAYS)} days from ${observer.label}.`;
      case 'pass':
        return passLine(result.pass, observer.timeZone);
    }
  }, [observer, elements, nowMs]);

  return (
    <p role="status" aria-live="polite" className={styles.line}>
      {text}
    </p>
  );
}
