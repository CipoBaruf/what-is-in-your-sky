import type { EpochMs } from '../model';

export const MS_PER_DAY = 86_400_000;
/** Julian date of the Unix epoch, 1970-01-01T00:00:00Z. */
export const JD_UNIX_EPOCH = 2_440_587.5;
/** Julian date of J2000.0, 2000-01-01T12:00:00 TT (used as UTC here; the 64 s offset is irrelevant for SGP4). */
export const JD_J2000 = 2_451_545.0;

export function msToJulianDate(t: EpochMs): number {
  return t / MS_PER_DAY + JD_UNIX_EPOCH;
}

export function julianDateToMs(jd: number): EpochMs {
  return (jd - JD_UNIX_EPOCH) * MS_PER_DAY;
}

export function msToDate(t: EpochMs): Date {
  return new Date(t);
}

/**
 * Parse an OMM `EPOCH` string as UTC. CelesTrak writes `2026-09-01T19:42:22.677120`
 * with no zone suffix and six fractional digits; `Date.parse` would treat the
 * suffix-less form as local time, so the zone is made explicit and the fraction
 * is trimmed to milliseconds (truncated, not rounded).
 */
export function parseOmmEpoch(epoch: string): EpochMs {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/.exec(epoch.trim());
  if (!m) throw new Error(`Unrecognised OMM EPOCH: ${epoch}`);
  const [, date, hms, frac = '', zone = 'Z'] = m;
  const ms = (frac + '000').slice(0, 3);
  const parsed = Date.parse(`${date}T${hms}.${ms}${zone}`);
  if (Number.isNaN(parsed)) throw new Error(`Unparseable OMM EPOCH: ${epoch}`);
  return parsed;
}

export function isoUtc(t: EpochMs): string {
  return new Date(t).toISOString();
}
