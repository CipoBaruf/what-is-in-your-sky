/** Fixture discovery and loading for the Heavens-Above spike. Reads only committed files; never fetches. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OmmRecord } from '../../src/model';
import type { ExplainedExtra, HaFixture } from './heavensAbove';

export const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures');
export const HA_DIR = join(FIXTURES_DIR, 'heavens-above');
export const OMM_DIR = join(FIXTURES_DIR, 'omm');
export const REFERENCE_VALUES_PATH = join(FIXTURES_DIR, 'reference-values.json');

const HA_NAME = /^(\d{4}-\d{2}-\d{2})-neuquen-iss\.json$/;

/** Dates of every committed Heavens-Above fixture, oldest first. */
export function haFixtureDates(): string[] {
  if (!existsSync(HA_DIR)) return [];
  return readdirSync(HA_DIR)
    .map((f) => HA_NAME.exec(f)?.[1])
    .filter((d): d is string => d !== undefined)
    .sort();
}

export function latestHaFixtureDate(): string | null {
  const dates = haFixtureDates();
  return dates[dates.length - 1] ?? null;
}

export interface FixturePair {
  date: string;
  ha: HaFixture;
  omm: OmmRecord[];
  ommMeta: { fetchedAt: string; iss: { EPOCH: string } };
  explainedExtras: ExplainedExtra[];
}

/**
 * Load the pair for `date`. The OMM capture is the one dated `ommDate`
 * (defaults to the same date; step 7 says they are captured within the same hour).
 */
export function loadFixturePair(date: string, ommDate: string = date): FixturePair {
  const haPath = join(HA_DIR, `${date}-neuquen-iss.json`);
  const ommPath = join(OMM_DIR, `${ommDate}-stations.json`);
  const metaPath = join(OMM_DIR, `${ommDate}.meta.json`);
  const extrasPath = join(HA_DIR, `${date}-neuquen-iss.extras.json`);
  for (const p of [haPath, ommPath, metaPath]) {
    if (!existsSync(p)) throw new Error(`Missing fixture ${p}. See tests/fixtures/heavens-above/README.md for the capture procedure.`);
  }
  return {
    date,
    ha: JSON.parse(readFileSync(haPath, 'utf8')) as HaFixture,
    omm: JSON.parse(readFileSync(ommPath, 'utf8')) as OmmRecord[],
    ommMeta: JSON.parse(readFileSync(metaPath, 'utf8')) as FixturePair['ommMeta'],
    explainedExtras: existsSync(extrasPath) ? (JSON.parse(readFileSync(extrasPath, 'utf8')) as ExplainedExtra[]) : [],
  };
}
