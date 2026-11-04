/**
 * PLAN §16.3: the driver reads TASKS.md and, since the split, each closed
 * phase's tasks.md (FR-SDD-7), so the parser is pinned against the real layout — the MVP block (R1–R15 and H, which carry no
 * `Lane:`/`Model:`/`Gate:`) and the v1 block, which carries all three — and
 * against the v1 shape `sdd-breakdown` emits.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadAgents, modelTiers, pickAgent } from '../../scripts/sdd/agents';
import { branchName, byId, fallbackFor, layoutTasksText, limitsFor, ownerDriven, parseTasks, runBlockers, tierFor, type Task } from '../../scripts/sdd/tasks';

/** FR-SDD-11: the default agent's model → tier map, which closed phases' `Model:` is read through. */
const models = modelTiers(pickAgent(loadAgents()));

const real = parseTasks(layoutTasksText(readFileSync('TASKS.md', 'utf8'), (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null)), models);
const sample = parseTasks(readFileSync('tests/sdd/fixtures/tasks-v1-sample.md', 'utf8'), models);

/** The MVP block is everything up to and including H; the v1 block is what `sdd-breakdown` appended after it. */
const mvpEnd = real.tasks.findIndex((task) => task.id === 'H') + 1;
const mvpTasks = real.tasks.slice(0, mvpEnd);
const v1Tasks = real.tasks.slice(mvpEnd);

/** The sample task with this id; the fixture is committed, so a miss is a broken test. */
function sampleTask(id: string): Task {
  const task = byId(sample.tasks, id);
  if (!task) throw new Error(`${id} is missing from the fixture`);
  return task;
}

describe('the real TASKS.md', () => {
  it('reads the MVP block first, in file order', () => {
    expect(real.tasks.map((task) => task.id).slice(0, 16)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'H']);
    expect(real.tasks.map((task) => task.order)).toEqual([...real.tasks.keys()]);
  });

  it('has no breakdown problems: no duplicate id, no dependency on a task that does not exist', () => {
    expect(real.problems).toEqual([]);
  });

  it('has the MVP block checked off', () => {
    expect(mvpTasks.every((task) => task.done)).toBe(true);
  });

  it('reads the dependency graph', () => {
    expect(byId(real.tasks, 'R1')?.deps).toEqual([]);
    expect(byId(real.tasks, 'R12')?.deps).toEqual(['R6', 'R7', 'R10', 'R11']);
    expect(byId(real.tasks, 'H')?.deps).toEqual(['R1']);
  });

  it('keeps the `[P]` marker out of the id and the title', () => {
    const parallel = byId(real.tasks, 'R4');
    expect(parallel?.parallel).toBe(true);
    expect(parallel?.title).toBe('Deploy the thin product to Cloudflare Pages with the strict CSP');
    expect(byId(real.tasks, 'R1')?.parallel).toBe(false);
  });

  it('leaves the v1 fields null on the MVP tasks, since they predate them', () => {
    for (const task of mvpTasks) expect([task.lane, task.model, task.tier, task.gate]).toEqual([null, null, null, null]);
  });

  it('gives every v1 task a lane and a gate, so the driver can run it (§16.3)', () => {
    expect(v1Tasks.length).toBeGreaterThan(0);
    for (const task of v1Tasks) expect({ id: task.id, blockers: runBlockers(task) }).toEqual({ id: task.id, blockers: [] });
  });
});

describe('the v1 task shape', () => {
  it('reads the lane, model, gate and dependencies', () => {
    expect(byId(sample.tasks, 'R17')).toMatchObject({ lane: 'chart', model: 'fable', tier: 'hard', gate: 'owner', deps: ['R16'], done: false });
    expect(byId(sample.tasks, 'R16')?.done).toBe(true);
    expect(byId(sample.tasks, 'R21')?.deps).toEqual(['R19', 'R20']);
  });

  it('reports a task with no `Gate:` as a breakdown bug the driver refuses to run', () => {
    const moon = byId(sample.tasks, 'R22');
    expect(moon?.gate).toBeNull();
    expect(runBlockers(sampleTask('R22'))).toEqual(['no `Gate:`']);
    expect(runBlockers(sampleTask('R17'))).toEqual([]);
  });

  it('FR-SDD-11: defaults the tier to standard, the tier of the old default model (§16.6)', () => {
    expect(tierFor(sampleTask('R22'))).toBe('standard');
    expect(tierFor(sampleTask('R17'))).toBe('hard');
  });

  it('reads the v1.1 fields: a precondition, the findings, and the owner-driven model (§16.3, D-197)', () => {
    expect(sampleTask('R23')).toMatchObject({ lane: 'window', model: 'interactive', precondition: null, findings: [] });
    expect(ownerDriven(sampleTask('R23'))).toBe(true);
    expect(tierFor(sampleTask('R23'))).toBe('standard');
    expect(sampleTask('R24')).toMatchObject({ lane: 'docs', model: 'sonnet', tier: 'light', precondition: 'docs/window/FINDINGS.md', findings: ['F-3', 'F-35'] });
    expect(ownerDriven(sampleTask('R24'))).toBe(false);
    expect(sampleTask('R17')).toMatchObject({ precondition: null, findings: [] });
  });

  it('names a branch per task, capped at four words', () => {
    expect(byId(sample.tasks, 'R17')?.branch).toBe('r17-the-layered-dome');
    expect(byId(sample.tasks, 'R16')?.branch).toBe('r16-language-preference-and-the');
    expect(branchName('R99', 'Overwhelmingly, extraordinarily, unnecessarily long')).toBe('r99-overwhelmingly-extraordinarily');
    expect(branchName('H', '')).toBe('h');
  });
});

describe('bad values', () => {
  const bad = parseTasks(['- [ ] **R30 — A task**', '  - **Lane:** everything', '  - **Model:** gemini', '  - **Gate:** maybe', '  - **Depends on:** R99', '  - **Findings:** F-1, bug-2', '', '- [ ] **R30 — Again**'].join('\n'), models);

  it('names each one against its task and leaves the field null', () => {
    expect(bad.tasks[0]).toMatchObject({ lane: null, model: null, gate: null });
    expect(bad.problems).toEqual([
      'R30: `Lane: everything` is not one of ui, chart, data, physics, live, window, docs.',
      'R30: `Model: gemini` is not one of fable, opus, sonnet, haiku, interactive.',
      'R30: `Gate: maybe` is not one of auto, owner.',
      'R30: `Findings: bug-2` is not an F-<n> id.',
      'R30: appears twice in TASKS.md.',
      'R30: depends on R99, which is not a task.',
    ]);
  });

  it('treats an em dash, a hyphen or nothing as no dependencies', () => {
    for (const value of ['—', '-', 'none', '']) expect(parseTasks(`- [ ] **R31 — A task**\n  - **Depends on:** ${value}`).tasks[0]?.deps).toEqual([]);
  });
});

describe('FR-SDD-10, FR-SDD-11: `Tier:`, `Agent:` and a closed `Model:`', () => {
  const read = (lines: string[]): ReturnType<typeof parseTasks> => parseTasks(['- [ ] **R90 — A task**', ...lines].join('\n'), models);

  it('reads `Tier:` and `Agent:`', () => {
    expect(read(['  - **Tier:** hard', '  - **Agent:** `claude`']).tasks[0]).toMatchObject({ tier: 'hard', model: null, agent: 'claude' });
    expect(read(['  - **Tier:** light']).tasks[0]).toMatchObject({ tier: 'light', agent: null });
  });

  it('FR-SDD-10: an unknown `Agent:` is a breakdown problem and a blocker for that one task, never a throw', () => {
    const text = ['- [ ] **R90 — A task**', '  - **Lane:** docs', '  - **Gate:** auto', '  - **Agent:** `nobody`', '- [ ] **R91 — Another**', '  - **Lane:** docs', '  - **Gate:** auto', '  - **Agent:** `claude`'].join('\n');
    const { tasks, problems } = parseTasks(text, models, ['claude']);
    expect(problems).toEqual([expect.stringContaining('R90: `Agent: nobody` is not an entry of sdd.agents.json (claude).')]);
    expect(runBlockers(tasks[0] as Task)).toEqual([expect.stringContaining('`Agent: nobody` is not an entry')]);
    expect(runBlockers(tasks[1] as Task)).toEqual([]);
    expect(parseTasks(text, models).problems).toEqual([]);
  });

  it('reads each closed `Model:` through the map: fable→hard, opus→standard, sonnet→light, haiku→light', () => {
    const tiers = ['fable', 'opus', 'sonnet', 'haiku'].map((model) => read([`  - **Model:** ${model}`]).tasks[0]?.tier);
    expect(tiers).toEqual(['hard', 'standard', 'light', 'light']);
  });

  it('lets `Tier:` win over `Model:` in either order, and keeps `interactive` owner-driven', () => {
    expect(read(['  - **Model:** fable', '  - **Tier:** light']).tasks[0]?.tier).toBe('light');
    expect(read(['  - **Tier:** light', '  - **Model:** fable']).tasks[0]?.tier).toBe('light');
    const owner = read(['  - **Model:** interactive']).tasks[0] as Task;
    expect(ownerDriven(owner)).toBe(true);
    expect(owner.tier).toBeNull();
  });

  it('names a bad tier, and reads a model as unknown without the map', () => {
    expect(read(['  - **Tier:** huge']).problems).toEqual(['R90: `Tier: huge` is not one of hard, standard, light.']);
    expect(parseTasks('- [ ] **R91 — A task**\n  - **Model:** opus').problems).toEqual(['R91: `Model: opus` is not one of interactive.']);
  });
});

describe('the v2.2 fields: `Review:`, `Turns:` and `Fallback:` (§16.3, D-659)', () => {
  const base = { implement: { maxTurns: 250, timeoutMs: 45 * 60_000 }, review: { maxTurns: 40, timeoutMs: 15 * 60_000 } };
  const full = parseTasks(
    ['- [ ] **P6 — The address**', '  - **Lane:** docs', '  - **Model:** fable', '  - **Gate:** owner', '  - **Review:** opus', '  - **Turns:** 500', '  - **Fallback:** off'].join('\n'),
    models,
  ).tasks[0] as Task;

  it('reads all three and lets them win over the D-1065 rule, the driver defaults and the flag', () => {
    expect(full).toMatchObject({ review: 'standard', turns: 500, fallback: false });
    expect(fallbackFor(full, true)).toBe(false);
    expect(limitsFor(full, base)).toEqual({ implement: { maxTurns: 500, timeoutMs: 90 * 60_000 }, review: { maxTurns: 80, timeoutMs: 30 * 60_000 } });
  });

  it('leaves a task without them on the old rules: D-1065 picks the review, the flag decides the fallback, the defaults cap the turns', () => {
    const plain = sampleTask('R17');
    expect(plain).toMatchObject({ review: null, turns: null, fallback: null });
    expect(fallbackFor(plain, true)).toBe(true);
    expect(fallbackFor(plain, false)).toBe(false);
    expect(limitsFor(plain, base)).toEqual(base);
  });

  it('names a bad value against its task and leaves the field null', () => {
    const bad = parseTasks(['- [ ] **P7 — A task**', '  - **Review:** interactive', '  - **Turns:** many', '  - **Fallback:** maybe'].join('\n'), models);
    expect(bad.tasks[0]).toMatchObject({ review: null, turns: null, fallback: null });
    expect(bad.problems).toEqual([
      'P7: `Review: interactive` is not one of hard, standard, light, fable, opus, sonnet, haiku.',
      'P7: `Turns: many` is not a positive whole number.',
      'P7: `Fallback: maybe` is not one of on, off.',
    ]);
  });
});
