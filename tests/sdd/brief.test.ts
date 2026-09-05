/**
 * PLAN §16.4 step 3 (D-198): the brief a session reads instead of the three
 * documents. Pinned against the real files, so a task whose entry cites an
 * id the documents do not carry, or whose brief outgrows §16.8's budget,
 * fails here before a wave pays for it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRIEF_BUDGET_CHARS, boldBullet, buildBrief, citedIds, laneRow, tableRow, taskEntry, userStory } from '../../scripts/sdd/brief';
import { DENIED_TOOLS, IMPLEMENT_TOOLS } from '../../scripts/sdd/session';
import { byId, parseTasks } from '../../scripts/sdd/tasks';

const sources = { spec: readFileSync('SPEC.md', 'utf8'), plan: readFileSync('PLAN.md', 'utf8'), tasks: readFileSync('TASKS.md', 'utf8') };
const tools = { allowedTools: IMPLEMENT_TOOLS, deniedTools: DENIED_TOOLS };
const { tasks } = parseTasks(sources.tasks);
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

describe('the extractors, on the real documents', () => {
  it('takes a task entry from its heading to the next line at the margin', () => {
    const entry = taskEntry(sources.tasks, 'R37');
    expect(entry?.startsWith('- [ ] **R37 — CI time')).toBe(true);
    expect(entry).toContain('- **Done when:**');
    expect(entry).not.toContain('**R38');
  });

  it('takes a requirement, a decision, a story, a finding row and a lane row by id', () => {
    expect(boldBullet(sources.spec, 'FR-CI-1')).toMatch(/^- \*\*FR-CI-1\*\* A pull request's CI MUST finish/);
    expect(boldBullet(sources.spec, 'FR-CI-1')).not.toContain('FR-CI-2');
    expect(boldBullet(sources.plan, 'D-89')).toMatch(/^- \*\*D-89 — The turn cap is 250/);
    expect(userStory(sources.spec, 'US-20')).toMatch(/^\*\*US-20 — Set things up on a phone/);
    expect(userStory(sources.spec, 'US-20')).toContain('AC6');
    expect(userStory(sources.spec, 'US-20')).not.toContain('US-21');
    expect(tableRow(sources.spec, 'F-46')).toMatch(/^\| F-46 \| R36 #58 \| ui \|/);
    expect(tableRow(sources.spec, 'V11-10')).toMatch(/^\| 2026-09-05 \| V11-10 \|/);
    expect(tableRow(sources.spec, 'OQ-17')).toMatch(/^\| OQ-17/);
    expect(laneRow(sources.plan, 'ui')).toMatch(/^\| `ui` \| `src\/ui\/\*\*`/);
  });

  it('does not confuse F-1 with F-10 or D-89 with D-189', () => {
    expect(tableRow(sources.spec, 'F-1')).toMatch(/^\| F-1 \|/);
    expect(boldBullet(sources.plan, 'D-89')).toMatch(/^- \*\*D-89 /);
    expect(boldBullet(sources.plan, 'FR-NOPE-1')).toBeNull();
  });
});

describe('buildBrief', () => {
  it('carries R37 its entry, its requirements, its findings, its decisions, its lane row, D-89 and the allowlist', () => {
    const { markdown, missing } = buildBrief(task('R37'), sources, tools);
    expect(missing).toEqual([]);
    expect(markdown).toContain('# R37 — CI time');
    expect(markdown).toContain('- [ ] **R37 — CI time');
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
    const { markdown, missing } = buildBrief({ ...task('R41'), id: 'R99', findings: ['F-999'] }, sources, tools);
    expect(missing).toContain('F-999');
    expect(markdown).toContain('entry not found in TASKS.md');
  });

  it(`stays under ${String(BRIEF_BUDGET_CHARS)} characters and cites nothing missing, for every open task (§16.8)`, () => {
    expect(open.length).toBeGreaterThan(0);
    for (const candidate of open) {
      const { markdown, missing } = buildBrief(candidate, sources, tools);
      expect(missing, `${candidate.id} cites ids the documents do not carry`).toEqual([]);
      expect(markdown.length, `${candidate.id}'s brief is over budget`).toBeLessThan(BRIEF_BUDGET_CHARS);
    }
  });
});
