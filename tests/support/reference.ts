/**
 * Typed access to `tests/fixtures/reference-values.json` (TASKS R1 "Done when",
 * TASKS H): the intermediate values pinned at the R1 fixture's `capturedAt`.
 * Every physics unit test asserts the value that concerns its module against
 * this file, so a physics change shows up in the module's own test, not only
 * in the end-to-end golden test.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { Observer } from '../../src/model';
import { REFERENCE_VALUES_PATH } from './fixtures';

export interface RefVec {
  x: number;
  y: number;
  z: number;
}
export interface RefPoint {
  t: number;
  azDeg: number;
  elDeg: number;
  rangeKm: number;
}
export interface ReferenceValues {
  fixture: string;
  ommFixture: string;
  capturedAt: string;
  t: number;
  observer: { lat: number; lon: number; altM: number };
  iss: { noradId: number; epoch: string; epochMs: number };
  eci: { position: RefVec; velocity: RefVec };
  gmstRad: number;
  lookAngles: { azDeg: number; elDeg: number; rangeKm: number };
  sunAltitudeDeg: number;
  sunUnitVectorEqd: RefVec;
  inUmbra: boolean;
  firstGoldenPass: {
    start: RefPoint;
    peak: RefPoint;
    end: RefPoint;
    startReason: string;
    endReason: string;
    peakMagnitude: number;
    sunAltAtPeakDeg: number;
    twilight: boolean;
  } | null;
}

export function hasReferenceValues(): boolean {
  return existsSync(REFERENCE_VALUES_PATH);
}

/** Throws when the file is missing: run `npx tsx scripts/validate-iss.ts --fixture 2026-09-02 --write-reference`. */
export function loadReferenceValues(): ReferenceValues {
  if (!hasReferenceValues()) {
    throw new Error(`Missing ${REFERENCE_VALUES_PATH}; generate it with \`npx tsx scripts/validate-iss.ts --fixture 2026-09-02 --write-reference\``);
  }
  return JSON.parse(readFileSync(REFERENCE_VALUES_PATH, 'utf8')) as ReferenceValues;
}

/** The R1 observer as an `Observer`, from the reference file. */
export function referenceObserver(ref: ReferenceValues): Observer {
  return { ...ref.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: 'UTC' };
}
