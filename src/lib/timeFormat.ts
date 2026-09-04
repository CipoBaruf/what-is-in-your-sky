import { INTL_LOCALE } from '../i18n/locale';
import type { EpochMs, Locale } from '../model';

/**
 * D-3 / FR-LOC-3: all times are epoch ms; display uses Intl in the observer's
 * IANA zone. Until the zone is known (`timeZone === null`) times are shown in
 * UTC with an explicit "UTC" label. Pure: never reads the wall clock (D-15).
 *
 * R17 (FR-I18N-4): the active language is a parameter, so nothing here can
 * format in a language other than the one on screen. The clock is `h23` and
 * the calendar date is `YYYY-MM-DD` in both languages — an hour cycle and a
 * field order, not a translation: the digits are the same and the form is
 * unambiguous either way (D-91). What the language does change is the words
 * Intl puts around them, the zone abbreviation above all.
 */
function parts(t: EpochMs, timeZone: string | null, locale: Locale, options: Intl.DateTimeFormatOptions): Map<string, string> {
  const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: timeZone ?? 'UTC', ...options });
  return new Map(formatter.formatToParts(t).map((p) => [p.type, p.value]));
}

/** "09:48:14 UTC", or "06:48:14 GMT-3" when a zone is known. */
export function formatClock(t: EpochMs, timeZone: string | null, locale: Locale): string {
  const p = parts(t, timeZone, locale, {
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
export function formatDate(t: EpochMs, timeZone: string | null, locale: Locale): string {
  const p = parts(t, timeZone, locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.get('year') ?? '????'}-${p.get('month') ?? '??'}-${p.get('day') ?? '??'}`;
}

/** The zone abbreviation Intl gives, or the literal "UTC" when no zone is known yet. */
export function zoneLabel(p: Map<string, string>, timeZone: string | null): string {
  if (!timeZone) return 'UTC';
  return p.get('timeZoneName') ?? timeZone;
}

/**
 * A remaining-time countdown as `m:ss` ("3:12", "0:07", "12:05"); hours roll
 * into the minutes ("65:00"). Negative or non-finite input reads "0:00".
 * Used by the Now panel (US-4 AC3) and, in R6, the pass countdown.
 */
export function formatCountdown(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
  const min = Math.floor(total / 60);
  const s = total % 60;
  return `${String(min)}:${String(s).padStart(2, '0')}`;
}
