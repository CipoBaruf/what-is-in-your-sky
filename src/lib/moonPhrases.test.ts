import { describe, expect, it } from 'vitest';
import { MOON_FIXTURE } from '../../tests/support/moonFixtures';
import { fullMoonName, MOON_LORE, phaseLore, signAtLongitude } from '../data/moon';
import { CATALOGS } from '../i18n/useT';
import { LOCALES } from '../i18n/locale';
import { DEFAULT_MOON_GLARE_THRESHOLDS } from '../physics/constants';
import type { Locale, MoonPhaseName, MoonState } from '../model';
import {
  MOON_PHASE_DEG_PER_DAY,
  loreLineSource,
  moonFacts,
  moonGlareFacts,
  moonLoreParams,
  showsFullMoonName,
  type MoonLoreEntries,
} from './moonPhrases';

/**
 * R30 (FR-MOON-2/3/4/5). The phrases are keys and numbers, so the assertions
 * are made where the reader meets them: every case is rendered through both
 * catalogs, and neither language may come out looking like the other. The
 * lore entries are the real `lore.json` — this file is the one place the
 * mapping from a Moon to a reviewed line is checked end to end (D-121: `src/lib`
 * may not import `src/data`, but a test may wire anything together).
 */
const moon = (overrides: Partial<MoonState> = {}): MoonState => ({ ...MOON_FIXTURE, ...overrides });

/** The entries the UI hands `moonLoreParams`, looked up the way `MoonLore.tsx` looks them up. */
const entriesFor = (state: MoonState, month: number): MoonLoreEntries => ({
  sign: signAtLongitude(state.eclipticLonDeg),
  phase: phaseLore(state.phase),
  fullMoon: showsFullMoonName(state) ? fullMoonName(month) : null,
  hemisphereNote: MOON_LORE.fullMoons.hemisphereNote,
});

describe('moonFacts (FR-MOON-3)', () => {
  it('reads the phase, the whole-percent illumination and where the Moon is', () => {
    expect(moonFacts(moon())).toEqual({ phase: 'waningGibbous', illumination: '72', up: true, direction: 'N', azimuth: '7°', elevation: '29°' });
  });

  it('marks a Moon below the horizon as down, and still reports its phase and illumination', () => {
    const facts = moonFacts(moon({ elDeg: -0.5 }));
    expect(facts.up).toBe(false);
    expect(facts).toMatchObject({ phase: 'waningGibbous', illumination: '72' });
  });

  it('is up only above the horizon: 0° is not up, the smallest positive elevation is', () => {
    expect(moonFacts(moon({ elDeg: 0 })).up).toBe(false);
    expect(moonFacts(moon({ elDeg: 0.01 })).up).toBe(true);
  });

  describe.each([...LOCALES])('the %s line', (locale: Locale) => {
    const t = CATALOGS[locale];

    it('names the phase in this language, with the illumination and the direction', () => {
      const line = t.moon.line(moonFacts(moon()));
      expect(line).toContain(t.moon.phase.waningGibbous);
      expect(line).toContain('72 %');
      expect(line).toContain('N 7°');
      expect(line).toContain('29°');
    });

    it('drops the direction and the elevation when the Moon is down', () => {
      const line = t.moon.line(moonFacts(moon({ elDeg: -20, azDeg: 200 })));
      expect(line).toContain(t.moon.phase.waningGibbous);
      expect(line).not.toContain('SSW');
      expect(line).not.toContain('-20°');
    });
  });

  it('says something different in each language', () => {
    expect(CATALOGS.en.moon.line(moonFacts(moon()))).not.toBe(CATALOGS.es.moon.line(moonFacts(moon())));
  });
});

describe('moonGlareFacts (FR-MOON-2)', () => {
  it('carries the illumination, the separation and the thresholds the tooltip quotes', () => {
    expect(moonGlareFacts(moon(), { glare: true, separationDeg: 8.2 }, DEFAULT_MOON_GLARE_THRESHOLDS)).toEqual({
      illumination: '72',
      separation: '8°',
      minIllumination: '50',
      maxSeparation: '30°',
    });
  });

  describe.each([...LOCALES])('the %s tooltip', (locale: Locale) => {
    it('states both thresholds, so the label can be judged', () => {
      const tooltip = CATALOGS[locale].moon.glare.tooltip(moonGlareFacts(moon(), { glare: true, separationDeg: 8.2 }, DEFAULT_MOON_GLARE_THRESHOLDS));
      expect(tooltip).toContain('50 %');
      expect(tooltip).toContain('30°');
      expect(tooltip).toContain('8°');
    });
  });
});

describe('showsFullMoonName (FR-MOON-4)', () => {
  it('opens exactly one day of phase angle either side of full', () => {
    expect(MOON_PHASE_DEG_PER_DAY).toBeCloseTo(12.19, 2);
    expect(showsFullMoonName(moon({ phaseAngleDeg: 180 }))).toBe(true);
    expect(showsFullMoonName(moon({ phaseAngleDeg: 180 - MOON_PHASE_DEG_PER_DAY }))).toBe(true);
    expect(showsFullMoonName(moon({ phaseAngleDeg: 180 + MOON_PHASE_DEG_PER_DAY }))).toBe(true);
    expect(showsFullMoonName(moon({ phaseAngleDeg: 180 - MOON_PHASE_DEG_PER_DAY - 0.01 }))).toBe(false);
    expect(showsFullMoonName(moon({ phaseAngleDeg: 180 + MOON_PHASE_DEG_PER_DAY + 0.01 }))).toBe(false);
  });

  it('is closed at every other phase, the gibbous ones included', () => {
    for (const angle of [0, 90, 150, 167, 193, 210, 270, 359]) {
      expect(showsFullMoonName(moon({ phaseAngleDeg: angle })), `${String(angle)}°`).toBe(false);
    }
  });
});

describe('loreLineSource (D-123)', () => {
  it('takes the phase line at the four phases the calendars turn on, and the sign line in between', () => {
    const bySource = (source: 'phase' | 'sign'): MoonPhaseName[] =>
      (['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'] as const).filter((p) => loreLineSource(p) === source);
    expect(bySource('phase')).toEqual(['new', 'firstQuarter', 'full', 'lastQuarter']);
    expect(bySource('sign')).toEqual(['waxingCrescent', 'waxingGibbous', 'waningGibbous', 'waningCrescent']);
  });
});

describe('moonLoreParams (FR-MOON-4, FR-MOON-5)', () => {
  describe.each([...LOCALES])('in %s', (locale: Locale) => {
    const t = CATALOGS[locale];

    it('names the sign the ecliptic longitude falls in, at both edges of a band', () => {
      const below = moonLoreParams(entriesFor(moon({ eclipticLonDeg: 29.99 }), 9), moon({ eclipticLonDeg: 29.99 }), locale);
      const above = moonLoreParams(entriesFor(moon({ eclipticLonDeg: 30 }), 9), moon({ eclipticLonDeg: 30 }), locale);
      expect(below.sign).toBe(signAtLongitude(29.99).name[locale]);
      expect(above.sign).toBe(signAtLongitude(30).name[locale]);
      expect(below.sign).not.toBe(above.sign);
      expect(t.moon.lore.line(below)).toContain(below.sign);
    });

    it('adds the month’s folk name within a day of full, with the file’s hemisphere note, and neither outside it', () => {
      const full = moon({ phaseAngleDeg: 180, phase: 'full' });
      const gibbous = moon({ phaseAngleDeg: 160, phase: 'waningGibbous' });
      const named = moonLoreParams(entriesFor(full, 1), full, locale);
      const unnamed = moonLoreParams(entriesFor(gibbous, 1), gibbous, locale);
      expect(named.fullMoonName).toBe(fullMoonName(1).name[locale]);
      expect(named.hemisphereNote).toBe(MOON_LORE.fullMoons.hemisphereNote[locale]);
      expect(t.moon.lore.line(named)).toContain(fullMoonName(1).name[locale]);
      expect(unnamed.fullMoonName).toBeNull();
      expect(unnamed.hemisphereNote).toBeNull();
      expect(t.moon.lore.line(unnamed)).not.toContain(fullMoonName(1).name[locale]);
    });

    it('takes its one-liner from the file, the phase’s at full and the sign’s in between (D-123)', () => {
      const full = moon({ phaseAngleDeg: 180, phase: 'full' });
      const gibbous = moon({ phaseAngleDeg: 160, phase: 'waningGibbous' });
      expect(moonLoreParams(entriesFor(full, 1), full, locale).line).toBe(phaseLore('full').line[locale]);
      expect(moonLoreParams(entriesFor(gibbous, 1), gibbous, locale).line).toBe(signAtLongitude(gibbous.eclipticLonDeg).line[locale]);
    });

    it('states no observing fact: the tradition line carries neither the phase name nor the illumination (FR-MOON-5)', () => {
      const state = moon();
      const line = t.moon.lore.line(moonLoreParams(entriesFor(state, 9), state, locale));
      expect(line).not.toContain(`${moonFacts(state).illumination} %`);
      expect(line).not.toContain(t.moon.phase[state.phase]);
    });
  });

  it('is a different line in each language, from the same entries', () => {
    const state = moon();
    const line = (locale: Locale): string => CATALOGS[locale].moon.lore.line(moonLoreParams(entriesFor(state, 9), state, locale));
    expect(line('en')).not.toBe(line('es'));
  });
});
