/**
 * FR-SDD-3..5 (D-1059, D-1060): SPEC.md, PLAN.md and TASKS.md cut by heading into the phase
 * folders, the Decision Log, the reference files and the three index files.
 * `split(sources)` is pure; `npx tsx scripts/sdd/split.ts <dir>` reads the three files from
 * `<dir>` (default `.`) and writes the layout, then `docs/sdd/ids.md`, into the repository root.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DOCS, OPEN_PHASE, PHASES, SPLIT_MAP, type Destination, type Doc, type DocMap } from './splitMap';
import { IDS_PATH, generateIds } from './ids';
import { rewrapBlocks } from './rewrap';
import { parseTasks } from './tasks';

/** A run of input lines and where it goes. Concatenated in input order, the pieces are the input. */
export interface Piece {
  doc: Doc;
  to: Destination;
  /** 1-based line of the piece's first line in its document. */
  start: number;
  /** The lines as they came. */
  lines: readonly string[];
}

export const SDD_DIR = 'docs/sdd';
const KIND: Record<Doc, string> = { SPEC: 'spec', PLAN: 'plan', TASKS: 'tasks' };

/** The file a destination names for a document's piece. */
export function pathFor(doc: Doc, to: Destination): string {
  if (to === 'index') return `${doc}.md`;
  if (to === 'decisions') return `${SDD_DIR}/decisions.md`;
  if (to.startsWith('ref:')) return `${SDD_DIR}/reference/${to.slice(4)}.md`;
  if (!(PHASES as readonly string[]).includes(to)) throw new Error(`${doc}: "${to}" is not a destination`);
  return `${SDD_DIR}/phases/${to}/${KIND[doc]}.md`;
}

/** D-1078: a point release folds into the phase before it. */
const FOLD: Record<string, string> = { 'v1.3.1': 'v1.3', 'v1.3.3': 'v1.3.2', 'v1.4.1': 'v1.4', 'v2.0.2': 'v2.0', 'v2.0.3': 'v2.0', 'v2.4.1': 'v2.4' };

/** D-1059: a story goes to the first version its *(…)* tag names; untagged, or `MVP`, to `mvp`. */
export function storyPhase(header: string): string {
  const tag = /\*\(([^)]*)\)\*/.exec(header)?.[1] ?? '';
  const version = /\bv\d+(?:\.\d+)*/.exec(tag)?.[0];
  if (version === undefined) return 'mvp';
  return FOLD[version] ?? version;
}

/** One document cut into pieces by its map. Throws on a heading the map lacks, or an entry with no heading. */
export function cut(doc: Doc, text: string, map: DocMap = SPLIT_MAP[doc]): Piece[] {
  const lines = text.split('\n');
  const sections = new Map(map.sections.map((section) => [section.h, section]));
  const used = new Set<string>();
  const pieces: Piece[] = [];
  let current: { to: Destination; start: number; lines: string[] } = { to: map.preamble, start: 1, lines: [] };
  let parent: (typeof map.sections)[number] | null = null;
  let fenced = false;
  const close = (): void => {
    if (current.lines.length > 0) pieces.push({ doc, to: current.to, start: current.start, lines: current.lines });
  };
  const open = (to: Destination, index: number): void => {
    close();
    current = { to, start: index + 1, lines: [] };
  };

  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const h2 = fenced ? null : /^## (.*)$/.exec(line);
    const h3 = fenced ? null : /^### (.*)$/.exec(line);
    if (index === 0 && /^# /.test(line)) {
      // The title stays in the root file whatever the preamble does.
      pieces.push({ doc, to: 'index', start: 1, lines: [line] });
      current = { to: map.preamble, start: 2, lines: [] };
      return;
    }
    if (h2) {
      const section = sections.get(h2[1] ?? '');
      if (!section) throw new Error(`${doc}.md:${String(index + 1)}: "## ${h2[1] ?? ''}" is not in the split map`);
      used.add(section.h);
      parent = section;
      open(section.to, index);
    } else if (h3) {
      const name = h3[1] ?? '';
      const entry = parent?.sub?.find((sub) => (typeof sub === 'string' ? sub : sub[0]) === name);
      if (!parent || entry === undefined) throw new Error(`${doc}.md:${String(index + 1)}: "### ${name}" is not in the split map`);
      used.add(`${parent.h}\n${name}`);
      open(typeof entry === 'string' ? parent.to : entry[1], index);
    }
    current.lines.push(line);
  });
  close();

  for (const section of map.sections) {
    if (!used.has(section.h)) throw new Error(`${doc}: the split map names "## ${section.h}", which the document does not have`);
    for (const sub of section.sub ?? []) {
      const name = typeof sub === 'string' ? sub : sub[0];
      if (!used.has(`${section.h}\n${name}`)) throw new Error(`${doc}: the split map names "### ${name}", which the document does not have`);
    }
  }
  return pieces.flatMap((piece) => (piece.to === 'stories' ? cutStories(piece) : [piece]));
}

/** SPEC §3.2 story by story: the heading and the preamble to `mvp`, each `**US-n …**` block to its phase. */
function cutStories(piece: Piece): Piece[] {
  const out: Piece[] = [];
  let current: { to: string; start: number; lines: string[] } = { to: 'mvp', start: piece.start, lines: [] };
  piece.lines.forEach((line, offset) => {
    if (/^\*\*US-\d+\s/.test(line)) {
      if (current.lines.length > 0) out.push({ ...piece, to: current.to, start: current.start, lines: current.lines });
      current = { to: storyPhase(line), start: piece.start + offset, lines: [] };
    }
    current.lines.push(line);
  });
  if (current.lines.length > 0) out.push({ ...piece, to: current.to, start: current.start, lines: current.lines });
  return out;
}

/** D-1060: SPEC and PLAN text is rewrapped; TASKS moves byte for byte (FR-SDD-3). */
export const outputLines = (piece: Piece): string[] => (piece.doc === 'TASKS' ? [...piece.lines] : rewrapBlocks(piece.lines));

export interface SplitResult {
  pieces: readonly Piece[];
  /** Path → file text, every file the layout has. */
  files: ReadonlyMap<string, string>;
}

const REFERENCE_TITLES: Record<string, string> = {
  'breakdown-inputs': "TASKS.md's header: each phase's status, inputs and scope",
  'revision-history': 'Revision history',
};

/** The three documents into the layout. */
export function split(sources: Record<Doc, string>): SplitResult {
  const pieces = DOCS.flatMap((doc) => cut(doc, sources[doc]));
  const byPath = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const path = pathFor(piece.doc, piece.to);
    byPath.set(path, [...(byPath.get(path) ?? []), piece]);
  }

  const files = new Map<string, string>();
  for (const [path, group] of byPath) {
    if (DOCS.some((doc) => path === `${doc}.md`)) continue;
    files.set(path, renderFile(path, group));
  }
  const phaseTasks = new Map<string, string>();
  for (const phase of PHASES) {
    const text = files.get(`${SDD_DIR}/phases/${phase}/tasks.md`);
    if (text !== undefined) phaseTasks.set(phase, text);
  }
  for (const doc of DOCS) files.set(`${doc}.md`, renderIndex(doc, byPath.get(`${doc}.md`) ?? [], files, phaseTasks));
  files.set(`${SDD_DIR}/archive.json`, '{}\n');
  return { pieces, files: new Map([...files].sort(([a], [b]) => a.localeCompare(b))) };
}

const join2 = (blocks: readonly (readonly string[])[]): string => `${blocks.flat().join('\n').replace(/\n*$/, '')}\n`;

function renderFile(path: string, group: readonly Piece[]): string {
  const phase = /\/phases\/([^/]+)\//.exec(path)?.[1];
  const blocks: string[][] = [];
  if (phase !== undefined) {
    const doc = group[0]?.doc ?? 'SPEC';
    blocks.push([`# ${phase} — ${doc}.md sections`, '', `Cut from \`${doc}.md\` by \`scripts/sdd/split.ts\` (FR-SDD-3); ids resolve through \`docs/sdd/ids.md\`.`, '']);
    for (const piece of group) blocks.push(outputLines(piece));
    return join2(blocks);
  }
  const name = /reference\/(.+)\.md$/.exec(path)?.[1];
  const docs = [...new Set(group.map((piece) => piece.doc))];
  const title = name !== undefined ? REFERENCE_TITLES[name] : undefined;
  if (title !== undefined) blocks.push([`# ${title}`, '']);
  let last: Doc | null = null;
  for (const piece of group) {
    if (docs.length > 1 && piece.doc !== last) blocks.push([`<!-- From ${piece.doc}.md -->`, '']);
    last = piece.doc;
    blocks.push(outputLines(piece));
  }
  return join2(blocks);
}

/** The table of every file the layout has, for SPEC.md and PLAN.md. */
function mapSection(files: ReadonlyMap<string, string>): string[] {
  const link = (path: string, label: string): string => (files.has(path) ? `[${label}](${path})` : '—');
  const rows = PHASES.map((phase) => {
    const base = `${SDD_DIR}/phases/${phase}`;
    const tasks = phase === OPEN_PHASE ? '[TASKS.md](TASKS.md)' : link(`${base}/tasks.md`, 'tasks');
    return `| ${phase} | ${link(`${base}/spec.md`, 'spec')} | ${link(`${base}/plan.md`, 'plan')} | ${tasks} |`;
  });
  const references = [...files.keys()].filter((path) => path.startsWith(`${SDD_DIR}/reference/`)).map((path) => `[${path.slice(`${SDD_DIR}/reference/`.length, -3)}](${path})`);
  return [
    '## Map',
    '',
    'The rest of this document is cut by phase (FR-SDD-3, `scripts/sdd/split.ts`).',
    'Every id resolves through [`docs/sdd/ids.md`](docs/sdd/ids.md): `npm run sdd:id <id>` prints it with its file and heading, and an old section number (`SPEC §4.47`, `PLAN §16.4`) has a line there too.',
    '',
    '| Phase | Spec | Plan | Tasks |',
    '|---|---|---|---|',
    ...rows,
    '',
    `The Decision Log (SPEC §12): [decisions.md](${SDD_DIR}/decisions.md). Reference: ${references.join(', ')}.`,
    '',
  ];
}

/** TASKS.md's table of every phase: its tasks, how many are merged, and its file. */
function statusSection(open: readonly Piece[], phaseTasks: ReadonlyMap<string, string>): string[] {
  const row = (phase: string, text: string, file: string): string => {
    const { tasks } = parseTasks(text);
    const done = tasks.filter((task) => task.done).length;
    const ids = tasks.length === 0 ? '—' : `${tasks[0]?.id ?? ''} … ${tasks[tasks.length - 1]?.id ?? ''}`;
    return `| ${phase} | ${ids} | ${String(done)} of ${String(tasks.length)} | ${file} |`;
  };
  const openText = open.map((piece) => piece.lines.join('\n')).join('\n');
  return [
    '## Status',
    '',
    `This file holds the open phase, ${OPEN_PHASE}; each closed phase's tasks are in its folder, moved byte for byte (FR-SDD-3).`,
    "Each phase's header rows (status, inputs, scope) are in [`docs/sdd/reference/breakdown-inputs.md`](docs/sdd/reference/breakdown-inputs.md).",
    '',
    '| Phase | First … last task | Merged | File |',
    '|---|---|---|---|',
    ...[...phaseTasks].map(([phase, text]) => row(phase, text, `[tasks.md](${SDD_DIR}/phases/${phase}/tasks.md)`)),
    row(OPEN_PHASE, openText, 'this file'),
    '',
  ];
}

function renderIndex(doc: Doc, group: readonly Piece[], files: ReadonlyMap<string, string>, phaseTasks: ReadonlyMap<string, string>): string {
  const [title, ...rest] = group;
  const blocks: string[][] = [];
  if (title) blocks.push(outputLines(title));
  if (doc === 'TASKS') blocks.push(['']);
  if (doc === 'TASKS') {
    blocks.push(statusSection(rest, phaseTasks));
    for (const piece of rest) blocks.push(outputLines(piece));
  } else {
    for (const piece of rest) blocks.push(outputLines(piece));
    blocks.push(['', ...mapSection(files)]);
  }
  return join2(blocks);
}

/** Writes the layout under `root`. */
export function writeLayout(root: string, files: ReadonlyMap<string, string>): void {
  for (const [path, text] of files) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

if (process.argv[1]?.endsWith('split.ts')) {
  const from = process.argv[2] ?? '.';
  const sources = Object.fromEntries(DOCS.map((doc) => [doc, readFileSync(join(from, `${doc}.md`), 'utf8')])) as Record<Doc, string>;
  const { files } = split(sources);
  writeLayout('.', files);
  writeFileSync(IDS_PATH, generateIds('.'));
  console.log(`split: ${String(files.size)} files written`);
}
