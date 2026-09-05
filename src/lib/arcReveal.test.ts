/**
 * FR-TRAJ-1 / D-189 (R45): the five arc states at their boundaries, and the
 * cut track that ends under the live marker. The golden pass is the fixture,
 * so the times are real ones.
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../tests/support/catalogFixtures';
import { ARC_LINGER_MS, ARC_LOOKAHEAD_MS } from '../physics/constants';
import { arcState, cutTrack, isDrawn } from './arcReveal';
import { interpolateTrack } from './skyGeometry';

const pass = goldenPassFixture();
const { start, end } = pass;

describe('arcState (FR-TRAJ-1, FR-TRAJ-2)', () => {
  it('is full without an instant, which is the pass detail (FR-TRAJ-3)', () => {
    expect(arcState(pass, undefined)).toBe('full');
    expect(arcState(pass, NaN)).toBe('full');
  });

  it('is hidden before the lookahead, ahead from the lookahead to the rise, live from the rise to the end, linger to the end of the linger, hidden after', () => {
    expect(arcState(pass, start.t - ARC_LOOKAHEAD_MS - 1)).toBe('hidden');
    expect(arcState(pass, start.t - ARC_LOOKAHEAD_MS)).toBe('ahead');
    expect(arcState(pass, start.t - 1)).toBe('ahead');
    expect(arcState(pass, start.t)).toBe('live');
    expect(arcState(pass, Math.round((start.t + end.t) / 2))).toBe('live');
    expect(arcState(pass, end.t)).toBe('live');
    expect(arcState(pass, end.t + 1)).toBe('linger');
    expect(arcState(pass, end.t + ARC_LINGER_MS)).toBe('linger');
    expect(arcState(pass, end.t + ARC_LINGER_MS + 1)).toBe('hidden');
  });

  it('draws every state but hidden, and the thresholds are the FR-TRAJ-2 defaults', () => {
    expect(isDrawn('hidden')).toBe(false);
    for (const state of ['ahead', 'live', 'linger', 'full'] as const) expect(isDrawn(state)).toBe(true);
    expect(ARC_LOOKAHEAD_MS).toBe(5 * 60_000);
    expect(ARC_LINGER_MS).toBe(10 * 60_000);
  });
});

describe('cutTrack (D-189)', () => {
  it('is the samples up to the instant with the interpolated position appended, ending exactly under the marker', () => {
    const t = start.t + 25_000;
    const cut = cutTrack(pass, t);
    const last = cut[cut.length - 1];
    expect(last).toEqual(interpolateTrack(pass.track, t));
    expect(cut.slice(0, -1).every((p) => p.t < t)).toBe(true);
    expect(cut.slice(0, -1)).toEqual(pass.track.filter((p) => p.t < t));
    // Strictly in time order, no sample doubled.
    for (let i = 1; i < cut.length; i++) expect((cut[i]?.t ?? 0) > (cut[i - 1]?.t ?? 0)).toBe(true);
  });

  it('does not double a sample whose time is the instant', () => {
    // The golden fixture's track is its three points: the peak sample is the middle one.
    const sample = pass.track[1];
    if (!sample) throw new Error('short track');
    const cut = cutTrack(pass, sample.t);
    expect(cut).toEqual(pass.track.slice(0, 2));
  });

  it('is the rise point alone before the start and the whole track at or after the end', () => {
    expect(cutTrack(pass, start.t - 1)).toEqual([pass.track[0]]);
    expect(cutTrack(pass, start.t)).toEqual([pass.track[0]]);
    expect(cutTrack(pass, end.t)).toEqual(pass.track);
    expect(cutTrack(pass, end.t + 60_000)).toEqual(pass.track);
    expect(cutTrack({ track: [] }, start.t)).toEqual([]);
  });

  it('grows with the instant', () => {
    const before = cutTrack(pass, pass.peak.t - 1000).length;
    const after = cutTrack(pass, pass.peak.t + 1000).length;
    expect(before).toBeGreaterThan(1);
    expect(after).toBeGreaterThan(before);
  });
});
