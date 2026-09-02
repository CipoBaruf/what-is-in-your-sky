import { describe, expect, it } from 'vitest';
import { fixtureRecords } from '../../tests/support/catalogFixtures';
import { EPOCH_WARN_MS, epochIsOld, formatAge, newestEpoch } from './elementsAge';

const T = Date.parse('2026-09-02T12:00:00Z');

describe('newestEpoch', () => {
  it('is the largest epochMs of the set, null for an empty set', () => {
    const records = fixtureRecords();
    const expected = Math.max(...records.map((r) => r.epochMs));
    expect(newestEpoch(records)).toBe(expected);
    expect(newestEpoch([])).toBeNull();
  });
});

describe('epochIsOld (FR-SAT-4)', () => {
  it('warns at 5 days + 1 s and not at 5 days − 1 s', () => {
    expect(epochIsOld(T, T + EPOCH_WARN_MS + 1000)).toBe(true);
    expect(epochIsOld(T, T + EPOCH_WARN_MS - 1000)).toBe(false);
    expect(epochIsOld(T, T + EPOCH_WARN_MS)).toBe(false);
  });
});

describe('formatAge', () => {
  it('reads as days, hours and minutes, never negative', () => {
    expect(formatAge(-5_000)).toBe('under a minute');
    expect(formatAge(30_000)).toBe('under a minute');
    expect(formatAge(7 * 60_000)).toBe('7 min');
    expect(formatAge(3 * 3_600_000)).toBe('3 h');
    expect(formatAge(3 * 3_600_000 + 12 * 60_000)).toBe('3 h 12 min');
    expect(formatAge(2 * 86_400_000 + 4 * 3_600_000 + 59 * 60_000)).toBe('2 d 4 h');
    expect(formatAge(5 * 86_400_000)).toBe('5 d');
  });
});
