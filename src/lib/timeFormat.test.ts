import { describe, expect, it } from 'vitest';
import { formatClock, formatCountdown, formatDate, formatShortClock, nextCalendarDate } from './timeFormat';

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

/** R46 (F-27): the readiness line's stamp stands alone, so it asks for the zone. */
describe('formatShortClock', () => {
  it('is the clock to the minute, with no zone by default', () => {
    expect(formatShortClock(GOLDEN_START_MS, null, 'en')).toBe('09:48');
    expect(formatShortClock(GOLDEN_START_MS, 'America/Argentina/Buenos_Aires', 'en')).toBe('06:48');
  });

  it('labels the digits when asked, and says UTC when there is no zone to label them with', () => {
    expect(formatShortClock(GOLDEN_START_MS, null, 'en', true)).toBe('09:48 UTC');
    const s = formatShortClock(GOLDEN_START_MS, 'America/Argentina/Buenos_Aires', 'en', true);
    expect(s.startsWith('06:48 ')).toBe(true);
    expect(s.endsWith(' UTC')).toBe(false);
  });
});

/** R46 (F-26): "tomorrow" is a calendar step, and a calendar day is not always 24 h long. */
describe('nextCalendarDate', () => {
  it('steps one day, across a month and a year end', () => {
    expect(nextCalendarDate('2026-09-11')).toBe('2026-09-12');
    expect(nextCalendarDate('2026-09-30')).toBe('2026-10-01');
    expect(nextCalendarDate('2026-12-31')).toBe('2027-01-01');
    expect(nextCalendarDate('2028-02-28')).toBe('2028-02-29'); // a leap year
  });

  it('steps the calendar and not the clock, so a 23 h DST day still has a tomorrow', () => {
    // Chile springs forward at 00:00 on 2026-09-06, which makes that day 23 h long. Late on the
    // 5th, now + 24 h has already skipped over the 6th and landed on the 7th — so the night of
    // the 6th, the reader's actual tomorrow, would never be called tomorrow night (F-26).
    const zone = 'America/Santiago';
    const late = Date.parse('2026-09-06T03:30:00Z'); // 2026-09-05 23:30 local
    expect(formatDate(late, zone, 'en')).toBe('2026-09-05');
    expect(formatDate(late + 24 * 3_600_000, zone, 'en')).toBe('2026-09-07');
    expect(nextCalendarDate(formatDate(late, zone, 'en'))).toBe('2026-09-06');
  });

  it('hands back anything it cannot parse rather than throwing', () => {
    expect(nextCalendarDate('????-??-??')).toBe('????-??-??');
  });
});
