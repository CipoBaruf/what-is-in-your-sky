import type { EpochMs, SatelliteRecord } from '../model';

/**
 * FR-SAT-4: the epoch age of the elements in use, and the 5 day warning.
 * The set's age is that of its newest epoch: the stations group (the ISS)
 * is refreshed several times a day, so an old newest epoch means the whole
 * fetch is old, while an old oldest epoch is normal for a quiet rocket body.
 * Pure functions of `now`; nothing here reads the clock (D-15).
 */
export const EPOCH_WARN_MS = 5 * 86_400_000;

/** The newest `epochMs` among `records`, or null for an empty set. */
export function newestEpoch(records: readonly SatelliteRecord[]): EpochMs | null {
  let newest: EpochMs | null = null;
  for (const { epochMs } of records) if (newest === null || epochMs > newest) newest = epochMs;
  return newest;
}

/** True strictly beyond 5 days: at 5 d + 1 s the warning shows, at 5 d − 1 s it does not (TASKS R11). */
export function epochIsOld(epochMs: EpochMs, now: EpochMs): boolean {
  return now - epochMs > EPOCH_WARN_MS;
}

/** "3 h", "2 d 4 h", "just now" for the age of a timestamp; never negative. */
export function formatAge(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(total / 1_440);
  const hours = Math.floor((total % 1_440) / 60);
  const minutes = total % 60;
  if (days > 0) return hours > 0 ? `${String(days)} d ${String(hours)} h` : `${String(days)} d`;
  if (hours > 0) return minutes > 0 ? `${String(hours)} h ${String(minutes)} min` : `${String(hours)} h`;
  if (minutes > 0) return `${String(minutes)} min`;
  return 'under a minute';
}
