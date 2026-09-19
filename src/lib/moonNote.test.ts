import { describe, expect, it } from 'vitest';
import { CATALOGS } from '../i18n/useT';
import { LOCALES } from '../i18n/locale';
import { MOON_BRIGHT_PCT, MOON_NOTE_STEP_MS, moonNote, moonSampleTimes } from './moonNote';

/**
 * R82 (FR-FIRST-4 as amended v2.0.2, D-513): the when step's Moon sentence —
 * "Tonight it will." when the Moon is up and at least `MOON_BRIGHT_PCT` lit at
 * some instant of the dark window, "Tonight it will not." otherwise — pinned
 * at the threshold's two sides and with the Moon down, in both languages.
 */
const up = (pct: number) => ({ elDeg: 20, illuminatedFraction: pct / 100 });
const down = (pct: number) => ({ elDeg: -5, illuminatedFraction: pct / 100 });

describe('moonNote (D-513)', () => {
  it('holds the threshold at 50 %', () => {
    expect(MOON_BRIGHT_PCT).toBe(50);
  });

  it('says it will at the threshold and above, with the Moon up', () => {
    expect(moonNote([up(MOON_BRIGHT_PCT)])).toBe('bright');
    expect(moonNote([up(99)])).toBe('bright');
  });

  it('says it will not just under the threshold, as the row rounds it', () => {
    expect(moonNote([up(49)])).toBe('dim');
    // 49.6 % reads "50 %" in the row beside the sentence, so it is at the threshold, not under it.
    expect(moonNote([up(49.6)])).toBe('bright');
    expect(moonNote([up(49.4)])).toBe('dim');
  });

  it('says it will not with a bright Moon that is down all window', () => {
    expect(moonNote([down(98), down(99), { elDeg: 0, illuminatedFraction: 0.99 }])).toBe('dim');
  });

  it('says it will once the Moon rises inside the window, and not with no samples', () => {
    expect(moonNote([down(80), down(80), up(80)])).toBe('bright');
    expect(moonNote([])).toBe('dim');
  });

  const SENTENCES = {
    en: ['A bright moon washes out the faint ones. Tonight it will.', 'A bright moon washes out the faint ones. Tonight it will not.'],
    es: ['Una luna brillante apaga los más tenues. Esta noche lo hará.', 'Una luna brillante apaga los más tenues. Esta noche no lo hará.'],
  } as const;

  it.each(LOCALES)('reads both sentences in %s, either side of the threshold and with the Moon down', (locale) => {
    const t = CATALOGS[locale];
    const [bright, dim] = SENTENCES[locale];
    expect(t.home.whenStep.moonNote(moonNote([up(MOON_BRIGHT_PCT)]))).toBe(bright);
    expect(t.home.whenStep.moonNote(moonNote([up(MOON_BRIGHT_PCT - 1)]))).toBe(dim);
    expect(t.home.whenStep.moonNote(moonNote([down(100)]))).toBe(dim);
  });
});

describe('moonSampleTimes', () => {
  it('samples the window from its start to its end, a quarter hour apart', () => {
    const times = moonSampleTimes({ start: 0, end: 3_600_000 });
    expect(times).toEqual([0, MOON_NOTE_STEP_MS, 2 * MOON_NOTE_STEP_MS, 3 * MOON_NOTE_STEP_MS, 3_600_000]);
  });

  it('samples an empty window once', () => {
    expect(moonSampleTimes({ start: 5, end: 5 })).toEqual([5]);
  });
});
