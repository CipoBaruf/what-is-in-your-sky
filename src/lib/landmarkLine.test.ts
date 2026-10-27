/**
 * R127 (FR-SKY-11, D-796): the landmark line from the scene's two parts and
 * the catalog's two sentences, in both languages, with the star's own
 * constellation where no figure is within reach and nothing with neither.
 */
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { landmarkLine, landmarkNames, type LandmarkNames } from './landmarkLine';

const names = (lang: 'en' | 'es'): LandmarkNames => ({
  star: (i) => (lang === 'es' ? ['Betelgeuse', 'Sirio'] : ['Betelgeuse', 'Sirius'])[i] ?? '',
  constellation: (con) => ({ Ori: lang === 'es' ? 'Orión' : 'Orion', CMa: lang === 'es' ? 'Can Mayor' : 'Canis Major' })[con],
  constellationOf: (i) => ['Ori', 'CMa'][i] ?? '',
});

describe('landmarkLine (FR-SKY-11, D-796)', () => {
  it('words the star, the whole degrees, the direction and the figure the peak is among, in each language', () => {
    const landmark = { star: { index: 0, sepDeg: 7.4, word: 'above' as const }, among: { con: 'Ori' } };
    expect(landmarkLine(landmark, names('en'), en.live)).toBe('passes 7° above Betelgeuse, in Orion');
    expect(landmarkLine(landmark, names('es'), es.live)).toBe('pasa 7° sobre Betelgeuse, en Orión');
    expect(landmarkLine({ star: { index: 1, sepDeg: 2.5, word: 'below' }, among: { con: 'CMa' } }, names('es'), es.live)).toBe('pasa 3° bajo Sirio, en Can Mayor');
    expect(landmarkLine({ star: { index: 1, sepDeg: 1, word: 'beside' }, among: { con: 'CMa' } }, names('en'), en.live)).toBe('passes 1° beside Sirius, in Canis Major');
  });

  it('names the star’s own constellation where no figure is within reach', () => {
    expect(landmarkLine({ star: { index: 1, sepDeg: 4, word: 'beside' }, among: null }, names('en'), en.live)).toBe('passes 4° beside Sirius, in Canis Major');
  });

  it('is "passes through" with a figure and no star, and nothing with neither', () => {
    expect(landmarkLine({ star: null, among: { con: 'Ori' } }, names('en'), en.live)).toBe('passes through Orion');
    expect(landmarkLine({ star: null, among: { con: 'Ori' } }, names('es'), es.live)).toBe('pasa por Orión');
    expect(landmarkLine({ star: null, among: null }, names('en'), en.live)).toBeNull();
    expect(landmarkLine(null, names('en'), en.live)).toBeNull();
    expect(landmarkLine(undefined, names('en'), en.live)).toBeNull();
  });

  it('falls back to the abbreviation for a figure the table does not name', () => {
    expect(landmarkLine({ star: null, among: { con: 'Xyz' } }, names('en'), en.live)).toBe('passes through Xyz');
  });
});

describe('landmarkNames (R127 review)', () => {
  it('reads the names in the one language and the constellation column, empty past it', () => {
    const names = landmarkNames({ star: (i: number, lang: string) => `${lang}:${String(i)}`, constellation: (con: string, lang: string) => (con === 'Ori' ? `${lang}:Orion` : undefined) }, ['Ori'], 'es');
    expect(names.star(3)).toBe('es:3');
    expect(names.constellation('Ori')).toBe('es:Orion');
    expect(names.constellation('Tau')).toBeUndefined();
    expect(names.constellationOf(0)).toBe('Ori');
    expect(names.constellationOf(1)).toBe('');
  });
});
