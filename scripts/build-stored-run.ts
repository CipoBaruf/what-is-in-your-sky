/**
 * R37 (FR-CI-3): writes `tests/fixtures/stored-run-neuquen.json`, the finished
 * 72 h run the e2e suite seeds into IndexedDB (`liveHelpers.seedStoredRun`),
 * and — P4 (FR-SHOW-6, D-673) — `tests/fixtures/stored-run-paris.json`, the
 * same over Paris at the capture set's instant, which the recording run seeds.
 *
 * A spec whose subject is a rendered page — the palette, the language, the
 * desktop layout, the shortcut overlay — used to type a coordinate pair and
 * then wait for the whole 72 h search to finish before it could look at
 * anything, thirty objects over three nights for a screenshot of a heading.
 * The app itself does not: FR-OFF-2 puts the stored run on screen before a
 * single request goes out. So the suite starts where a returning reader
 * starts, and the search it no longer waits for is the one it was never
 * testing.
 *
 * The runs are *computed*, not written by hand, and by the same handler the
 * worker binds (`worker/handlers.ts`) over the same committed fixtures at the
 * same instant the specs run at. That is the point: the recompute that follows
 * the seeded run lands on the same passes, so a spec cannot see the list
 * change under it, and a physics change that moves a pass makes these files
 * regenerate rather than quietly disagree with the app.
 *
 * The Paris run exists because the recordings are material a reader compares
 * with a fresh install: nine days on from the fixtures the elements are past
 * FR-SAT-4's warning threshold and the home carries the amber staleness line,
 * where at `PARIS_NIGHT` they are seven hours old (D-179's reason for the
 * capture set's night).
 *
 *   npm run build:stored-run
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG } from '../src/data/catalog';
import { filterToCatalog, mergeGroups } from '../src/data/elementsLoader';
import type { Observer, OmmRecord, Pass, PassRun, SatelliteRecord } from '../src/model';
import { DEFAULT_THRESHOLDS } from '../src/physics/constants';
import { searchWindow } from '../src/state/passWindow';
import { createHandler, createHandlerState } from '../src/worker/handlers';
import type { WorkerResponse } from '../src/worker/protocol';
import { passCellKey } from '../src/data/passesCache';
// The instants, the places and the file names all belong to the suites that seed the runs, not to this script.
import { FIXTURE_DATE, NEUQUEN, NINE_DAYS_ON, PARIS, PARIS_NIGHT, STORED_RUN_FILE, STORED_RUN_PARIS_FILE } from '../tests/e2e/observers';

const read = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

/** One run: the 72 h search from `at` over `observer`, written to `file` as the app would have stored it. */
async function build(records: SatelliteRecord[], observer: Observer, at: number, file: string): Promise<void> {
  const state = createHandlerState();
  const handle = createHandler(state);
  const window = searchWindow(at);
  const passes: Pass[] = [];
  let hasDarkness = true;
  let failed: string | null = null;

  await handle({ type: 'loadElements', requestId: 'build', records }, () => undefined);
  await handle({ type: 'computePasses', jobId: 'build', observer, window, thresholds: DEFAULT_THRESHOLDS }, (response: WorkerResponse) => {
    if (response.type === 'passes') passes.push(...response.passes);
    if (response.type === 'jobDone') hasDarkness = response.hasDarkness;
    if (response.type === 'error') failed = `${response.code}: ${response.message}`;
  });
  if (failed !== null) throw new Error(`${file}: the search did not finish cleanly (${failed})`);
  if (passes.length === 0) throw new Error(`${file}: the search found no passes; a fixture seeded with nothing is worse than no fixture`);

  // What the app would have stored for this run (`data/passesCache.ts`): the streamed order, night by
  // night and the ISS first, and the provenance of the whole set rather than of its oldest object.
  const run: PassRun = {
    cellKey: passCellKey(observer.lat, observer.lon),
    observer,
    window,
    computedAt: at,
    newestElementsEpochMs: Math.max(...records.map((record) => record.epochMs)),
    hasDarkness,
    passes,
  };
  writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`);
  console.log(`${file}: ${String(passes.length)} passes over ${String(records.length)} objects, computed at ${new Date(at).toISOString()}`);
}

async function main(): Promise<void> {
  const groups = {
    stations: read<OmmRecord[]>(`tests/fixtures/omm/${FIXTURE_DATE}-stations.json`),
    visual: read<OmmRecord[]>(`tests/fixtures/omm/${FIXTURE_DATE}-visual.json`),
  };
  const { records } = filterToCatalog(CATALOG, mergeGroups(groups));
  if (records.length === 0) throw new Error('no elements: the OMM fixtures and the catalog do not meet');

  await build(records, NEUQUEN, NINE_DAYS_ON, STORED_RUN_FILE);
  await build(records, PARIS, PARIS_NIGHT, STORED_RUN_PARIS_FILE);
}

await main();
