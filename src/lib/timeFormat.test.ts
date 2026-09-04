import { describe, expect, it } from 'vitest';
import { formatClock, formatCountdown, formatDate } from './timeFormat';

// First golden pass start from tests/fixtures/reference-values.json (R1).
const GOLDEN_START_MS = 1789120094063; // 2026-09-11T09:48:14.063Z

describe('formatClock', () => {
  it('shows UTC with an explicit label when the zone is unknown (D-3)', () => {
    expect(formatClock(GOLDEN_START_MS, null, 'en')).toBe('09:48:14 UTC');
  });

  it('uses 24-hour digits with leading zeros, never 24:xx', () => {
    expect(formatClock(Date.parse('2026-09-11T00:05:09Z'), null, 'en')).toBe('00:05:09 UTC');
    expect(formatClock(Date.parse('2026-09-11T23:59:59Z'), null, 'en')).toBe('23:59:59 UTC');
  });

  it('formats in a named zone with its abbreviation', () => {
    const s = formatClock(GOLDEN_START_MS, 'America/Argentina/Buenos_Aires', 'en');
    expect(s.startsWith('06:48:14 ')).toBe(true);
    expect(s.endsWith(' UTC')).toBe(false);
  });

  it('gives the local time and zone abbreviation in three zones (FR-LOC-3, R8)', () => {
    // Intl's `short` zone name in `en-GB`: a metazone abbreviation where CLDR has one (BST, CEST),
    // else the offset form (GMT-3). Argentina has no English abbreviation, so the offset form is the label.
    expect(formatClock(GOLDEN_START_MS, 'America/Argentina/Salta', 'en')).toBe('06:48:14 GMT-3');
    expect(formatClock(GOLDEN_START_MS, 'Europe/London', 'en')).toBe('10:48:14 BST');
    expect(formatClock(GOLDEN_START_MS, 'Europe/Paris', 'en')).toBe('11:48:14 CEST');
    expect(formatDate(GOLDEN_START_MS, 'Asia/Tokyo', 'en')).toBe('2026-09-11');
    expect(formatClock(GOLDEN_START_MS, 'Asia/Tokyo', 'en')).toBe('18:48:14 GMT+9');
  });
});

/**
 * FR-I18N-4 (R17): the same instant in the same zone, in both languages. The
 * digits and the field order do not move — the clock is `h23` and the date is
 * ISO in either language (D-91) — but the words Intl puts around them are the
 * active language's, which for `short` zone names means Spanish CLDR's own
 * abbreviations.
 */
describe('formatClock and formatDate in both languages', () => {
  it('render the golden pass in the observer zone, in each language', () => {
    expect(formatClock(GOLDEN_START_MS, 'America/Argentina/Salta', 'es')).toBe('06:48:14 GMT-3');
    expect(formatDate(GOLDEN_START_MS, 'America/Argentina/Salta', 'es')).toBe('2026-09-11');
    expect(formatClock(GOLDEN_START_MS, null, 'es')).toBe('09:48:14 UTC');
    // London: `BST` in English, the offset form in Spanish, so the language is visibly in the output.
    expect(formatClock(GOLDEN_START_MS, 'Europe/London', 'es')).toBe('10:48:14 GMT+1');
  });
});

describe('formatDate', () => {
  it('is the UTC calendar date when the zone is unknown', () => {
    expect(formatDate(GOLDEN_START_MS, null, 'en')).toBe('2026-09-11');
  });

  it('follows the display zone across midnight', () => {
    const t = Date.parse('2026-09-11T01:30:00Z');
    expect(formatDate(t, null, 'en')).toBe('2026-09-11');
    expect(formatDate(t, 'America/Argentina/Buenos_Aires', 'en')).toBe('2026-09-10');
    expect(formatDate(t, 'America/Argentina/Buenos_Aires', 'es')).toBe('2026-09-10');
  });
});

describe('formatCountdown', () => {
  it('formats m:ss, rounding to the second', () => {
    expect(formatCountdown(192_000)).toBe('3:12');
    expect(formatCountdown(7_400)).toBe('0:07');
    expect(formatCountdown(725_000)).toBe('12:05');
    expect(formatCountdown(65 * 60_000)).toBe('65:00');
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('clamps negative and non-finite input to 0:00', () => {
    expect(formatCountdown(-5_000)).toBe('0:00');
    expect(formatCountdown(Number.NaN)).toBe('0:00');
  });
});
