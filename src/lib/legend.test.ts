/**
 * FR-LEG-1, FR-LEG-2, FR-LEG-4, FR-LEG-5 / D-186 (R45): the legend's rows
 * are the drawing's passes in the drawing's order and states, keyed A, B,
 * C…; the highlighted pass first on the detail, the one nearest the zenith
 * first on the live page; the swatch tokens follow the colouring mode; and
 * a row the reader activates goes first without changing anyone's key.
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../tests/support/catalogFixtures';
import { MOON_DOWN, MOON_FIXTURE } from '../../tests/support/moonFixtures';
import type { Pass } from '../model';
import { bodyLines, keyFor, legendKeys, legendRows, promoteRow, seriesToken, type LegendPass } from './legend';

const pass = goldenPassFixture();
const shift = (p: Pass, id: string, byMs: number, name = id): Pass => ({
  ...p,
  id,
  name,
  start: { ...p.start, t: p.start.t + byMs },
  peak: { ...p.peak, t: p.peak.t + byMs },
  end: { ...p.end, t: p.end.t + byMs },
  track: p.track.map((point) => ({ ...point, t: point.t + byMs })),
});
const other = shift(pass, 'other', 3_600_000, 'Tiangong');

describe('legendRows (FR-LEG-2, D-186)', () => {
  it('lists the explained pass first on the detail with the keys A, B in that order, the times and the full state', () => {
    const rows = legendRows({ passes: [other, pass], highlightedPassId: pass.id });
    expect(rows.map((row) => [row.key, row.passId, row.state, row.highlighted])).toEqual([
      ['A', pass.id, 'full', true],
      ['B', 'other', 'full', false],
    ]);
    expect(rows[0]).toMatchObject({ name: pass.name, riseMs: pass.start.t, peakMs: pass.peak.t, endMs: pass.end.t, colorToken: 'pass' });
    expect(rows[1]?.colorToken).toBe('pass-dim');
  });

  it('carries each pass s arc state and leaves a hidden arc out (FR-TRAJ-3, FR-LEG-2)', () => {
    const passes: LegendPass[] = [
      { ...pass, arc: 'live' },
      { ...other, arc: 'ahead' },
      { ...shift(pass, 'gone', -3_600_000), arc: 'linger' },
      { ...shift(pass, 'far', 7_200_000), arc: 'hidden' },
    ];
    const rows = legendRows({ passes, highlightedPassId: null, colorBy: 'pass' });
    expect(rows.map((row) => row.passId)).toEqual([pass.id, 'other', 'gone']);
    expect(rows.map((row) => row.state)).toEqual(['live', 'ahead', 'linger']);
  });

  it('puts the pass whose marker is nearest the zenith first on the live page, and keeps the series colours by pass order (FR-LEG-4, FR-LIVE-2)', () => {
    // Two passes both under way at `now`: the golden pass a little after its rise (low), a copy shifted so that `now` is its peak (highest).
    const now = pass.start.t + 20_000;
    const high = shift(pass, 'high', now - pass.peak.t);
    const rows = legendRows({ passes: [pass, high], highlightedPassId: null, now, colorBy: 'pass' });
    expect(rows.map((row) => [row.key, row.passId, row.colorToken])).toEqual([
      ['A', 'high', 'series-2'],
      ['B', pass.id, 'series-1'],
    ]);
    expect(rows.every((row) => row.highlighted)).toBe(true);
  });

  it('keeps the chart s order among passes with no marker on the arc, after those with one', () => {
    const now = pass.start.t + 20_000;
    const rows = legendRows({ passes: [other, pass, shift(pass, 'later', 7_200_000)], highlightedPassId: null, now, colorBy: 'pass' });
    expect(rows.map((row) => row.passId)).toEqual([pass.id, 'other', 'later']);
  });

  it('lists the hidden objects after the passes, dim, with the words the page gave them and no times (FR-LIVE-6, FR-LEG-3)', () => {
    const hidden = [{ id: 'hidden-1', azDeg: 40, elDeg: 20, label: 'Cosmos 2369 · in shadow' }];
    const rows = legendRows({ passes: [pass], highlightedPassId: null, hidden, colorBy: 'pass' });
    expect(rows[1]).toEqual({ key: 'B', passId: 'hidden-1', name: 'Cosmos 2369 · in shadow', colorToken: 'pass-dim', riseMs: null, peakMs: null, endMs: null, state: 'hidden-object', highlighted: false });
  });

  it('cycles the series after the sixth and letters past Z without repeating', () => {
    const many = Array.from({ length: 28 }, (_, i) => shift(pass, `p${String(i)}`, i * 600_000));
    const rows = legendRows({ passes: many, highlightedPassId: null, colorBy: 'pass' });
    expect(rows.map((row) => row.colorToken).slice(0, 8)).toEqual(['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6', 'series-1', 'series-2']);
    expect(new Set(rows.map((row) => row.key)).size).toBe(28);
    expect(rows[26]?.key).toBe('A1');
    expect(seriesToken(-1)).toBe('series-6');
    expect(keyFor(0)).toBe('A');
  });

  it('maps every row id to its key for the drawing (FR-LEG-1)', () => {
    const rows = legendRows({ passes: [other, pass], highlightedPassId: pass.id });
    expect(legendKeys(rows)).toEqual({ [pass.id]: 'A', other: 'B' });
  });
});

describe('promoteRow (FR-LEG-4)', () => {
  it('moves the activated row first, highlights it alone, and keeps every key', () => {
    const rows = legendRows({ passes: [pass, other], highlightedPassId: null, colorBy: 'pass' });
    const promoted = promoteRow(rows, 'other');
    expect(promoted.map((row) => [row.key, row.passId, row.highlighted])).toEqual([
      ['B', 'other', true],
      ['A', pass.id, false],
    ]);
  });

  it('leaves the rows as derived for null or an id that is not listed', () => {
    const rows = legendRows({ passes: [pass, other], highlightedPassId: pass.id });
    expect(promoteRow(rows, null)).toEqual(rows);
    expect(promoteRow(rows, 'nobody')).toEqual(rows);
  });
});

describe('bodyLines (FR-DOME-6 as amended)', () => {
  it('gives the Sun and the Moon one line each with azimuth and altitude, only while each is drawn', () => {
    const sun = { azDeg: 285, altDeg: -8 };
    expect(bodyLines({ sun, moon: MOON_FIXTURE }, { sun: true, moon: true })).toEqual([
      { body: 'sun', azDeg: 285, altDeg: -8 },
      { body: 'moon', azDeg: MOON_FIXTURE.azDeg, altDeg: MOON_FIXTURE.elDeg, moon: MOON_FIXTURE },
    ]);
    expect(bodyLines({ sun, moon: MOON_DOWN }, { sun: false, moon: false })).toEqual([]);
    expect(bodyLines({ sun: null, moon: null }, { sun: true, moon: true })).toEqual([]);
  });
});
