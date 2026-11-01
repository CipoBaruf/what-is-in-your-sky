/**
 * R155 (FR-LOOK-3; D-974, D-983): the haze — the galactic frame the build's,
 * the three bands at their alphas, the rings through the instant's rotation,
 * and the band the antipode falls in drawn against the box.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MILKY_WAY_BANDS_DEG, MILKY_WAY_STRENGTH } from '../../../../../data/stars/constants';
import milkyWayJson from '../../../../../data/stars/milkyWay.json';
import { bandHalfWidthDeg, GALACTIC_POLE, galacticOf, galacticToEquatorial, HAZE_ALPHAS, hazeOpacity, hazePaths, MILKY_WAY_CORE, prepareHaze } from './milkyWay';
import { rotationMatrix, uprightRotation, WINDOW_FOV, type Mat3, type View } from './projection';
import { equatorialVector, horizonOf } from './skyFrame';

const view: View = { fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 };
/** The horizon frame as the equatorial one: azimuth from +y through +x, so a star's place is a plain function of its coordinates. */
const IDENTITY: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
/** The build script's constants, read from its source: the script runs under node and this file under jsdom, so it is not imported. */
const build = readFileSync('scripts/build-stars.ts', 'utf8');
const BUILD_POLE = /GALACTIC_POLE = \{ raDeg: ([\d.]+), decDeg: ([\d.]+), lNcpDeg: ([\d.]+) \}/.exec(build);
const BUILD_CORE = /MILKY_WAY_CORE = \{ widenDeg: ([\d.]+), scaleDeg: ([\d.]+) \}/.exec(build);
describe('the galactic frame', () => {
  it('is the build’s, and inverts galacticToEquatorial', () => {
    expect(BUILD_POLE?.slice(1, 4).map(Number)).toEqual([GALACTIC_POLE.raDeg, GALACTIC_POLE.decDeg, GALACTIC_POLE.lNcpDeg]);
    expect(BUILD_CORE?.slice(1, 3).map(Number)).toEqual([MILKY_WAY_CORE.widenDeg, MILKY_WAY_CORE.scaleDeg]);
    for (const [l, b] of [
      [0, 0],
      [90, 30],
      [180, -45],
      [270, 10],
      [33.3, -2.5],
    ]) {
      const { raDeg, decDeg } = galacticToEquatorial(l ?? 0, b ?? 0);
      const back = galacticOf(raDeg, decDeg);
      expect(back.bDeg).toBeCloseTo(b ?? 0, 6);
      expect(((back.lDeg - (l ?? 0)) % 360 + 360) % 360).toBeCloseTo(0, 6);
    }
    // The galactic centre is in Sagittarius; the north galactic pole is in Coma Berenices.
    expect(galacticOf(266.405, -28.936).bDeg).toBeCloseTo(0, 2);
    expect(galacticOf(192.859, 27.128).bDeg).toBeCloseTo(90, 2);
  });

  it('widens each band toward the core by the build’s rule', () => {
    expect(bandHalfWidthDeg(0, 0)).toBeCloseTo((MILKY_WAY_BANDS_DEG[0] ?? 0) + 3, 10);
    expect(bandHalfWidthDeg(2, 180)).toBeCloseTo(MILKY_WAY_BANDS_DEG[2] ?? 0, 3);
    expect(bandHalfWidthDeg(1, 55)).toBeCloseTo((MILKY_WAY_BANDS_DEG[1] ?? 0) + 3 / Math.E, 10);
    expect(bandHalfWidthDeg(1, 305)).toBeCloseTo(bandHalfWidthDeg(1, 55), 10);
  });
});

describe('the haze (FR-LOOK-3)', () => {
  it('is three bands at 0.03, 0.04 and 0.05 × MILKY_WAY_STRENGTH, outermost first', () => {
    expect(HAZE_ALPHAS).toEqual([0.03, 0.04, 0.05]);
    expect(MILKY_WAY_STRENGTH).toBe(0.6);
    expect([0, 1, 2].map(hazeOpacity)).toEqual([0.018, 0.024, 0.03]);
  });

  it('turns the outline’s rings through the frame once, each point where the frame puts it', () => {
    const m = rotationMatrix(37, -41, 120);
    const haze = prepareHaze(milkyWayJson.bands, m);
    expect(haze.rings).toHaveLength(3);
    expect(haze.rings.map((ring) => ring.azDeg.length)).toEqual(milkyWayJson.bands.map((ring) => ring.length));
    const first = milkyWayJson.bands[0]?.[0] ?? [0, 0];
    const h = horizonOf([
      m[0][0] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[0] + m[0][1] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[1] + m[0][2] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[2],
      m[1][0] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[0] + m[1][1] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[1] + m[1][2] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[2],
      m[2][0] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[0] + m[2][1] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[1] + m[2][2] * equatorialVector(first[0] ?? 0, first[1] ?? 0)[2],
    ]);
    expect(haze.rings[0]?.azDeg[0]).toBeCloseTo(h.azDeg, 9);
    expect(haze.rings[0]?.altDeg[0]).toBeCloseTo(h.altDeg, 9);
    // The two probes are two points of the plane, opposite directions, off the seam.
    expect(haze.probes).toHaveLength(2);
    expect(haze.probes[0]?.v.map((n, i) => n + (haze.probes[1]?.v[i] ?? 0))).toEqual([expect.closeTo(0, 9), expect.closeTo(0, 9), expect.closeTo(0, 9)]);
  });

  it('draws three closed paths at the bands’ alphas, each against the box only where the antipode is inside the band', () => {
    const haze = prepareHaze(milkyWayJson.bands, IDENTITY);
    // Looking at the galactic pole: the antipode is the south galactic pole, outside every band.
    const pole = horizonOf(equatorialVector(GALACTIC_POLE.raDeg, GALACTIC_POLE.decDeg));
    const atPole = hazePaths(uprightRotation(pole.azDeg, pole.altDeg), view, haze);
    expect(atPole.map((p) => p.opacity)).toEqual([0.018, 0.024, 0.03]);
    for (const path of atPole) {
      expect(path.d.startsWith('M0 0H')).toBe(false);
      expect(path.d).toMatch(/^M-?[\d.]+ -?[\d.]+ (L-?[\d.]+ -?[\d.]+ )+Z$/);
    }
    // Looking away from the galactic centre: the antipode is the centre, inside all three bands.
    const centre = galacticToEquatorial(0, 0);
    const away = horizonOf(equatorialVector(centre.raDeg + 180, -centre.decDeg));
    const atAnticentre = hazePaths(uprightRotation(away.azDeg, away.altDeg), view, haze);
    for (const path of atAnticentre) expect(path.d.startsWith('M0 0H390.0V390.0H0Z')).toBe(true);
    // Looking away from a point 9° off the plane at the anticentre: the antipode is inside the widest band (12°) and no other.
    const edge = galacticToEquatorial(180, 9);
    const awayEdge = horizonOf(equatorialVector(edge.raDeg + 180, -edge.decDeg));
    const atEdge = hazePaths(uprightRotation(awayEdge.azDeg, awayEdge.altDeg), view, haze);
    expect(atEdge.map((p) => p.d.startsWith('M0 0H'))).toEqual([true, false, false]);
  });
});
