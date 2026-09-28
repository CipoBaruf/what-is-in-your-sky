/**
 * P7 (SPEC FR-SHOW-9; PLAN D-682, D-683, D-685): the showcase night the
 * recordings — and, from P8, the capture set — are seeded on, held to the
 * fixtures rather than to the specs' prose. Bariloche, 5 to 6 September 2026:
 * the place is the geocoder's first answer for `bariloche` as the app turns it
 * into an observer, every instant a recording names is on that night in the
 * place's zone and short of the moment FR-SAT-4's warning would appear, and the
 * recorded forecast is for the place's cell and covers every such instant.
 *
 * No Playwright: `observers.ts` and `promoFlows.ts` are plain modules, and the
 * rest is the fixtures themselves. P8 extends it to the capture set: its
 * seeds are read as text, since `captureSeeds.ts` imports Playwright.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/data/catalog';
import { filterToCatalog, mergeGroups } from '../../src/data/elementsLoader';
import { parseGeocodeBody } from '../../src/data/openMeteo/geocode';
import { cellCentre } from '../../src/data/weatherCache';
import { EPOCH_WARN_MS, epochIsOld, newestEpoch } from '../../src/lib/elementsAge';
import { observerFromPlace } from '../../src/lib/place';
import type { OmmRecord } from '../../src/model';
import { BARILOCHE, BARILOCHE_FORECAST_FILE, BARILOCHE_GEOCODE_FILE, BARILOCHE_QUERY, FIXTURE_DATE, SHOWCASE_NIGHT, SHOWCASE_UNTIL, STORED_RUN_BARILOCHE_FILE } from '../e2e/observers';
import { FAINT_MAG } from '../../src/lib/faint';
import { BRIGHTEST_PASS, PROMO_FLOWS, SHOWCASE_SHOWN } from '../e2e/promoFlows';

const read = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const ZONE = 'America/Argentina/Salta';
/** The calendar day of `t` in the showcase zone, `YYYY-MM-DD`. */
const localDay = (t: number): string => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

interface Forecast {
  timezone: string;
  hourly: { time: number[]; cloud_cover: (number | null)[]; cloud_cover_low: (number | null)[]; cloud_cover_mid: (number | null)[]; cloud_cover_high: (number | null)[] };
}
interface StoredPass {
  id: string;
  noradId: number;
  name: string;
  start: { t: number };
  peak: { elDeg: number };
  peakMagnitude: number;
  twilight: boolean;
  moonGlare: { glare: boolean };
}
const forecast = read<Forecast>(BARILOCHE_FORECAST_FILE);
const forecastMeta = read<{ kind?: string; cell: { lat: number; lon: number }; timezone: string }>(BARILOCHE_FORECAST_FILE.replace(/\.json$/, '.meta.json'));
const run = read<{ observer: unknown; computedAt: number; newestElementsEpochMs: number; passes: StoredPass[] }>(STORED_RUN_BARILOCHE_FILE);

/**
 * P8 (D-684, D-685): the capture set's instants, read off `captureSeeds.ts`'s source rather than imported — the
 * module imports Playwright, which a unit test cannot load. Each is held to what the recordings' constants say, so
 * a seed that drifts off the night fails here.
 */
const captureSeeds = readFileSync('tests/e2e/captureSeeds.ts', 'utf8');
const captureSpec = readFileSync('tests/e2e/v1-captures.spec.ts', 'utf8');
/** A spec constant of the shape `const NAME = BASE ± n [* 60_000]`, evaluated against `bases`. */
function specInstant(name: string, bases: Record<string, number>): number {
  const match = new RegExp(`const ${name} = (\\w+) ([+-]) ([\\d_]+)( \\* 60_000)?;`).exec(captureSpec);
  if (!match) throw new Error(`no ${name} in v1-captures.spec.ts`);
  const [, base = '', sign, amount = '', minutes] = match;
  const baseT = bases[base];
  if (baseT === undefined) throw new Error(`${name} is off ${base}, which this test does not know`);
  const offset = Number(amount.replaceAll('_', '')) * (minutes ? 60_000 : 1);
  return sign === '+' ? baseT + offset : baseT - offset;
}
const TICK_MS = 10_000;
const CAPTURE_INSTANTS: { what: string; t: number }[] = [
  { what: 'the capture CLOCK', t: SHOWCASE_NIGHT },
  { what: 'the capture SHOWN', t: SHOWCASE_SHOWN },
  { what: 'LEGEND_SHOWN', t: specInstant('LEGEND_SHOWN', { SHOWN: SHOWCASE_SHOWN }) },
  { what: 'CHIP_SHOWN', t: specInstant('CHIP_SHOWN', { SHOWN_PASS_START: BRIGHTEST_PASS.start }) },
  // The chip is pinned a strip tick after its instant (`followScreen`).
  { what: 'CHIP_SHOWN + TICK_MS', t: specInstant('CHIP_SHOWN', { SHOWN_PASS_START: BRIGHTEST_PASS.start }) + TICK_MS },
];

/** Every instant the recordings name: the night, each flow's start and where its clock stops, and the desk live flow's pass. */
const INSTANTS: { what: string; t: number }[] = [
  { what: 'SHOWCASE_NIGHT', t: SHOWCASE_NIGHT },
  { what: 'SHOWCASE_SHOWN', t: SHOWCASE_SHOWN },
  { what: 'the brightest pass', t: BRIGHTEST_PASS.start },
  ...PROMO_FLOWS.flatMap((flow) => [
    { what: `${flow.name} starts`, t: flow.at },
    { what: `${flow.name} ends`, t: flow.at + flow.seconds * 1000 },
  ]),
];

describe('the showcase night (FR-SHOW-9)', () => {
  it('seeds the observer the place picker writes for the first result of `bariloche` (F-49)', () => {
    expect(BARILOCHE_QUERY).toBe('bariloche');
    const [first] = parseGeocodeBody(read<unknown>(BARILOCHE_GEOCODE_FILE));
    if (!first) throw new Error('the geocode fixture has no result');
    expect(BARILOCHE).toEqual(observerFromPlace(first));
    // What FR-SHOW-9 names: the place, its altitude and its zone came with the answer.
    expect(BARILOCHE).toEqual({ lat: -41.14557, lon: -71.30822, altM: 839, label: 'Bariloche, Rio Negro, Argentina', source: 'geocode', timeZone: ZONE });
  });

  it('holds every instant the recordings name to 5–6 September in Bariloche’s zone and short of SHOWCASE_UNTIL', () => {
    expect(new Date(SHOWCASE_NIGHT).toISOString()).toBe('2026-09-06T08:00:00.000Z');
    for (const { what, t } of INSTANTS) {
      expect(['2026-09-05', '2026-09-06'], `${what} is on ${localDay(t)}`).toContain(localDay(t));
      expect(t, `${what} is not before SHOWCASE_UNTIL`).toBeLessThan(SHOWCASE_UNTIL);
      expect(t, `${what} is before the showcase night`).toBeGreaterThanOrEqual(SHOWCASE_NIGHT);
    }
  });

  it('seeds the capture set on the same night: CLOCK, SHOWN and the pass are the showcase’s, and nothing is Paris’s (P8, D-684, D-685)', () => {
    expect(captureSeeds).toContain('export const CLOCK = SHOWCASE_NIGHT;');
    expect(captureSeeds).toContain('export const SHOWN = SHOWCASE_SHOWN;');
    expect(captureSeeds).toContain('export const SHOWN_PASS = BRIGHTEST_PASS.id;');
    expect(captureSeeds).toContain('export const SHOWN_PASS_START = BRIGHTEST_PASS.start;');
    // No Paris import, by name or by `import *`, and the constant the set was shot at is gone from the seeds.
    for (const source of [captureSeeds, captureSpec]) {
      expect(source).not.toMatch(/import [^;]*\b(PARIS|PARIS_NIGHT)\b[^;]*from '\.\/observers'/);
      expect(source).not.toMatch(/import \* as \w+ from '\.\/observers'/);
    }
    expect(readFileSync('tests/e2e/observers.ts', 'utf8')).not.toContain('PARIS_NIGHT');
    // The page observes from Bariloche on the recorded weather, and never from a coordinate pair.
    expect(captureSpec).toContain("stubNetwork(page, 'fixtures', 'showcase')");
    expect(captureSpec).not.toMatch(/observer: (?!BARILOCHE\b|NEUQUEN\b)\w+/);
    for (const { what, t } of CAPTURE_INSTANTS) {
      expect(['2026-09-05', '2026-09-06'], `${what} is on ${localDay(t)}`).toContain(localDay(t));
      expect(t, `${what} is not before SHOWCASE_UNTIL`).toBeLessThan(SHOWCASE_UNTIL);
      expect(t, `${what} is before the showcase night`).toBeGreaterThanOrEqual(SHOWCASE_NIGHT);
    }
    // D-684: the glare state is absent because the night has no glare pass; the day it has one, the seeds move to it.
    const night = run.passes.filter((pass) => pass.start.t < SHOWCASE_UNTIL);
    expect(night.filter((pass) => pass.moonGlare.glare)).toEqual([]);
    // …and the `Next ISS` tag for the same reason: no ISS pass in the run at all.
    expect(run.passes.filter((pass) => pass.noradId === 25544)).toEqual([]);
  });

  it('puts SHOWCASE_UNTIL where FR-SAT-4’s warning would appear: the newest fixture epoch plus EPOCH_WARN_MS, to the second', () => {
    const groups = {
      stations: read<OmmRecord[]>(`tests/fixtures/omm/${FIXTURE_DATE}-stations.json`),
      visual: read<OmmRecord[]>(`tests/fixtures/omm/${FIXTURE_DATE}-visual.json`),
    };
    const newest = newestEpoch(filterToCatalog(CATALOG, mergeGroups(groups)).records);
    if (newest === null) throw new Error('no elements in the fixtures');
    expect(new Date(SHOWCASE_UNTIL).toISOString()).toBe('2026-09-06T23:20:48.000Z');
    expect(SHOWCASE_UNTIL).toBe(Math.floor((newest + EPOCH_WARN_MS) / 1000) * 1000);
    // The literal is the warning's own measure: not shown at SHOWCASE_UNTIL, shown a second after it.
    expect(epochIsOld(newest, SHOWCASE_UNTIL)).toBe(false);
    expect(epochIsOld(newest, SHOWCASE_UNTIL + 1000)).toBe(true);
    // The stored run carries the same provenance, so the page measures the age from the same epoch.
    expect(run.newestElementsEpochMs).toBe(newest);
  });

  it('has the forecast of Bariloche’s cell, covering every instant and with no null in its four series (D-37, D-686)', () => {
    const cell = cellCentre(BARILOCHE.lat, BARILOCHE.lon);
    expect(forecastMeta.cell).toEqual(cell);
    expect(cell).toEqual({ lat: -41.1, lon: -71.3 });
    expect(forecastMeta.kind).toBe('historical-forecast reconstruction');
    expect(forecast.timezone).toBe(ZONE);
    expect(forecastMeta.timezone).toBe(ZONE);
    const { time } = forecast.hourly;
    expect(time).toHaveLength(72);
    const first = (time[0] ?? Infinity) * 1000;
    const last = (time[time.length - 1] ?? -Infinity) * 1000;
    for (const { what, t } of [...INSTANTS, ...CAPTURE_INSTANTS]) {
      expect(t, `${what} is before the forecast`).toBeGreaterThanOrEqual(first);
      expect(t, `${what} is past the forecast`).toBeLessThan(last + 3_600_000);
    }
    for (const series of ['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high'] as const) {
      expect(forecast.hourly[series], series).toHaveLength(72);
      expect(forecast.hourly[series].some((value) => value === null), `${series} has a null`).toBe(false);
    }
  });

  it('seeds the recordings with the Bariloche run at SHOWCASE_NIGHT, whose first pass is under an hour away (D-683)', () => {
    expect(run.observer).toEqual(BARILOCHE);
    expect(run.computedAt).toBe(SHOWCASE_NIGHT);
    // The countdown runs on camera: 48 minutes to the night's first pass after the clock.
    const next = Math.min(...run.passes.map((pass) => pass.start.t).filter((t) => t > SHOWCASE_NIGHT));
    expect(next - SHOWCASE_NIGHT).toBeLessThan(3_600_000);
  });

  it('leads the list with a bright pass: the first after SHOWCASE_NIGHT is Tiangong at 05:48, brighter than FAINT_MAG (D-690)', () => {
    const [first] = run.passes.filter((pass) => pass.start.t > SHOWCASE_NIGHT).sort((a, b) => a.start.t - b.start.t);
    if (!first) throw new Error('no pass after SHOWCASE_NIGHT');
    expect(first.name).toMatch(/^Tiangong/);
    expect(first.peakMagnitude).toBeLessThan(FAINT_MAG);
    expect(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(first.start.t)).toBe('05:48');
  });

  it('never holds a pass past SHOWCASE_UNTIL: `[ see this pass ]` holds a morning rise, and no flow jumps to the next rise (D-690)', () => {
    // The phone's live flow holds the rise after its start, so that rise must be the morning's.
    const held = PROMO_FLOWS.find((flow) => flow.name === 'live-see-this-pass');
    if (!held) throw new Error('no live-see-this-pass flow');
    const next = Math.min(...run.passes.map((pass) => pass.start.t).filter((t) => t > held.at));
    expect(next).toBeLessThan(SHOWCASE_UNTIL);
    expect(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(next)).toBe('05:48');
    // The other flows step by minutes: after the desk's 07:23 the next rise is the evening's, past the limit.
    expect(readFileSync('tests/e2e/promo-record.spec.ts', 'utf8')).not.toContain('data-step="next-rise"');
  });

  it('watches the night’s brightest pass on the desk: Tiangong rising at 07:20 local, three minutes in (D-683)', () => {
    const pass = run.passes.find((candidate) => candidate.id === BRIGHTEST_PASS.id);
    if (!pass) throw new Error(`${BRIGHTEST_PASS.id} is not in the stored run`);
    expect(pass.name).toMatch(/^Tiangong/);
    expect(pass.start.t).toBe(BRIGHTEST_PASS.start);
    expect(SHOWCASE_SHOWN).toBe(BRIGHTEST_PASS.start + 180_000);
    expect(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(pass.start.t)).toBe('07:20');
    // The brightest of the night: no pass before SHOWCASE_UNTIL has a lower peak magnitude.
    const night = run.passes.filter((candidate) => candidate.start.t < SHOWCASE_UNTIL);
    expect(Math.min(...night.map((candidate) => candidate.peakMagnitude))).toBe(pass.peakMagnitude);
    expect(pass.peakMagnitude).toBeCloseTo(-2.1, 1);
  });
});
