/**
 * R143 (FR-TONIGHT-7, D-903, D-912): the context line's parts in each case — a pass up before and after its peak,
 * the sky form and its next pass, the two no-pass reasons (FR-TONIGHT-1, FR-TONIGHT-4), passes already over at `t`
 * left out — on a small run with one night band.
 */
import { describe, expect, it } from 'vitest';
import type { Pass, PassBoundaryReason } from '../model';
import { contextLine, type ContextInput } from './contextLine';
import { tonightBand } from './shownTime';
import type { SkyBand } from './timeStripe';

const H = 3_600_000;
const MIN = 60_000;
const NOW = Date.UTC(2026, 8, 11, 15, 0, 0);
const SPAN = { start: NOW, end: NOW + 24 * H };
const BANDS: SkyBand[] = [
  { from: NOW, to: NOW + 7 * H, sky: 'day' },
  { from: NOW + 7 * H, to: NOW + 18 * H, sky: 'dark' },
  { from: NOW + 18 * H, to: NOW + 24 * H, sky: 'day' },
];

/** A pass with what the line reads: its name, its three instants and azimuths, and its end's reason. */
const pass = (name: string, start: number, endReason: PassBoundaryReason = 'horizon'): Pass =>
  ({
    id: `${name}-${String(start)}`,
    name,
    start: { t: start, azDeg: 300, altDeg: 10 },
    peak: { t: start + 3 * MIN, azDeg: 135, altDeg: 60 },
    end: { t: start + 6 * MIN, azDeg: 45, altDeg: 10 },
    endReason,
  }) as unknown as Pass;

const TIANGONG = pass('Tiangong', NOW + 9 * H, 'shadow');
const ISS = pass('ISS', NOW + 10 * H);
const NIGHT = tonightBand(BANDS, NOW);
const input = (over: Partial<ContextInput>): ContextInput => ({ passes: [TIANGONG, ISS], t: NOW, span: SPAN, night: NIGHT, sky: 'day', cloud: 'clear', ...over });

describe('contextLine', () => {
  it('names an up pass and its peak ahead, where and in how long', () => {
    expect(contextLine(input({ t: TIANGONG.start.t + 2 * MIN + 20_000, sky: 'dark' }))).toEqual({ kind: 'up', name: 'Tiangong', event: 'peak', point: 'SE', inMs: 40_000 });
  });

  it('names its end by the end’s reason once past the peak', () => {
    expect(contextLine(input({ t: TIANGONG.peak.t + 1000 }))).toEqual({ kind: 'up', name: 'Tiangong', event: 'shadow', point: 'NE', inMs: 3 * MIN - 1000 });
    expect(contextLine(input({ t: ISS.end.t }))).toMatchObject({ kind: 'up', name: 'ISS', event: 'horizon', inMs: 0 });
  });

  it('takes the pass that rose first when two are up', () => {
    const late = pass('Hubble', TIANGONG.start.t + MIN);
    expect(contextLine(input({ passes: [late, TIANGONG], t: TIANGONG.start.t + 2 * MIN }))).toMatchObject({ name: 'Tiangong' });
  });

  it('is the sky, the cloud and the next rise between passes', () => {
    expect(contextLine(input({ t: NOW, sky: 'day', cloud: 'partly' }))).toEqual({ kind: 'sky', sky: 'day', cloud: 'partly', nextAt: TIANGONG.start.t });
    expect(contextLine(input({ t: TIANGONG.end.t + 1, sky: 'dark' }))).toEqual({ kind: 'sky', sky: 'dark', cloud: 'clear', nextAt: ISS.start.t });
  });

  it('keeps a pending sky as null', () => {
    expect(contextLine(input({ t: NOW, sky: null, cloud: 'unknown' }))).toEqual({ kind: 'sky', sky: null, cloud: 'unknown', nextAt: TIANGONG.start.t });
  });

  it('leaves out the passes already over at t: past the span’s last pass it is the no-pass sentence (D-912)', () => {
    // Inside tonight, after its last pass: nothing is left of tonight.
    expect(contextLine(input({ t: ISS.end.t + 1, sky: 'dark' }))).toEqual({ kind: 'none', reason: 'tonight' });
    // After tonight, late in the span, every pass behind `t`: nothing is left of the 24 h.
    expect(contextLine(input({ t: NOW + 20 * H }))).toEqual({ kind: 'none', reason: 'span' });
    expect(contextLine(input({ t: NOW + 20 * H, night: null }))).toEqual({ kind: 'none', reason: 'span' });
  });

  it('counts only what is left of tonight after t, and the next rise among what is ahead', () => {
    const tomorrow = pass('Hubble', NOW + 20 * H);
    // Between tonight's two passes the next is ISS; after ISS, tonight has none left though tomorrow has one.
    expect(contextLine(input({ passes: [TIANGONG, ISS, tomorrow], t: TIANGONG.end.t + 1 }))).toMatchObject({ kind: 'sky', nextAt: ISS.start.t });
    expect(contextLine(input({ passes: [TIANGONG, ISS, tomorrow], t: ISS.end.t + 1 }))).toEqual({ kind: 'none', reason: 'tonight' });
    // Outside tonight, a pass behind `t` is not the next one.
    expect(contextLine(input({ passes: [tomorrow, pass('Early', NOW + MIN)], t: NOW + 30 * MIN, night: null }))).toMatchObject({ kind: 'sky', nextAt: tomorrow.start.t });
  });

  it('says no visible pass in 24 h when none touches the span (FR-TONIGHT-1)', () => {
    expect(contextLine(input({ passes: [] }))).toEqual({ kind: 'none', reason: 'span' });
    expect(contextLine(input({ passes: [pass('Old', NOW - 2 * H)] }))).toEqual({ kind: 'none', reason: 'span' });
  });

  it('says no visible pass tonight when t is inside tonight and tonight has none (FR-TONIGHT-4)', () => {
    const tomorrow = pass('ISS', NOW + 20 * H);
    expect(contextLine(input({ passes: [tomorrow], t: NOW + 7 * H, sky: 'dark' }))).toEqual({ kind: 'none', reason: 'tonight' });
    // Outside tonight, the same run reads the sky form and the next rise.
    expect(contextLine(input({ passes: [tomorrow], t: NOW }))).toMatchObject({ kind: 'sky', nextAt: tomorrow.start.t });
  });
});
