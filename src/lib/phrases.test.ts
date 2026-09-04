import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR } from '../../tests/support/fixtures';
import { goldenPassFixture } from '../../tests/support/catalogFixtures';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import type { Messages } from '../i18n/messages';
import type { Locale, Pass } from '../model';
import { brightnessBand, elevationBand, guideParams } from './phrases';

interface GuideGolden {
  asComputed: string;
  endHorizon: string;
  endShadow: string;
  endTwilight: string;
}
const golden = JSON.parse(readFileSync(join(FIXTURES_DIR, 'guide-sentences.json'), 'utf8')) as Record<Locale, GuideGolden>;
const pass = goldenPassFixture();
const CATALOGS: Record<Locale, Messages> = { en, es };

/** The sentence as the screen builds it: `lib` supplies the parameters, the catalog the words (R17). */
const sentence = (p: Pass, timeZone: string | null, locale: Locale): string => CATALOGS[locale].guide.sentence(guideParams(p, timeZone, locale));

describe('elevationBand (FR-GUIDE-1)', () => {
  it('names the four bands with each boundary in the higher band (D-32)', () => {
    expect(elevationBand(10)).toBe('low');
    expect(elevationBand(24.9)).toBe('low');
    expect(elevationBand(25)).toBe('mid');
    expect(elevationBand(49.9)).toBe('mid');
    expect(elevationBand(50)).toBe('high');
    expect(elevationBand(74.9)).toBe('high');
    expect(elevationBand(75)).toBe('overhead');
    expect(elevationBand(90)).toBe('overhead');
  });
});

describe('brightnessBand (FR-GUIDE-3)', () => {
  it('uses the five bands with each boundary in the brighter band', () => {
    expect(brightnessBand(-4)).toBe('venus');
    expect(brightnessBand(-4.5)).toBe('venus');
    expect(brightnessBand(-3.9)).toBe('any-star');
    expect(brightnessBand(-1.4)).toBe('any-star');
    expect(brightnessBand(-1.3)).toBe('bright-star');
    expect(brightnessBand(1)).toBe('bright-star');
    expect(brightnessBand(1.1)).toBe('average-star');
    expect(brightnessBand(3)).toBe('average-star');
    expect(brightnessBand(3.1)).toBe('faint');
  });

  it('is worded by each catalog, never here', () => {
    expect(en.guide.startReason.horizon).toBe('appears');
    expect(es.guide.startReason.horizon).toBe('aparece');
    expect(en.guide.endReason.shadow).toBe("disappears into Earth's shadow");
    expect(es.guide.endReason.shadow).toBe('desaparece en la sombra de la Tierra');
  });
});

describe('guideParams', () => {
  it('returns keys and already-formatted numbers, and no sentence (FR-I18N-2)', () => {
    const p = guideParams(pass, null, 'en');
    expect(p).toMatchObject({
      startReason: 'horizon',
      startBand: 'low',
      startDir: 'NE',
      startTime: '09:48:14 UTC',
      peakDegrees: '10°',
      peakBand: 'low',
      endReason: 'horizon',
      endDir: 'ENE',
      brightness: 'bright-star',
      magnitude: '+0.5',
      twilight: true,
    });
    expect(guideParams(pass, null, 'es').magnitude).toBe('+0,5');
  });
});

describe('the guide sentence (US-6 AC1) on the first R1 golden pass in UTC', () => {
  it('matches the golden string for the pass as computed (horizon end, twilight = true), in both languages', () => {
    expect(pass.endReason).toBe('horizon');
    expect(pass.twilight).toBe(true);
    expect(sentence(pass, null, 'en')).toBe(golden.en.asComputed);
    expect(sentence(pass, null, 'es')).toBe(golden.es.asComputed);
  });

  it('matches one golden string per end reason without the twilight clause, in both languages', () => {
    const dark = (endReason: Pass['endReason']): Pass => ({ ...pass, endReason, twilight: false });
    for (const locale of ['en', 'es'] as const) {
      expect(sentence(dark('horizon'), null, locale)).toBe(golden[locale].endHorizon);
      expect(sentence(dark('shadow'), null, locale)).toBe(golden[locale].endShadow);
      expect(sentence(dark('twilight'), null, locale)).toBe(golden[locale].endTwilight);
    }
  });

  it('follows the US-6 example shape for a bright high pass ending in shadow', () => {
    const example: Pass = {
      ...pass,
      start: { t: Date.parse('2026-09-11T21:14:32Z'), azDeg: 247, elDeg: 10, rangeKm: 1500 },
      peak: { t: Date.parse('2026-09-11T21:17:50Z'), azDeg: 180, elDeg: 62, rangeKm: 500 },
      end: { t: Date.parse('2026-09-11T21:20:05Z'), azDeg: 67, elDeg: 30, rangeKm: 900 },
      endReason: 'shadow',
      peakMagnitude: -1.8,
      twilight: false,
    };
    expect(sentence(example, null, 'en')).toBe(
      "Appears low in the west-southwest at 21:14:32 UTC, climbs to 62° (high in the sky) in the south at 21:17:50 UTC, disappears into Earth's shadow in the east-northeast at 21:20:05 UTC. Brighter than any star (magnitude −1.8).",
    );
    // FR-I18N-3: the Spanish sentence describes the sky and addresses nobody.
    expect(sentence(example, null, 'es')).toBe(
      'Aparece bajo en el oeste-suroeste a las 21:14:32 UTC, sube a 62° (alto en el cielo) en el sur a las 21:17:50 UTC, desaparece en la sombra de la Tierra en el este-noreste a las 21:20:05 UTC. Más brillante que cualquier estrella (magnitud −1,8).',
    );
  });

  it('formats the times in the observer zone when one is known, in both languages', () => {
    expect(sentence(pass, 'America/Argentina/Buenos_Aires', 'en')).toContain('at 06:48:14 GMT-3,');
    expect(sentence(pass, 'America/Argentina/Buenos_Aires', 'es')).toContain('a las 06:48:14 GMT-3,');
  });
});
