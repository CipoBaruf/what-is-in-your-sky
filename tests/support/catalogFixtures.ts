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
import type { SatelliteRecord } from '../../src/model';
import { loadOmmFixture } from '../setup/msw';
import { REFERENCE_VALUES_PATH } from './fixtures';

export interface ReferenceValues {
  t: number;
  observer: { lat: number; lon: number; altM: number };
  firstGoldenPass: {
    start: { t: number; azDeg: number; elDeg: number };
    peak: { t: number; azDeg: number; elDeg: number };
    end: { t: number; azDeg: number; elDeg: number };
    peakMagnitude: number;
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
