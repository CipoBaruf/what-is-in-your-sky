import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { drawnMagLimit, drawnRungs } from '../../../../lib/skyStars';
import type { Observer } from '../../../../model';
import { useSkyScene, type SkySceneInput, type StarSource } from './useSkyScene';
import type { StarField } from './window/scene';

type Positions = ReturnType<StarSource['positionsAt']>;

/**
 * FR-SKY-1, FR-SKY-8 / PLAN D-788, D-802 (R119): one scene per tick from the
 * observer, the instant and the toggle, through a source the page supplies;
 * the same inputs give the same object, a new instant a new one, and `[ stars ]`
 * off or no source gives a scene with no stars. R123 (FR-STAR-13, D-791): the
 * twilight steps, applied here and nowhere else.
 */
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const catalog: StarField['catalog'] = { ra: [0], dec: [0], mag: [0], name: ['A'], desig: ['a'], con: ['Ori'], figures: [] };

/** A dark sky: every rung drawn (FR-STAR-13). */
const NIGHT = -18;

function fakeSource(): StarSource & { positionsAt: ReturnType<typeof vi.fn> } {
  const positionsAt = vi.fn((_where: Pick<Observer, 'lat' | 'lon'>, t: number): Positions => ({ altDeg: [t % 90], azDeg: [0], planets: [], sunAltDeg: NIGHT }));
  return { catalog, positionsAt, drawnRungs, drawnMagLimit };
}

const input = (rest: Omit<SkySceneInput, 'observer'> & Partial<Pick<SkySceneInput, 'observer'>>): SkySceneInput => ({ observer, ...rest });

describe('useSkyScene (FR-SKY-1, FR-SKY-8; D-788, D-802)', () => {
  it('builds the scene from the source at the shown instant with every switch on, once per tick', () => {
    const source = fakeSource();
    const { result, rerender } = renderHook((props: SkySceneInput) => useSkyScene(props), { initialProps: input({ now: 1_000, starsLayer: true, source }) });
    const first = result.current;
    expect(first.stars?.catalog).toBe(catalog);
    // No names: the pass pages do not offer the layer (FR-SKY-3, OQ-45); a tap still names a star.
    expect(first.stars?.layers).toEqual({ stars: true, figures: true, planets: true, names: false });
    expect(source.positionsAt).toHaveBeenCalledWith({ lat: observer.lat, lon: observer.lon }, 1_000);
    // The same tick again — an observer object rebuilt with the same place — is the same scene.
    rerender(input({ observer: { ...observer }, now: 1_000, starsLayer: true, source }));
    expect(result.current).toBe(first);
    expect(source.positionsAt).toHaveBeenCalledTimes(1);
    // A new instant is a new scene with the positions at it.
    rerender(input({ now: 2_000, starsLayer: true, source }));
    expect(result.current).not.toBe(first);
    expect(source.positionsAt).toHaveBeenLastCalledWith({ lat: observer.lat, lon: observer.lon }, 2_000);
  });

  it('carries no stars with the toggle off, without a source, or without an instant — and the same object each time', () => {
    const source = fakeSource();
    const { result, rerender } = renderHook((props: SkySceneInput) => useSkyScene(props), { initialProps: input({ now: 1_000, starsLayer: false, source }) });
    const none = result.current;
    expect(none).toEqual({ stars: null });
    rerender(input({ now: 1_000, starsLayer: true, source: null }));
    expect(result.current).toBe(none);
    rerender(input({ now: undefined, starsLayer: true, source }));
    expect(result.current).toBe(none);
    expect(source.positionsAt).not.toHaveBeenCalled();
    // Turned on, the stars appear at the shown instant.
    rerender(input({ now: 1_000, starsLayer: true, source }));
    expect(result.current.stars).not.toBeNull();
  });

  it('holds the scene for a source rebuilt inline with the same fields, and hands out frozen shared objects', () => {
    const source = fakeSource();
    const { result, rerender } = renderHook((props: SkySceneInput) => useSkyScene(props), { initialProps: input({ now: 1_000, starsLayer: true, source }) });
    const first = result.current;
    rerender(input({ now: 1_000, starsLayer: true, source: { ...source } }));
    expect(result.current).toBe(first);
    expect(source.positionsAt).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(first.stars?.layers)).toBe(true);
    rerender(input({ now: 1_000, starsLayer: false, source }));
    expect(Object.isFrozen(result.current)).toBe(true);
  });

  /*
   * R123 (FR-STAR-13 as amended, FR-SKY-3; D-791, D-814): the twilight steps applied once, in the scene, so no view
   * changes for them — every rung at −6° and below, the first two and the planets up to 0°, nothing above — over the
   * real `skyStars.ts` functions, at PLAN §9.7's four altitudes. The Sun is the positions' own, at the scene's
   * instant, so the step follows the shown `t` however fast it runs (R123 review).
   */
  describe('the twilight steps (FR-STAR-13, D-791)', () => {
    // In D-748's magnitude order, one star on each of the ladder's five rungs (0.5, 1.5, 2.5, 3.5, the rest).
    const ladder: StarField['catalog'] = {
      ra: [0, 10, 20, 30, 40],
      dec: [0, 0, 0, 0, 0],
      mag: [0, 1, 2, 3, 4],
      name: ['A', 'B', 'C', 'D', 'E'],
      desig: ['a', 'b', 'c', 'd', 'e'],
      con: ['Ori', 'Ori', 'Ori', 'Ori', 'Ori'],
      figures: [{ con: 'Ori', part: '', segments: [[0, 4]] }],
    };
    const planets: StarField['positions']['planets'] = [{ body: 'Venus', azDeg: 270, altDeg: 10, mag: -4 }];
    const positions = (sunAltDeg: number): Positions => ({ altDeg: [10, 20, 30, 40, 50], azDeg: [0, 0, 0, 0, 0], planets, sunAltDeg });
    // The Sun at `t` is `t`'s own here: the step reads it from the positions at the scene's instant.
    const source: StarSource = { catalog: ladder, positionsAt: (_where, t) => positions(t), drawnRungs, drawnMagLimit };
    const at = (sunAltDeg: number) => renderHook(() => useSkyScene({ observer, now: sunAltDeg, starsLayer: true, source })).result.current;

    it('draws the whole field, the figures and the planets at −18° and at −6°', () => {
      for (const sun of [-18, -6]) {
        const field = at(sun).stars;
        expect(field?.catalog).toBe(ladder);
        expect(field?.layers).toEqual({ stars: true, figures: true, planets: true, names: false });
      }
    });

    it('draws the first two rungs and every planet at −3°, and no figure', () => {
      const field = at(-3).stars;
      expect(Array.from(field?.catalog.mag ?? [])).toEqual([0, 1]);
      expect(field?.catalog.name).toEqual(['A', 'B']);
      expect(field?.catalog.figures).toEqual([]);
      expect(field?.layers).toEqual({ stars: true, figures: false, planets: true, names: false });
      // The positions stay whole: a view counts its stars by the catalogue's length.
      expect(Array.from(field?.positions.altDeg ?? [])).toHaveLength(5);
      // The cut is made once per catalogue and limit, so a view's memo on the catalogue holds from tick to tick.
      expect(at(-2).stars?.catalog).toBe(field?.catalog);
    });

    it('draws nothing at +1°', () => {
      expect(at(1)).toEqual({ stars: null });
    });

    it('steps with the shown instant itself: a scrub from night into day thins and then empties the field at once', () => {
      const { result, rerender } = renderHook((now: number) => useSkyScene({ observer, now, starsLayer: true, source }), { initialProps: -20 });
      expect(result.current.stars?.catalog).toBe(ladder);
      rerender(-5);
      expect(result.current.stars?.catalog.mag).toHaveLength(2);
      rerender(5);
      expect(result.current).toEqual({ stars: null });
    });
  });
});
