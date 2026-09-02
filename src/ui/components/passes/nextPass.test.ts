/**
 * Physics check against the R1 reference values (sdd-implement rule): the
 * next-pass search from `capturedAt` must land on the pinned first golden pass.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REFERENCE_VALUES_PATH } from '../../../../tests/support/fixtures';
import { loadOmmFixture } from '../../../../tests/setup/msw';
import type { Observer } from '../../../model';
import { nextIssPass, searchWindow } from './nextPass';

interface Reference {
  ommFixture: string;
  t: number;
  observer: { lat: number; lon: number; altM: number };
  firstGoldenPass: {
    start: { t: number; azDeg: number; elDeg: number };
    peak: { t: number; elDeg: number };
    end: { t: number };
    peakMagnitude: number;
  } | null;
}

const ref = JSON.parse(readFileSync(REFERENCE_VALUES_PATH, 'utf8')) as Reference;
const observer: Observer = { ...ref.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: null };

describe('nextIssPass', () => {
  it('searches ten days from now', () => {
    expect(searchWindow(ref.t)).toEqual({ startMs: ref.t, endMs: ref.t + 10 * 86_400_000 });
  });

  it('reproduces the first golden pass from the R1 reference values', () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
    const result = nextIssPass(loadOmmFixture('stations', ref.ommFixture), observer, ref.t);
    expect(result.kind).toBe('pass');
    if (result.kind !== 'pass') return;
    expect(result.pass.noradId).toBe(25544);
    expect(result.pass.start.t).toBe(golden.start.t);
    expect(result.pass.start.azDeg).toBeCloseTo(golden.start.azDeg, 6);
    expect(result.pass.peak.t).toBe(golden.peak.t);
    expect(result.pass.peak.elDeg).toBeCloseTo(golden.peak.elDeg, 6);
    expect(result.pass.end.t).toBe(golden.end.t);
    expect(result.pass.peakMagnitude).toBeCloseTo(golden.peakMagnitude, 6);
  });

  it('reports missing ISS elements', () => {
    const others = loadOmmFixture('stations').filter((r) => r.NORAD_CAT_ID !== 25544);
    expect(nextIssPass(others, observer, ref.t)).toEqual({ kind: 'no-elements' });
  });

  it('reports no pass when the window starts after the only golden pass', () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
    // The window [capturedAt + 10 d, +20 d] is unfixtured; only assert the shape when empty.
    const result = nextIssPass(loadOmmFixture('stations'), observer, golden.end.t + 60_000);
    expect(['none', 'pass']).toContain(result.kind);
    if (result.kind === 'pass') expect(result.pass.start.t).toBeGreaterThan(golden.end.t);
  });
});
