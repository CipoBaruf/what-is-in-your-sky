/**
 * R143 (FR-TONIGHT-7, D-903, D-911): the chip's facts — `now` on real time, the offset ahead and behind (under a
 * minute too), `tonight` inside tonight's night band, the weekday past midnight outside it — and tonight's band
 * itself (FR-TONIGHT-4's night), worded through both catalogs so these are the chips a reader sees.
 */
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { chipFor, isTonight, tonightBand } from './shownTime';
import type { SkyBand } from './timeStripe';

const ZONE = 'America/Argentina/Salta'; // UTC−3
const H = 3_600_000;
const MIN = 60_000;
/** Friday 2026-09-11, 12:00 local. */
const NOW = Date.UTC(2026, 8, 11, 15, 0, 0);
/** Day until 19:00, twilight to 20:00, dark to 05:00, twilight to 06:00, then day again (local). */
const BANDS: SkyBand[] = [
  { from: NOW, to: NOW + 7 * H, sky: 'day' },
  { from: NOW + 7 * H, to: NOW + 8 * H, sky: 'bright-twilight' },
  { from: NOW + 8 * H, to: NOW + 17 * H, sky: 'dark' },
  { from: NOW + 17 * H, to: NOW + 18 * H, sky: 'bright-twilight' },
  { from: NOW + 18 * H, to: NOW + 24 * H, sky: 'day' },
];
const NIGHT = tonightBand(BANDS, NOW);

describe('tonightBand', () => {
  it('is the run of non-day bands at or after now, twilight and dark together', () => {
    expect(tonightBand(BANDS, NOW)).toEqual({ from: NOW + 7 * H, to: NOW + 18 * H });
  });

  it('is the night under way when now is already in it, and is unaffected by the bands’ order', () => {
    const inNight = NOW + 9 * H;
    expect(tonightBand([...BANDS].reverse(), inNight)).toEqual({ from: NOW + 7 * H, to: NOW + 18 * H });
  });

  it('is null with no night in the bands (a polar summer) and with no bands yet', () => {
    expect(tonightBand([{ from: NOW, to: NOW + 24 * H, sky: 'day' }], NOW)).toBeNull();
    expect(tonightBand([], NOW)).toBeNull();
  });

  it('isTonight is the band’s inside, its end excluded, and false with no band', () => {
    expect(isTonight(NOW + 7 * H, NIGHT)).toBe(true);
    expect(isTonight(NOW + 18 * H - 1, NIGHT)).toBe(true);
    expect(isTonight(NOW + 18 * H, NIGHT)).toBe(false);
    expect(isTonight(NOW + 6 * H, NIGHT)).toBe(false);
    expect(isTonight(NOW + 9 * H, null)).toBe(false);
  });
});

describe('chipFor', () => {
  /** A held instant's chip: off real time whatever `t` is. */
  const held = (t: number, night = NIGHT, zone: string | null = ZONE) => chipFor(t, NOW, false, night, zone);
  const words = (t: number) => {
    const chip = held(t);
    const weekday = (locale: 'en' | 'es') => (chip.kind !== 'now' && chip.weekday ? { en: 'Sat', es: 'sáb' }[locale] : null);
    return chip.kind === 'now' ? [en.live.chip(chip), es.live.chip(chip)] : [en.live.chip({ ...chip, weekday: weekday('en') }), es.live.chip({ ...chip, weekday: weekday('es') })];
  };

  it('is now on real time, by usePlayback’s flag and not by t equalling the clock', () => {
    expect(chipFor(NOW, NOW, true, NIGHT, ZONE)).toEqual({ kind: 'now' });
    expect(en.live.chip({ kind: 'now' })).toBe('now');
    expect(es.live.chip({ kind: 'now' })).toBe('ahora');
    // On real time with a `now` a tick behind the page's `t`, still `now`.
    expect(chipFor(NOW + 7_000, NOW, true, NIGHT, ZONE)).toEqual({ kind: 'now' });
    // A held instant that lands on the clock is held.
    expect(held(NOW)).toEqual({ kind: 'ahead', hours: 0, minutes: 0, tonight: false, weekday: false });
  });

  it('reads under a minute as <1 min on its own side, never 0 min or −0 ahead', () => {
    expect(words(NOW)).toEqual(['in <1 min', 'en <1 min']);
    expect(words(NOW + 29_000)).toEqual(['in <1 min', 'en <1 min']);
    expect(held(NOW - 20_000)).toMatchObject({ kind: 'behind', hours: 0, minutes: 0 });
    expect(words(NOW - 20_000)).toEqual(['<1 min ago', 'hace <1 min']);
    // Half a minute rounds to one, as the held readout does.
    expect(words(NOW + 30_000)).toEqual(['in 1 min', 'en 1 min']);
    expect(words(NOW - 40_000)).toEqual(['1 min ago', 'hace 1 min']);
  });

  it('is the offset ahead in the day, hours split off past sixty', () => {
    expect(held(NOW + 6 * H + 12 * MIN)).toEqual({ kind: 'ahead', hours: 6, minutes: 12, tonight: false, weekday: false });
    expect(words(NOW + 6 * H + 12 * MIN)).toEqual(['in 6 h 12 min', 'en 6 h 12 min']);
    expect(words(NOW + 33 * MIN)).toEqual(['in 33 min', 'en 33 min']);
    expect(words(NOW + 2 * H + 5 * MIN)).toEqual(['in 2 h 05 min', 'en 2 h 05 min']);
  });

  it('is the offset behind', () => {
    expect(held(NOW - 12 * MIN)).toEqual({ kind: 'behind', hours: 0, minutes: 12, tonight: false, weekday: false });
    expect(words(NOW - 12 * MIN)).toEqual(['12 min ago', 'hace 12 min']);
    expect(words(NOW - 65 * MIN)).toEqual(['1 h 05 min ago', 'hace 1 h 05 min']);
  });

  it('carries tonight inside tonight’s night band, after midnight too, and not the weekday then', () => {
    expect(words(NOW + 8 * H + 12 * MIN)).toEqual(['tonight · in 8 h 12 min', 'esta noche · en 8 h 12 min']);
    // 02:30 Saturday, still tonight.
    expect(held(NOW + 14 * H + 30 * MIN)).toMatchObject({ tonight: true, weekday: false });
    expect(words(NOW + 14 * H + 30 * MIN)).toEqual(['tonight · in 14 h 30 min', 'esta noche · en 14 h 30 min']);
  });

  it('carries the weekday when t is not today and outside tonight', () => {
    // 07:00 Saturday, the day after the night.
    expect(held(NOW + 19 * H)).toEqual({ kind: 'ahead', hours: 19, minutes: 0, tonight: false, weekday: true });
    expect(words(NOW + 19 * H)).toEqual(['Sat · in 19 h 00 min', 'sáb · en 19 h 00 min']);
  });

  it('reads the day in UTC while the zone is unknown', () => {
    // 12:00 local is 15:00 UTC; 23:30 UTC is still today in UTC, and 00:30 UTC is not.
    expect(held(NOW + 8 * H + 30 * MIN, null, null)).toMatchObject({ weekday: false });
    expect(held(NOW + 9 * H + 30 * MIN, null, null)).toMatchObject({ weekday: true });
  });
});
