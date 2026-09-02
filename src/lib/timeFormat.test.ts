import { describe, expect, it } from 'vitest';
import { formatClock, formatDate } from './timeFormat';

// First golden pass start from tests/fixtures/reference-values.json (R1).
const GOLDEN_START_MS = 1789120094063; // 2026-09-11T09:48:14.063Z

describe('formatClock', () => {
  it('shows UTC with an explicit label when the zone is unknown (D-3)', () => {
    expect(formatClock(GOLDEN_START_MS, null)).toBe('09:48:14 UTC');
  });

  it('uses 24-hour digits with leading zeros, never 24:xx', () => {
    expect(formatClock(Date.parse('2026-09-11T00:05:09Z'), null)).toBe('00:05:09 UTC');
    expect(formatClock(Date.parse('2026-09-11T23:59:59Z'), null)).toBe('23:59:59 UTC');
  });

  it('formats in a named zone with its abbreviation', () => {
    const s = formatClock(GOLDEN_START_MS, 'America/Argentina/Buenos_Aires');
    expect(s.startsWith('06:48:14 ')).toBe(true);
    expect(s.endsWith(' UTC')).toBe(false);
  });
});

describe('formatDate', () => {
  it('is the UTC calendar date when the zone is unknown', () => {
    expect(formatDate(GOLDEN_START_MS, null)).toBe('2026-09-11');
  });

  it('follows the display zone across midnight', () => {
    const t = Date.parse('2026-09-11T01:30:00Z');
    expect(formatDate(t, null)).toBe('2026-09-11');
    expect(formatDate(t, 'America/Argentina/Buenos_Aires')).toBe('2026-09-10');
  });
});
