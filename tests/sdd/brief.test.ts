/**
 * PLAN §16.4 step 3 (D-198): the brief a session reads instead of the three
 * documents. Pinned against the real layout, so a task whose entry cites an
 * id the documents do not carry, or whose brief outgrows §16.8's budget,
 * fails here before a wave pays for it; and (FR-SDD-7, D-1062) the briefs of
 * R167–R171 come out of the split layout byte for byte as they did before it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRIEF_BUDGET_CHARS, boldBullet, buildBrief, citedIds, documentSources, laneRow, tableRow, taskEntry, userStory } from '../../scripts/sdd/brief';
import { layoutLookup } from '../../scripts/sdd/ids';
import { DENIED_TOOLS, IMPLEMENT_TOOLS } from '../../scripts/sdd/session';
import { byId, layoutTasksText, parseTasks } from '../../scripts/sdd/tasks';

const sources = { textFor: layoutLookup('.') };
const text = (key: string): string => sources.textFor(key) ?? '';
const tools = { allowedTools: IMPLEMENT_TOOLS, deniedTools: DENIED_TOOLS };
const { tasks } = parseTasks(layoutTasksText(readFileSync('TASKS.md', 'utf8'), (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null)));
const open = tasks.filter((task) => !task.done);

const task = (id: string) => {
  const found = byId(tasks, id);
  if (!found) throw new Error(`${id} is not in TASKS.md`);
  return found;
};

describe('citedIds', () => {
  it('finds every id family and keeps first-seen order', () => {
    expect(citedIds('Satisfies FR-CI-1, US-20; closes F-46 (PLAN D-195, V11-10, OQ-17, V1-11), FR-GUIDE-2b.')).toEqual(['FR-CI-1', 'US-20', 'F-46', 'D-195', 'V11-10', 'OQ-17', 'V1-11', 'FR-GUIDE-2b']);
  });

  it('expands the ranges the breakdown writes, in both spellings', () => {
    expect(citedIds('F-11..F-13 and FR-CI-1..3 and D-183..D-184')).toEqual(['F-11', 'F-12', 'F-13', 'FR-CI-1', 'FR-CI-2', 'FR-CI-3', 'D-183', 'D-184']);
  });

  it('does not double-count', () => {
    expect(citedIds('F-1, F-1, F-1..F-2')).toEqual(['F-1', 'F-2']);
  });
});

describe('the extractors, on the real layout', () => {
  it('takes a task entry from its heading to the next line at the margin', () => {
    const entry = taskEntry(text('R37'), 'R37');
    expect(entry).toMatch(/^- \[[ x]\] \*\*R37 — CI time/); // ticked on R37's own branch, so either box
    expect(entry).toContain('- **Done when:**');
    expect(entry).not.toContain('**R38');
  });

  it('takes a requirement, a decision, a story, a finding row and a lane row by id', () => {
    expect(boldBullet(text('FR-CI-1'), 'FR-CI-1')).toMatch(/^- \*\*FR-CI-1\*\* A pull request's CI MUST finish/);
    expect(boldBullet(text('FR-CI-1'), 'FR-CI-1')).not.toContain('FR-CI-2');
    expect(boldBullet(text('D-89'), 'D-89')).toMatch(/^- \*\*D-89 — The turn cap is 250/);
    expect(userStory(text('US-20'), 'US-20')).toMatch(/^\*\*US-20 — Set things up on a phone/);
    expect(userStory(text('US-20'), 'US-20')).toContain('AC6');
    expect(userStory(text('US-20'), 'US-20')).not.toContain('US-21');
    expect(tableRow(text('F-46'), 'F-46')).toMatch(/^\| F-46 \| R36 #58 \| ui \|/);
    expect(tableRow(text('V11-10'), 'V11-10')).toMatch(/^\| 2026-09-05 \| V11-10 \|/);
    expect(tableRow(text('OQ-17'), 'OQ-17')).toMatch(/^\| OQ-17/);
    expect(laneRow(text('PLAN §16.1'), 'ui')).toMatch(/^\| `ui` \| `src\/ui\/\*\*`/);
  });

  it('does not confuse F-1 with F-10 or D-89 with D-189', () => {
    expect(tableRow(text('F-1'), 'F-1')).toMatch(/^\| F-1 \|/);
    expect(boldBullet(text('D-89'), 'D-89')).toMatch(/^- \*\*D-89 /);
    expect(boldBullet(text('D-89'), 'FR-NOPE-1')).toBeNull();
  });
});

describe('buildBrief', () => {
  it('carries R37 its entry, its requirements, its findings, its decisions, its lane row, D-89 and the allowlist', () => {
    const { markdown, missing } = buildBrief(task('R37'), sources, tools);
    expect(missing).toEqual([]);
    expect(markdown).toContain('# R37 — CI time');
    expect(markdown).toMatch(/- \[[ x]\] \*\*R37 — CI time/);
    for (const id of ['FR-CI-1', 'FR-CI-2', 'FR-CI-3', 'FR-FIX-2']) expect(markdown).toContain(`- **${id}**`);
    for (const id of ['F-46', 'F-47', 'F-48', 'F-49', 'F-50']) expect(markdown).toContain(`| ${id} | R36 #58 | ui |`);
    expect(markdown).toContain('- **D-195 —');
    expect(markdown).toContain('- **D-89 —');
    expect(markdown).toContain('| `ui` |');
    expect(markdown).toContain('sdd-run/R37.blocked.md');
    expect(markdown).toContain('sdd-run/R37.summary.md');
    expect(markdown).toContain('`Bash(npx vitest:*)`');
    expect(markdown).toContain('`Bash(git push:*)`');
    // What it does not carry: another lane's row, a requirement it never names.
    expect(markdown).not.toContain('| `chart` |');
    expect(markdown).not.toContain('- **FR-WIN-1**');
  });

  it('adds the `Findings:` field ids even when the entry text does not spell them out', () => {
    const { markdown } = buildBrief(task('R41'), sources, tools);
    for (const id of ['F-11', 'F-12', 'F-13']) expect(markdown).toContain(`| ${id} |`);
  });

  it('reports an id the documents do not carry instead of failing', () => {
    const { markdown, missing } = buildBrief({ ...task('R41'), id: 'R999', findings: ['F-999'] }, sources, tools);
    expect(missing).toContain('F-999');
    expect(markdown).toContain('entry not found in TASKS.md');
  });

  it(`stays under ${String(BRIEF_BUDGET_CHARS)} characters and cites nothing missing, for every open task (§16.8)`, () => {
    // R53: the guard used to be `open.length > 0`, which made "the phase is finished" a test
    // failure — the last task of v1.1 checking itself off turned this red. What the guard is
    // really for is a parser that has stopped returning tasks, since the loop below would then
    // pass by being empty; so it asks the whole list, which is never empty while TASKS.md exists,
    // and an empty backlog is left to mean what it says.
    expect(tasks.length).toBeGreaterThan(0);
    for (const candidate of open) {
      const { markdown, missing } = buildBrief(candidate, sources, tools);
      expect(missing, `${candidate.id} cites ids the documents do not carry`).toEqual([]);
      expect(markdown.length, `${candidate.id}'s brief is over budget`).toBeLessThan(BRIEF_BUDGET_CHARS);
    }
  });
});

describe('FR-SDD-7: the briefs of R167–R171, byte for byte (D-1062)', () => {
  const parent = (name: string): string => readFileSync(`scripts/sdd/__fixtures__/parent/${name}`, 'utf8');
  const before = documentSources({ spec: parent('SPEC.md'), plan: parent('PLAN.md'), tasks: parent('TASKS.md') });
  const beforeTasks = parseTasks(parent('TASKS.md')).tasks;

  for (const id of ['R167', 'R168', 'R169', 'R170', 'R171']) {
    it(`regenerates ${id}'s brief from the split layout as the parent wrote it`, () => {
      const fixture = readFileSync(`scripts/sdd/__fixtures__/briefs/${id}.md`, 'utf8');
      const pinned = byId(beforeTasks, id);
      if (!pinned) throw new Error(`${id} is not in the parent TASKS.md`);
      expect(buildBrief(pinned, before, tools).markdown).toBe(fixture);
      const { markdown, missing } = buildBrief(task(id), sources, tools);
      expect(missing).toEqual([]);
      expect(markdown === fixture, `${id}'s brief differs from the fixture`).toBe(true);
    });
  }
});
