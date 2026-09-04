import { INTL_LOCALE } from '../i18n/locale';
import type { Locale } from '../model';

/**
 * Number formatting shared by the pass card and the detail screen (R6 moved
 * these out of `PassCard.tsx`). Pure; no clock, no React (PLAN §3).
 *
 * R17 (FR-I18N-4): every number a reader could read differently in the two
 * languages goes through `Intl.NumberFormat` in the active one — the decimal
 * mark of a magnitude, the group mark of a range. Degrees, the SI symbols
 * `min`, `s` and `km`, and the durations written as clocks are identical in
 * both languages and stay plain (FR-I18N-4 "degrees, magnitudes and compass
 * abbreviations are identical in both languages").
 */
const number = (n: number, locale: Locale, options?: Intl.NumberFormatOptions): string => new Intl.NumberFormat(INTL_LOCALE[locale], options).format(n);

/** Whole degrees with the degree sign: "53°". Under 1 000 in every use, so no group mark can appear. */
export const degrees = (n: number): string => `${String(Math.round(n))}°`;

/** "4 min 32 s", "48 s". */
export function formatDuration(durationS: number): string {
  const total = Math.round(durationS);
  const min = Math.floor(total / 60);
  const s = total % 60;
  return min > 0 ? `${String(min)} min ${String(s)} s` : `${String(s)} s`;
}

/**
 * Signed, one decimal, real minus sign: "+1.2", "−0.3", "+0.0" in English,
 * "+1,2" in Spanish. The sign is ours (Intl's `signDisplay` would give the
 * hyphen-minus, and a magnitude is written with the typographic one); the
 * digits and the decimal mark are Intl's.
 */
export function formatMagnitude(mag: number, locale: Locale): string {
  const rounded = Math.round(mag * 10) / 10;
  const digits = number(Math.abs(rounded), locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (Object.is(rounded, -0) || rounded === 0) return `+${digits}`;
  return `${rounded < 0 ? '−' : '+'}${digits}`;
}

/** One decimal, signed with the typographic minus: the sun's altitude at the peak, "+2.4°" / "−12.0°". */
export function formatSignedDegrees(n: number, locale: Locale): string {
  const digits = number(Math.abs(n), locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${n < 0 ? '−' : '+'}${digits}°`;
}

/** FR-I18N-4: a list as the language joins one — "A, B and C" in English, "A, B y C" in Spanish. */
export function formatList(items: readonly string[], locale: Locale): string {
  return new Intl.ListFormat(INTL_LOCALE[locale], { style: 'long', type: 'conjunction' }).format(items);
}

/** Whole kilometres, grouped as the language groups them: "1,505 km" in English. */
export function formatRange(rangeKm: number, locale: Locale): string {
  return `${number(Math.round(rangeKm), locale, { maximumFractionDigits: 0 })} km`;
}

/**
 * A duration as a clock: "m:ss" under an hour, "h:mm:ss" above. Negative
 * inputs are treated as zero; the caller decides how to word the past.
 */
export function formatClockDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h)}:${mm}:${ss}` : `${String(m)}:${ss}`;
}
