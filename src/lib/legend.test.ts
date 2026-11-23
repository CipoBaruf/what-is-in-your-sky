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
import { bodyLines, keyFor, legendKeys, legendRows, promoteRow, seriesToken, upNowBodies, upNowColumns, upNowPlace, upNowRows, type BodyLine, type LegendPass } from './legend';

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
    expect(rows[1]).toEqual({ key: 'B', passId: 'hidden-1', name: 'Cosmos 2369 · in shadow', colorToken: 'pass-dim', riseMs: null, peakMs: null, endMs: null, state: 'hidden-object', highlighted: false, at: null });
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

describe('the up-only form (FR-NOW-2, D-1239)', () => {
  const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  it('FR-NOW-2: names the 16 compass points, each sector 22.5° wide, at its boundaries on both sides', () => {
    POINTS.forEach((point, i) => {
      const centre = i * 22.5;
      const start = centre - 11.25;
      const end = centre + 11.25;
      expect(upNowPlace(centre, 10).point, `${point} at its centre`).toBe(point);
      expect(upNowPlace(start, 10).point, `${point} opens at ${String(start)}°`).toBe(point);
      expect(upNowPlace(end - 0.01, 10).point, `${point} until just before ${String(end)}°`).toBe(point);
      expect(upNowPlace(end, 10).point, `${String(end)}° is the next point`).toBe(POINTS[(i + 1) % 16]);
    });
    expect(upNowPlace(-11.25, 10).point).toBe('N');
    expect(upNowPlace(359.99, 10).point).toBe('N');
  });

  it('FR-NOW-2: the height in whole degrees, below the horizon said as such, never negative', () => {
    expect(upNowPlace(45, 30.4)).toEqual({ point: 'NE', degrees: 30, up: true });
    expect(upNowPlace(247.5, -4.2)).toEqual({ point: 'WSW', degrees: 4, up: false });
    expect(upNowPlace(0, -0.4)).toEqual({ point: 'N', degrees: 0, up: true });
    expect(upNowPlace(180, -89.6)).toEqual({ point: 'S', degrees: 90, up: false });
  });

  it('FR-NOW-2: lists only the satellites above the horizon at the instant, in the legend order, never a hidden object', () => {
    const mid = pass.peak.t;
    const before = pass.start.t - 60_000;
    const rows = legendRows({ passes: [pass, other], highlightedPassId: null, now: mid, hidden: [{ id: 'hidden-1', azDeg: 10, elDeg: 40, label: 'Cosmos · in shadow' }], colorBy: 'pass' });
    expect(rows.find((row) => row.passId === pass.id)?.at?.elDeg).toBeGreaterThan(0);
    expect(rows.find((row) => row.passId === other.id)?.at).toBeNull();
    expect(upNowRows(rows).map((row) => row.passId)).toEqual([pass.id]);
    expect(upNowRows(legendRows({ passes: [pass, other], highlightedPassId: null, now: before }))).toEqual([]);
    // A row whose marker is on the arc but under the horizon is not up.
    const low = rows.map((row) => (row.passId === pass.id ? { ...row, at: { azDeg: 200, elDeg: -1 } } : row));
    expect(upNowRows(low)).toEqual([]);
  });

  it('FR-NOW-2: the Moon before the Sun, whatever order the drawing carries them in', () => {
    const sun: BodyLine = { body: 'sun', azDeg: 250, altDeg: -4 };
    const moon: BodyLine = { body: 'moon', azDeg: 45, altDeg: 30 };
    expect(upNowBodies([sun, moon])).toEqual([moon, sun]);
    expect(upNowBodies([sun])).toEqual([sun]);
    expect(upNowBodies([])).toEqual([]);
  });

  it('FR-NOW-2: the columns are as wide as their widest entry, in characters', () => {
    expect(upNowColumns([{ point: 'NE', height: '30° up' }, { point: 'WSW', height: '4° below' }])).toEqual({ point: 3, height: 8 });
    expect(upNowColumns([])).toEqual({ point: 0, height: 0 });
  });
});
