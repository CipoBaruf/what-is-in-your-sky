/**
 * P3 (FR-SHOW-1, FR-SHOW-2, FR-SHOW-3, FR-ADDR-1, FR-ADDR-4; D-650): a claim
 * about a document is a test that reads the document.
 *
 * The audit of 2026-09-25 found the reader-facing documents saying things that
 * had stopped being true months of tasks earlier — paths that had been renamed,
 * counts read once and never again, a cache "following in R11" three phases
 * after R11 merged. Each of those has one shape, and each shape has a check
 * here: every backticked path exists in `git ls-files`; every `npm run` names a
 * script and every `npx tsx scripts/…` a file; the skills the reading order
 * lists are the directories under `.claude/skills/`; the version the release
 * checklist calls current is `package.json`'s; and the figures live in one
 * table whose every row carries the command and the commit — which is what this
 * test asserts about them, and all it asserts: it does not recount the tree,
 * because a test that did would make the page wrong the moment a task merged.
 * The strings the audit found stale are pinned so they never come back.
 *
 * Off line, like every test in `tests/docs`: the tree and `git ls-files`, no
 * `gh`, no network.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The four skills, read from the directory so a fifth is covered the day it lands. */
const SKILLS = readdirSync('.claude/skills', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

/** The documents D-650 names, whose every path, script and skill must exist as named. */
const DOCUMENTS = [
  'README.md',
  'CONTRIBUTING.md',
  'CLAUDE.md',
  'docs/HOW-THIS-WAS-BUILT.md',
  'docs/DEPLOY.md',
  'docs/RELEASE.md',
  ...SKILLS.map((skill) => `.claude/skills/${skill}/SKILL.md`),
];

/** The files FR-SHOW-1's audit table covers: the documents above plus the two READMEs it corrected. */
const AUDITED = [...DOCUMENTS, 'docs/mockups/README.md', 'tests/fixtures/heavens-above/README.md'];

/** Every tracked path, relative to the root. */
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((path) => path !== '');
const trackedSet = new Set(tracked);
const trackedNames = new Set(tracked.map((path) => basename(path)));
/** Every directory that holds a tracked file, at every depth. */
const trackedDirs = new Set<string>();
for (const path of tracked) {
  for (let dir = dirname(path); dir !== '.' && dir !== '/'; dir = dirname(dir)) trackedDirs.add(dir);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string; scripts: Record<string, string> };
const built = readFileSync('docs/HOW-THIS-WAS-BUILT.md', 'utf8');
const release = readFileSync('docs/RELEASE.md', 'utf8');
const deploy = readFileSync('docs/DEPLOY.md', 'utf8');

/** The marker this task put under each released version's checklist (FR-SHOW-1). */
const HISTORY = '> *History (';

/**
 * The text of a document that is current. `docs/RELEASE.md` keeps every
 * released version's list as it was run, under a marker saying so; a file a
 * v1.1 checklist named and a later phase deleted is history, not drift, so
 * those sections are not scanned for paths. Everything else is scanned whole.
 */
function current(path: string, text: string): string {
  if (path !== 'docs/RELEASE.md') return text;
  return text
    .split(/^(?=## )/m)
    .filter((part) => !part.includes(HISTORY))
    .join('');
}

/** A `## ` section of a document, by the start of its heading, up to the next `## `. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  expect(start, `no "## ${heading}" heading`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 3);
  const end = rest.search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Every backticked token in a text, with the backticks removed. */
function tokens(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1] ?? '');
}

/** A token that names one repository path: a directory prefix the tree has, or a root file with an extension. */
const PATH = /^(?:docs|scripts|src|tests|public|spike|\.claude|\.github)\/[\w./-]+$/;
const ROOT_FILE = /^[\w-][\w.-]*\.(?:md|json|jsonc|ts|tsx|js|txt|css|html|yml|svg|png|webmanifest|sh|otf)$/;
/** Not a path: a glob, a placeholder, a URL path, a command, prose. */
const NOT_A_PATH = /[*<>{}…$\s]|^\/|^https?:/;

/** The paths a document names, as `[token, exists]`. */
function pathClaims(text: string): [string, boolean][] {
  const claims: [string, boolean][] = [];
  for (const token of tokens(text)) {
    if (NOT_A_PATH.test(token)) continue;
    if (PATH.test(token)) {
      const exists = token.endsWith('/') ? trackedDirs.has(token.slice(0, -1)) : trackedSet.has(token) || trackedDirs.has(token);
      claims.push([token, exists]);
    } else if (ROOT_FILE.test(token)) {
      claims.push([token, trackedNames.has(token)]);
    }
  }
  return claims;
}

describe('every path a document names exists as named (FR-SHOW-1, US-36 AC1)', () => {
  for (const path of DOCUMENTS) {
    it(`${path}`, () => {
      const text = current(path, readFileSync(path, 'utf8'));
      const claims = pathClaims(text);
      expect(claims.filter(([, exists]) => !exists).map(([token]) => token)).toEqual([]);
    });
  }

  it('and the rule finds paths to check: a reader that matched nothing would pass on any text', () => {
    const claims = DOCUMENTS.flatMap((path) => pathClaims(current(path, readFileSync(path, 'utf8'))));
    expect(claims.length).toBeGreaterThan(40);
  });

  it('and the rule tells a path from a glob, a placeholder and a URL', () => {
    expect(pathClaims('`docs/DEPLOY.md` `scripts/sdd/` `package.json`').every(([, exists]) => exists)).toBe(true);
    expect(pathClaims('`docs/no-such-file.md` `no-such-file.ts`').map(([, exists]) => exists)).toEqual([false, false]);
    expect(pathClaims('`docs/screenshots/v1-*.png` `sdd-run/<task>.brief.md` `/third-party-notices.txt` `npm run build`')).toEqual([]);
  });
});

describe('every script a document names exists (FR-SHOW-1)', () => {
  for (const path of DOCUMENTS) {
    it(`${path}`, () => {
      const text = current(path, readFileSync(path, 'utf8'));
      const runs = [...text.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1] ?? '');
      expect(runs.filter((name) => !(name in pkg.scripts))).toEqual([]);
      const scripts = [...text.matchAll(/npx tsx (scripts\/[\w./-]+\.ts)/g)].map((match) => match[1] ?? '');
      expect(scripts.filter((file) => !trackedSet.has(file))).toEqual([]);
    });
  }
});

describe('the reading order (FR-SHOW-2, FR-SHOW-3, D-650)', () => {
  it('lists exactly the skills the tree has', () => {
    const listed = [...built.matchAll(/\.claude\/skills\/([\w-]+)\/SKILL\.md/g)].map((match) => match[1] ?? '');
    expect([...new Set(listed)].sort()).toEqual(SKILLS);
    expect(SKILLS.length).toBe(4);
  });

  it('says the MVP was built by hand and the driver ran the rest, from R16 (FR-SHOW-2)', () => {
    expect(built).toContain('by hand');
    expect(built).toContain('R16');
    // The first commit of the driver, so the sentence can be checked against `git log`.
    expect(built).toContain('6b79db1');
    expect(built).toContain('2026-09-03');
    // The one task the driver did not run.
    expect(built).toContain('R38');
  });

  it('names the public half and the local half in one place (FR-SHOW-3, D-651)', () => {
    const publicHalf = section(built, 'What is deliberately public');
    for (const named of ['.claude/settings.json', 'gh pr merge', 'CLAUDE.md', 'scripts/sdd/']) expect(publicHalf).toContain(named);
    for (const local of ['sdd-run/', 'logs/', '.sdd-cache/', 'handoff/', 'redesign/', 'promo/']) expect(publicHalf).toContain(local);
    // And the one allow rule is the one the section says it is.
    const settings = JSON.parse(readFileSync('.claude/settings.json', 'utf8')) as { permissions: { allow: string[] } };
    expect(settings.permissions.allow).toEqual(['Bash(gh pr merge:*)']);
  });

  it('keeps every figure in the By the numbers table, each beside its command and the commit it was read at', () => {
    const table = section(built, 'By the numbers');
    const rows = table
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .map((line) => line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim()));
    const header = rows[0] ?? [];
    expect(header).toEqual(['Figure', 'Value', 'Command', 'Read at']);
    const data = rows.slice(2);
    expect(data.length).toBeGreaterThanOrEqual(8);
    for (const row of data) {
      const [figure, value, command, readAt] = row;
      expect(figure, JSON.stringify(row)).toBeTruthy();
      expect(value, JSON.stringify(row)).toBeTruthy();
      // The command is in code: a reader can paste it.
      expect(command, `no command beside "${figure ?? ''}"`).toMatch(/^`.+`$/);
      // The commit is a short SHA in code, and the same one the table's preamble names.
      expect(readAt, `no commit beside "${figure ?? ''}"`).toMatch(/^`[0-9a-f]{7,40}`$/);
    }
    const commit = /^`([0-9a-f]{7,40})`$/.exec(data[0]?.[3] ?? '')?.[1] ?? '';
    expect(table.indexOf(`\`${commit}\``)).toBeLessThan(table.indexOf('| Figure'));
    // Every row was read at the one commit the preamble names.
    expect(new Set(data.map((row) => row[3]))).toEqual(new Set([`\`${commit}\``]));
  });

  it('and names no count outside that table that the audit found stale', () => {
    // The counts the 2026-09-25 audit found wrong in this file, and the shape
    // they took: a number and a unit written into a sentence. They live in the
    // table now, so a sentence carrying one has drifted.
    // Outside a table row, which is what `(?![^|\n]*\|)` says: a cell is
    // followed by a `|` on its own line, a sentence is not.
    expect(built).not.toMatch(/\b\d{3,4} lines\b(?![^|\n]*\|)/);
    expect(built).not.toMatch(/\b\d+ MB\b(?![^|\n]*\|)/);
  });
});

describe('the version (FR-SHOW-1)', () => {
  it('the release checklist knows the version package.json carries', () => {
    expect(release).toContain(`\`package.json\` is \`${pkg.version}\``);
  });
});

describe('the strings the audit found stale never return (FR-SHOW-1)', () => {
  /** Each one as the audit met it. `T<n>` is the old task-id shape; the arrows are the skill's edit markers. */
  const STALE = ['53 MB', '326 PNGs', '1053 lines', '1846 lines', '1459 lines', 'D-375', '← NEW', '← CHANGED', 'Pixel 5', 'T<n>'];

  for (const path of AUDITED) {
    it(`${path}`, () => {
      const text = readFileSync(path, 'utf8');
      expect(STALE.filter((stale) => text.includes(stale))).toEqual([]);
    });
  }
});

describe('the address (FR-ADDR-1, FR-ADDR-4)', () => {
  /** Not text, so not scanned. */
  const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|otf|ttf|woff2?|wasm)$/i;
  /** The old host, assembled so that this file is not one of the matches. */
  const OLD_HOST = ['workers', 'dev'].join('.');

  it('the old address is written in docs/DEPLOY.md and the three documents, and nowhere else', () => {
    const named = tracked
      .filter((path) => !BINARY.test(path) && path !== 'package-lock.json')
      .filter((path) => readFileSync(path, 'utf8').includes(OLD_HOST))
      .sort();
    expect(named).toContain('docs/DEPLOY.md');
    expect(named.filter((path) => !['docs/DEPLOY.md', 'SPEC.md', 'PLAN.md', 'TASKS.md'].includes(path))).toEqual([]);
  });

  it('docs/DEPLOY.md carries the Domain heading and the renewal date', () => {
    expect(deploy).toMatch(/^## Domain$/m);
    expect(deploy).toContain('2026-09-25');
    expect(deploy).toContain('https://inyoursky.app');
  });

  it('and the history marker is on every released version and on nothing current', () => {
    const marked = release
      .split(/^(?=## )/m)
      .filter((part) => part.includes(HISTORY))
      .map((part) => /^## (\d+)\./.exec(part)?.[1] ?? '');
    expect(marked).toEqual(['6', '7', '8', '9', '11', '12', '13']);
    expect(existsSync('docs/RELEASE.md')).toBe(true);
  });
});
