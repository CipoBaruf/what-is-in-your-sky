/**
 * PLAN §16.3: the driver reads TASKS.md, so the parser is pinned against the
 * real file — the MVP block (R1–R15 and H, which carry no
 * `Lane:`/`Model:`/`Gate:`) and the v1 block, which carries all three — and
 * against the v1 shape `sdd-breakdown` emits.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { branchName, byId, modelFor, parseTasks, runBlockers, type Task } from '../../scripts/sdd/tasks';

const real = parseTasks(readFileSync('TASKS.md', 'utf8'));
const sample = parseTasks(readFileSync('tests/sdd/fixtures/tasks-v1-sample.md', 'utf8'));

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
    for (const task of mvpTasks) expect([task.lane, task.model, task.gate]).toEqual([null, null, null]);
  });

  it('gives every v1 task a lane and a gate, so the driver can run it (§16.3)', () => {
    expect(v1Tasks.length).toBeGreaterThan(0);
    for (const task of v1Tasks) expect({ id: task.id, blockers: runBlockers(task) }).toEqual({ id: task.id, blockers: [] });
  });
});

describe('the v1 task shape', () => {
  it('reads the lane, model, gate and dependencies', () => {
    expect(byId(sample.tasks, 'R17')).toMatchObject({ lane: 'chart', model: 'fable', gate: 'owner', deps: ['R16'], done: false });
    expect(byId(sample.tasks, 'R16')?.done).toBe(true);
    expect(byId(sample.tasks, 'R21')?.deps).toEqual(['R19', 'R20']);
  });

  it('reports a task with no `Gate:` as a breakdown bug the driver refuses to run', () => {
    const moon = byId(sample.tasks, 'R22');
    expect(moon?.gate).toBeNull();
    expect(runBlockers(sampleTask('R22'))).toEqual(['no `Gate:`']);
    expect(runBlockers(sampleTask('R17'))).toEqual([]);
  });

  it('defaults the model to Opus (§16.6)', () => {
    expect(modelFor(sampleTask('R22'))).toBe('opus');
    expect(modelFor(sampleTask('R17'))).toBe('fable');
  });

  it('names a branch per task, capped at four words', () => {
    expect(byId(sample.tasks, 'R17')?.branch).toBe('r17-the-layered-dome');
    expect(byId(sample.tasks, 'R16')?.branch).toBe('r16-language-preference-and-the');
    expect(branchName('R99', 'Overwhelmingly, extraordinarily, unnecessarily long')).toBe('r99-overwhelmingly-extraordinarily');
    expect(branchName('H', '')).toBe('h');
  });
});

describe('bad values', () => {
  const bad = parseTasks(['- [ ] **R30 — A task**', '  - **Lane:** everything', '  - **Model:** haiku', '  - **Gate:** maybe', '  - **Depends on:** R99', '', '- [ ] **R30 — Again**'].join('\n'));

  it('names each one against its task and leaves the field null', () => {
    expect(bad.tasks[0]).toMatchObject({ lane: null, model: null, gate: null });
    expect(bad.problems).toEqual([
      'R30: `Lane: everything` is not one of ui, chart, data, physics, live.',
      'R30: `Model: haiku` is not one of opus, fable.',
      'R30: `Gate: maybe` is not one of auto, owner.',
      'R30: appears twice in TASKS.md.',
      'R30: depends on R99, which is not a task.',
    ]);
  });

  it('treats an em dash, a hyphen or nothing as no dependencies', () => {
    for (const value of ['—', '-', 'none', '']) expect(parseTasks(`- [ ] **R31 — A task**\n  - **Depends on:** ${value}`).tasks[0]?.deps).toEqual([]);
  });
});
