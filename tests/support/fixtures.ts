/** Fixture discovery and loading for the Heavens-Above golden suite. Reads only committed files; never fetches. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OmmRecord } from '../../src/model';
import type { ExplainedExtra, HaFixture } from './heavensAbove';

export const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures');
export const HA_DIR = join(FIXTURES_DIR, 'heavens-above');
export const OMM_DIR = join(FIXTURES_DIR, 'omm');
export const REFERENCE_VALUES_PATH = join(FIXTURES_DIR, 'reference-values.json');

/** `<YYYY-MM-DD>-<place>-iss.json`; the R1 fixture is `2026-09-02-neuquen-iss.json`. */
const HA_NAME = /^((\d{4}-\d{2}-\d{2})-([a-z0-9]+)-iss)\.json$/;
const R1_PLACE = 'neuquen';

/** Names (file name without `.json`) of every committed Heavens-Above fixture, sorted. */
export function haFixtureNames(): string[] {
  if (!existsSync(HA_DIR)) return [];
  return readdirSync(HA_DIR)
    .map((f) => HA_NAME.exec(f)?.[1])
    .filter((n): n is string => n !== undefined)
    .sort();
}

/** Dates of every committed fixture, oldest first, without duplicates. */
export function haFixtureDates(): string[] {
  return [...new Set(haFixtureNames().map((n) => n.slice(0, 10)))].sort();
}

export function latestHaFixtureName(): string | null {
  const names = haFixtureNames();
  return names[names.length - 1] ?? null;
}

/**
 * A fixture can be named in full (`2026-09-02-paris-iss`) or, for the R1
 * fixture only, by its date (`2026-09-02`), which is how `reference-values.json`
 * and the R1 script arguments referred to it.
 */
export function resolveFixtureName(nameOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(nameOrDate)) return `${nameOrDate}-${R1_PLACE}-iss`;
  return nameOrDate.replace(/\.json$/, '');
}

export interface FixturePair {
  name: string; // e.g. "2026-09-02-paris-iss"
  date: string; // capture date, YYYY-MM-DD
  place: string; // e.g. "paris"
  ommFixture: string; // OMM capture name, e.g. "2026-09-02" or "2026-09-02T13"
  ha: HaFixture;
  omm: OmmRecord[];
  ommMeta: { fetchedAt: string; iss: { EPOCH: string } };
  explainedExtras: ExplainedExtra[];
}

/**
 * Load the pair for a fixture. The OMM capture is `ommOverride`, else the
 * fixture's own `ommFixture` field, else the fixture's date (step 7 says both
 * sides are captured within the same hour).
 */
export function loadFixturePair(nameOrDate: string, ommOverride?: string): FixturePair {
  const name = resolveFixtureName(nameOrDate);
  const m = HA_NAME.exec(`${name}.json`);
  if (!m?.[2] || !m[3]) throw new Error(`Fixture name ${name} is not <YYYY-MM-DD>-<place>-iss`);
  const [, , date, place] = m;
  const haPath = join(HA_DIR, `${name}.json`);
  if (!existsSync(haPath)) throw new Error(`Missing fixture ${haPath}. See tests/fixtures/heavens-above/README.md for the capture procedure.`);
  const ha = JSON.parse(readFileSync(haPath, 'utf8')) as HaFixture;
  const ommFixture = ommOverride ?? ha.ommFixture ?? date;
  const ommPath = join(OMM_DIR, `${ommFixture}-stations.json`);
  const metaPath = join(OMM_DIR, `${ommFixture}.meta.json`);
  const extrasPath = join(HA_DIR, `${name}.extras.json`);
  for (const p of [ommPath, metaPath]) {
    if (!existsSync(p)) throw new Error(`Missing fixture ${p}. See tests/fixtures/heavens-above/README.md for the capture procedure.`);
  }
  return {
    name,
    date,
    place,
    ommFixture,
    ha,
    omm: JSON.parse(readFileSync(ommPath, 'utf8')) as OmmRecord[],
    ommMeta: JSON.parse(readFileSync(metaPath, 'utf8')) as FixturePair['ommMeta'],
    explainedExtras: existsSync(extrasPath) ? (JSON.parse(readFileSync(extrasPath, 'utf8')) as ExplainedExtra[]) : [],
  };
}
