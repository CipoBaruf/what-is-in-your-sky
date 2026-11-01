/**
 * R155 (FR-LOOK-8, FR-LOOK-9; D-974, D-983): the deep stars' pool — the
 * catalogue through the frame once with each star's dot ready, and per frame
 * the stars to the field's magnitude that are up and in the box, brightest
 * first, at most the pool, none within the collision distance of a mark.
 */
import { describe, expect, it } from 'vitest';
import { DEEP_NODE_POOL } from '../../../../../data/stars/constants';
import { parseDeepCatalog } from '../../../../../data/stars/deepChunk';
import { deepFrame, prepareDeep, reachOf } from './deepField';
import { project, uprightRotation, WINDOW_FOV, type Mat3, type View } from './projection';
import { horizonOf, equatorialVector } from './skyFrame';
import { COLLISION_PX } from './starGlyphs';

const view: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };
const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
/** Under the identity frame a star at right ascension `ra` and declination `dec` has azimuth 90 − ra (from +y through +x) and altitude `dec`. */
const at = (azDeg: number, altDeg: number): [number, number] => [((90 - azDeg) % 360 + 360) % 360, altDeg];

/** Seven deep stars in magnitude order: five around S 35° up, one below the horizon, one behind the camera. */
const STARS: { ra: number; dec: number; mag: number; bv: number }[] = [
  { ...rd(at(180, 35)), mag: 4.6, bv: -0.1 }, // 0: the centre
  { ...rd(at(180, 40)), mag: 4.8, bv: 0.2 }, // 1: 5° up
  { ...rd(at(185, 35)), mag: 5.2, bv: 0.6 }, // 2: to the side
  { ...rd(at(180.3, 35)), mag: 5.4, bv: 1.1 }, // 3: 0.3° from 0, collides with it
  { ...rd(at(175, 30)), mag: 6.1, bv: 0.3 }, // 4: in the box, faint
  { ...rd(at(180, -5)), mag: 4.7, bv: 0.3 }, // 5: below the horizon
  { ...rd(at(0, 35)), mag: 4.9, bv: 0.3 }, // 6: behind the camera
].sort((a, b) => a.mag - b.mag);
function rd([az, alt]: [number, number]): { ra: number; dec: number } {
  return { ra: az, dec: alt };
}
const deep = parseDeepCatalog({ ra: STARS.map((s) => Math.round(s.ra * 100)), dec: STARS.map((s) => Math.round(s.dec * 100)), mag: STARS.map((s) => Math.round(s.mag * 10)), bv: STARS.map((s) => Math.round(s.bv * 10)) });
const m = uprightRotation(180, 35);

describe('prepareDeep', () => {
  it('rotates every star once and fixes its dot: radius and opacity from the magnitude, tone from B−V', () => {
    const prepared = prepareDeep(deep, IDENTITY);
    expect(prepared.size).toBe(7);
    expect(Array.from(prepared.mag)).toEqual(STARS.map((s) => Math.round(s.mag * 10) / 10).map((n) => Math.fround(n)));
    const centre = STARS.findIndex((s) => s.mag === 4.6);
    expect(prepared.azDeg[centre]).toBeCloseTo(180, 3);
    expect(prepared.altDeg[centre]).toBeCloseTo(35, 3);
    expect(prepared.tone[centre]).toBe('chart-star-blue');
    expect(prepared.r[centre]).toBeCloseTo(1.46, 2);
    expect(prepared.opacity[centre]).toBeCloseTo(0.68, 2);
    const faint = STARS.findIndex((s) => s.mag === 6.1);
    expect(prepared.tone[faint]).toBe('chart-star');
    expect(prepared.opacity[faint]).toBeCloseTo(0.38, 2);
    const h = horizonOf(equatorialVector(deep.ra[centre] ?? 0, deep.dec[centre] ?? 0));
    expect(prepared.x[centre]).toBeCloseTo(Math.sin((h.azDeg * Math.PI) / 180) * Math.cos((h.altDeg * Math.PI) / 180), 5);
  });
});

describe('reachOf', () => {
  it('is one past the last star at the limit or brighter, in the sorted column', () => {
    expect(reachOf([4.6, 4.7, 5.3, 5.3, 6.5], 4.5)).toBe(0);
    expect(reachOf([4.6, 4.7, 5.3, 5.3, 6.5], 4.7)).toBe(2);
    expect(reachOf([4.6, 4.7, 5.3, 5.3, 6.5], 5.3)).toBe(4);
    expect(reachOf([4.6, 4.7, 5.3, 5.3, 6.5], 9)).toBe(5);
    expect(reachOf([], 6)).toBe(0);
  });
});

describe('deepFrame (FR-LOOK-9)', () => {
  const prepared = prepareDeep(deep, IDENTITY);
  const index = (mag: number): number => STARS.findIndex((s) => s.mag === mag);

  it('draws the stars to the limit that are up, in front and in the box, brightest first, where the projection puts them, the fainter of a close pair dropped', () => {
    const drawn = deepFrame(m, view, prepared, 6.5, []);
    expect(drawn.map((d) => d.index)).toEqual([index(4.6), index(4.8), index(5.2), index(6.1)]);
    const p = project(m, 180, 40, view);
    expect(drawn[1]?.x).toBeCloseTo(p.x, 6);
    expect(drawn[1]?.y).toBeCloseTo(p.y, 6);
    expect(drawn[0]?.x).toBeCloseTo(195, 6);
  });

  it('stops at the field’s magnitude, so the 60° row draws to 5.3 and the 75° row nothing past 4.5', () => {
    expect(deepFrame(m, view, prepared, 5.3, []).map((d) => d.index)).toEqual([index(4.6), index(4.8), index(5.2)]);
    expect(deepFrame(m, view, prepared, 4.5, [])).toEqual([]);
  });

  it('drops a deep star within the collision distance of a bright mark, and fills no more than the pool', () => {
    const centre = project(m, 180, 35, view);
    const kept = [{ x: centre.x + COLLISION_PX - 1, y: centre.y }];
    expect(deepFrame(m, view, prepared, 6.5, kept).map((d) => d.index)).toEqual([index(4.8), index(5.2), index(6.1)]);
    expect(deepFrame(m, view, prepared, 6.5, [], 2).map((d) => d.index)).toEqual([index(4.6), index(4.8)]);
    expect(deepFrame(m, view, prepared, 6.5, [], 0)).toEqual([]);
    expect(DEEP_NODE_POOL).toBe(600);
  });

  it('culls by the angle from the look direction before projecting: a star behind the camera is never in the frame', () => {
    const turned = uprightRotation(0, 35);
    const drawn = deepFrame(turned, view, prepared, 6.5, []);
    expect(drawn.map((d) => d.index)).toEqual([index(4.9)]);
  });
});
