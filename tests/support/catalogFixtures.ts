/**
 * Catalog + R1 OMM fixtures wired together for tests (R3). Reads committed
 * files only. The golden pass is nine days after `capturedAt`; starting a
 * 24 h window at `capturedAt + 9 d` keeps the 30 s coarse grid in phase with
 * R1's, so pass boundaries reproduce exactly rather than to within one
 * sample (PLAN D-20).
 */
import { readFileSync } from 'node:fs';
import { CATALOG } from '../../src/data/catalog';
import { filterToCatalog, mergeGroups } from '../../src/data/elementsLoader';
import type { Pass, PassBoundaryReason, PassPoint, SatelliteRecord } from '../../src/model';
import { loadOmmFixture } from '../setup/msw';
import { NO_MOON_AT_PEAK } from './moonFixtures';
import { REFERENCE_VALUES_PATH } from './fixtures';
import { ISS_STD_MAG_SEED } from './heavensAbove';

export interface ReferenceValues {
  t: number;
  observer: { lat: number; lon: number; altM: number };
  firstGoldenPass: {
    start: { t: number; azDeg: number; elDeg: number; rangeKm?: number };
    peak: { t: number; azDeg: number; elDeg: number; rangeKm?: number };
    end: { t: number; azDeg: number; elDeg: number; rangeKm?: number };
    startReason?: PassBoundaryReason;
    endReason?: PassBoundaryReason;
    peakMagnitude: number;
    sunAltAtPeakDeg?: number;
    twilight: boolean;
  } | null;
}

export function loadReferenceValues(): ReferenceValues {
  return JSON.parse(readFileSync(REFERENCE_VALUES_PATH, 'utf8')) as ReferenceValues;
}

export const DAY_MS = 86_400_000;

export function goldenWindowStart(ref: ReferenceValues = loadReferenceValues()): number {
  return ref.t + 9 * DAY_MS;
}

/** The whole catalog joined to the R1 fixtures, as `loadElements` would return it. */
export function fixtureRecords(): SatelliteRecord[] {
  return filterToCatalog(CATALOG, mergeGroups({ stations: loadOmmFixture('stations'), visual: loadOmmFixture('visual') })).records;
}

/**
 * The first golden pass as a full `Pass` (R6): the reference numbers with the
 * fields the reference file does not pin (id, name, track, elements epoch)
 * filled in the way `findPasses` would. The reference magnitude was computed
 * with the R1 seed (`ISS_STD_MAG_SEED`); the app uses the catalog's ISS
 * `stdMag` (D-22), and D-1 is linear in it, so the fixture shifts the peak
 * magnitude by the difference to match what the app shows. Tests that need
 * the pipeline's own object still run `findPasses`; this is for the
 * presentation layer.
 */
export function goldenPassFixture(ref: ReferenceValues = loadReferenceValues()): Pass {
  const golden = ref.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
  const iss = CATALOG.find((entry) => entry.noradId === 25544);
  if (!iss) throw new Error('catalog has no ISS entry');
  const point = (p: { t: number; azDeg: number; elDeg: number; rangeKm?: number }): PassPoint => ({ t: p.t, azDeg: p.azDeg, elDeg: p.elDeg, rangeKm: p.rangeKm ?? 1500 });
  return {
    id: `25544-${String(golden.start.t)}`,
    noradId: 25544,
    name: 'ISS (Zarya)',
    start: point(golden.start),
    peak: point(golden.peak),
    end: point(golden.end),
    startReason: golden.startReason ?? 'horizon',
    endReason: golden.endReason ?? 'horizon',
    durationS: (golden.end.t - golden.start.t) / 1000,
    peakMagnitude: golden.peakMagnitude + (iss.stdMag - ISS_STD_MAG_SEED),
    sunAltAtPeakDeg: golden.sunAltAtPeakDeg ?? -8,
    twilight: golden.twilight,
    track: [point(golden.start), point(golden.peak), point(golden.end)],
    elementsEpochMs: ref.t,
    // The reference file predates the Moon and pins nothing about it (R19), so
    // the fixture reports no Moon above the horizon at the peak.
    ...NO_MOON_AT_PEAK,
  };
}
