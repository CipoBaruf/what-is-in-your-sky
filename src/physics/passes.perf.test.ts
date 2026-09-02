/**
 * PLAN §9.1 performance budget: the whole MVP catalog over 24 h in under
 * 1.5 s in CI Node (proxy for < 1 s on a desktop and ≈ 3 s on a phone,
 * FR-VIS-4). Same inputs as the golden window so the number is comparable
 * across runs; the elapsed time is printed for the CI log.
 */
import { describe, expect, it } from 'vitest';
import { DAY_MS, fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../tests/support/catalogFixtures';
import type { Observer } from '../model';
import { DEFAULT_THRESHOLDS } from './constants';
import { findPasses } from './passes';
import { ommToSatrec } from './sgp4';

const BUDGET_MS = 1_500;
const MIN_OBJECTS = 30;

describe('pass search performance budget', () => {
  it(`searches ≥ ${String(MIN_OBJECTS)} objects × 24 h in under ${String(BUDGET_MS)} ms`, () => {
    const ref = loadReferenceValues();
    const observer: Observer = { ...ref.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: null };
    const window = { startMs: goldenWindowStart(ref), endMs: goldenWindowStart(ref) + DAY_MS };
    const records = fixtureRecords();
    expect(records.length).toBeGreaterThanOrEqual(MIN_OBJECTS);
    const objects = records.map((r) => ({ satrec: ommToSatrec(r.omm), catalog: r.catalog, epochMs: r.epochMs }));

    const t0 = performance.now();
    let found = 0;
    for (const { satrec, catalog, epochMs } of objects) {
      found += findPasses(satrec, observer, window, DEFAULT_THRESHOLDS, {
        noradId: catalog.noradId,
        name: catalog.name,
        stdMag: catalog.stdMag,
        elementsEpochMs: epochMs,
      }).length;
    }
    const elapsed = performance.now() - t0;
    console.info(`[perf] ${String(objects.length)} objects × 24 h: ${elapsed.toFixed(0)} ms, ${String(found)} passes (budget ${String(BUDGET_MS)} ms)`);
    expect(found).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
