/**
 * R14 spike fixtures: the first golden pass (the reference numbers, the way
 * `tests/support/catalogFixtures.goldenPassFixture` builds it, without the
 * catalog dependency) and a synthetic high pass for the legibility and
 * panorama comparisons, since the golden pass grazes the horizon (13° of sky).
 */
import reference from '../tests/fixtures/reference-values.json';
import type { Pass, PassPoint } from '../src/model';

interface RefPoint {
  t: number;
  azDeg: number;
  elDeg: number;
  rangeKm?: number;
}

/** The dome spike draws the arc, not the sky around it: neither fixture carries a Moon (R19, FR-MOON-2). */
const NO_MOON = { moonAtPeak: null, moonGlare: { glare: false, separationDeg: null } } satisfies Pick<Pass, 'moonAtPeak' | 'moonGlare'>;

const golden = (reference as { firstGoldenPass: { start: RefPoint; peak: RefPoint; end: RefPoint; peakMagnitude: number; sunAltAtPeakDeg?: number; twilight: boolean }; t: number }).firstGoldenPass;
const point = (p: RefPoint): PassPoint => ({ t: p.t, azDeg: p.azDeg, elDeg: p.elDeg, rangeKm: p.rangeKm ?? 1500 });

export const GOLDEN_PASS: Pass = {
  id: `25544-${String(golden.start.t)}`,
  noradId: 25544,
  name: 'ISS (Zarya)',
  start: point(golden.start),
  peak: point(golden.peak),
  end: point(golden.end),
  startReason: 'horizon',
  endReason: 'horizon',
  durationS: (golden.end.t - golden.start.t) / 1000,
  peakMagnitude: golden.peakMagnitude,
  sunAltAtPeakDeg: golden.sunAltAtPeakDeg ?? -8,
  twilight: golden.twilight,
  track: [point(golden.start), point(golden.peak), point(golden.end)],
  elementsEpochMs: (reference as { t: number }).t,
  ...NO_MOON,
};

/**
 * A synthetic pass: rises WNW at 10°, peaks at 64° in the SW, ends in the
 * shadow at 22° in the SE. Track sampled every 10 s along a great circle in
 * the sky, the way `findPasses` samples (PLAN §6.3).
 */
function synthetic(): Pass {
  const t0 = golden.start.t + 3_600_000;
  const samples: PassPoint[] = [];
  const n = 36; // 6 minutes at 10 s
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    // A smooth arc in az/el: azimuth sweeps 300° → 140° through the south, elevation is a raised bump.
    const azDeg = 300 - 160 * f;
    const elDeg = 10 + 54 * Math.sin(Math.PI * Math.min(1, f * 1.15));
    samples.push({ t: t0 + i * 10_000, azDeg: ((azDeg % 360) + 360) % 360, elDeg: Math.max(10, elDeg), rangeKm: 1400 - 900 * Math.sin(Math.PI * f) });
  }
  const last = samples[samples.length - 1] as PassPoint;
  const peak = samples.reduce((a, b) => (b.elDeg > a.elDeg ? b : a));
  return {
    id: `25544-${String(t0)}`,
    noradId: 25544,
    name: 'ISS (Zarya)',
    start: samples[0] as PassPoint,
    peak,
    end: last,
    startReason: 'horizon',
    endReason: 'shadow',
    durationS: (last.t - t0) / 1000,
    peakMagnitude: -3.4,
    sunAltAtPeakDeg: -14,
    twilight: false,
    track: samples,
    elementsEpochMs: (reference as { t: number }).t,
    ...NO_MOON,
  };
}

export const HIGH_PASS: Pass = synthetic();

export const PASSES: Record<string, Pass> = { golden: GOLDEN_PASS, high: HIGH_PASS };
