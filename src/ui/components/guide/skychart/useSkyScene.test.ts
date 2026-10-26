import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Observer } from '../../../../model';
import { useSkyScene, type SkySceneInput, type StarSource } from './useSkyScene';
import type { StarField } from './window/scene';

/**
 * FR-SKY-1, FR-SKY-8 / PLAN D-788, D-802 (R119): one scene per tick from the
 * observer, the instant and the toggle, through a source the page supplies;
 * the same inputs give the same object, a new instant a new one, and `[ stars ]`
 * off or no source gives a scene with no stars.
 */
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const catalog: StarField['catalog'] = { ra: [0], dec: [0], mag: [0], name: ['A'], desig: ['a'], con: ['Ori'], figures: [] };

function fakeSource(): StarSource & { positionsAt: ReturnType<typeof vi.fn> } {
  const positionsAt = vi.fn((_where: Pick<Observer, 'lat' | 'lon'>, t: number): StarField['positions'] => ({ altDeg: [t % 90], azDeg: [0], planets: [] }));
  return { catalog, positionsAt };
}

describe('useSkyScene (FR-SKY-1, FR-SKY-8; D-788, D-802)', () => {
  it('builds the scene from the source at the shown instant with every switch on, once per tick', () => {
    const source = fakeSource();
    const { result, rerender } = renderHook((input: SkySceneInput) => useSkyScene(input), { initialProps: { observer, now: 1_000, starsLayer: true, source } });
    const first = result.current;
    expect(first.stars?.catalog).toBe(catalog);
    expect(first.stars?.layers).toEqual({ stars: true, figures: true, planets: true, names: true });
    expect(source.positionsAt).toHaveBeenCalledWith({ lat: observer.lat, lon: observer.lon }, 1_000);
    // The same tick again — an observer object rebuilt with the same place — is the same scene.
    rerender({ observer: { ...observer }, now: 1_000, starsLayer: true, source });
    expect(result.current).toBe(first);
    expect(source.positionsAt).toHaveBeenCalledTimes(1);
    // A new instant is a new scene with the positions at it.
    rerender({ observer, now: 2_000, starsLayer: true, source });
    expect(result.current).not.toBe(first);
    expect(source.positionsAt).toHaveBeenLastCalledWith({ lat: observer.lat, lon: observer.lon }, 2_000);
  });

  it('carries no stars with the toggle off, without a source, or without an instant — and the same object each time', () => {
    const source = fakeSource();
    const { result, rerender } = renderHook((input: SkySceneInput) => useSkyScene(input), { initialProps: { observer, now: 1_000, starsLayer: false, source } });
    const none = result.current;
    expect(none).toEqual({ stars: null });
    rerender({ observer, now: 1_000, starsLayer: true, source: null });
    expect(result.current).toBe(none);
    rerender({ observer, now: undefined, starsLayer: true, source });
    expect(result.current).toBe(none);
    expect(source.positionsAt).not.toHaveBeenCalled();
    // Turned on, the stars appear at the shown instant.
    rerender({ observer, now: 1_000, starsLayer: true, source });
    expect(result.current.stars).not.toBeNull();
  });
});
