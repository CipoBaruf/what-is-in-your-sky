/**
 * R81 (FR-FIRST-3, D-507): the path's three ends by the pass's boundary
 * reasons — `low` for a rise at the threshold, the altitude for a start out of
 * Earth's shadow and for an end into it — over passes of the stored Neuquén run.
 */
import { describe, expect, it } from 'vitest';
import run from '../../tests/fixtures/stored-run-neuquen.json';
import type { Pass } from '../model';
import { passPath } from './passPath';

const passes = run.passes as unknown as Pass[];
const byId = (id: string): Pass => {
  const pass = passes.find((p) => p.id === id);
  if (!pass) throw new Error(`no pass ${id} in the fixture`);
  return pass;
};

/** SL-16 R/B (Cosmos 2369): rises at the threshold at 184°, peaks 32° at 121°, sets at 58°. */
const HORIZON = byId('26070-1789112167032');
/** Tiangong: leaves Earth's shadow at 29°, climbs to 51°, sets at the threshold. */
const SHADOW_START = byId('48274-1789205010782');

describe('passPath (D-507)', () => {
  it('a rise at the threshold is low; a set at the threshold carries no altitude', () => {
    expect(passPath(HORIZON)).toEqual({ start: { point: 'S', altitude: 'low' }, peak: { point: 'ESE', altitude: 32 }, end: { point: 'ENE', altitude: null } });
  });

  it('a start out of Earth’s shadow carries its altitude', () => {
    const path = passPath(SHADOW_START);
    expect(path.start.altitude).toBe(29);
    expect(path.peak.altitude).toBe(51);
    expect(path.end.altitude).toBeNull();
  });

  it('an end into Earth’s shadow above the threshold carries its altitude', () => {
    const path = passPath({ ...HORIZON, endReason: 'shadow', end: { ...HORIZON.end, elDeg: 24.6 } });
    expect(path.end).toEqual({ point: 'ENE', altitude: 25 });
  });

  it('a start as the sky darkens carries its altitude too: it is not at the threshold', () => {
    expect(passPath({ ...HORIZON, startReason: 'twilight', start: { ...HORIZON.start, elDeg: 17.2 } }).start).toEqual({ point: 'S', altitude: 17 });
  });
});
