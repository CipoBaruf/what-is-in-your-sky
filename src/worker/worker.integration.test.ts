/**
 * PLAN §9.1 "Worker integration" (Vitest browser mode, Chromium): the real
 * module worker boots from its URL, loads the fixture elements over
 * structured clone, and streams the golden window's passes back, the ISS
 * first, with the first golden pass intact. Fixtures are imported as modules
 * because the browser has no `node:fs`.
 */
import { describe, expect, it } from 'vitest';
import stationsJson from '../../tests/fixtures/omm/2026-09-02-stations.json';
import visualJson from '../../tests/fixtures/omm/2026-09-02-visual.json';
import reference from '../../tests/fixtures/reference-values.json';
import { CATALOG } from '../data/catalog';
import { filterToCatalog, mergeGroups } from '../data/elementsLoader';
import type { Observer, OmmRecord } from '../model';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import type { WorkerRequest, WorkerResponse } from './protocol';

const DAY_MS = 86_400_000;
const ISS = 25544;

function collect(worker: Worker, until: (r: WorkerResponse) => boolean, timeoutMs = 20_000): Promise<WorkerResponse[]> {
  return new Promise((resolve, reject) => {
    const responses: WorkerResponse[] = [];
    const timer = setTimeout(() => reject(new Error(`worker gave no terminal response within ${String(timeoutMs)} ms; got ${String(responses.length)} messages`)), timeoutMs);
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      responses.push(event.data);
      if (until(event.data)) {
        clearTimeout(timer);
        resolve(responses);
      }
    };
    worker.onerror = (event) => {
      clearTimeout(timer);
      reject(new Error(`worker error: ${event.message}`));
    };
  });
}

describe('passes.worker (bundled, in Chromium)', () => {
  it('boots, loads the fixture elements, and streams the golden window with the ISS first', async () => {
    const worker = new Worker(new URL('./passes.worker.ts', import.meta.url), { type: 'module' });
    try {
      const { records } = filterToCatalog(
        CATALOG,
        mergeGroups({ stations: stationsJson as unknown as OmmRecord[], visual: visualJson as unknown as OmmRecord[] }),
      );
      expect(records.length).toBeGreaterThanOrEqual(30);

      const loadReply = collect(worker, (r) => r.type === 'elementsLoaded' || r.type === 'error');
      worker.postMessage({ type: 'loadElements', requestId: 'req-1', records } satisfies WorkerRequest);
      const [loaded] = await loadReply;
      expect(loaded).toMatchObject({ type: 'elementsLoaded', requestId: 'req-1', rejected: [] });
      expect(loaded?.type === 'elementsLoaded' && loaded.loaded.length).toBe(records.length);

      const observer: Observer = { ...reference.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: null };
      const startMs = reference.t + 9 * DAY_MS;
      const jobReply = collect(worker, (r) => r.type === 'jobDone' || (r.type === 'error' && r.code !== 'PROPAGATION_FAILED'));
      worker.postMessage({
        type: 'computePasses',
        jobId: 'job-1',
        observer,
        window: { startMs, endMs: startMs + DAY_MS },
        thresholds: DEFAULT_THRESHOLDS,
      } satisfies WorkerRequest);
      const responses = await jobReply;

      const passes = responses.filter((r): r is WorkerResponse & { type: 'passes' } => r.type === 'passes');
      expect(passes).toHaveLength(records.length);
      expect(passes[0]?.noradId).toBe(ISS);
      const done = responses.at(-1);
      expect(done).toMatchObject({ type: 'jobDone', jobId: 'job-1', cancelled: false, hasDarkness: true });

      const golden = reference.firstGoldenPass;
      if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
      const iss = passes.find((p) => p.noradId === ISS)?.passes ?? [];
      expect(iss).toHaveLength(1);
      expect(iss[0]?.start.t).toBe(golden.start.t);
      expect(iss[0]?.peak.t).toBe(golden.peak.t);
      expect(iss[0]?.end.t).toBe(golden.end.t);
      expect(passes.flatMap((p) => p.passes).length).toBeGreaterThan(1);
    } finally {
      worker.terminate();
    }
  });
});
