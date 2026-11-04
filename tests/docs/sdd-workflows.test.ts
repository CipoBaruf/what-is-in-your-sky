/**
 * FR-SDD-8, FR-SDD-9 (D-1063; R176): `AGENTS.md` is the entry point, `CLAUDE.md` imports it, the seven
 * workflows open with their reading row from `AGENTS.md`'s table, and each skill is a pointer to one.
 * R179's `check:sdd` takes the size rules over with the constants in `scripts/sdd/limits.ts`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** SPEC §4.56's constants, until `scripts/sdd/limits.ts` exists (R179). */
const AGENTS_MAX_KB = 6;
const WORKFLOW_MAX_KB = 4;
const DOC_LINE_MAX = 400;

const WORKFLOWS = ['spec', 'breakdown', 'implement', 'visual-review', 'review', 'fix-ci', 'release'];
/** Each skill, read from the directory, and the workflow it points to: its name without the `sdd-` prefix. */
const SKILLS: Record<string, string> = Object.fromEntries(
  readdirSync('.claude/skills', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, entry.name.replace(/^sdd-/, '')]),
);

const agents = readFileSync('AGENTS.md', 'utf8');
const workflow = (name: string): string => readFileSync(`docs/sdd/workflows/${name}.md`, 'utf8');
const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

interface Row {
  work: string;
  workflow: string;
  reads: string;
  never: string;
}

/** The reading table's rows, by the `| Work | Workflow | Reads | Never reads |` header. */
function readingTable(text: string): Row[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith('| Work | Workflow | Reads | Never reads |'));
  expect(start, 'no reading table in AGENTS.md').toBeGreaterThanOrEqual(0);
  const rows: Row[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    const [work = '', flow = '', reads = '', never = ''] = line.split('|').slice(1, -1).map((cell) => cell.trim());
    rows.push({ work, workflow: flow, reads, never });
  }
  return rows;
}

/** A workflow's `Reads:` and `Never reads:` lines, the first two after its title, without the final stop. */
function readingLines(text: string): { reads: string; never: string } {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const strip = (line: string | undefined, prefix: string): string => {
    expect(line?.startsWith(prefix), `expected "${prefix}" got "${line ?? ''}"`).toBe(true);
    return (line ?? '').slice(prefix.length).trim().replace(/\.$/, '');
  };
  expect(lines[0]).toMatch(/^# /);
  return { reads: strip(lines[1], 'Reads:'), never: strip(lines[2], 'Never reads:') };
}

describe('FR-SDD-8: AGENTS.md is the entry point and CLAUDE.md its import', () => {
  it(`is within AGENTS_MAX_KB (${String(AGENTS_MAX_KB)} KB), no line over DOC_LINE_MAX`, () => {
    expect(bytes(agents)).toBeLessThanOrEqual(AGENTS_MAX_KB * 1024);
    expect(agents.split('\n').filter((line) => line.length > DOC_LINE_MAX)).toEqual([]);
  });

  it('CLAUDE.md is one line, the import', () => {
    expect(readFileSync('CLAUDE.md', 'utf8')).toBe('@AGENTS.md\n');
  });

  it("carries the old CLAUDE.md's content: the documents, the workflow rules, the stack, the conventions", () => {
    for (const heading of ['## Documents', '## What each kind of work reads', '## Workflow', '## Stack', '## Conventions']) expect(agents).toContain(heading);
    for (const fact of ['satellite.js', '@glyphcss/react', 'Cloudflare Workers static assets', 'golden fixtures from R1', 'npm for package management', 'SDD_HEADLESS=1']) expect(agents).toContain(fact);
  });

  it('names every workflow in the table, and points to gotchas.md and the id lookup', () => {
    const named = new Set(readingTable(agents).map((row) => row.workflow));
    for (const name of WORKFLOWS) expect(named, name).toContain(`\`docs/sdd/workflows/${name}.md\``);
    expect(agents).toContain('`docs/sdd/gotchas.md`');
    expect(agents).toContain('npm run sdd:id <id>');
  });
});

describe('FR-SDD-9: seven workflows, each with its reading row', () => {
  const rows = readingTable(agents);

  for (const name of WORKFLOWS) {
    it(`${name}.md is within WORKFLOW_MAX_KB (${String(WORKFLOW_MAX_KB)} KB), no line over DOC_LINE_MAX`, () => {
      const text = workflow(name);
      expect(bytes(text)).toBeLessThanOrEqual(WORKFLOW_MAX_KB * 1024);
      expect(text.split('\n').filter((line) => line.length > DOC_LINE_MAX)).toEqual([]);
    });

    it(`${name}.md opens with Reads: and Never reads: copied from AGENTS.md's table (D-1063)`, () => {
      const own = rows.filter((row) => row.workflow === `\`docs/sdd/workflows/${name}.md\``);
      expect(own.length).toBeGreaterThan(0);
      const { reads, never } = readingLines(workflow(name));
      // Two rows sharing a workflow (headless and interactive) are named by the word after the comma.
      const expected = own.length === 1 ? own[0]?.reads : own.map((row) => `${row.work.split(', ').at(-1) ?? ''}, ${row.reads}`).join('; ');
      expect(reads).toBe(expected);
      for (const row of own) expect(never).toBe(row.never);
    });
  }

  it('the folder holds exactly the seven', () => {
    expect(readdirSync('docs/sdd/workflows').sort()).toEqual(WORKFLOWS.map((name) => `${name}.md`).sort());
  });

  it("no workflow calls a tool by one agent's name", () => {
    const AGENT_NAMED = /\bclaude\b|\bcodex\b|\bcursor\b|\bgemini\b|\bcopilot\b|TodoWrite|AskUserQuestion|\bSkill\b|subagent/i;
    for (const name of WORKFLOWS) expect(AGENT_NAMED.exec(workflow(name))?.[0], name).toBeUndefined();
  });

  it("review.md carries D-1065's tiers and finding shape", () => {
    const review = workflow('review');
    for (const path of ['`src/physics/`', '`src/worker/`', '`scripts/sdd/`', '`Tier: hard`', '`Gate: owner`']) expect(review).toContain(path);
    for (const tier of ['no review session', '`standard`', '`light`']) expect(review).toContain(tier);
    expect(review).toContain('{"file": "<repo path>", "line": <n>, "claim": ');
    expect(review).toContain('"scenario": ');
  });

  it("fix-ci.md starts from the digest and the findings, and visual-review.md names D-1068's scripts", () => {
    const fix = workflow('fix-ci');
    expect(fix).toContain('`failure-digest`');
    expect(fix).toContain('{file, line, claim, scenario}');
    const visual = workflow('visual-review');
    for (const script of ['scripts/captures/manifest.json', 'scripts/captures/diff.ts', 'scripts/captures/compress.ts', '`CAPTURE_DIFF_SHARE`', '`captures`']) expect(visual).toContain(script);
  });

  it('breakdown.md aims at TASK_DIFF_TARGET_LINES and lists deleted tests and manifest entries (FR-SDD-21)', () => {
    const breakdown = workflow('breakdown');
    expect(breakdown).toContain('`TASK_DIFF_TARGET_LINES`');
    expect(breakdown).toContain('superseded tests it deletes');
    expect(breakdown).toContain('capture-manifest entries it adds');
  });
});

describe('FR-SDD-9: each skill is a pointer to its workflow', () => {
  it('the skills are the four the tree has', () => {
    const dirs = readdirSync('.claude/skills', { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    expect(dirs.sort()).toEqual(Object.keys(SKILLS).sort());
  });

  for (const [skill, name] of Object.entries(SKILLS)) {
    it(`${skill} keeps its frontmatter and at most five lines, pointing to ${name}.md`, () => {
      const text = readFileSync(`.claude/skills/${skill}/SKILL.md`, 'utf8');
      const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
      expect(match, 'no frontmatter').not.toBeNull();
      expect(match?.[1]).toContain(`name: ${skill}`);
      expect(match?.[1]).toMatch(/^description: .+/m);
      const body = (match?.[2] ?? '').trimEnd().split('\n');
      expect(body.length).toBeLessThanOrEqual(5);
      expect(match?.[2]).toContain(`Follow \`docs/sdd/workflows/${name}.md\`.`);
      expect(existsSync(`docs/sdd/workflows/${name}.md`)).toBe(true);
    });
  }
});
