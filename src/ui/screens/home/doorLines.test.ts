/**
 * R130 (FR-FLOW-1, D-843): the three doors' lines — an up-now pass, a later
 * pass, no pass, daylight, and the stars chunk not yet loaded — in both
 * languages, from the one pure builder the doors draw.
 */
import { describe, expect, it } from 'vitest';
import { DOOR_NIGHT, DOOR_SKY, doorInput, doorPass, local } from '../../../../tests/support/doorFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
import { skyStateAt } from '../../../lib/skyBodies';
import { HOUR_MS, skyBands } from '../../../lib/timeStripe';
import { tonightsDark, tonightsStarsFrom } from '../../../lib/tonightStripe';
import type { Observer } from '../../../model';
import { DOOR_CELLS, doorLines } from './doorLines';

const SKY = DOOR_SKY;

describe('doorLines', () => {
  it('a later pass: its time and countdown, then its name, peak and end, opening that pass', () => {
    const { satellites, stars, both } = doorLines(doorInput(), en);
    expect(satellites).toEqual({ title: 'Satellites', lines: ['Next 05:48 · in 48:00', 'Tiangong · NE 11° → ENE'], passId: 'tiangong', wide: 'passes 3° beside Mintaka, in Orion' });
    expect(stars.lines).toEqual(['Dark 20:25 → 07:05 · Clear', 'Brightest now: Canopus, S']);
    expect(stars.wide).toBe('Moon 64 % · sets 02:10');
    expect(both).toEqual({ title: 'Both · live sky', lines: ['Nothing up now · next 05:48'], wide: 'Stars under the arcs, drag to look' });
  });

  it('an up-now pass: the countdown to its peak, and the Both door counts it with its landmark star', () => {
    const now = local(11, 5, 49);
    const { satellites, both } = doorLines(doorInput({ now }), en);
    expect(satellites.lines[0]).toBe('Up now · peaks in 1:00');
    expect(satellites.passId).toBe('tiangong');
    expect(both.lines).toEqual(['1 up now, beside Mintaka']);
    expect(doorLines(doorInput({ now, locale: 'es' }), es).both.lines).toEqual(['1 en el cielo, junto a Mintaka']);
    // Before the chunk, the count alone.
    expect(doorLines(doorInput({ now, sky: null }), en).both.lines).toEqual(['1 up now']);
  });

  it('words the up-now line exactly in both languages: the peak, then the end by its reason', () => {
    const now = local(11, 5, 49);
    const at = (locale: 'en' | 'es', over = {}) => doorLines(doorInput({ now, locale, ...over }), locale === 'en' ? en : es).satellites.lines[0];
    expect(at('en')).toBe('Up now · peaks in 1:00');
    expect(at('es')).toBe('Arriba · culmina en 1:00');
    const later = local(11, 5, 51);
    const shadow = [{ ...doorPass('tiangong', local(11, 5, 48), 'Tiangong'), endReason: 'shadow' as const }];
    expect(at('en', { now: later, passes: shadow })).toBe('Up now · into shadow in 1:00');
    expect(at('es', { now: later, passes: shadow })).toBe('Arriba · a la sombra en 1:00');
  });

  it('no zone: neither of the Stars door’s first lines gives a cloud word', () => {
    expect(doorLines(doorInput({ zone: null }), en).stars.lines[0]).toBe('Dark 23:25 → 10:05 UTC');
    expect(doorLines(doorInput({ zone: null, dark: null }), en).stars.lines[0]).toBe('No full dark');
    expect(doorLines(doorInput({ zone: null, dark: null, locale: 'es' }), es).stars.lines[0]).toBe('Sin oscuridad total');
    expect(doorLines(doorInput({ dark: null, locale: 'es' }), es).stars.lines[0]).toBe('Sin oscuridad total · Despejado');
  });

  it('no pass in the span: one line, and the door opens the What reading (no pass id)', () => {
    const { satellites, both } = doorLines(doorInput({ passes: [] }), en);
    expect(satellites).toEqual({ title: 'Satellites', lines: ['No visible pass in 72 h'], passId: null });
    expect(both.lines).toEqual(['Nothing up now']);
    expect(doorLines(doorInput({ passes: [], locale: 'es' }), es).satellites.lines).toEqual(['Ningún pase visible en 72 h']);
    // While the passes are still arriving it is not yet "no pass".
    expect(doorLines(doorInput({ passes: [], pending: true }), en).satellites.lines).toEqual(['Looking for the next pass…']);
  });

  it('daylight: nothing drawn above the horizon, so the second line is when the stars come', () => {
    const sky = { ...SKY, brightest: null };
    expect(doorLines(doorInput({ now: local(11, 14), sky }), en).stars.lines[1]).toBe('Stars from 20:25');
    expect(doorLines(doorInput({ now: local(11, 14), sky, locale: 'es' }), es).stars.lines[1]).toBe('Estrellas desde las 20:25');
    // No dark band tonight (a polar summer): no time to give.
    expect(doorLines(doorInput({ now: local(11, 14), sky, dark: null }), en).stars.lines).toEqual(['No full dark · Clear', 'No dark sky tonight']);
  });

  it('reads the second line from `starsFrom`, not from `dark` (D-884)', () => {
    const twilight = { ...DOOR_NIGHT, from: DOOR_NIGHT.from - 60 * 60_000, sky: 'bright-twilight' as const };
    const lines = doorLines(doorInput({ now: local(11, 14), sky: { ...DOOR_SKY, brightest: null }, starsFrom: twilight }), en).stars.lines;
    expect(lines[1]).toBe(doorLines(doorInput({ now: local(11, 14), sky: { ...DOOR_SKY, brightest: null }, dark: twilight, starsFrom: twilight }), en).stars.lines[1]);
    expect(lines[1]).not.toBe(doorLines(doorInput({ now: local(11, 14), sky: { ...DOOR_SKY, brightest: null } }), en).stars.lines[1]);
  });

  describe('a June night with no dark band (FR-FLOW-1 as amended v2.6.1, D-884)', () => {
    /** 21 June 2026, 12:00 UTC: the bands from the astronomy module, sampled over the span `tonightStripe.test.ts` uses (a day before to 38 h after). */
    const NOON = Date.UTC(2026, 5, 21, 12, 0);
    const night = (lat: number, lon: number, timeZone: string) => {
      const observer: Observer = { lat, lon, altM: 0, label: `${lat}, ${lon}`, source: 'coords', timeZone };
      const bands = skyBands(NOON - 24 * HOUR_MS, NOON + 38 * HOUR_MS, 5 * 60_000, (t) => skyStateAt(t, observer));
      const at = (locale: 'en' | 'es') =>
        doorInput({ now: NOON, zone: timeZone, locale, passes: [], sky: { ...SKY, brightest: null }, dark: tonightsDark(bands, NOON), starsFrom: tonightsStarsFrom(bands, NOON) });
      return { en: doorLines(at('en'), en).stars.lines, es: doorLines(at('es'), es).stars.lines };
    };

    it('at 58° N the second line is the start of bright twilight, in both languages', () => {
      // The Sun stays above −12° all night; it is below −6° from 22:40 UTC, 23:40 on the UK's summer clock.
      const lines = night(58, -4, 'Europe/London');
      expect(lines.en).toEqual(['No full dark · Clear', 'Stars from 23:40']);
      expect(lines.es).toEqual(['Sin oscuridad total · Despejado', 'Estrellas desde las 23:40']);
    });

    it('at 70° N, with neither band, it is still "No dark sky tonight", in both languages', () => {
      const lines = night(70, 19, 'Europe/Oslo');
      expect(lines.en).toEqual(['No full dark · Clear', 'No dark sky tonight']);
      expect(lines.es).toEqual(['Sin oscuridad total · Despejado', 'Sin cielo oscuro esta noche']);
    });
  });

  it('the stars chunk not loaded: the Stars door keeps its second line, empty, and the wide lines wait', () => {
    const { satellites, stars } = doorLines(doorInput({ sky: null }), en);
    expect(stars.lines).toEqual(['Dark 20:25 → 07:05 · Clear', null]);
    expect(stars.wide).toBeNull();
    expect(satellites.wide).toBeNull();
    // Before the bands, the first line waits too.
    expect(doorLines(doorInput({ sky: null, bandsKnown: false, dark: null }), en).stars.lines).toEqual([null, null]);
  });

  it('cuts a long name rather than the path, so the line stays within the cells', () => {
    const passes = [doorPass('long', local(11, 5, 48), 'STARLINK-31415 (VISORSAT DARK)')];
    const line = doorLines(doorInput({ passes }), en).satellites.lines[1] ?? '';
    expect([...line].length).toBeLessThanOrEqual(DOOR_CELLS);
    expect(line).toMatch(/^STARLINK.*… · NE 11° → ENE$/);
  });
});
