/** R48 (FR-TRAJ-1, D-189): the page's passes carry their arc state at the shown instant, and the array only changes when a state does. */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { ARC_LINGER_MS, ARC_LOOKAHEAD_MS } from '../../../physics/constants';
import { withArcStates } from './liveArcs';

const pass = goldenPassFixture();
const other = { ...pass, id: 'other', start: { ...pass.start, t: pass.start.t + 3_600_000 }, peak: { ...pass.peak, t: pass.peak.t + 3_600_000 }, end: { ...pass.end, t: pass.end.t + 3_600_000 } };

describe('withArcStates', () => {
  it('sets each pass its FR-TRAJ-1 state at the instant', () => {
    const states = (t: number) => withArcStates([pass, other], t, null).map((p) => p.arc);
    expect(states(pass.start.t - ARC_LOOKAHEAD_MS - 1)).toEqual(['hidden', 'hidden']);
    expect(states(pass.start.t - 1)).toEqual(['ahead', 'hidden']);
    expect(states(pass.peak.t)).toEqual(['live', 'hidden']);
    expect(states(pass.end.t + ARC_LINGER_MS)).toEqual(['linger', 'hidden']);
    expect(states(other.start.t)).toEqual(['hidden', 'live']);
  });

  it('returns the previous array while no state changes, and a new one when any does', () => {
    const first = withArcStates([pass, other], pass.peak.t, null);
    expect(withArcStates([pass, other], pass.peak.t + 1000, first)).toBe(first);
    const faded = withArcStates([pass, other], pass.end.t + 1, first);
    expect(faded).not.toBe(first);
    expect(faded.map((p) => p.arc)).toEqual(['linger', 'hidden']);
    // A new pass list (the 10 s tick, or the passes arriving) is a new array too.
    expect(withArcStates([pass], pass.peak.t, first)).not.toBe(first);
    expect(withArcStates([{ ...pass }, other], pass.peak.t, first)).toBe(first);
  });
});
