import type { EpochMs } from '../model';

/**
 * D-3 / FR-LOC-3: all times are epoch ms; display uses Intl in the observer's
 * IANA zone. Until the zone is known (`timeZone === null`) times are shown in
 * UTC with an explicit "UTC" label. Pure: never reads the wall clock (D-15).
 */
const LOCALE = 'en-GB';

function parts(t: EpochMs, timeZone: string | null, options: Intl.DateTimeFormatOptions): Map<string, string> {
  const formatter = new Intl.DateTimeFormat(LOCALE, { timeZone: timeZone ?? 'UTC', ...options });
  return new Map(formatter.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
}

/** "09:48:14 UTC", or "06:48:14 GMT-3" when a zone is known. */
export function formatClock(t: EpochMs, timeZone: string | null): string {
  const p = parts(t, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZoneName: 'short' } : {}),
  });
  const hms = `${p.get('hour') ?? '??'}:${p.get('minute') ?? '??'}:${p.get('second') ?? '??'}`;
  return `${hms} ${zoneLabel(p, timeZone)}`;
}

/** "2026-09-11" on the calendar of the display zone. */
export function formatDate(t: EpochMs, timeZone: string | null): string {
  const p = parts(t, timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.get('year') ?? '????'}-${p.get('month') ?? '??'}-${p.get('day') ?? '??'}`;
}

/** The zone abbreviation Intl gives, or the literal "UTC" when no zone is known yet. */
export function zoneLabel(p: Map<string, string>, timeZone: string | null): string {
  if (!timeZone) return 'UTC';
  return p.get('timeZoneName') ?? timeZone;
}
