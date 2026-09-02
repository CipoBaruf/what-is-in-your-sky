/**
 * Physics check against the R1 reference values (sdd-implement rule): the
 * catalog-wide search must still reproduce the pinned first golden pass, now
 * with the catalog's ISS `stdMag` instead of the R1 seed.
 */
import { describe, expect, it, vi } from 'vitest';
import { DAY_MS, fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../../../tests/support/catalogFixtures';
import { ISS_STD_MAG_SEED } from '../../../../tests/support/heavensAbove';
import { CATALOG } from '../../../data/catalog';
import type { Observer, SatelliteRecord } from '../../../model';
import { computeOrder, findAllPasses, searchWindow, SEARCH_WINDOW_MS } from './passSearch';

const ref = loadReferenceValues();
const observer: Observer = { ...ref.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: null };
const GOLDEN_WINDOW_START = goldenWindowStart(ref);

describe('searchWindow', () => {
  it('is 24 hours from now (FR-VIS-1 MVP window)', () => {
    expect(SEARCH_WINDOW_MS).toBe(DAY_MS);
    expect(searchWindow(ref.t)).toEqual({ startMs: ref.t, endMs: ref.t + DAY_MS });
  });
});

describe('computeOrder', () => {
  it('puts the featured object first and keeps the rest in catalog order', () => {
    const records = fixtureRecords();
    const ordered = computeOrder([...records].reverse());
    expect(ordered[0]?.catalog.noradId).toBe(25544);
    expect(ordered.slice(1).map((r) => r.catalog.noradId)).toEqual(
      records
        .filter((r) => !r.catalog.featured)
        .map((r) => r.catalog.noradId)
        .reverse(),
    );
  });
});

describe('findAllPasses', () => {
  const golden = ref.firstGoldenPass;
  if (!golden) throw new Error('reference-values.json has no firstGoldenPass');

  it('reproduces the first golden ISS pass from the R1 reference values, with the catalog stdMag', () => {
    const { passes, skipped } = findAllPasses(fixtureRecords(), observer, GOLDEN_WINDOW_START);
    expect(skipped).toEqual([]);
    const iss = passes.filter((p) => p.noradId === 25544);
    expect(iss).toHaveLength(1);
    const pass = iss[0];
    if (!pass) return;
    expect(pass.name).toBe('ISS (Zarya)'); // catalog display name, not the OMM name
    expect(pass.start.t).toBe(golden.start.t);
    expect(pass.start.azDeg).toBeCloseTo(golden.start.azDeg, 6);
    expect(pass.peak.t).toBe(golden.peak.t);
    expect(pass.peak.elDeg).toBeCloseTo(golden.peak.elDeg, 6);
    expect(pass.end.t).toBe(golden.end.t);
    expect(pass.twilight).toBe(golden.twilight);
    // D-1 is linear in stdMag: the catalog value shifts the pinned magnitude by exactly the seed difference.
    const issStdMag = CATALOG.find((e) => e.noradId === 25544)?.stdMag;
    expect(issStdMag).toBeDefined();
    expect(pass.peakMagnitude).toBeCloseTo(golden.peakMagnitude + ((issStdMag ?? 0) - ISS_STD_MAG_SEED), 6);
  });

  it('returns passes sorted by start time and only within the window', () => {
    const { passes } = findAllPasses(fixtureRecords(), observer, GOLDEN_WINDOW_START);
    expect(passes.length).toBeGreaterThan(1); // 30 objects over a night: more than the ISS alone
    const starts = passes.map((p) => p.start.t);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (const p of passes) {
      expect(p.start.t).toBeGreaterThanOrEqual(GOLDEN_WINDOW_START);
      expect(p.end.t).toBeLessThanOrEqual(GOLDEN_WINDOW_START + DAY_MS);
      expect(p.peakMagnitude).toBeLessThanOrEqual(4.5); // the magnitude cut is live from R3
      expect(p.peak.elDeg).toBeGreaterThanOrEqual(10);
    }
  });

  it('skips an object whose elements cannot be propagated and keeps the rest', () => {
    const records = fixtureRecords();
    const first = records[0];
    if (!first) throw new Error('no records');
    const broken: SatelliteRecord = { ...first, omm: { ...first.omm, EPHEMERIS_TYPE: 3 } };
    const warn = vi.fn();
    const { passes, skipped } = findAllPasses([broken, ...records.slice(1)], observer, GOLDEN_WINDOW_START, warn);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.noradId).toBe(first.catalog.noradId);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(passes.some((p) => p.noradId === first.catalog.noradId)).toBe(false);
    expect(passes.length).toBeGreaterThan(0);
  });

  it('runs the catalog over 24 h in a reasonable time on the main thread', () => {
    const records = fixtureRecords();
    const t0 = performance.now();
    findAllPasses(records, observer, GOLDEN_WINDOW_START);
    const elapsed = performance.now() - t0;
    expect(records.length).toBeGreaterThanOrEqual(25);
    expect(elapsed).toBeLessThan(5_000); // generous CI bound; PLAN §9.1's 1.5 s budget is asserted in R5 with the worker
  });
});
