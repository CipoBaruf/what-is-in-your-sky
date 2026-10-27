/**
 * R130 (FR-FLOW-1, D-843): the three doors' lines — an up-now pass, a later
 * pass, no pass, daylight, and the stars chunk not yet loaded — in both
 * languages, from the one pure builder the doors draw.
 */
import { describe, expect, it } from 'vitest';
import { DOOR_SKY, doorInput, doorPass, local } from '../../../../tests/support/doorFixtures';
import { en } from '../../../i18n/en';
import { es } from '../../../i18n/es';
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
