/** R48 (FR-TRAJ-1, D-189): the page's passes carry their arc state at the shown instant, keyed so the array only changes when a state does. */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { ARC_LINGER_MS, ARC_LOOKAHEAD_MS } from '../../../physics/constants';
import { arcKey, withArcStates } from './liveArcs';

const pass = goldenPassFixture();
const other = { ...pass, id: 'other', start: { ...pass.start, t: pass.start.t + 3_600_000 }, peak: { ...pass.peak, t: pass.peak.t + 3_600_000 }, end: { ...pass.end, t: pass.end.t + 3_600_000 } };

describe('arcKey and withArcStates', () => {
  it('sets each pass its FR-TRAJ-1 state at the instant', () => {
    const states = (t: number) => withArcStates([pass, other], arcKey([pass, other], t)).map((p) => p.arc);
    expect(states(pass.start.t - ARC_LOOKAHEAD_MS - 1)).toEqual(['hidden', 'hidden']);
    expect(states(pass.start.t - 1)).toEqual(['ahead', 'hidden']);
    expect(states(pass.peak.t)).toEqual(['live', 'hidden']);
    expect(states(pass.end.t + ARC_LINGER_MS)).toEqual(['linger', 'hidden']);
    expect(states(other.start.t)).toEqual(['hidden', 'live']);
  });

  it('keys the same while no state changes, and differently when any does — what the page memoises on', () => {
    const key = arcKey([pass, other], pass.peak.t);
    expect(key).toBe('live hidden');
    expect(arcKey([pass, other], pass.peak.t + 1000)).toBe(key);
    expect(arcKey([pass, other], pass.end.t + 1)).toBe('linger hidden');
    expect(arcKey([], pass.peak.t)).toBe('');
    expect(withArcStates([], '')).toEqual([]);
  });

  it('refuses a key from another list', () => {
    expect(() => withArcStates([pass], arcKey([pass, other], pass.peak.t))).toThrow(/2 states for 1 passes/);
  });
});
