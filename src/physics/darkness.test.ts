import { describe, expect, it } from 'vitest';
import { loadReferenceValues } from '../../tests/support/catalogFixtures';
import type { Observer } from '../model';
import { DEFAULT_THRESHOLDS } from './constants';
import { DARKNESS_STEP_MS, hasDarkness } from './darkness';
import { sunAltitudeDeg } from './sun';

const DAY_MS = 86_400_000;
const ref = loadReferenceValues();
const neuquen: Observer = { ...ref.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: null };
const observer = (lat: number, lon: number): Observer => ({ lat, lon, altM: 0, label: `${String(lat)}, ${String(lon)}`, source: 'coords', timeZone: null });

describe('hasDarkness', () => {
  it('is true for the R1 reference observer over the 24 h from the reference instant', () => {
    // Physics check against the R1 spike: at the reference instant the sun is below −6° at Neuquén.
    expect(sunAltitudeDeg(neuquen, ref.t)).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.sunAltMaxDeg);
    expect(hasDarkness(neuquen, { startMs: ref.t, endMs: ref.t + DAY_MS }, DEFAULT_THRESHOLDS)).toBe(true);
  });

  it('is false for a high-latitude summer window (Tromsø, 69.6° N, late June: sun never below −6°)', () => {
    const start = Date.UTC(2026, 5, 21, 0, 0, 0);
    expect(hasDarkness(observer(69.65, 18.96), { startMs: start, endMs: start + DAY_MS }, DEFAULT_THRESHOLDS)).toBe(false);
  });

  it('is true for the same place at the winter solstice', () => {
    const start = Date.UTC(2026, 11, 21, 0, 0, 0);
    expect(hasDarkness(observer(69.65, 18.96), { startMs: start, endMs: start + DAY_MS }, DEFAULT_THRESHOLDS)).toBe(true);
  });

  it('is false for a daylight-only window at the equator, true once the window reaches into the night', () => {
    // Singapore: sunset ≈ 11:10 UTC, civil dusk ≈ 11:30 UTC on 2026-09-02.
    const noon = Date.UTC(2026, 8, 2, 4, 0, 0);
    const singapore = observer(1.35, 103.82);
    expect(hasDarkness(singapore, { startMs: noon, endMs: noon + 6 * 3_600_000 }, DEFAULT_THRESHOLDS)).toBe(false);
    expect(hasDarkness(singapore, { startMs: noon, endMs: noon + 9 * 3_600_000 }, DEFAULT_THRESHOLDS)).toBe(true);
  });

  it('checks the window end even when it is not on the sampling grid', () => {
    // Find civil dusk at Singapore on 2026-09-02 (first instant after local noon with the sun ≤ −6°) by bisection to 1 s.
    const singapore = observer(1.35, 103.82);
    let lo = Date.UTC(2026, 8, 2, 4, 0, 0); // noon-ish, sun high
    let hi = Date.UTC(2026, 8, 2, 16, 0, 0); // midnight-ish, dark
    expect(sunAltitudeDeg(singapore, lo)).toBeGreaterThan(DEFAULT_THRESHOLDS.sunAltMaxDeg);
    expect(sunAltitudeDeg(singapore, hi)).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.sunAltMaxDeg);
    while (hi - lo > 1_000) {
      const mid = Math.round((lo + hi) / 2);
      if (sunAltitudeDeg(singapore, mid) <= DEFAULT_THRESHOLDS.sunAltMaxDeg) hi = mid;
      else lo = mid;
    }
    const dusk = hi;
    // A window whose grid samples all fall before dusk and whose end is exactly dusk: only the end check can say yes.
    const start = dusk - DARKNESS_STEP_MS - 1_000;
    expect(sunAltitudeDeg(singapore, start + DARKNESS_STEP_MS)).toBeGreaterThan(DEFAULT_THRESHOLDS.sunAltMaxDeg);
    expect(hasDarkness(singapore, { startMs: start, endMs: dusk }, DEFAULT_THRESHOLDS)).toBe(true);
    expect(hasDarkness(singapore, { startMs: start, endMs: dusk - 2_000 }, DEFAULT_THRESHOLDS)).toBe(false);
  });
});
