/**
 * FR-MEAS-6 (D-1149): the funnel, printed from the site's own Analytics Engine dataset.
 *
 *   CF_ACCOUNT_ID=... CF_API_TOKEN=... npm run funnel [-- --days 14 --layout compact --lang en]
 *
 * `funnelReport` is pure over grouped rows and is what the test drives; `main` posts one SQL query to the account's
 * Analytics Engine SQL API and prints the report. The credentials come from the environment only and are in no file.
 * The query groups by the five blobs and sums `_sample_interval`: FR-MEAS-2 sends a name and detail pair once per
 * page load, so that sum is the count of loads, sampling included, with no DISTINCT.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { EVENTS, type MeasureName } from '../src/model/measure';

/** The dataset's name (D-1148). */
export const DATASET = 'inyoursky_events';
export const DEFAULT_DAYS = 14;

/** One grouped row: a name and detail pair for one visit, layout and language, and how many loads sent it. */
export interface FunnelRow {
  name: string;
  detail: string;
  visit: string;
  layout: string;
  lang: string;
  count: number;
}

export interface FunnelOptions {
  days: number;
  layout?: string;
  lang?: string;
}

/** The steps of a first visit, in order (FR-MEAS-6); the share's denominator is first-visit `open` on `home` (FR-MEAS-6 as amended, D-1182). */
const STEPS: readonly MeasureName[] = ['example_shown', 'where_shown', 'place_set', 'door', 'pass_open'];
/** The steps whose row is split by detail. */
const SPLIT: ReadonlySet<string> = new Set(['example_shown', 'where_shown', 'place_set', 'door']);
const DETAILED: readonly MeasureName[] = ['device_refused', 'search_empty', 'no_passes', 'failure', 'follow_answer'];

const sum = (rows: readonly FunnelRow[], keep: (row: FunnelRow) => boolean): number => rows.filter(keep).reduce((total, row) => total + row.count, 0);
const share = (n: number, of: number): string => (of === 0 ? '-' : `${String(Math.round((n / of) * 100))}%`);
const pad = (text: string, width: number): string => text.padEnd(width);
const num = (n: number): string => String(n).padStart(7);

/** FR-MEAS-6: the plain-text funnel. Never divides by zero: a share over no first `open` on `home` is `-`. */
export function funnelReport(rows: readonly FunnelRow[], options: FunnelOptions): string {
  const narrowed = [...(options.layout === undefined ? [] : [`layout ${options.layout}`]), ...(options.lang === undefined ? [] : [`lang ${options.lang}`])];
  const kept = rows.filter((row) => (options.layout === undefined || row.layout === options.layout) && (options.lang === undefined || row.lang === options.lang));
  const lines = [`Funnel, last ${String(options.days)} days${narrowed.length === 0 ? '' : ` (${narrowed.join(', ')})`}`, ''];

  lines.push('Opens');
  const opens = kept.filter((row) => row.name === 'open');
  for (const [key, values] of [
    ['visit', ['first', 'return']],
    ['layout', ['compact', 'wide']],
    ['lang', ['en', 'es']],
  ] as const) {
    for (const value of values) lines.push(`  ${pad(`${key} ${value}`, 16)}${num(sum(opens, (row) => row[key] === value))}`);
  }

  const first = kept.filter((row) => row.visit === 'first');
  const base = sum(first, (row) => row.name === 'open' && row.detail === 'home');
  lines.push('', 'First visits', `  ${pad('step', 22)}${'loads'.padStart(7)}  share of open home`);
  for (const step of STEPS) {
    const n = sum(first, (row) => row.name === step);
    lines.push(`  ${pad(step, 22)}${num(n)}  ${share(n, base)}`);
    if (SPLIT.has(step)) {
      for (const detail of EVENTS[step]) {
        const d = sum(first, (row) => row.name === step && row.detail === detail);
        lines.push(`    ${pad(detail, 20)}${num(d)}  ${share(d, base)}`);
      }
    }
  }

  lines.push('', 'Refusals, empties and failures');
  for (const name of DETAILED) {
    lines.push(`  ${pad(name, 22)}${num(sum(kept, (row) => row.name === name))}`);
    for (const detail of EVENTS[name]) lines.push(`    ${pad(detail, 20)}${num(sum(kept, (row) => row.name === name && row.detail === detail))}`);
  }
  return `${lines.join('\n')}\n`;
}

/** The SQL the command posts: grouped counts of the last `days` days (D-1149). */
export function funnelQuery(days: number): string {
  return `SELECT blob1, blob2, blob3, blob4, blob5, SUM(_sample_interval) AS n FROM ${DATASET} WHERE timestamp > NOW() - INTERVAL '${String(days)}' DAY GROUP BY blob1, blob2, blob3, blob4, blob5`;
}

/**
 * UNVERIFIED against Cloudflare's documentation (it was not reachable when this was written): the SQL API's default
 * JSON answer is read as `{ data: [{ blob1, blob2, blob3, blob4, blob5, n }, ...] }`, a number possibly sent as a string.
 * This is the one place that shape is known; a different one is fixed here.
 */
export function parseRows(body: unknown): FunnelRow[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new Error('The SQL API answer has no `data` list.');
  return (data as Record<string, unknown>[]).map((raw) => ({
    name: String(raw['blob1'] ?? ''),
    detail: String(raw['blob2'] ?? ''),
    visit: String(raw['blob3'] ?? ''),
    layout: String(raw['blob4'] ?? ''),
    lang: String(raw['blob5'] ?? ''),
    count: Number(raw['n'] ?? 0),
  }));
}

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function parseArgs(argv: readonly string[], env: Record<string, string | undefined>): FunnelOptions | string {
  let days = Number(env['FUNNEL_DAYS'] ?? DEFAULT_DAYS);
  let layout: string | undefined;
  let lang: string | undefined;
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--days') days = Number(value);
    else if (flag === '--layout') layout = value;
    else if (flag === '--lang') lang = value;
    else return `Unknown argument ${String(flag)}.`;
  }
  if (!Number.isInteger(days) || days < 1) return '--days (or FUNNEL_DAYS) must be a whole number of days, 1 or more.';
  if (layout !== undefined && layout !== 'compact' && layout !== 'wide') return '--layout is compact or wide.';
  if (lang !== undefined && lang !== 'en' && lang !== 'es') return '--lang is en or es.';
  return { days, ...(layout === undefined ? {} : { layout }), ...(lang === undefined ? {} : { lang }) };
}

/** The command: returns the exit code. `fetchFn` is injected so a test never reaches the network. */
export async function main(argv: readonly string[], env: Record<string, string | undefined>, fetchFn: Fetch, io: Io): Promise<number> {
  const missing = ['CF_ACCOUNT_ID', 'CF_API_TOKEN'].filter((name) => (env[name] ?? '') === '');
  if (missing.length > 0) {
    io.err(`Missing ${missing.join(' and ')}: set it in the environment (docs/DEPLOY.md, "Reading the funnel").\n`);
    return 1;
  }
  const options = parseArgs(argv, env);
  if (typeof options === 'string') {
    io.err(`${options}\n`);
    return 2;
  }
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env['CF_ACCOUNT_ID'] ?? ''}/analytics_engine/sql`;
    const response = await fetchFn(url, { method: 'POST', headers: { Authorization: `Bearer ${env['CF_API_TOKEN'] ?? ''}` }, body: funnelQuery(options.days) });
    if (!response.ok) {
      io.err(`The SQL API answered ${String(response.status)}.\n`);
      return 1;
    }
    io.out(funnelReport(parseRows(await response.json()), options));
    return 0;
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2), process.env, fetch, { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) });
}
