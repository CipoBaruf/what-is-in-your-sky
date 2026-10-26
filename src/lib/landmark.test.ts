import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { starCatalog } from '../data/stars/catalog';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { LADDER } from '../ui/components/guide/skychart/window/starGlyphs';
import { AMONG_MAX_DEG, constellationAt, drawnRungs, landmark, LANDMARK_DEG, LANDMARK_LEVEL_DEG, LANDMARK_MAG, segmentDistanceDeg, type SkyPoint } from './landmark';
import { angularDistanceDeg } from './skyGeometry';
import { constellationName, drawnMagLimit, planetsDrawn, starName, starsAt } from './skyStars';
import { RUNG_MAX_MAG } from './starRungs';

/**
 * R120, FR-SKY-11, FR-SKY-12, FR-STAR-13, FR-STAR-14 (D-795): the landmark,
 * the constellation at a point, the distance to a figure's line and the
 * twilight steps — hand cases for every branch, then the three R1 sites
 * (`tests/fixtures/stars/`), where the published positions stand in for the
 * peak and the point and the app's positions for the stars.
 */
const FIXTURE_TOLERANCE_DEG = 0.25; // skyStars.test.ts's STAR_TOLERANCE_DEG
const DIR = new URL('../../tests/fixtures/stars/', import.meta.url);

interface Fixture {
  site: string;
  observer: { lat: number; lon: number };
  instant: string;
  stars: { name: string; altDeg: number; azDeg: number }[];
}

const fixtures: Fixture[] = readdirSync(DIR)
  .filter((f) => /Z\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Fixture);

const catalog = starCatalog();

const sep = (a: SkyPoint, b: SkyPoint): number => angularDistanceDeg({ azDeg: a.azDeg, elDeg: a.altDeg }, { azDeg: b.azDeg, elDeg: b.altDeg });

/** A hand-made sky: star `i` at `points[i]` with `mags[i]`, brightest first as the catalogue is. */
const sky = (stars: { mag: number; at: SkyPoint }[]) => ({
  mag: stars.map((s) => s.mag),
  altDeg: stars.map((s) => s.at.altDeg),
  azDeg: stars.map((s) => s.at.azDeg),
});

const ALL = RUNG_MAX_MAG.length;

describe('segmentDistanceDeg', () => {
  const a = { azDeg: 80, altDeg: 30 };
  const b = { azDeg: 100, altDeg: 30 };

  it('is 0 on the line and at its ends', () => {
    expect(segmentDistanceDeg(a, a, b)).toBeCloseTo(0, 9);
    expect(segmentDistanceDeg(b, a, b)).toBeCloseTo(0, 9);
    expect(segmentDistanceDeg({ azDeg: 0, altDeg: 10 }, { azDeg: 0, altDeg: 0 }, { azDeg: 0, altDeg: 40 })).toBeCloseTo(0, 9);
  });

  it('is the perpendicular when its foot falls between the ends', () => {
    // Along the horizon the great circle is the horizon itself: 5° up from its middle is 5° away.
    expect(segmentDistanceDeg({ azDeg: 90, altDeg: 5 }, { azDeg: 80, altDeg: 0 }, { azDeg: 100, altDeg: 0 })).toBeCloseTo(5, 9);
    expect(segmentDistanceDeg({ azDeg: 90, altDeg: -5 }, { azDeg: 80, altDeg: 0 }, { azDeg: 100, altDeg: 0 })).toBeCloseTo(5, 9);
    // Either way round.
    expect(segmentDistanceDeg({ azDeg: 90, altDeg: 5 }, { azDeg: 100, altDeg: 0 }, { azDeg: 80, altDeg: 0 })).toBeCloseTo(5, 9);
  });

  it('is the nearer end when the foot falls outside the line', () => {
    const p = { azDeg: 110, altDeg: 0 };
    expect(segmentDistanceDeg(p, { azDeg: 80, altDeg: 0 }, { azDeg: 100, altDeg: 0 })).toBeCloseTo(10, 9);
    expect(segmentDistanceDeg({ azDeg: 60, altDeg: 3 }, a, b)).toBeCloseTo(sep({ azDeg: 60, altDeg: 3 }, a), 9);
  });

  it('is the distance to the point when the line is one', () => {
    expect(segmentDistanceDeg({ azDeg: 0, altDeg: 50 }, a, a)).toBeCloseTo(sep({ azDeg: 0, altDeg: 50 }, a), 9);
  });

  it('crosses north without a seam', () => {
    expect(segmentDistanceDeg({ azDeg: 0, altDeg: 4 }, { azDeg: 350, altDeg: 0 }, { azDeg: 10, altDeg: 0 })).toBeCloseTo(4, 9);
  });
});

describe('landmark', () => {
  const peak = { azDeg: 180, altDeg: 40 };

  it('picks the nearest star within LANDMARK_DEG, and says which way the peak lies', () => {
    const stars = sky([
      { mag: 0.1, at: { azDeg: 180, altDeg: 30 } }, // 10° below the peak
      { mag: 1.0, at: { azDeg: 180, altDeg: 47 } }, // 7° above the peak: the nearest
      { mag: 2.0, at: { azDeg: 191, altDeg: 40 } },
    ]);
    const got = landmark(stars, peak, ALL);
    expect(got?.index).toBe(1);
    expect(got?.sepDeg).toBeCloseTo(7, 9);
    expect(got?.word).toBe('below');
    expect(landmark(sky([{ mag: 0.1, at: { azDeg: 180, altDeg: 33 } }]), peak, ALL)).toMatchObject({ index: 0, word: 'above' });
  });

  it(`is beside within ${String(LANDMARK_LEVEL_DEG)}° of altitude, above or below from it`, () => {
    const at = (altDeg: number) => landmark(sky([{ mag: 1, at: { azDeg: 186, altDeg } }]), peak, ALL)?.word;
    expect(at(40)).toBe('beside');
    expect(at(40 - LANDMARK_LEVEL_DEG + 0.01)).toBe('beside');
    expect(at(40 + LANDMARK_LEVEL_DEG - 0.01)).toBe('beside');
    expect(at(40 - LANDMARK_LEVEL_DEG)).toBe('above');
    expect(at(40 + LANDMARK_LEVEL_DEG)).toBe('below');
  });

  it(`is null past ${String(LANDMARK_DEG)}°, and counts ${String(LANDMARK_DEG)}° itself`, () => {
    expect(landmark(sky([{ mag: 0, at: { azDeg: 180, altDeg: 40 + LANDMARK_DEG + 0.01 } }]), peak, ALL)).toBeNull();
    expect(landmark(sky([{ mag: 0, at: { azDeg: 180, altDeg: 40 + LANDMARK_DEG } }]), peak, ALL)?.index).toBe(0);
    expect(landmark(sky([]), peak, ALL)).toBeNull();
  });

  it(`skips a star fainter than ${String(LANDMARK_MAG)} even when it is nearer`, () => {
    const stars = sky([
      { mag: 2.5, at: { azDeg: 180, altDeg: 50 } },
      { mag: 2.51, at: { azDeg: 180, altDeg: 41 } },
    ]);
    expect(landmark(stars, peak, ALL)?.index).toBe(0);
  });

  it('looks at every star, so an input out of brightness order loses none', () => {
    const stars = sky([
      { mag: 3.0, at: { azDeg: 180, altDeg: 41 } }, // fainter than LANDMARK_MAG, first
      { mag: 1.0, at: { azDeg: 180, altDeg: 45 } },
      { mag: 2.0, at: { azDeg: 180, altDeg: 37 } }, // the nearest bright one, last
    ]);
    expect(landmark(stars, peak, ALL)).toMatchObject({ index: 2, word: 'above' });
  });

  it('picks only among the rungs the twilight draws, and none in daylight', () => {
    const stars = sky([
      { mag: 1.5, at: { azDeg: 180, altDeg: 51 } },
      { mag: 1.6, at: { azDeg: 180, altDeg: 41 } },
    ]);
    expect(landmark(stars, peak, ALL)?.index).toBe(1);
    expect(landmark(stars, peak, 2)?.index).toBe(0);
    expect(landmark(stars, peak, 0)).toBeNull();
  });

  it('skips a star under the horizon', () => {
    const low = { azDeg: 180, altDeg: 3 };
    const stars = sky([
      { mag: 0, at: { azDeg: 180, altDeg: -1 } },
      { mag: 1, at: { azDeg: 180, altDeg: 9 } },
    ]);
    expect(landmark(stars, low, ALL)?.index).toBe(1);
  });

  it('gives a tie to the brighter', () => {
    const stars = sky([
      { mag: 0.5, at: { azDeg: 175, altDeg: 40 } },
      { mag: 0.4, at: { azDeg: 185, altDeg: 40 } },
    ]);
    // Equal distances go to the lower magnitude whichever comes first.
    expect(landmark(sky([{ mag: 0.4, at: { azDeg: 185, altDeg: 40 } }, { mag: 0.5, at: { azDeg: 175, altDeg: 40 } }]), peak, ALL)?.index).toBe(0);
    expect(landmark(stars, peak, ALL)?.index).toBe(1);
  });
});

describe('constellationAt', () => {
  // Two figures on the horizon's great circle, one at 80–100° and one at 120–130°.
  const positions = { azDeg: [80, 100, 120, 130], altDeg: [0, 0, 0, 0] };
  const figures = [
    { con: 'Ori', part: 0, segments: [0, 1] },
    { con: 'Ser', part: 1, segments: [2, 3] },
  ];

  it('names the figure with the nearest line', () => {
    expect(constellationAt({ azDeg: 90, altDeg: 4 }, figures, positions)).toMatchObject({ con: 'Ori', part: 0 });
    expect(constellationAt({ azDeg: 90, altDeg: 4 }, figures, positions)?.deg).toBeCloseTo(4, 9);
    expect(constellationAt({ azDeg: 125, altDeg: 2 }, figures, positions)).toMatchObject({ con: 'Ser', part: 1 });
  });

  it('takes the nearer of two figures for a point between them', () => {
    expect(constellationAt({ azDeg: 109, altDeg: 0 }, figures, positions)?.con).toBe('Ori');
    expect(constellationAt({ azDeg: 111, altDeg: 0 }, figures, positions)?.con).toBe('Ser');
  });

  it(`is null past ${String(AMONG_MAX_DEG)}°, and counts ${String(AMONG_MAX_DEG)}° itself`, () => {
    expect(constellationAt({ azDeg: 90, altDeg: AMONG_MAX_DEG + 0.01 }, figures, positions)).toBeNull();
    expect(constellationAt({ azDeg: 90, altDeg: AMONG_MAX_DEG }, figures, positions)?.con).toBe('Ori');
    expect(constellationAt({ azDeg: 90, altDeg: 0 }, [], positions)).toBeNull();
  });

  it('names a point under the horizon like any other', () => {
    expect(constellationAt({ azDeg: 90, altDeg: -3 }, figures, positions)?.con).toBe('Ori');
  });
});

describe('the twilight steps (FR-STAR-13, FR-SKY-3)', () => {
  it('draws every rung at −18° and −6°, the first two at −3° and 0°, none at +1°', () => {
    expect(drawnRungs(-18)).toBe(ALL);
    expect(drawnRungs(-6)).toBe(ALL);
    expect(drawnRungs(-5.99)).toBe(2);
    expect(drawnRungs(-3)).toBe(2);
    expect(drawnRungs(0)).toBe(2);
    expect(drawnRungs(1)).toBe(0);
    expect(drawnRungs(-7, { sunAltMaxDeg: -8 })).toBe(2);
  });

  it('draws nothing for a Sun altitude that is not a number, as the planets', () => {
    expect(drawnRungs(NaN)).toBe(0);
    expect(planetsDrawn(NaN)).toBe(false);
  });

  it("reads −6° from the threshold skyStateOf calls day", () => {
    expect(DEFAULT_THRESHOLDS.sunAltMaxDeg).toBe(-6);
    expect(drawnRungs(DEFAULT_THRESHOLDS.sunAltMaxDeg)).toBe(ALL);
  });

  it('draws the planets up to 0°', () => {
    expect(planetsDrawn(-18)).toBe(true);
    expect(planetsDrawn(-3)).toBe(true);
    expect(planetsDrawn(0)).toBe(true);
    expect(planetsDrawn(1)).toBe(false);
  });

  it("has starGlyphs' ladder, rung by rung, and turns rungs into a magnitude", () => {
    expect(RUNG_MAX_MAG).toEqual(LADDER.map((row) => row.maxMag));
    expect(drawnMagLimit(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(drawnMagLimit(2)).toBe(1.5);
    expect(drawnMagLimit(3)).toBe(LANDMARK_MAG);
    expect(drawnMagLimit(ALL)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('the three R1 sites', () => {
  /** The worst gap between the app's separation and the published one, per check; the Done note carries them. */
  let worstLandmark = 0;
  let worstAmong = 0;

  it('has the three sites', () => {
    expect(fixtures.map((f) => f.site)).toEqual(['neuquen', 'paris', 'singapore']);
  });

  for (const fx of fixtures) {
    const at = starsAt(catalog, fx.observer, Date.parse(fx.instant));
    const stars = { mag: catalog.mag, altDeg: at.altDeg, azDeg: at.azDeg };
    const bright = fx.stars.map((s) => ({ ...s, i: catalog.name.indexOf(s.name) })).filter((s) => (catalog.mag[s.i] ?? Infinity) <= LANDMARK_MAG);

    it(`${fx.site}: a peak near each bright fixture star has it as the landmark, at the published separation`, () => {
      expect(bright.length).toBeGreaterThanOrEqual(4);
      let picked = 0;
      for (const s of bright) {
        for (const [dAlt, word] of [
          [3, 'above'],
          [1, 'beside'],
          [-3, 'below'],
        ] as const) {
          const peak = { azDeg: s.azDeg, altDeg: s.altDeg + dAlt };
          const got = landmark(stars, peak, ALL);
          if (got === null) throw new Error(`${fx.site} ${s.name}: a landmark`);
          const published = sep(peak, s);
          if (got.index !== s.i) {
            // A brighter neighbour nearer the peak wins (Hadar beside Rigil Kentaurus, Merak beside Dubhe).
            expect(got.sepDeg, `${fx.site} ${s.name} ${String(dAlt)}`).toBeLessThan(published + FIXTURE_TOLERANCE_DEG);
            continue;
          }
          expect(got.word, `${fx.site} ${s.name} ${String(dAlt)}`).toBe(word);
          const gap = Math.abs(got.sepDeg - published);
          expect(gap, `${fx.site} ${s.name}`).toBeLessThanOrEqual(FIXTURE_TOLERANCE_DEG);
          worstLandmark = Math.max(worstLandmark, gap);
          picked += 1;
        }
      }
      expect(picked).toBeGreaterThanOrEqual(Math.ceil(bright.length * 3 * 0.8));
    });

    it(`${fx.site}: each fixture star a figure ends on is among its figure, within the tolerance`, () => {
      let named = 0;
      for (const s of fx.stars) {
        const i = catalog.name.indexOf(s.name);
        const own = catalog.figures.filter((f) => f.segments.includes(i)).map((f) => f.con);
        if (own.length === 0) continue;
        const got = constellationAt(s, catalog.figures, at);
        expect(own, `${fx.site} ${s.name}`).toContain(got?.con);
        expect(got?.deg ?? NaN, `${fx.site} ${s.name}`).toBeLessThanOrEqual(FIXTURE_TOLERANCE_DEG);
        worstAmong = Math.max(worstAmong, got?.deg ?? NaN);
        named += 1;
      }
      expect(named).toBeGreaterThanOrEqual(10);
    });
  }

  it('reads Aldebaran in Taurus at Paris in both languages', () => {
    const fx = fixtures.find((f) => f.site === 'paris');
    const s = fx?.stars.find((x) => x.name === 'Aldebaran');
    if (fx === undefined || s === undefined) throw new Error('the Paris fixture has Aldebaran');
    const at = starsAt(catalog, fx.observer, Date.parse(fx.instant));
    const peak = { azDeg: s.azDeg, altDeg: s.altDeg + 7 };
    const got = landmark({ mag: catalog.mag, altDeg: at.altDeg, azDeg: at.azDeg }, peak, ALL);
    if (got === null) throw new Error('a landmark');
    expect(Math.round(got.sepDeg)).toBe(7);
    expect(got.word).toBe('above');
    expect([starName(catalog, got.index, 'en'), starName(catalog, got.index, 'es')]).toEqual(['Aldebaran', 'Aldebarán']);
    const among = constellationAt(peak, catalog.figures, at);
    expect(among?.con).toBe('Tau');
    expect([constellationName(catalog, 'Tau', 'en'), constellationName(catalog, 'Tau', 'es')]).toEqual(['Taurus', 'Tauro']);
  });

  it('stays within the tolerance at worst', () => {
    console.info(`R120 fixture worst: landmark separation ${worstLandmark.toFixed(4)}°, Among column ${worstAmong.toFixed(4)}°`);
    expect(worstLandmark).toBeLessThanOrEqual(FIXTURE_TOLERANCE_DEG);
    expect(worstAmong).toBeLessThanOrEqual(FIXTURE_TOLERANCE_DEG);
  });
});
