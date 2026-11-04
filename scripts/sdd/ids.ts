/**
 * FR-SDD-6 (D-1061): `docs/sdd/ids.md`, one line per id with its file and heading, one per old
 * section number, one per archived path; `npm run sdd:id <id>` prints an id's text.
 * CLI: `--write` regenerates ids.md, `--check` fails when it is stale, `--print <id>` prints.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unwrapBlocks } from './rewrap';
import { DOCS, PHASES, SPLIT_MAP, type Doc } from './splitMap';

export const SDD_DIR = 'docs/sdd';
export const IDS_PATH = `${SDD_DIR}/ids.md`;
export const ARCHIVE_PATH = `${SDD_DIR}/archive.json`;

/** An id's kind and the line that defines it, in the documents its kind lives in. */
interface Kind {
  name: string;
  origin: Doc;
  define: RegExp;
}

/**
 * The defining line of each kind, the same lines the brief reads (FR-SDD-7): a bold bullet for a
 * requirement, a goal and a decision, a bold line for a story, a table row whose first or second
 * cell is the id for a finding, an open question and a decision-log row, a checkbox for a task.
 */
export const KINDS: readonly Kind[] = [
  { name: 'FR', origin: 'SPEC', define: /^- \*\*(FR-[A-Z0-9]+-\d+[a-z]?)(?=\*\*|\s)/ },
  { name: 'G', origin: 'SPEC', define: /^- \*\*(G\d+)\./ },
  { name: 'US', origin: 'SPEC', define: /^\*\*(US-\d+)\s/ },
  { name: 'row', origin: 'SPEC', define: /^\|(?:[^|]*\|)? ((?:F|OQ|V\d+)-\d+[a-z]?)(?=\s|\|)/ },
  { name: 'D', origin: 'PLAN', define: /^- \*\*(D-\d+)(?=\*\*|\s)/ },
  { name: 'task', origin: 'TASKS', define: /^- \[[ xX]\] \*\*([A-Z][A-Z0-9]*)(?=\s|\*)/ },
];

/** The kind an id names, by its prefix. */
export function kindOf(id: string): Kind | undefined {
  if (/^FR-/.test(id)) return KINDS[0];
  if (/^G\d+$/.test(id)) return KINDS[1];
  if (/^US-/.test(id)) return KINDS[2];
  if (/^(F|OQ|V\d+)-/.test(id)) return KINDS[3];
  if (/^D-/.test(id)) return KINDS[4];
  if (/^[A-Z][A-Z0-9]*$/.test(id)) return KINDS[5];
  return undefined;
}

/** Which documents a file of the layout was cut from. */
export function originOf(path: string): Doc[] {
  const index = DOCS.find((doc) => path === `${doc}.md`);
  if (index) return [index];
  if (path === `${SDD_DIR}/decisions.md`) return ['SPEC'];
  const kind = /\/phases\/[^/]+\/(spec|plan|tasks)\.md$/.exec(path)?.[1];
  if (kind) return [kind.toUpperCase() as Doc];
  const name = /\/reference\/(.+)\.md$/.exec(path)?.[1];
  if (name === undefined) return [];
  const ref = `ref:${name}`;
  return DOCS.filter((doc) => SPLIT_MAP[doc].preamble === ref || SPLIT_MAP[doc].sections.some((section) => section.to === ref || (section.sub ?? []).some((sub) => typeof sub !== 'string' && sub[1] === ref)));
}

/** The document an old section number belongs to in a file: the only origin, or, for a file fed from several, the document whose map sends that section there. */
function sectionDoc(path: string, number: string, origins: readonly Doc[]): Doc | undefined {
  if (origins.length <= 1) return origins[0];
  const name = /\/reference\/(.+)\.md$/.exec(path)?.[1];
  const ref = `ref:${name ?? ''}`;
  const heading = (h: string): boolean => h.startsWith(`${number}. `) || h.startsWith(`${number} `);
  return origins.find((doc) =>
    SPLIT_MAP[doc].sections.some((section) => (heading(section.h) && section.to === ref) || (section.sub ?? []).some((sub) => (typeof sub === 'string' ? heading(sub) && section.to === ref : heading(sub[0]) && sub[1] === ref))),
  );
}

/** The documents of the layout, in a fixed order: the index files, the phases in release order, the Decision Log, the reference files. */
export function layoutPaths(root: string): string[] {
  const paths: string[] = DOCS.map((doc) => `${doc}.md`);
  for (const phase of PHASES) for (const kind of ['spec', 'plan', 'tasks']) paths.push(`${SDD_DIR}/phases/${phase}/${kind}.md`);
  paths.push(`${SDD_DIR}/decisions.md`);
  const reference = join(root, SDD_DIR, 'reference');
  if (existsSync(reference))
    for (const name of readdirSync(reference)
      .filter((file) => file.endsWith('.md'))
      .sort())
      paths.push(`${SDD_DIR}/reference/${name}`);
  return paths.filter((path) => existsSync(join(root, path)));
}

/** GitHub's heading anchor: link URLs dropped (the link text stays), code-span text kept without its backticks, lower case, punctuation dropped, spaces to hyphens. */
export function slug(heading: string): string {
  return heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, '$2')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/ /g, '-');
}

export interface IdLine {
  key: string;
  path: string;
  anchor: string;
  heading: string;
}

/** A fence line's marker, or `null`: the character and the run's length. */
const fenceMarker = (line: string): { char: string; length: number; closes: boolean } | null => {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  return match ? { char: (match[1] ?? '')[0] ?? '', length: (match[1] ?? '').length, closes: (match[2] ?? '').trim() === '' } : null;
};

const HEADING = /^(#{1,6})\s+(.*)$/;
const OLD_SECTION = /^#{2,3} (\d+(?:\.\d+)?)[. ]/;

/** ids.md's lines from the layout's files (path → text). */
export function collectIds(files: ReadonlyMap<string, string>, archive: Record<string, string> = {}): { ids: IdLine[]; sections: IdLine[]; archived: [string, string][] } {
  const ids: IdLine[] = [];
  const sections: IdLine[] = [];
  const seen = new Set<string>();
  for (const [path, text] of files) {
    const origins = originOf(path);
    const kinds = KINDS.filter((kind) => origins.includes(kind.origin));
    const anchors = new Map<string, number>();
    let heading = '';
    let anchor = '';
    let fence: { char: string; length: number } | null = null;
    for (const line of text.split('\n')) {
      const marker = fenceMarker(line);
      const wasFenced = fence !== null;
      if (marker) {
        if (fence === null) fence = { char: marker.char, length: marker.length };
        else if (marker.char === fence.char && marker.length >= fence.length && marker.closes) fence = null;
      }
      const match = wasFenced || marker ? null : HEADING.exec(line);
      if (match) {
        heading = match[2] ?? '';
        const base = slug(heading);
        const count = anchors.get(base) ?? 0;
        anchors.set(base, count + 1);
        anchor = count === 0 ? base : `${base}-${String(count)}`;
        const old = OLD_SECTION.exec(line)?.[1];
        // The index files keep their numbered sections too; a phase or reference file names the document it came from.
        const doc = old === undefined ? undefined : sectionDoc(path, old, origins);
        if (old !== undefined && doc !== undefined) sections.push({ key: `${doc} §${old}`, path, anchor, heading });
        continue;
      }
      for (const kind of kinds) {
        const id = kind.define.exec(line)?.[1];
        if (id === undefined || seen.has(id)) continue;
        seen.add(id);
        ids.push({ key: id, path, anchor, heading });
      }
    }
  }
  return { ids, sections, archived: Object.entries(archive) };
}

/** ids.md's text. */
export function renderIds(collected: ReturnType<typeof collectIds>): string {
  const line = (entry: IdLine): string => `${entry.key}\t${entry.path}#${entry.anchor}\t${entry.heading}`;
  return [
    '<!-- Generated by `npx tsx scripts/sdd/ids.ts --write` (FR-SDD-6, D-1061): id, file#anchor, heading; then old sections; then archived paths. -->',
    ...collected.ids.map(line),
    ...collected.sections.map((entry) => `${entry.key}\t${entry.path}#${entry.anchor}`),
    ...collected.archived.map(([path, location]) => `${path}\t${location}`),
    '',
  ].join('\n');
}

/** Reads ids.md into key → { path, anchor, heading }. */
export function parseIds(text: string): Map<string, IdLine> {
  const entries = new Map<string, IdLine>();
  for (const line of text.split('\n')) {
    if (line.startsWith('<!--') || line.trim() === '') continue;
    const [key = '', target = '', heading = ''] = line.split('\t');
    const hash = target.indexOf('#');
    entries.set(key, { key, path: hash < 0 ? target : target.slice(0, hash), anchor: hash < 0 ? '' : target.slice(hash + 1), heading });
  }
  return entries;
}

const readLayout = (root: string): Map<string, string> => new Map(layoutPaths(root).map((path) => [path, readFileSync(join(root, path), 'utf8')]));
const readArchive = (root: string): Record<string, string> => (existsSync(join(root, ARCHIVE_PATH)) ? (JSON.parse(readFileSync(join(root, ARCHIVE_PATH), 'utf8')) as Record<string, string>) : {});

/** ids.md as the layout under `root` would generate it. */
export const generateIds = (root: string): string => renderIds(collectIds(readLayout(root), readArchive(root)));

/**
 * FR-SDD-7: the text an id or an old section lives in, read through ids.md. SPEC and PLAN text
 * comes back unwrapped (D-1060's inverse), so the brief's readers see the lines they always
 * did; TASKS text comes back as it is.
 */
export function layoutLookup(root: string): (key: string) => string | null {
  const index = parseIds(readFileSync(join(root, IDS_PATH), 'utf8'));
  const cache = new Map<string, string>();
  return (key) => {
    const entry = index.get(key);
    if (!entry || !existsSync(join(root, entry.path))) return null;
    let text = cache.get(entry.path);
    if (text === undefined) {
      const raw = readFileSync(join(root, entry.path), 'utf8');
      text = originOf(entry.path).includes('TASKS') ? raw : unwrapBlocks(raw.split('\n')).join('\n');
      cache.set(entry.path, text);
    }
    return text;
  };
}

/** D-1061: an id's text, from its line to the end of its block; an old section's, to the next heading of its level. */
export function extract(text: string, key: string): string | null {
  const lines = text.split('\n');
  const section = /^(SPEC|PLAN|TASKS) §(\S+)$/.exec(key);
  if (section) {
    const start = lines.findIndex((line) => OLD_SECTION.exec(line)?.[1] === section[2]);
    if (start < 0) return null;
    const level = /^#+/.exec(lines[start] ?? '')?.[0].length ?? 2;
    let end = start + 1;
    while (end < lines.length && !new RegExp(`^#{1,${String(level)}} `).test(lines[end] ?? '')) end += 1;
    return lines.slice(start, end).join('\n').trimEnd();
  }
  const kind = kindOf(key);
  if (!kind) return null;
  const start = lines.findIndex((line) => kind.define.exec(line)?.[1] === key);
  if (start < 0) return null;
  if (kind.name === 'row') return lines[start] ?? null;
  const entry = [lines[start] ?? ''];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '' || HEADING.test(line) || KINDS.some((other) => other.define.test(line))) break;
    // A bullet's block is its indented lines; a story's runs to the blank line.
    if (kind.name !== 'US' && !/^\s/.test(line)) break;
    entry.push(line);
  }
  return entry.join('\n');
}

/** `npm run sdd:id <id>`: the id's heading and file, then its text. */
export function printId(root: string, key: string): string | null {
  const index = parseIds(readFileSync(join(root, IDS_PATH), 'utf8'));
  const sectionKey = /^(spec|plan|tasks) §/i.test(key) ? key.replace(/^\w+/, (word) => word.toUpperCase()) : key;
  // Exact first; then case-insensitively against the stored key (`fr-guide-2b` finds `FR-GUIDE-2b`).
  const normal = index.has(sectionKey) ? sectionKey : [...index.keys()].find((stored) => stored.toLowerCase() === sectionKey.toLowerCase()) ?? sectionKey;
  const entry = index.get(normal);
  if (!entry) return null;
  if (!entry.path.endsWith('.md')) return `${entry.key}: archived at ${entry.path}`;
  const text = extract(readFileSync(join(root, entry.path), 'utf8'), normal);
  return [`${entry.key} — ${entry.path}#${entry.anchor}${entry.heading ? ` — ${entry.heading}` : ''}`, '', text ?? '(the line is gone: ids.md is stale; run `npx tsx scripts/sdd/ids.ts --write`)'].join('\n');
}

if (process.argv[1]?.endsWith('ids.ts')) {
  const [flag, ...rest] = process.argv.slice(2);
  const root = '.';
  if (flag === '--write') {
    writeFileSync(join(root, IDS_PATH), generateIds(root));
    console.log(`ids: ${IDS_PATH} written`);
  } else if (flag === '--check') {
    const stale = !existsSync(join(root, IDS_PATH)) || readFileSync(join(root, IDS_PATH), 'utf8') !== generateIds(root);
    console.log(stale ? `ids: ${IDS_PATH} is stale; run \`npx tsx scripts/sdd/ids.ts --write\`` : `ids: ${IDS_PATH} is current`);
    process.exitCode = stale ? 1 : 0;
  } else if (flag === '--print' && rest.length > 0) {
    const key = rest.join(' ');
    const out = printId(root, key);
    if (out === null) {
      console.error(`sdd:id: ${key} is not in ${IDS_PATH}`);
      process.exitCode = 1;
    } else console.log(out);
  } else {
    console.error('usage: tsx scripts/sdd/ids.ts --write | --check | --print <id>');
    process.exitCode = 2;
  }
}
