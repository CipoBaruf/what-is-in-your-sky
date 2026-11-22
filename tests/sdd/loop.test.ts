/**
 * D-1314: `--until-done`'s decision after each wave.
 */
import { describe, expect, it } from 'vitest';
import { failuresOf, INITIAL_LOOP_STATE, LOOP_RESET_MARGIN_MS, LOOP_SLEEP_MAX_MS, LOOP_UNKNOWN_RESET_MS, nextLoopStep, stuckTasks, type LoopTask, type WaveResult } from '../../scripts/sdd/loop';

const now = Date.UTC(2026, 10, 21, 22, 0);
const wave = (reports: WaveResult['reports']): WaveResult => ({ planned: reports.length, reports });

describe('D-1314: the wave loop', () => {
  it('stops when no task is ready', () => {
    expect(nextLoopStep({ planned: 0, reports: [] }, INITIAL_LOOP_STATE, now).step).toEqual({ action: 'stop', reason: 'nothing to run: no task is ready', code: 0 });
  });

  it('runs the next wave after one that merged something', () => {
    const { step, state } = nextLoopStep(wave([{ id: 'R1', outcome: 'merged' }, { id: 'R2', outcome: 'failed' }]), INITIAL_LOOP_STATE, now);
    expect(step).toEqual({ action: 'continue' });
    expect(state).toMatchObject({ failures: ['R2 failed'], stalls: 0, skip: [] });
  });

  it('sleeps to the latest reset plus two minutes when a limit ended a task', () => {
    const resetsAt = now + 3 * 24 * 60 * 60_000;
    const { step } = nextLoopStep(wave([{ id: 'R1', outcome: 'limit', resetsAt: now + 60_000 }, { id: 'R2', outcome: 'limit', resetsAt }]), INITIAL_LOOP_STATE, now);
    expect(step).toMatchObject({ action: 'sleep', ms: resetsAt - now + LOOP_RESET_MARGIN_MS });
  });

  it('caps the sleep at seven days, and sleeps an hour on an unknown reset', () => {
    expect(nextLoopStep(wave([{ id: 'R1', outcome: 'limit', resetsAt: now + 30 * 24 * 60 * 60_000 }]), INITIAL_LOOP_STATE, now).step).toMatchObject({ action: 'sleep', ms: LOOP_SLEEP_MAX_MS });
    expect(nextLoopStep(wave([{ id: 'R1', outcome: 'limit', resetsAt: null }]), INITIAL_LOOP_STATE, now).step).toMatchObject({ action: 'sleep', ms: LOOP_UNKNOWN_RESET_MS });
  });

  it('stops after two waves in a row with nothing merged and the same failures', () => {
    const stuck = wave([{ id: 'R2', outcome: 'failed' }, { id: 'R3', outcome: 'ci-timeout' }]);
    let { step, state } = nextLoopStep(stuck, INITIAL_LOOP_STATE, now);
    expect(step.action).toBe('continue');
    ({ step, state } = nextLoopStep(stuck, state, now));
    expect([step.action, state.stalls]).toEqual(['continue', 1]);
    ({ step } = nextLoopStep(stuck, state, now));
    expect(step).toMatchObject({ action: 'stop' });
    expect(step.action === 'stop' && step.reason).toMatch(/no progress in 2 waves.*R2 failed, R3 ci-timeout/);
  });

  it('resets the stall count when the failures change or a task merges', () => {
    const first = nextLoopStep(wave([{ id: 'R2', outcome: 'failed' }]), INITIAL_LOOP_STATE, now).state;
    const second = nextLoopStep(wave([{ id: 'R2', outcome: 'failed' }]), first, now).state;
    expect(second.stalls).toBe(1);
    expect(nextLoopStep(wave([{ id: 'R4', outcome: 'failed' }]), second, now).state.stalls).toBe(0);
    expect(nextLoopStep(wave([{ id: 'R2', outcome: 'failed' }, { id: 'R5', outcome: 'merged' }]), second, now).state.stalls).toBe(0);
  });

  it('lists what did not merge, sorted', () => {
    expect(failuresOf(wave([{ id: 'R9', outcome: 'limit' }, { id: 'R1', outcome: 'merged' }, { id: 'R3', outcome: 'awaiting-owner' }]))).toEqual(['R3 awaiting-owner', 'R9 limit']);
  });
});

describe('D-1317: the loop skips what will not move', () => {
  const budget = { id: 'R7', outcome: 'failed' as const, reason: 'session ended budget', attempts: [{ stage: 'implement' as const, tier: 'standard', model: 'm', outcome: 'budget', durationMs: 1 }] };
  const merged = { id: 'R1', outcome: 'merged' as const };

  it('resumes a budget-killed task twice, then skips it', () => {
    let state = INITIAL_LOOP_STATE;
    for (const expected of [[], [], ['R7']]) {
      state = nextLoopStep(wave([budget, merged]), state, now).state;
      expect(state.skip).toEqual(expected);
    }
  });

  it('skips a task after the same failure twice, and a blocked one at once', () => {
    const red = { id: 'R8', outcome: 'failed' as const, reason: 'CI is red' };
    let state = nextLoopStep(wave([red, merged]), INITIAL_LOOP_STATE, now).state;
    expect(state.skip).toEqual([]);
    state = nextLoopStep(wave([red, merged]), state, now).state;
    expect(state.skip).toEqual(['R8']);
    expect(nextLoopStep(wave([{ id: 'R9', outcome: 'blocked', reason: 'the session stopped' }]), INITIAL_LOOP_STATE, now).state.skip).toEqual(['R9']);
  });

  it('does not skip on two different failures or on limits', () => {
    let state = nextLoopStep(wave([{ id: 'R8', outcome: 'failed', reason: 'CI is red' }, merged]), INITIAL_LOOP_STATE, now).state;
    state = nextLoopStep(wave([{ id: 'R8', outcome: 'failed', reason: 'rebase onto origin/main conflicted' }, merged]), state, now).state;
    expect(state.skip).toEqual([]);
    state = nextLoopStep(wave([{ id: 'R6', outcome: 'limit', reason: 'x', resetsAt: null }]), state, now).state;
    state = nextLoopStep(wave([{ id: 'R6', outcome: 'limit', reason: 'x', resetsAt: null }]), state, now).state;
    expect(state.skip).toEqual([]);
  });

  it('stops with exit 1 when every remaining ready task is skipped', () => {
    expect(nextLoopStep({ planned: 0, reports: [], skippedReady: ['R7', 'R8'] }, INITIAL_LOOP_STATE, now).step).toMatchObject({ action: 'stop', code: 1, reason: expect.stringMatching(/every remaining ready task is skipped: R7, R8/) });
  });
});

describe('D-1320: an open PR is carried on before the loop stops', () => {
  const r206: LoopTask = { id: 'R206', state: 'in review (PR #312)', missingDeps: [], owner: false };
  const r209: LoopTask = { id: 'R209', state: 'blocked', missingDeps: ['R206'], owner: false };
  const idle = (extra: Partial<WaveResult> = {}): WaveResult => ({ planned: 0, reports: [], ...extra });

  it('retries a task whose PR is open when nothing is ready, then counts it retried', () => {
    const { step, state } = nextLoopStep(idle({ retryable: ['R206'], unmerged: [r206, r209] }), INITIAL_LOOP_STATE, now);
    expect(step).toMatchObject({ action: 'retry', ids: ['R206'] });
    expect(state.retried).toEqual(['R206']);
  });

  it('stops with exit 1 and the list once the retry is spent and the PR is still open', () => {
    const after = { ...INITIAL_LOOP_STATE, retried: ['R206'] };
    const { step } = nextLoopStep(idle({ retryable: ['R206'], unmerged: [r206, r209] }), after, now);
    expect(step).toMatchObject({ action: 'stop', code: 1 });
    expect(step.action === 'stop' && step.reason).toMatch(/R206 in review \(PR #312\); R209 blocked on R206/);
  });

  it('does not retry a skipped task', () => {
    const { step } = nextLoopStep(idle({ retryable: ['R206'], unmerged: [r206] }), { ...INITIAL_LOOP_STATE, skip: ['R206'] }, now);
    expect(step).toMatchObject({ action: 'stop', code: 1 });
  });

  it('keeps the retry through a wave that merged something, and gives it back when a limit cut it short', () => {
    const retried = { ...INITIAL_LOOP_STATE, retried: ['R206'] };
    expect(nextLoopStep(wave([{ id: 'R1', outcome: 'merged' }]), retried, now).state.retried).toEqual(['R206']);
    expect(nextLoopStep(wave([{ id: 'R206', outcome: 'limit', resetsAt: now + 60_000 }]), retried, now).state.retried).toEqual([]);
  });

  it('exits 0 when the phase is merged, or every task left waits on the owner', () => {
    expect(nextLoopStep(idle({ unmerged: [] }), INITIAL_LOOP_STATE, now).step).toMatchObject({ action: 'stop', code: 0 });
    const owner = { ...r206, owner: true };
    const { step } = nextLoopStep(idle({ unmerged: [owner, r209] }), INITIAL_LOOP_STATE, now);
    expect(step).toMatchObject({ action: 'stop', code: 0 });
    expect(step.action === 'stop' && step.reason).toMatch(/waits on the owner \(R206, R209\)/);
  });

  it('counts a task blocked only on owner tasks, transitively, as the owner\'s', () => {
    const a: LoopTask = { id: 'A', state: 'owner-driven', missingDeps: [], owner: true };
    const b: LoopTask = { id: 'B', state: 'blocked', missingDeps: ['A'], owner: false };
    const c: LoopTask = { id: 'C', state: 'blocked', missingDeps: ['B'], owner: false };
    const d: LoopTask = { id: 'D', state: 'blocked', missingDeps: ['B', 'E'], owner: false };
    const e: LoopTask = { id: 'E', state: 'failed', missingDeps: [], owner: false };
    expect(stuckTasks([a, b, c, d, e]).map((task) => task.id)).toEqual(['D', 'E']);
  });
});
