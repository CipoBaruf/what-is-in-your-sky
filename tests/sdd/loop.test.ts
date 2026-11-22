/**
 * D-1314: `--until-done`'s decision after each wave.
 */
import { describe, expect, it } from 'vitest';
import { failuresOf, INITIAL_LOOP_STATE, LOOP_RESET_MARGIN_MS, LOOP_SLEEP_MAX_MS, LOOP_UNKNOWN_RESET_MS, nextLoopStep, type WaveResult } from '../../scripts/sdd/loop';

const now = Date.UTC(2026, 10, 21, 22, 0);
const wave = (reports: WaveResult['reports']): WaveResult => ({ planned: reports.length, reports });

describe('D-1314: the wave loop', () => {
  it('stops when no task is ready', () => {
    expect(nextLoopStep({ planned: 0, reports: [] }, INITIAL_LOOP_STATE, now).step).toEqual({ action: 'stop', reason: 'nothing to run: no task is ready' });
  });

  it('runs the next wave after one that merged something', () => {
    const { step, state } = nextLoopStep(wave([{ id: 'R1', outcome: 'merged' }, { id: 'R2', outcome: 'failed' }]), INITIAL_LOOP_STATE, now);
    expect(step).toEqual({ action: 'continue' });
    expect(state).toEqual({ failures: ['R2 failed'], stalls: 0 });
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
