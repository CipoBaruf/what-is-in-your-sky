import { describe, expect, it } from 'vitest';
import { degrees, formatClockDuration, formatDuration, formatList, formatMagnitude, formatRange, formatSignedDegrees } from './format';

describe('formatDuration', () => {
  it('prints seconds only under a minute and minutes plus seconds above', () => {
    expect(formatDuration(48)).toBe('48 s');
    expect(formatDuration(272.4)).toBe('4 min 32 s');
    expect(formatDuration(60)).toBe('1 min 0 s');
  });
});

describe('formatMagnitude', () => {
  it('always carries a sign, one decimal, and a real minus sign', () => {
    expect(formatMagnitude(1.18, 'en')).toBe('+1.2');
    expect(formatMagnitude(-0.26, 'en')).toBe('−0.3');
    expect(formatMagnitude(0, 'en')).toBe('+0.0');
    expect(formatMagnitude(-0.04, 'en')).toBe('+0.0');
    expect(formatMagnitude(-4, 'en')).toBe('−4.0');
  });

  it('takes the decimal mark from the active language (FR-I18N-4), and keeps the sign', () => {
    expect(formatMagnitude(1.18, 'es')).toBe('+1,2');
    expect(formatMagnitude(-0.26, 'es')).toBe('−0,3');
    expect(formatMagnitude(0, 'es')).toBe('+0,0');
  });
});

describe('formatSignedDegrees', () => {
  it('signs one decimal in each language', () => {
    expect(formatSignedDegrees(2.44, 'en')).toBe('+2.4°');
    expect(formatSignedDegrees(-12, 'en')).toBe('−12.0°');
    expect(formatSignedDegrees(-12, 'es')).toBe('−12,0°');
  });
});

describe('degrees and formatRange', () => {
  it('round to whole units, and group the range as the language does', () => {
    expect(degrees(53.33)).toBe('53°');
    expect(formatRange(1504.8, 'en')).toBe('1,505 km');
    expect(formatRange(420, 'en')).toBe('420 km');
    expect(formatRange(420, 'es')).toBe('420 km');
    // Spanish groups from five digits (CLDR `minimumGroupingDigits`), so a four-digit range has no mark at all.
    expect(formatRange(1504.8, 'es')).toBe('1505 km');
  });

  it('writes degrees identically in both languages (FR-I18N-4)', () => {
    expect(degrees(-0.4)).toBe('0°');
    expect(degrees(359.7)).toBe('360°');
  });
});

describe('formatList', () => {
  it('joins with the language‘s conjunction (FR-I18N-4)', () => {
    expect(formatList(['ISS (Zarya)'], 'en')).toBe('ISS (Zarya)');
    expect(formatList(['A', 'B'], 'en')).toBe('A and B');
    expect(formatList(['A', 'B', 'C'], 'en')).toBe('A, B and C');
    expect(formatList(['A', 'B', 'C'], 'es')).toBe('A, B y C');
  });
});

describe('formatClockDuration', () => {
  it('uses m:ss under an hour and h:mm:ss above, never negative', () => {
    expect(formatClockDuration(0)).toBe('0:00');
    expect(formatClockDuration(192)).toBe('3:12');
    expect(formatClockDuration(3600)).toBe('1:00:00');
    expect(formatClockDuration(45_296)).toBe('12:34:56');
    expect(formatClockDuration(-5)).toBe('0:00');
  });
});
