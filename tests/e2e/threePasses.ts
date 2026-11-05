/**
 * R186 (FR-WIDE-3, FR-WIDE-11; D-1099, D-1114 retired): three passes up at once through the southern sky over the
 * suite's place, as a stored run the live page reads — `globe.spec.ts`'s three arcs and `globe-perf.spec.ts`'s live
 * page, in place of R184's `window.__globeHarness`. Copies of the stored run's first pass with their own ids and
 * tracks (east to west through the south, so the globe's pole-side opening view draws them); no orbit stands behind them.
 */
import type { Page } from '@playwright/test';
import { NINE_DAYS_ON } from './observers';
import { seedStoredRun, STORED_RUN, type StoredRun } from './liveHelpers';

interface PassPoint {
  t: number;
  azDeg: number;
  elDeg: number;
  rangeKm: number;
}

const POINTS = 37;
const STEP_MS = 10_000;

/** The run: pass `k` rose `k + 1` minutes before `now` and is up for six, `PERF k`, the norad id 90000 + k. */
function threePassRun(now = NINE_DAYS_ON): StoredRun {
  const template = STORED_RUN.passes[0] as Record<string, unknown>;
  const passes = [0, 1, 2].map((k) => {
    const start = now - 60_000 * (k + 1);
    const track: PassPoint[] = Array.from({ length: POINTS }, (_, i) => ({ t: start + i * STEP_MS, azDeg: 110 + 140 * (i / (POINTS - 1)) + k * 12, elDeg: 25 + 55 * Math.sin((Math.PI * i) / (POINTS - 1)) - k * 8, rangeKm: 900 }));
    const noradId = 90_000 + k;
    const peak = track[18] as PassPoint;
    return { ...template, id: `${String(noradId)}-${String(start)}`, noradId, name: `PERF ${String(k)}`, start: track[0], peak, end: track[POINTS - 1], durationS: ((POINTS - 1) * STEP_MS) / 1000, track };
  });
  return { ...STORED_RUN, computedAt: now - 120_000, passes };
}

/** The three passes stored and the elements refused, so no recompute replaces them; `prefs` as `seedStoredRun`'s. */
export async function seedThreePasses(page: Page, prefs: Record<string, unknown> = { chartView: undefined }): Promise<void> {
  await seedStoredRun(page, { run: threePassRun(), elements: 'down', prefs });
}
