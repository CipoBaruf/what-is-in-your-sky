/**
 * The observers the e2e suite seeds into `wiys:prefs:v1`, built by the app's
 * own `observerFromCoords` (R37, F-49).
 *
 * A seeded observer is a saved state the app is supposed to have written, so
 * the way to be sure it is one the app can write is not to write it by hand.
 * R36's capture spec paired `source: 'coords'` with a real IANA zone; typing a
 * coordinate pair leaves the zone `null` until a forecast fills it in (D-3),
 * so nothing in the app ever produces that pair, and the captures were shot on
 * local clocks the same screens would never show. Building the seeds here from
 * `lib/place.ts` closes that off: the label, the altitude and the null zone are
 * whatever the coordinates box would have produced.
 *
 * No Playwright import: `tests/docs/ci.test.ts` and `scripts/build-stored-run.ts` read this file too.
 */
import { readFileSync } from 'node:fs';
import type { Observer } from '../../src/model';
import { observerFromCoords } from '../../src/lib/place';

/** The R1 capture the whole suite runs on; `liveHelpers.ts` reads the same file for its clock. */
export const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as { capturedAt: string; observer: { lat: number; lon: number } };

/** The chart screens' place: the one night in the committed fixtures with a pass, a high Moon and twilight at once (R22). */
export const PARIS: Observer = observerFromCoords(48.86, 2.35);
/** The rest of the suite's place: the R1 fixtures' observer, where the golden ISS pass is. */
export const NEUQUEN: Observer = observerFromCoords(ha.observer.lat, ha.observer.lon);

/**
 * The instant the page specs run at: nine days after the fixtures were
 * captured, which is where the golden ISS pass is and the line most of
 * `tests/e2e` opens with. It is here rather than in each spec because the
 * stored run (FR-CI-3) is computed for exactly this instant — a spec on
 * another clock would seed a run whose window has nothing to do with its own.
 */
export const NINE_DAYS_ON = Date.parse(ha.capturedAt) + 9 * 86_400_000;
/** The finished 72 h run `seedStoredRun` puts in IndexedDB; written by `scripts/build-stored-run.ts`. */
export const STORED_RUN_FILE = 'tests/fixtures/stored-run-neuquen.json';
