/**
 * PLAN D-1216 (FR-CI-5): the e2e shards are cut by time, not by test count.
 *
 *   npx tsx scripts/e2e-shards.ts <shard> <total> [spec ...]   # shard <shard>'s specs, one per line
 *   npx tsx scripts/e2e-shards.ts --durations <report.json> ...  # rewrite the table from a run's reports
 *
 * `tests/e2e/durations.json` maps each spec (its path under `tests/e2e/`) to the seconds its tests took
 * on a full CI run, retries included. The specs — the ones named, or with none named every spec a CI
 * run reaches — go longest first into the shard with the fewest seconds so far, and a spec the table
 * does not know counts as the table's median. Each shard hands its list to `playwright test` in place
 * of `--shard`, so the cut is the same on every runner and no spec is dropped or run twice.
 *
 * `npm run e2e:durations` takes every shard's JSON report of one full run (`e2e-report-shard-<n>`,
 * uploaded by `ci.yml` on a full run) and writes the table from them alone, so a deleted spec leaves it.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESIGN_SPEC, gatedSpecs, PROMO_SPEC } from '../playwright.config';

export type Durations = Record<string, number>;

const E2E_DIR = 'tests/e2e';
const TABLE = join(E2E_DIR, 'durations.json');

/** The middle value of the table's seconds (the mean of the two middle ones for an even count); 0 for an empty table. */
export function median(table: Durations): number {
  const values = Object.values(table).sort((a, b) => a - b);
  if (values.length === 0) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? (values[mid] ?? 0) : ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2;
}

/**
 * D-1216: `n` shards of `specs`, longest first into the shard with the fewest seconds (on a tie, the
 * fewest specs, then the lowest index), a spec missing from `table` at its median. Each shard's list
 * keeps the order the specs were cut in; a shard past the number of specs is empty.
 */
export function splitSpecs(specs: readonly string[], table: Durations, n: number): string[][] {
  if (!Number.isInteger(n) || n < 1) throw new Error(`splitSpecs: ${String(n)} shards`);
  const fallback = median(table);
  const weight = (spec: string): number => table[spec] ?? fallback;
  const order = [...new Set(specs)].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b));
  const shards = Array.from({ length: n }, () => ({ seconds: 0, specs: [] as string[] }));
  for (const spec of order) {
    let lightest = shards[0];
    for (const shard of shards) {
      if (lightest === undefined || shard.seconds < lightest.seconds || (shard.seconds === lightest.seconds && shard.specs.length < lightest.specs.length)) lightest = shard;
    }
    if (lightest === undefined) break;
    lightest.seconds += weight(spec);
    lightest.specs.push(spec);
  }
  return shards.map((shard) => shard.specs);
}

/** A spec's key: its path under `tests/e2e/`, as Playwright's JSON report names the file. */
export const specKey = (path: string): string => path.replace(/^(\.\/)?tests\/e2e\//, '');

interface ReportSuite {
  file?: string;
  specs?: { file?: string; tests?: { results?: { duration?: number }[] }[] }[];
  suites?: ReportSuite[];
}

/** Seconds per spec file from Playwright JSON reports, every result (retries too) counted, to 0.1 s. */
export function durationsFromReports(reports: readonly { suites?: ReportSuite[] }[]): Durations {
  const ms: Record<string, number> = {};
  const walk = (suite: ReportSuite): void => {
    for (const spec of suite.specs ?? []) {
      const file = spec.file ?? suite.file;
      if (file === undefined) continue;
      ms[file] = (ms[file] ?? 0) + (spec.tests ?? []).flatMap((test) => test.results ?? []).reduce((sum, result) => sum + (result.duration ?? 0), 0);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const report of reports) for (const suite of report.suites ?? []) walk(suite);
  return Object.fromEntries(
    Object.keys(ms)
      .sort()
      .map((file) => [specKey(file), Math.round((ms[file] ?? 0) / 100) / 10]),
  );
}

/** Every spec a CI run reaches with no selection: the spec files less the gated, promo and design ones. */
function allSpecs(): string[] {
  const gated = new Set(gatedSpecs(E2E_DIR, process.env));
  return readdirSync(E2E_DIR)
    .filter((file) => file.endsWith('.spec.ts') && !gated.has(file) && !PROMO_SPEC.test(file) && !DESIGN_SPEC.test(file))
    .sort();
}

function main(argv: readonly string[]): void {
  if (argv[0] === '--durations') {
    const files = argv.slice(1);
    if (files.length === 0) throw new Error('usage: npm run e2e:durations <report.json> [...]');
    const table = durationsFromReports(files.map((file) => JSON.parse(readFileSync(file, 'utf8')) as { suites?: ReportSuite[] }));
    writeFileSync(TABLE, `${JSON.stringify(table, null, 2)}\n`);
    console.log(`${TABLE}: ${String(Object.keys(table).length)} specs`);
    return;
  }
  const [shard, total, ...named] = argv;
  const index = Number(shard);
  const n = Number(total);
  if (!Number.isInteger(index) || !Number.isInteger(n) || index < 1 || index > n) throw new Error('usage: npx tsx scripts/e2e-shards.ts <shard> <total> [spec ...]');
  const table = JSON.parse(readFileSync(TABLE, 'utf8')) as Durations;
  const specs = named.length > 0 ? named.map(specKey) : allSpecs();
  for (const spec of splitSpecs(specs, table, n)[index - 1] ?? []) console.log(join(E2E_DIR, spec));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
