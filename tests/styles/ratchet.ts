/**
 * R209 (FR-DS-11, FR-DS-2 as amended; D-1229, D-1257): the two ratchets' allow lists, one file per lane so two
 * lanes never edit one list. A file over its count fails; a count below it never does, so a task that lowers
 * another lane's file does not turn `main` red.
 */
import { readdirSync, readFileSync } from 'node:fs';

const ALLOW_DIR = 'tests/styles/allow';
/** The lanes with controls or brackets to lower in this phase (§8.22); each has both lists, empty or not. */
const RATCHET_LANES = ['chart', 'live', 'ui', 'window'] as const;

type Ratchet = 'controls' | 'brackets';

interface Entry {
  count: number;
  reason: string;
}

export interface LaneList {
  path: string;
  entries: Record<string, Entry>;
}

export function laneLists(ratchet: Ratchet): LaneList[] {
  return readdirSync(ALLOW_DIR)
    .sort()
    .filter((name) => name.endsWith(`.${ratchet}.json`))
    .map((name) => ({ path: `${ALLOW_DIR}/${name}`, entries: JSON.parse(readFileSync(`${ALLOW_DIR}/${name}`, 'utf8')) as Record<string, Entry> }));
}

/** The files over their count, each as a message with the lines found. */
export function overCount(found: ReadonlyMap<string, readonly { line: number; text: string }[]>, lists: readonly LaneList[]): string[] {
  const failures: string[] = [];
  for (const [path, hits] of found) {
    const list = lists.find(({ entries }) => Object.hasOwn(entries, path));
    const allowed = list?.entries[path]?.count ?? 0;
    if (hits.length <= allowed) continue;
    failures.push([`${path}: ${String(hits.length)}, over the ${String(allowed)} ${list?.path ?? `${ALLOW_DIR}/ (no list names it)`} allows:`, ...hits.map((hit) => `  line ${String(hit.line)}: ${hit.text}`)].join('\n'));
  }
  return failures;
}

/** What is wrong with the lists themselves: a lane without its list, a file in two, a count or a reason that is not one, keys out of order. */
export function listFaults(ratchet: Ratchet, lists: readonly LaneList[]): string[] {
  const faults: string[] = [];
  const expected = RATCHET_LANES.map((lane) => `${ALLOW_DIR}/${lane}.${ratchet}.json`);
  if (lists.map((list) => list.path).join() !== expected.join()) faults.push(`the lists are not ${expected.join(', ')}`);
  const seen = new Set<string>();
  for (const { path, entries } of lists) {
    const keys = Object.keys(entries);
    if (keys.join() !== [...keys].sort().join()) faults.push(`${path}: the files are not sorted`);
    for (const [file, { count, reason }] of Object.entries(entries)) {
      if (seen.has(file)) faults.push(`${file} is in two lists`);
      seen.add(file);
      if (!Number.isInteger(count) || count < 1) faults.push(`${path}: ${file}'s count is not a whole number above zero — remove an entry at zero`);
      if (reason.trim() === '' || reason.includes('\n')) faults.push(`${path}: ${file}'s reason is not one line`);
    }
  }
  return faults;
}
