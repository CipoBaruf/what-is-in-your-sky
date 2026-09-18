/**
 * R76 (FR-FIRST-4): the dark window line — which band of the sampled day is
 * tonight's, and the sentence it makes in both languages. The component itself
 * is the bands, a clock and this pair of functions (D-470), so the pair is what
 * a regression in the line would show up in.
 */
import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import type { SkyBand } from '../../../lib/timeStripe';
import { darkWindowText, tonightsDark } from './DarkWindow';

const H = 3_600_000;
/** Midnight UTC, so the clock in the sentences is the one the numbers below read as. */
const MIDNIGHT = Date.UTC(2026, 8, 18, 0, 0, 0);
const at = (hours: number) => MIDNIGHT + hours * H;

const band = (fromH: number, toH: number, sky: SkyBand['sky']): SkyBand => ({ from: at(fromH), to: at(toH), sky });

/** A day sampled from noon yesterday: last night's dark window, the day, and tonight's. */
const DAY: readonly SkyBand[] = [band(-12, -10, 'bright-twilight'), band(-10, -3.75, 'dark'), band(-3.75, -2, 'bright-twilight'), band(-2, 8.25, 'day'), band(8.25, 10, 'bright-twilight'), band(10, 17.5, 'dark')];

describe('tonightsDark (FR-FIRST-4)', () => {
  it('during the day takes the window that has not opened yet', () => {
    const found = tonightsDark(DAY, at(3));
    expect(found?.from).toBe(at(10));
  });

  it('inside a window takes that window, not the next one', () => {
    const found = tonightsDark(DAY, at(-5));
    expect(found?.from).toBe(at(-10));
  });

  it('is null when nothing sampled is still to come', () => {
    expect(tonightsDark(DAY, at(18))).toBeNull();
    expect(tonightsDark([band(0, 8, 'day')], at(1))).toBeNull();
  });
});

describe('darkWindowText (FR-FIRST-4)', () => {
  const sampledFrom = at(-12);

  it('names both ends, the opening one with its zone', () => {
    expect(darkWindowText(band(10, 17.5, 'dark'), sampledFrom, 'UTC', 'en', en)).toBe('Dark 10:00 UTC → 17:30');
    expect(darkWindowText(band(10, 17.5, 'dark'), sampledFrom, 'UTC', 'es', es)).toBe('Oscuro 10:00 UTC → 17:30');
  });

  it('says there is none when there is none', () => {
    expect(darkWindowText(null, sampledFrom, 'UTC', 'en', en)).toBe(en.home.noDarkWindow);
    expect(darkWindowText(null, sampledFrom, 'UTC', 'es', es)).toBe(es.home.noDarkWindow);
  });

  it('names only the end when the darkness began before anything sampled (a polar winter)', () => {
    const openAllDay = band(-12, 6, 'dark');
    expect(darkWindowText(openAllDay, sampledFrom, 'UTC', 'en', en)).toBe('Dark until 06:00');
    expect(darkWindowText(openAllDay, sampledFrom, 'UTC', 'es', es)).toBe('Oscuro hasta las 06:00');
  });
});
