/**
 * PLAN §16.2 and §16.5: which tasks are ready, which wave runs, and why the
 * driver refuses `--task`. Every input here is what git and `gh` would have
 * said, so nothing in this file reaches the network.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTasks, type Task } from '../../scripts/sdd/tasks';
import { refusalFor, selectWave, statusOf, type TaskStatus } from '../../scripts/sdd/waves';

const { tasks } = parseTasks(readFileSync('tests/sdd/fixtures/tasks-v1-sample.md', 'utf8'));

const facts = (openPrs: [string, number][] = [], branches: string[] = [], onMain?: string[]): TaskStatus[] =>
  statusOf({ tasks, openPrs: new Map(openPrs), remoteBranches: new Set(branches), ...(onMain ? { fileOnMain: (path: string) => onMain.includes(path) } : {}) });

const state = (statuses: readonly TaskStatus[], id: string): string | undefined => statuses.find((status) => status.task.id === id)?.state;
const ids = (list: readonly { task: Task }[]): string[] => list.map((entry) => entry.task.id);

describe('status', () => {
  it('reads merged from the checkbox, and blocked from an unmerged dependency', () => {
    const statuses = facts();
    expect(state(statuses, 'R16')).toBe('merged');
    expect(state(statuses, 'R17')).toBe('ready');
    expect(state(statuses, 'R21')).toBe('blocked');
    expect(statuses.find((status) => status.task.id === 'R21')?.missingDeps).toEqual(['R19', 'R20']);
  });

  it('calls a task with an open PR in review', () => {
    expect(state(facts([['R17', 42]]), 'R17')).toBe('in-review');
    expect(facts([['R17', 42]]).find((status) => status.task.id === 'R17')?.pr).toBe(42);
  });

  it('calls a task with a branch on origin and no open PR failed — the residue §16.5 keeps', () => {
    expect(state(facts([], ['r17-the-layered-dome']), 'R17')).toBe('failed');
  });
});

describe('the wave', () => {
  it('runs at most one per lane and at most three at once, in file order', () => {
    const { wave, skipped } = selectWave(facts());
    expect(ids(wave)).toEqual(['R17', 'R18', 'R20']);
    expect(wave.map((status) => status.task.lane)).toEqual(['chart', 'ui', 'data']);
    expect(skipped.find((entry) => entry.task.id === 'R19')?.reason).toBe('lane `chart` is busy');
  });

  it('fills the wave to the cap and says so for the rest', () => {
    const { wave, skipped } = selectWave(facts(), { maxPerLane: 1, maxTasks: 2 });
    expect(ids(wave)).toEqual(['R17', 'R18']);
    expect(skipped.find((entry) => entry.task.id === 'R19')?.reason).toBe('wave is full (2 at once)');
  });

  it('holds a lane that already has a PR in review', () => {
    const { wave, skipped } = selectWave(facts([['R17', 42]]));
    expect(ids(wave)).toEqual(['R18', 'R20', 'R24']);
    expect(skipped.find((entry) => entry.task.id === 'R19')?.reason).toBe('lane `chart` is busy');
  });

  it('refuses a task with no `Gate:` and says so (§16.3)', () => {
    const { wave, skipped } = selectWave(facts(), { maxPerLane: 1, maxTasks: 5 });
    expect(ids(wave)).toEqual(['R17', 'R18', 'R20', 'R24']);
    expect(skipped).toContainEqual({ task: expect.objectContaining({ id: 'R22' }) as Task, reason: 'breakdown bug: no `Gate:`' });
  });

  it('lists an owner-driven task and never runs it (§16.6, D-197)', () => {
    const statuses = facts();
    expect(state(statuses, 'R23')).toBe('owner-driven');
    expect(ids(selectWave(statuses, { maxPerLane: 1, maxTasks: 9 }).wave)).not.toContain('R23');
    expect(refusalFor(statuses, 'R23')).toBe('R23 is `Model: interactive`: the owner drives it in a session by hand (§16.6).');
  });

  it('holds a task whose precondition is not on origin/main yet, and takes it as met when nothing is known (§16.3)', () => {
    const held = facts([], [], []);
    expect(state(held, 'R24')).toBe('ready');
    expect(selectWave(held, { maxPerLane: 1, maxTasks: 9 }).skipped).toContainEqual({ task: expect.objectContaining({ id: 'R24' }) as Task, reason: 'precondition `docs/window/FINDINGS.md` is not on origin/main yet (§16.3)' });
    expect(refusalFor(held, 'R24')).toBe('R24 waits for `docs/window/FINDINGS.md` to exist on origin/main (§16.3).');
    expect(ids(selectWave(facts([], [], ['docs/window/FINDINGS.md']), { maxPerLane: 1, maxTasks: 9 }).wave)).toContain('R24');
    expect(ids(selectWave(facts(), { maxPerLane: 1, maxTasks: 9 }).wave)).toContain('R24');
  });

  it('is empty when everything is merged', () => {
    // The real TASKS.md with every checkbox ticked: a whole-file corpus with nothing left to run.
    const merged = parseTasks(readFileSync('TASKS.md', 'utf8').replaceAll('- [ ] **', '- [x] **')).tasks;
    expect(selectWave(statusOf({ tasks: merged, openPrs: new Map(), remoteBranches: new Set() }))).toEqual({ wave: [], skipped: [] });
  });
});

describe('refusing --task', () => {
  it('accepts a ready task', () => {
    expect(refusalFor(facts(), 'r17')).toBeNull();
  });

  it('names the reason otherwise', () => {
    expect(refusalFor(facts(), 'R99')).toBe('R99 is not a task in TASKS.md.');
    expect(refusalFor(facts(), 'R16')).toBe('R16 is already checked off on origin/main.');
    expect(refusalFor(facts(), 'R21')).toBe('R21 depends on R19, R20, not checked off on origin/main.');
    expect(refusalFor(facts(), 'R22')).toBe('R22 has a breakdown bug: no `Gate:` (§16.3).');
    expect(refusalFor(facts([['R17', 42]]), 'R17')).toBe('R17 has an open PR (#42); merge or close it first.');
    expect(refusalFor(facts([], ['r17-the-layered-dome']), 'R17')).toContain('delete it before retrying');
  });
});
