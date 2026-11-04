/**
 * R179 (D-1069): `npm run check:sdd`, one failing fixture per rule, each run on a small git tree so
 * the production paths (`git ls-files`, the generators) run; then the committed tree passes.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { compressPng } from '../../scripts/captures/compress';
import { CAPTURE_DIFF_SHARE } from '../../scripts/captures/diff';
import { longTitles, type Commit } from '../../scripts/check-trailers';
import { FAILURE_DIGEST_MAX_KB } from '../../scripts/ci-digest';
import {
  checkAgents,
  checkCaptures,
  checkDecisionsUnique,
  checkGenerated,
  checkIdsResolve,
  checkLines,
  checkSizes,
  checkTested,
  newestBrokenDown,
  checkWorkflows,
  pendingIds,
  phaseBlocks,
  run,
  WORKFLOWS,
  type Outcome,
} from '../../scripts/check-sdd';
import { renderMap, MAP_PATH } from '../../scripts/sdd-map';
import { generateIds, IDS_PATH } from '../../scripts/sdd/ids';
import { FILE_WARN_LINES, LIMITS } from '../../scripts/sdd/limits';
import { generateTraceability, TRACEABILITY_PATH } from '../../scripts/sdd/traceability';

type Files = Record<string, string | Buffer>;

/** A test file's source naming `id` in its title, built so this file's own source holds no such title. */
const titled = (id: string, call = 'it'): string => `${call}('${id}: holds', () => {});\n`;

const AGENTS = ['# Agents', '', '## What each kind of work reads', '', '| Work | Workflow |', '|---|---|', ...WORKFLOWS.map((name) => `| ${name} | \`docs/sdd/workflows/${name}.md\` |`), ''].join('\n');

/** A tree every rule passes on. */
const BASE: Files = {
  // FR-SDD-24 and D-1069 are what the generated traceability heading cites.
  'SPEC.md': '# Spec\n\n## 1. Summary\n\n- **FR-X-1** One rule.\n- **FR-SDD-24** Tests carry their ids.\n',
  'PLAN.md': '# Plan\n\n- **D-1 — A decision.** Its text.\n- **D-1069 — Traceability.** Its text.\n',
  'TASKS.md': '# Tasks\n\n## Status\n\n| Phase | State |\n\n## v9 tasks\n\n- [ ] **R1 — A task**\n  - **Satisfies:** FR-X-1.\n',
  'AGENTS.md': AGENTS,
  'CLAUDE.md': '@AGENTS.md\n',
  ...Object.fromEntries(WORKFLOWS.map((name) => [`docs/sdd/workflows/${name}.md`, `# ${name}\n\nReads: this.\nNever reads: that.\n`])),
  'sdd.agents.json': readFileSync('sdd.agents.json', 'utf8'),
  'scripts/sdd/x.ts': '/** A script. */\nexport const x = 1;\n',
  'scripts/captures/manifest.json': JSON.stringify({ all: ['SPEC.md'], routes: { r: ['PLAN.md'] }, screens: { home: { route: 'r', extras: [] } } }),
  'tests/x.test.ts': titled('FR-X-1'),
};

const write = (root: string, files: Files): void => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
};
const git = (root: string, ...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

/** BASE plus `files`, committed to git, with the three generated files written; then `after` written over them. */
function tree(files: Files = {}, after: Files = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'check-sdd-'));
  write(root, { ...BASE, ...files });
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  write(root, { [IDS_PATH]: generateIds(root), [MAP_PATH]: renderMap(root), [TRACEABILITY_PATH]: '# Traceability\n' });
  write(root, { [TRACEABILITY_PATH]: generateTraceability(root) });
  write(root, after);
  git(root, 'add', '-A');
  return root;
}

const messages = (outcome: Outcome): string[] => outcome.problems.map((problem) => problem.message);
const long = (text = 'A sentence that runs on'): string => `${text}${' and on'.repeat(70)}.`;
const kb = (size: number): string => `${'x'.repeat(99)}\n`.repeat(Math.ceil((size * 1024) / 100));

describe('check:sdd on a tree every rule passes', () => {
  it('reports nothing', () => {
    const root = tree();
    for (const rule of [checkLines, checkSizes, checkGenerated, checkIdsResolve, checkDecisionsUnique, checkWorkflows, checkAgents, checkTested]) expect(messages(rule(root)), rule.name).toEqual([]);
    expect(messages(checkCaptures(root, ['home']))).toEqual([]);
  });
});

describe('FR-SDD-4: a long line', () => {
  it('fails over DOC_LINE_MAX, and lists a table row, a task field and a sentence the split moved', () => {
    const moved = long('A sentence the split moved verbatim');
    const root = tree({
      'docs/sdd/gotchas.md': `# Gotchas\n\n- ${long()}\n| ${long('a row')} |\n${moved}\n`,
      'TASKS.md': `${String(BASE['TASKS.md'])}  - **Scope:** ${long('the scope')}\n`,
      'scripts/sdd/__fixtures__/parent/PLAN.md': `${moved}\n`,
    });
    const outcome = checkLines(root);
    expect(messages(outcome)).toEqual([expect.stringMatching(/^docs\/sdd\/gotchas\.md:3 \(\d+ chars\) is over DOC_LINE_MAX \(400\)$/)]);
    expect(outcome.listed).toHaveLength(3);
  });
});

describe('FR-SDD-13: one failing fixture per ceiling', () => {
  const sizes = (files: Files): string[] => messages(checkSizes(tree(files)));
  it('INDEX_MAX_KB on SPEC.md and PLAN.md', () => {
    expect(sizes({ 'SPEC.md': kb(16) })).toEqual([expect.stringContaining('SPEC.md is 16.')]);
    expect(sizes({ 'PLAN.md': kb(16) })).toEqual([expect.stringContaining('over INDEX_MAX_KB')]);
  });
  it('INDEX_MAX_KB on TASKS.md without the open phase (D-1081), and TASKS.md holds the open phase only', () => {
    expect(sizes({ 'TASKS.md': `# Tasks\n\n## v9 tasks\n\n${kb(20)}` })).toEqual([]);
    expect(sizes({ 'TASKS.md': `# Tasks\n\n## Status\n\n${kb(16)}\n## v9 tasks\n` })).toEqual([expect.stringContaining('TASKS.md without the open phase')]);
    expect(sizes({ 'TASKS.md': '# Tasks\n\n## v8 tasks\n\n## v9 tasks\n' })).toEqual(['TASKS.md holds 2 phases (v8 tasks, v9 tasks); it holds the open one only']);
    expect(phaseBlocks('## Status\n## v9 tasks\n### Wave 1\nx\n## After\n')).toEqual([{ heading: '## v9 tasks', text: '## v9 tasks\n### Wave 1\nx' }]);
  });
  it('PHASE_DOC_MAX_KB from v2.13 on; an earlier phase the split moved is listed', () => {
    expect(sizes({ 'docs/sdd/phases/v2.13/spec.md': kb(61) })).toEqual([expect.stringContaining('over PHASE_DOC_MAX_KB')]);
    const outcome = checkSizes(tree({ 'docs/sdd/phases/v2.12/plan.md': kb(61) }));
    expect(messages(outcome)).toEqual([]);
    expect(outcome.listed).toEqual(['docs/sdd/phases/v2.12/plan.md']);
  });
  it('AREA_DOC_MAX_KB, WORKFLOW_MAX_KB and AGENTS_MAX_KB', () => {
    expect(sizes({ 'docs/sdd/areas/sky.md': kb(31) })).toEqual([expect.stringContaining('over AREA_DOC_MAX_KB')]);
    expect(sizes({ 'docs/sdd/workflows/review.md': `# review\n\nReads: a.\nNever reads: b.\n${kb(5)}` })).toEqual([expect.stringContaining('over WORKFLOW_MAX_KB')]);
    expect(sizes({ 'AGENTS.md': `${AGENTS}${kb(7)}` })).toEqual([expect.stringContaining('over AGENTS_MAX_KB')]);
  });
});

describe('FR-SDD-6, FR-SDD-14, FR-SDD-24: a stale generated file', () => {
  it('ids.md', () => {
    expect(messages(checkGenerated(tree({}, { 'SPEC.md': `${String(BASE['SPEC.md'])}- **FR-X-2** Another.\n` })))).toEqual([expect.stringMatching(/^docs\/sdd\/ids\.md is stale/)]);
  });
  it('map.md', () => {
    expect(messages(checkGenerated(tree({}, { 'scripts/y.ts': 'export const y = 2;\n' })))).toEqual([expect.stringMatching(/^docs\/sdd\/map\.md is stale/)]);
  });
  it('traceability.md', () => {
    expect(messages(checkGenerated(tree({}, { 'tests/y.test.ts': titled('FR-X-1') })))).toEqual([expect.stringMatching(/^docs\/sdd\/reference\/traceability\.md is stale/)]);
  });
});

describe('FR-SDD-6: an id that does not resolve', () => {
  it('fails in the docs, the code or the tests; a range, a letter suffix and moved text are not failures', () => {
    const root = tree({
      'scripts/a.ts': '// FR-X-1, FR-X-1b and D-1 resolve; D-5..D-9 and D-10 to D-12 are a reservation.\n// FR-NOPE-9 does not.\n',
      'docs/notes.md': 'Cites F-77, which the split moved.\n',
      'scripts/sdd/__fixtures__/parent/SPEC.md': 'Cites F-77, which the split moved.\n',
    });
    const outcome = checkIdsResolve(root);
    expect(messages(outcome)).toEqual(['FR-NOPE-9 (first cited at scripts/a.ts:2) is not in docs/sdd/ids.md']);
    expect(outcome.listed).toEqual(['F-77 at docs/notes.md:1 (moved text)']);
  });
});

describe('no D- id defined twice across docs/sdd/', () => {
  it('fails on a second definition, not on an amendment', () => {
    const root = tree({
      'docs/sdd/phases/v2.13/plan.md': '- **D-1088 — Captures.** One.\n- **D-1088 evidence — more.**\n',
      'docs/sdd/phases/v2.12/plan.md': '| **D-1088** | Two. |\n',
    });
    expect(messages(checkDecisionsUnique(root))).toEqual(['D-1088 is defined at docs/sdd/phases/v2.12/plan.md:1 and again at docs/sdd/phases/v2.13/plan.md:1']);
  });
});

describe('FR-SDD-8, FR-SDD-9: a workflow without its reading row', () => {
  it('fails on a missing row, a workflow AGENTS.md does not name, a missing workflow and a CLAUDE.md that is not the import', () => {
    expect(messages(checkWorkflows(tree({ 'docs/sdd/workflows/review.md': '# review\n\nRead the diff.\n' })))).toEqual([expect.stringContaining('review.md does not open with its title')]);
    expect(messages(checkWorkflows(tree({ 'AGENTS.md': AGENTS.replace('`docs/sdd/workflows/spec.md`', 'spec') })))).toEqual(["AGENTS.md's reading table does not name docs/sdd/workflows/spec.md"]);
    expect(messages(checkWorkflows(tree({ 'CLAUDE.md': '# Rules\n' })))).toEqual(['CLAUDE.md is not the one line `@AGENTS.md`']);
    const root = tree();
    git(root, 'rm', '-q', '-f', 'docs/sdd/workflows/release.md');
    expect(messages(checkWorkflows(root))).toEqual(['docs/sdd/workflows/release.md is missing']);
  });
});

describe('FR-SDD-10: an invalid agents config', () => {
  it('fails the schema, and an agent or model named in scripts/sdd/', () => {
    const broken = JSON.parse(String(BASE['sdd.agents.json'])) as { agents: Record<string, { parser: string }> };
    for (const agent of Object.values(broken.agents)) agent.parser = 'xml';
    expect(messages(checkAgents(tree({ 'sdd.agents.json': JSON.stringify(broken) })))).toEqual([expect.stringContaining('sdd.agents.json is invalid')]);
    const [model] = Object.values((JSON.parse(String(BASE['sdd.agents.json'])) as { agents: Record<string, { tiers: Record<string, { model: string }> }> }).agents).flatMap((agent) => Object.values(agent.tiers).map((tier) => tier.model));
    expect(messages(checkAgents(tree({ 'scripts/sdd/x.ts': `export const x = '${String(model)}';\n` })))).toEqual(['scripts/sdd/x.ts names an agent or a model; they live in sdd.agents.json']);
  });
});

describe('FR-SDD-22: a capture with no manifest entry', () => {
  const png = (level: number): Buffer => {
    const image = new PNG({ width: 64, height: 64 });
    image.data.fill(255);
    return PNG.sync.write(image, { deflateLevel: level, deflateStrategy: 0 });
  };
  it('fails on a screen with no entry, an entry for no screen, a glob naming no file and an uncompressed capture', () => {
    expect(messages(checkCaptures(tree(), ['home', 'stars']))).toEqual([expect.stringContaining('`stars` has no entry')]);
    expect(messages(checkCaptures(tree(), []))).toEqual([expect.stringContaining('names `home`, which tests/e2e/captureSet.ts does not shoot')]);
    const manifest = JSON.stringify({ all: ['SPEC.md', 'gone/**'], routes: { r: ['PLAN.md'] }, screens: { home: { route: 'r', extras: [] } } });
    expect(messages(checkCaptures(tree({ 'scripts/captures/manifest.json': manifest }), ['home']))).toEqual(["scripts/captures/manifest.json's `gone/**` names no tracked file"]);
    const raw = png(0);
    expect(messages(checkCaptures(tree({ 'docs/screenshots/v1-home-390-dark-en.png': raw }), ['home']))).toEqual([expect.stringContaining('v1-home-390-dark-en.png is not compressed')]);
    expect(messages(checkCaptures(tree({ 'docs/screenshots/v1-home-390-dark-en.png': compressPng(raw) }), ['home']))).toEqual([]);
  });
});

describe('FR-SDD-24: a v2.13 requirement with no test', () => {
  const spec = '# v2.13\n\n- **FR-SDD-90** Tested.\n- **FR-SDD-91** Untested.\n- **FR-SDD-92** Owed by an open task.\n';
  it('fails unless a test title names it or an open task still owes it; an earlier phase is not checked', () => {
    const root = tree({
      'docs/sdd/phases/v2.13/spec.md': spec,
      'docs/sdd/phases/v2.12/spec.md': '- **FR-OLD-1** Never tested by name.\n',
      'tests/sdd.test.ts': titled('FR-SDD-90', 'describe'),
      'TASKS.md': `${String(BASE['TASKS.md'])}- [x] **R2 — Done**\n  - **Satisfies:** FR-SDD-91.\n- [ ] **R3 — Open**\n  - **Satisfies:** FR-SDD-92 (part).\n`,
    });
    expect(messages(checkTested(root))).toEqual(['FR-SDD-91 (v2.13) has no test naming it in its title']);
    expect([...pendingIds(readFileSync(join(root, 'TASKS.md'), 'utf8'))]).toEqual(['FR-X-1', 'FR-SDD-92']);
  });

  it('V214-14: skips a phase written after the newest one with tasks, and checks it once it has them', () => {
    const spec = { 'docs/sdd/phases/v2.14/spec.md': '# v2.14\n\n- **FR-NEW-1** Written, not broken down.\n' };
    const written = tree({ ...spec, 'TASKS.md': '# Tasks\n\n## Status\n\n## v2.13 tasks\n\n- [x] **R1 — Done**\n' });
    expect(newestBrokenDown(written)).toBe('v2.13');
    expect(messages(checkTested(written))).toEqual([]);
    const broken = tree({ ...spec, 'TASKS.md': '# Tasks\n\n## Status\n\n## v2.14 tasks\n\n- [x] **R1 — Done**\n' });
    expect(messages(checkTested(broken))).toEqual(['FR-NEW-1 (v2.14) has no test naming it in its title']);
  });

});

describe('FR-SDD-20: a long commit title', () => {
  const commit = (subject: string): Commit => ({ sha: 'abc', subject, body: '' });
  it('fails over COMMIT_TITLE_MAX; the squash suffix GitHub adds is not counted', () => {
    const at = 'R179: '.padEnd(LIMITS.COMMIT_TITLE_MAX, 'x');
    expect(longTitles([commit(at), commit(`${at} (#279)`)])).toEqual([]);
    expect(longTitles([commit(`${at}y`)]).map((c) => c.subject.length)).toEqual([73]);
  });
});

describe('FR-SDD-13: the constants are SPEC §4.56 table, held in one place', () => {
  it('names every row of the table with its value', () => {
    const rows = readFileSync('docs/sdd/phases/v2.13/spec.md', 'utf8').split('\n').filter((line) => /^\| `[A-Z_]+`/.test(line));
    const table: Record<string, number> = {};
    for (const row of rows) {
      const [names = '', value = ''] = row.split('|').slice(1, 3);
      const keys = [...names.matchAll(/`([A-Z_]+)`/g)].map((match) => match[1] ?? '');
      const values = value.split('/').map((part) => (part.includes('%') ? Number.parseFloat(part) / 100 : Number.parseFloat(part.replace(/,/g, ''))));
      keys.forEach((key, index) => (table[key] = values[index] ?? Number.NaN));
    }
    expect(LIMITS).toEqual(table);
  });
  it('and the two scripts that run under plain node keep the same numbers', () => {
    expect(FAILURE_DIGEST_MAX_KB).toBe(LIMITS.FAILURE_DIGEST_MAX_KB);
    expect(CAPTURE_DIFF_SHARE).toBe(LIMITS.CAPTURE_DIFF_SHARE);
  });
});

describe('FR-SDD-19: lint warns past FILE_WARN_LINES', () => {
  it("uses ESLint's own max-lines at warn, with limits.ts's number", async () => {
    const eslint = new ESLint();
    for (const file of ['scripts/x.ts', 'src/ui/x.tsx', 'tests/x.test.ts']) {
      const effective = (await eslint.calculateConfigForFile(file)) as { rules?: Record<string, unknown> };
      expect(effective.rules?.['max-lines'], file).toEqual([1, { max: FILE_WARN_LINES }]);
    }
    const lines = (count: number): string => Array.from({ length: count }, (_, index) => `export const a${String(index)} = ${String(index)};`).join('\n') + '\n';
    const [over] = await eslint.lintText(lines(FILE_WARN_LINES + 1), { filePath: 'scripts/long-fixture.ts' });
    expect(over?.messages.map((message) => [message.ruleId, message.severity])).toEqual([['max-lines', 1]]);
    const [under] = await eslint.lintText(lines(FILE_WARN_LINES), { filePath: 'scripts/long-fixture.ts' });
    expect(under?.messages).toEqual([]);
  }, 30_000);
});

describe('US-51 AC7: check:sdd in CI, and on this tree', () => {
  it('runs in an sdd job with no `if:`, so a docs-only pull request runs it too', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    const start = ci.indexOf('\n  sdd:\n');
    const job = ci.slice(start, start + 1 + ci.slice(start + 1).search(/\n {2}[a-z-]+:\n/));
    expect(job).toContain('npm run -s check:sdd 2>&1 | tee reports/sdd.txt');
    expect(job).not.toMatch(/^ {4}if:/m);
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts['check:sdd']).toBe('tsx scripts/check-sdd.ts');
  });
  it('exits 0 on the committed tree, and 1 on a broken one', () => {
    const lines: string[] = [];
    expect(run('.', (line) => lines.push(line)), lines.join('\n')).toBe(0);
    expect(run(tree({ 'CLAUDE.md': 'x\n' }), () => undefined)).toBe(1);
  }, 60_000);
});
