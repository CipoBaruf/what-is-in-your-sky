/** R33 (FR-LIVE-6, D-96, D-102): the reason read off a hidden item, and the subtraction of what an arc already draws. */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import type { NowItem, NowState } from '../../../model';
import { drawnAt, hiddenMarkers, hiddenReason } from './hiddenObjects';

const item = (over: Partial<NowItem> = {}): NowItem => ({ noradId: 1, name: 'Cosmos', azDeg: 40, elDeg: 20, rangeKm: 900, magnitude: 5.2, lit: true, aboveMinElevation: true, visible: false, ...over });

describe('hiddenReason', () => {
  it('reads the reason in D-96 order: too low, in shadow, daylight, then too faint', () => {
    expect(hiddenReason(item({ aboveMinElevation: false, lit: false }), 'day')).toBe('low');
    expect(hiddenReason(item({ lit: false }), 'day')).toBe('shadow');
    expect(hiddenReason(item(), 'day')).toBe('daylight');
    expect(hiddenReason(item(), 'bright-twilight')).toBe('daylight');
    expect(hiddenReason(item(), 'dark')).toBe('faint');
  });
});

describe('hiddenMarkers', () => {
  const pass = goldenPassFixture();
  const state: NowState = {
    t: pass.start.t + 10_000,
    sunAltDeg: -30,
    sky: 'dark',
    items: [],
    hidden: [item({ noradId: pass.noradId, name: pass.name }), item({ noradId: 2, name: 'Envisat', lit: false, azDeg: 200, elDeg: 5 })],
    moon: MOON_FIXTURE,
  };
  const label = (name: string, reason: string): string => `${name} · ${reason}`;

  it('places every hidden object that is not already on an arc, worded by the caller (D-102)', () => {
    expect(drawnAt([pass], state.t)).toEqual(new Set([pass.noradId]));
    expect(hiddenMarkers(state, drawnAt([pass], state.t), label)).toEqual([{ id: 'hidden-2', azDeg: 200, elDeg: 5, label: 'Envisat · shadow' }]);
    // Past the end of the pass the object is nobody's arc any more, and it is dimmed like the rest.
    expect(hiddenMarkers(state, drawnAt([pass], pass.end.t + 1), label).map((m) => m.id)).toEqual([`hidden-${String(pass.noradId)}`, 'hidden-2']);
  });

  it('is empty without an answer, or with an answer that carries no hidden set', () => {
    expect(hiddenMarkers(null, new Set(), label)).toEqual([]);
    const { hidden: _dropped, ...withoutHidden } = state;
    expect(hiddenMarkers(withoutHidden, new Set(), label)).toEqual([]);
  });
});
