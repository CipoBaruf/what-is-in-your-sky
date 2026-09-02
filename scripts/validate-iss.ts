/**
 * Task Zero (PLAN §10, TASKS R1): reproduce Heavens-Above's ISS passes for
 * Neuquén from the committed fixtures and print the comparison table.
 *
 *   npx tsx scripts/validate-iss.ts [--fixture YYYY-MM-DD] [--omm YYYY-MM-DD] [--write-reference]
 *
 * Reads only committed fixtures; never fetches. Exit code 1 on OVERALL: FAIL.
 * `--write-reference` (re)writes tests/fixtures/reference-values.json from the
 * fixture's capturedAt (step "Done when": pinned intermediate values).
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { Pass } from '../src/model';
import {
  ISS_NORAD_ID,
  ISS_STD_MAG_SEED,
  compare,
  fixtureObserver,
  formatReport,
  runOurPipeline,
} from '../tests/support/heavensAbove';
import { REFERENCE_VALUES_PATH, latestHaFixtureDate, loadFixturePair } from '../tests/support/fixtures';
import { gmstRad, isoUtc, lookAnglesFrom, ommToSatrec, parseOmmEpoch, propagateEci, sunAltitudeDeg, sunVectorEqd } from '../src/physics';

const { values } = parseArgs({
  options: {
    fixture: { type: 'string' },
    omm: { type: 'string' },
    'write-reference': { type: 'boolean', default: false },
  },
});

const date = values.fixture ?? latestHaFixtureDate();
if (!date) {
  console.error('No Heavens-Above fixture found in tests/fixtures/heavens-above/. Follow the README there to capture one.');
  process.exit(2);
}
const pair = loadFixturePair(date, values.omm ?? date);
const iss = pair.omm.find((r) => r.NORAD_CAT_ID === ISS_NORAD_ID);
if (!iss) throw new Error('ISS missing from OMM fixture');

console.log(`Heavens-Above fixture ${pair.date}: capturedAt ${pair.ha.capturedAt}, haEpoch ${pair.ha.haEpoch}`);
console.log(`OMM fixture: fetchedAt ${pair.ommMeta.fetchedAt}, ISS EPOCH ${iss.EPOCH} (UTC)`);
const epochGapH = Math.abs(parseOmmEpoch(iss.EPOCH) - Date.parse(pair.ha.haEpoch)) / 3_600_000;
console.log(`Epoch gap between the two sides: ${epochGapH.toFixed(1)} h${epochGapH > 24 ? '  ** more than one day: re-capture both sides together (step 7) **' : ''}`);
console.log(`ISS stdMag seed used for the brightness column: ${ISS_STD_MAG_SEED}`);
console.log('');

const t0 = performance.now();
const ours = runOurPipeline(pair.ha, pair.omm);
const elapsedMs = performance.now() - t0;
const report = compare(pair.ha, ours, pair.explainedExtras);
console.log(formatReport(report, pair.explainedExtras));
console.log('');
console.log(`Our passes in window: ${ours.length}. Pipeline runtime for ISS × 10 days: ${elapsedMs.toFixed(0)} ms (Node ${process.version}).`);

if (values['write-reference']) {
  const t = Date.parse(pair.ha.capturedAt);
  const observer = fixtureObserver(pair.ha);
  const satrec = ommToSatrec(iss);
  const state = propagateEci(satrec, t);
  if (!state) throw new Error('Propagation failed at capturedAt');
  const first: Pass | undefined = ours[0];
  const reference = {
    note: 'Pinned intermediate values at capturedAt of the Heavens-Above fixture. Later physics tasks assert against these (sdd-task). Never edit by hand; regenerate with `npx tsx scripts/validate-iss.ts --write-reference` only when a physics change is intended and the golden test still passes.',
    fixture: pair.date,
    ommFixture: values.omm ?? pair.date,
    capturedAt: pair.ha.capturedAt,
    t,
    observer: pair.ha.observer,
    iss: { noradId: ISS_NORAD_ID, epoch: iss.EPOCH, epochMs: parseOmmEpoch(iss.EPOCH) },
    eci: state,
    gmstRad: gmstRad(t),
    lookAngles: lookAnglesFrom(observer, state.position, t),
    sunAltitudeDeg: sunAltitudeDeg(observer, t),
    sunUnitVectorEqd: sunVectorEqd(t),
    firstGoldenPass: first
      ? { start: first.start, peak: first.peak, end: first.end, startReason: first.startReason, endReason: first.endReason, peakMagnitude: first.peakMagnitude, sunAltAtPeakDeg: first.sunAltAtPeakDeg, twilight: first.twilight }
      : null,
  };
  writeFileSync(REFERENCE_VALUES_PATH, `${JSON.stringify(reference, null, 2)}\n`);
  console.log(`Wrote ${REFERENCE_VALUES_PATH} (t = ${isoUtc(t)}).`);
}

process.exit(report.overall ? 0 : 1);
