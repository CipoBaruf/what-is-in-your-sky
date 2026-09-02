/**
 * TASKS R12 (US-5 AC2, spec §8 rank 1): "best first" ranks by brightness ×
 * elevation with a chronological tie-break, "chronological" by start; the
 * hero pass is the earliest featured pass that has not ended.
 */
import { describe, expect, it } from 'vitest';
import type { Pass } from '../model';
import { bestScore, isPassSort, nextFeaturedPass, sortPasses } from './passSort';

const T0 = 1_789_120_000_000;
function pass(id: string, noradId: number, startOffsetS: number, elDeg: number, magnitude: number): Pass {
  const start = T0 + startOffsetS * 1000;
  return {
    id,
    noradId,
    name: id,
    start: { t: start, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: start + 120_000, azDeg: 250, elDeg, rangeKm: 800 },
    end: { t: start + 240_000, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 240,
    peakMagnitude: magnitude,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: T0,
  };
}

// Three passes: a faint high one first, a bright low ISS one second, an average one last.
const faintHigh = pass('faint-high', 2, 0, 80, 2.0);
const issLow = pass('iss-low', 25544, 600, 25, -2.0);
const average = pass('average', 3, 1200, 45, 0.5);
const three = [faintHigh, issLow, average];

describe('bestScore', () => {
  it('is brightness (flux relative to magnitude 0) times peak elevation', () => {
    expect(bestScore(pass('m0', 1, 0, 50, 0))).toBeCloseTo(50, 9);
    expect(bestScore(pass('m-2.5', 1, 0, 50, -2.5))).toBeCloseTo(500, 6); // 2.5 mag brighter = 10× the flux
    expect(bestScore(pass('m2.5', 1, 0, 50, 2.5))).toBeCloseTo(5, 6);
  });
});

describe('sortPasses', () => {
  it('chronological is by start time; best is by score, ties by start; neither mutates the input', () => {
    const shuffled = [average, faintHigh, issLow];
    expect(sortPasses(shuffled, 'chronological').map((p) => p.id)).toEqual(['faint-high', 'iss-low', 'average']);
    // iss-low: 10^0.8 · 25 ≈ 158; average: 10^-0.2 · 45 ≈ 28.4; faint-high: 10^-0.8 · 80 ≈ 12.7.
    expect(sortPasses(shuffled, 'best').map((p) => p.id)).toEqual(['iss-low', 'average', 'faint-high']);
    expect(shuffled.map((p) => p.id)).toEqual(['average', 'faint-high', 'iss-low']);
    const twin = { ...faintHigh, id: 'twin', start: { ...faintHigh.start, t: faintHigh.start.t + 1000 } };
    expect(sortPasses([twin, faintHigh], 'best').map((p) => p.id)).toEqual(['faint-high', 'twin']);
  });
});

describe('nextFeaturedPass', () => {
  const featured = (noradId: number): boolean => noradId === 25544;
  it('is the earliest featured pass that has not ended, or null', () => {
    expect(nextFeaturedPass(three, featured, T0)?.id).toBe('iss-low');
    const issLater = pass('iss-later', 25544, 3000, 60, -3);
    expect(nextFeaturedPass([issLater, ...three], featured, T0)?.id).toBe('iss-low');
    expect(nextFeaturedPass([issLater, ...three], featured, issLow.end.t)?.id).toBe('iss-later'); // the first one has ended
    expect(nextFeaturedPass([issLater, ...three], featured, issLow.end.t - 1)?.id).toBe('iss-low'); // in progress still counts
    expect(nextFeaturedPass([faintHigh, average], featured, T0)).toBeNull();
    expect(nextFeaturedPass(three, featured, issLow.end.t)).toBeNull();
  });
});

describe('isPassSort', () => {
  it('accepts the two orders only', () => {
    expect(isPassSort('best')).toBe(true);
    expect(isPassSort('chronological')).toBe(true);
    expect(isPassSort('soonest')).toBe(false);
    expect(isPassSort(1)).toBe(false);
  });
});
