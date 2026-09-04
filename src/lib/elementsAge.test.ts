import { describe, expect, it } from 'vitest';
import { fixtureRecords } from '../../tests/support/catalogFixtures';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { ageParts, EPOCH_WARN_MS, epochIsOld, newestEpoch } from './elementsAge';

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

describe('ageParts, worded by the catalogs', () => {
  const age = (ms: number): string => en.elements.age(ageParts(ms));

  it('reads as days, hours and minutes, never negative', () => {
    expect(age(-5_000)).toBe('under a minute');
    expect(age(30_000)).toBe('under a minute');
    expect(age(7 * 60_000)).toBe('7 min');
    expect(age(3 * 3_600_000)).toBe('3 h');
    expect(age(3 * 3_600_000 + 12 * 60_000)).toBe('3 h 12 min');
    expect(age(2 * 86_400_000 + 4 * 3_600_000 + 59 * 60_000)).toBe('2 d 4 h');
    expect(age(5 * 86_400_000)).toBe('5 d');
  });

  it('drops the minutes past a day and cuts nothing else (the parts, not the wording)', () => {
    expect(ageParts(2 * 86_400_000 + 4 * 3_600_000 + 59 * 60_000)).toEqual({ days: 2, hours: 4, minutes: 0 });
    expect(ageParts(3 * 3_600_000 + 12 * 60_000)).toEqual({ days: 0, hours: 3, minutes: 12 });
    expect(ageParts(-1)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });

  it('keeps the SI symbols in Spanish and translates only the words (FR-I18N-4)', () => {
    expect(es.elements.age(ageParts(2 * 86_400_000 + 4 * 3_600_000))).toBe('2 d 4 h');
    expect(es.elements.age(ageParts(30_000))).toBe('menos de un minuto');
  });
});
