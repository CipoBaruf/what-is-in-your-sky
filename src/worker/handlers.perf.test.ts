/**
 * PLAN §9.1 performance budget for the v1 window (FR-VIS-1 as amended, D-77).
 * Two numbers matter and they are different questions:
 *
 * - **Night 1** is what FR-VIS-4 is about. The night-outer loop exists so that
 *   tonight is complete in the MVP's time whatever the window is, so night 1
 *   is held to the MVP's own 1.5 s budget (`passes.perf.test.ts`).
 * - **The whole 72 h run** is three nights plus the boundary overlap, so its
 *   budget is three times the MVP's. It is not a responsiveness figure — the
 *   list is already usable — but it bounds how long the other two nights take
 *   to stream in behind tonight's.
 *
 * Driven through `createHandler` rather than `findPasses` so the split, the
 * overlap and the per-pair yields are all inside the measurement. Best of
 * three runs, for the same reason as `passes.perf.test.ts`: on a shared CI
 * core a single run measures the contention as much as the algorithm.
 */
import { describe, expect, it } from 'vitest';
import { DAY_MS, fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../tests/support/catalogFixtures';
import type { Observer } from '../model';
import { DEFAULT_THRESHOLDS } from '../physics';
import { createHandler, createHandlerState } from './handlers';
import type { WorkerResponse } from './protocol';

const NIGHT_BUDGET_MS = 1_500;
const WINDOW_BUDGET_MS = 3 * NIGHT_BUDGET_MS;
const MIN_OBJECTS = 30;
const RUNS = 3;
// Three runs of three nights each, plus the satrec setup, outlast Vitest's 5 s
// default; the budget assertions are the gate, this only has to clear them.
const TIMEOUT_MS = 120_000;

describe('72 h search performance budget (D-77)', () => {
  it(`searches >= ${String(MIN_OBJECTS)} objects x 72 h in under ${String(WINDOW_BUDGET_MS)} ms, night 1 under ${String(NIGHT_BUDGET_MS)} ms`, async () => {
    const ref = loadReferenceValues();
    const observer: Observer = { ...ref.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: null };
    const window = { startMs: goldenWindowStart(ref), endMs: goldenWindowStart(ref) + 3 * DAY_MS };
    const records = fixtureRecords();
    expect(records.length).toBeGreaterThanOrEqual(MIN_OBJECTS);

    const state = createHandlerState();
    const handler = createHandler(state);
    await handler({ type: 'loadElements', requestId: 'perf', records }, () => undefined);
    expect(state.objects.size).toBeGreaterThanOrEqual(MIN_OBJECTS);

    const run = async (): Promise<{ nightMs: number; totalMs: number; found: number }> => {
      let found = 0;
      let nightMs = 0;
      const t0 = performance.now();
      const emit = (response: WorkerResponse): void => {
        if (response.type !== 'passes') return;
        found += response.passes.length;
        if (response.nightIndex === 0) nightMs = performance.now() - t0;
      };
      await handler({ type: 'computePasses', jobId: 'perf', observer, window, thresholds: DEFAULT_THRESHOLDS }, emit);
      return { nightMs, totalMs: performance.now() - t0, found };
    };

    const runs: { nightMs: number; totalMs: number; found: number }[] = [];
    for (let i = 0; i < RUNS; i++) runs.push(await run());
    const night = Math.min(...runs.map((r) => r.nightMs));
    const total = Math.min(...runs.map((r) => r.totalMs));
    const found = runs[0]?.found ?? 0;
    console.info(
      `[perf] ${String(state.objects.size)} objects x 72 h: best night 1 ${night.toFixed(0)} ms (budget ${String(NIGHT_BUDGET_MS)} ms), ` +
        `best whole window ${total.toFixed(0)} ms (budget ${String(WINDOW_BUDGET_MS)} ms), ${String(found)} passes; ` +
        `runs ${runs.map((r) => `${r.nightMs.toFixed(0)}/${r.totalMs.toFixed(0)}`).join(' ')} ms`,
    );

    expect(found).toBeGreaterThan(0);
    expect(night).toBeLessThan(NIGHT_BUDGET_MS);
    expect(total).toBeLessThan(WINDOW_BUDGET_MS);
  }, TIMEOUT_MS);
});
