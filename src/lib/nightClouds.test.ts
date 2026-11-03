/**
 * D-1028: tonight's cloud hour by hour across the dark window — one state, one change at a clock time, or variable —
 * and its words in both languages.
 */
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import type { HourlyCloud, TonightCloud, WeatherSnapshot } from '../model';
import { laterIsBetter, nightClouds, tonightCloud } from './nightClouds';

const HOUR = 3_600_000;
/** 21:00 in Neuquén (UTC−3) on 2026-11-02, the owner's night. */
const H21 = Date.parse('2026-11-03T00:00:00Z');
const at = (localHour: number): number => H21 + (localHour - 21) * HOUR;
const snapshot = (hourly: HourlyCloud[]): WeatherSnapshot => ({ provider: 'open-meteo', lat: -38.9, lon: -68, cellKey: '-38.9,-68.0', fetchedAt: H21, timeZone: 'America/Argentina/Salta', hourly });
/** Hourly samples from 21:00 on, by total cover alone (no layers), one per hour. */
const totals = (...pcts: number[]): WeatherSnapshot => snapshot(pcts.map((totalPct, i) => ({ t: H21 + i * HOUR, totalPct })));
/** The dark window 21:15 → 05:20, whose hours are 22:00 … 05:00. */
const DARK = { start: at(21) + 15 * 60_000, end: at(29) + 20 * 60_000 };
/** The clock in Neuquén. */
const hhmm = (t: number): string => new Date(t - 3 * HOUR).toISOString().slice(11, 16);

describe('nightClouds', () => {
  it('reads the owner’s Neuquén night as partly cloudy until 02:00, clear after (the 22:00 sample of 2026-11-02)', () => {
    const s = snapshot([
      { t: at(21), totalPct: 98, lowPct: 1, midPct: 27, highPct: 98 },
      { t: at(22), totalPct: 98, lowPct: 1, midPct: 27, highPct: 98 },
      { t: at(23), totalPct: 99, lowPct: 0, midPct: 30, highPct: 99 },
      { t: at(24), totalPct: 97, lowPct: 0, midPct: 20, highPct: 97 },
      { t: at(25), totalPct: 80, lowPct: 0, midPct: 10, highPct: 80 },
      { t: at(26), totalPct: 41, lowPct: 15, midPct: 10, highPct: 30 },
      { t: at(27), totalPct: 19, lowPct: 12, midPct: 2, highPct: 9 },
      { t: at(28), totalPct: 10, lowPct: 5, midPct: 0, highPct: 6 },
      { t: at(29), totalPct: 6, lowPct: 3, midPct: 0, highPct: 4 },
      { t: at(30), totalPct: 4, lowPct: 2, midPct: 0, highPct: 2 },
    ]);
    const clouds = nightClouds(s, DARK, at(21));
    expect(clouds).toMatchObject({ kind: 'change', at: at(26), before: { state: 'partly' }, after: { state: 'clear' } });
    if (clouds.kind !== 'change') throw new Error('a change');
    // The part's figure is the mean of its hours, so the tooltip's percentage is inside its state's band.
    expect(clouds.before.effectivePct).toBeCloseTo((68.6 + 69.3 + 67.9 + 56) / 4, 6);
    expect(tonightCloud(clouds, hhmm)).toEqual({ kind: 'change', before: 'partly', after: 'clear', at: '02:00' });
  });

  it('is steady with one state all night, the figure the mean across it', () => {
    const clouds = nightClouds(totals(5, 10, 20, 0, 0, 10, 5, 5, 5), DARK, at(21));
    expect(clouds).toEqual({ kind: 'steady', verdict: { state: 'clear', effectivePct: (10 + 20 + 0 + 0 + 10 + 5 + 5 + 5) / 8, at: (DARK.start + DARK.end) / 2 } });
  });

  it('says when an overcast night clears, and when a clear night clouds over', () => {
    expect(nightClouds(totals(95, 95, 95, 90, 85, 10, 10, 5, 5), DARK, at(21))).toMatchObject({ kind: 'change', at: at(26), before: { state: 'obscured' }, after: { state: 'clear' } });
    expect(nightClouds(totals(5, 5, 10, 20, 90, 95, 95, 95, 95), DARK, at(21))).toMatchObject({ kind: 'change', at: at(25), before: { state: 'clear' }, after: { state: 'obscured' } });
  });

  it('ignores a state that lasts one hour, in the middle or at either end', () => {
    expect(nightClouds(totals(5, 5, 5, 80, 5, 5, 5, 5, 5), DARK, at(21))).toMatchObject({ kind: 'steady', verdict: { state: 'clear' } });
    expect(nightClouds(totals(5, 80, 5, 5, 5, 5, 5, 5, 80), DARK, at(21))).toMatchObject({ kind: 'steady', verdict: { state: 'clear' } });
    // Two one-hour blips of different states fold away one after the other.
    expect(nightClouds(totals(5, 5, 5, 50, 5, 90, 5, 5, 5), DARK, at(21))).toMatchObject({ kind: 'steady', verdict: { state: 'clear' } });
  });

  it('gives a one-hour step between two states to the longer side, and on a tie to the cloudier one', () => {
    // 22–00 obscured, 01 partly, 02–05 clear: the partly hour joins the clear side, the longer.
    expect(nightClouds(totals(0, 95, 95, 95, 50, 5, 5, 5, 5), DARK, at(21))).toMatchObject({ kind: 'change', at: at(25), before: { state: 'obscured' } });
    // To 06:00: 22–01 obscured, 02 partly, 03–06 clear, four hours each side: the step goes to the cloudier side.
    expect(nightClouds(totals(0, 95, 95, 95, 95, 50, 5, 5, 5, 5), { start: DARK.start, end: at(30) }, at(21))).toMatchObject({ kind: 'change', at: at(27), before: { state: 'obscured' }, after: { state: 'clear' } });
  });

  it('is variable when the cloud changes more than once for longer than an hour', () => {
    const clouds = nightClouds(totals(0, 5, 5, 90, 90, 90, 5, 5, 5), DARK, at(21));
    expect(clouds.kind).toBe('variable');
    expect(tonightCloud(clouds, hhmm)).toEqual({ kind: 'variable' });
  });

  it('uses the hours the forecast covers, and the middle of the window with fewer than two', () => {
    // The forecast ends at 01:00: the night is read from 22:00–01:00.
    expect(nightClouds(totals(95, 95, 95, 95, 95), DARK, at(21))).toMatchObject({ kind: 'steady', verdict: { state: 'obscured' } });
    // A window of under an hour holds one sample: the verdict at its middle, as before D-1028.
    const short = { start: at(22) - 10 * 60_000, end: at(22) + 20 * 60_000 };
    expect(nightClouds(totals(0, 90, 0), short, at(21))).toEqual({ kind: 'steady', verdict: { state: 'obscured', effectivePct: 82.5, at: at(22) + 5 * 60_000 } });
  });

  it('is unknown without a forecast or a window', () => {
    expect(nightClouds(null, DARK, at(21))).toEqual({ kind: 'steady', verdict: { state: 'unknown', effectivePct: null, at: (DARK.start + DARK.end) / 2 } });
    expect(nightClouds(totals(5, 5), null, at(23))).toEqual({ kind: 'steady', verdict: { state: 'unknown', effectivePct: null, at: at(23) } });
    // Every hour of the window past the forecast's end.
    expect(nightClouds(totals(5), DARK, at(21))).toEqual({ kind: 'steady', verdict: { state: 'unknown', effectivePct: null, at: (DARK.start + DARK.end) / 2 } });
  });
});

describe('laterIsBetter', () => {
  it('is true when the later part is less cloudy', () => {
    expect(laterIsBetter({ before: 'obscured', after: 'clear' })).toBe(true);
    expect(laterIsBetter({ before: 'obscured', after: 'partly' })).toBe(true);
    expect(laterIsBetter({ before: 'clear', after: 'partly' })).toBe(false);
  });
});

describe('D-1028: tonight’s cloud in words', () => {
  const clearing: TonightCloud = { kind: 'change', before: 'obscured', after: 'clear', at: '02:00' };
  const closing: TonightCloud = { kind: 'change', before: 'clear', after: 'partly', at: '01:00' };

  it('the wide line: the state, Variable, or the change with its time', () => {
    expect(en.weather.tonight({ kind: 'steady', state: 'clear' })).toBe('Clear');
    expect(en.weather.tonight({ kind: 'variable' })).toBe('Variable');
    expect(en.weather.tonight(clearing)).toBe('Likely obscured until 02:00 · clear after');
    expect(es.weather.tonight(clearing)).toBe('Probablemente cubierto hasta las 02:00 · despejado después');
    expect(es.weather.tonight(closing)).toBe('Despejado hasta las 01:00 · parcialmente nublado después');
  });

  it('the what step’s foot: a change is two pieces', () => {
    const foot = (t: typeof en, cloud: TonightCloud) => t.home.whatStep.foot({ place: 'Neuquén', dark: { from: '21:15', to: '05:20' }, cloud });
    expect(foot(en, clearing)).toEqual(['Neuquén', 'dark 21:15–05:20', 'likely obscured until 02:00', 'clear after']);
    expect(foot(es, clearing)).toEqual(['Neuquén', 'oscuro 21:15–05:20', 'probablemente cubierto hasta las 02:00', 'despejado después']);
    expect(foot(en, { kind: 'variable' })).toEqual(['Neuquén', 'dark 21:15–05:20', 'variable']);
    expect(foot(es, { kind: 'steady', state: 'clear' })).toEqual(['Neuquén', 'oscuro 21:15–05:20', 'despejado']);
  });

  it('the Stars door: the better part with its stretch of the dark', () => {
    const dark = (t: typeof en, cloud: TonightCloud) => t.doors.stars.dark({ from: '21:15', to: '05:20', cloud });
    expect(dark(en, clearing)).toBe('Dark, clear 02:00 → 05:20');
    expect(dark(es, clearing)).toBe('Oscuro y despejado 02:00 → 05:20');
    expect(dark(en, closing)).toBe('Dark, clear 21:15 → 01:00');
    expect(dark(es, closing)).toBe('Oscuro y despejado 21:15 → 01:00');
    expect(dark(en, { kind: 'steady', state: 'obscured' })).toBe('Dark 21:15 → 05:20 · Cloudy');
    expect(en.doors.stars.noDark(clearing)).toBe('No full dark · Variable');
    expect(es.doors.stars.noDark({ kind: 'variable' })).toBe('Sin oscuridad total · Variable');
  });

  it('the when step’s two rows', () => {
    expect([en.home.whenStep.cloudsUntil('02:00'), en.home.whenStep.cloudsFrom('02:00')]).toEqual(['Until 02:00', 'From 02:00']);
    expect([es.home.whenStep.cloudsUntil('02:00'), es.home.whenStep.cloudsFrom('02:00')]).toEqual(['Hasta 02:00', 'Desde 02:00']);
  });
});
