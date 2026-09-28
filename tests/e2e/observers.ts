/**
 * The observers the e2e suite seeds into `wiys:prefs:v1`, built by the app's
 * own `observerFromCoords` (R37, F-49) and, for the showcase night's place,
 * its `observerFromPlace` over the recorded geocoder answer (P7, D-682).
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
 * No Playwright import: `tests/docs/ci.test.ts`, `tests/docs/showcase.test.ts` and `scripts/build-stored-run.ts` read this file too.
 */
import { readFileSync } from 'node:fs';
import type { Observer } from '../../src/model';
import { parseGeocodeBody } from '../../src/data/openMeteo/geocode';
import { observerFromCoords, observerFromPlace } from '../../src/lib/place';

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

/**
 * The capture set's instant (D-179; `captureSeeds.ts` exports it as `CLOCK`):
 * the same night over Paris, seven hours after the fixtures were captured,
 * with the ISS pass fifty minutes ahead. The capture set reads it until P8
 * re-shoots the set on the showcase night; the recordings moved off it in P7.
 */
export const PARIS_NIGHT = Date.parse('2026-09-02T03:00:00Z');

/**
 * P7 (FR-SHOW-9, D-682): the showcase night, the one place and night the
 * recordings (and, from P8, the capture set) are seeded on — Bariloche, 5 to 6
 * September 2026, with the forecast recorded for its cell. The place is what a
 * reader who types `bariloche` and picks the first result gets: the first
 * `Place` the geocode fixture parses to, made an observer by `lib/place.ts` as
 * `PlacePicker.tsx` does, so its name, region, altitude and zone are the app's
 * and not typed here (F-49's rule).
 */
export const BARILOCHE_QUERY = 'bariloche';
export const BARILOCHE_GEOCODE_FILE = 'tests/fixtures/open-meteo/2026-09-06-bariloche-geocode.json';
export const BARILOCHE_FORECAST_FILE = 'tests/fixtures/open-meteo/2026-09-06-bariloche-forecast.json';
const firstPlace = parseGeocodeBody(JSON.parse(readFileSync(BARILOCHE_GEOCODE_FILE, 'utf8')) as unknown)[0];
if (!firstPlace) throw new Error(`${BARILOCHE_GEOCODE_FILE} has no result`);
export const BARILOCHE: Observer = observerFromPlace(firstPlace);
/**
 * 2026-09-06 05:00 local (`GMT-3`): 48 minutes before the night's first bright
 * pass, Tiangong at 05:48, so the list's first card is a pass a reader can see
 * rather than the faint 04:43 one (D-690, the owner at P7's gate; D-682 had 04:00).
 */
export const SHOWCASE_NIGHT = Date.parse('2026-09-06T08:00:00Z');
/**
 * The instant FR-SAT-4's warning would appear, 20:20 local on the 6th: the
 * fixtures' newest epoch (2026-09-01 23:20:48 UTC, `lib/elementsAge.ts`'s
 * `newestEpoch`) plus `EPOCH_WARN_MS`, to the second. A literal, which
 * `tests/docs/showcase.test.ts` holds to the computation; no recording's
 * clock runs past it.
 */
export const SHOWCASE_UNTIL = Date.parse('2026-09-06T23:20:48Z');
/** The finished 72 h run over `BARILOCHE` at `SHOWCASE_NIGHT`, which the recording run seeds; written by `scripts/build-stored-run.ts`. */
export const STORED_RUN_BARILOCHE_FILE = 'tests/fixtures/stored-run-bariloche.json';
