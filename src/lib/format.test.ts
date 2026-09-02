import { describe, expect, it } from 'vitest';
import { degrees, formatClockDuration, formatDuration, formatMagnitude, formatRange } from './format';

describe('formatDuration', () => {
  it('prints seconds only under a minute and minutes plus seconds above', () => {
    expect(formatDuration(48)).toBe('48 s');
    expect(formatDuration(272.4)).toBe('4 min 32 s');
    expect(formatDuration(60)).toBe('1 min 0 s');
  });
});

describe('formatMagnitude', () => {
  it('always carries a sign, one decimal, and a real minus sign', () => {
    expect(formatMagnitude(1.18)).toBe('+1.2');
    expect(formatMagnitude(-0.26)).toBe('−0.3');
    expect(formatMagnitude(0)).toBe('+0.0');
    expect(formatMagnitude(-0.04)).toBe('+0.0');
    expect(formatMagnitude(-4)).toBe('−4.0');
  });
});

describe('degrees and formatRange', () => {
  it('round to whole units', () => {
    expect(degrees(53.33)).toBe('53°');
    expect(formatRange(1504.8)).toBe('1 505 km');
    expect(formatRange(420)).toBe('420 km');
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
