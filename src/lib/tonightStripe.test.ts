/**
 * R81 (FR-FIRST-8, D-506): tonight's stripe over the stored Neuquén run — the
 * bands sampled from the astronomy module the live stripe loads, as
 * `useSkyBands` samples them — pinning the span, the label line, the band's
 * characters and the ticks; and the span where there is no dark band (OQ-33).
 */
import { describe, expect, it } from 'vitest';
import run from '../../tests/fixtures/stored-run-neuquen.json';
import type { Observer, Pass } from '../model';
import { skyStateAt } from './skyBodies';
import { HOUR_MS, skyBands, type SkyBand } from './timeStripe';
import { solarMidnight, tickLine, TONIGHT_STRIPE_CELLS, tonightSpan, tonightStripe, tonightsDark } from './tonightStripe';

const passes = run.passes as unknown as Pass[];
const ZONE = 'America/Argentina/Salta'; // UTC−3 all year, Neuquén's clock
const observer: Observer = { ...(run.observer as Observer), timeZone: ZONE };
/** 15:00 on 10 September in Neuquén: the afternoon before the run's first night. */
const NOW = Date.UTC(2026, 8, 10, 18, 0);
const bands = skyBands(NOW - 24 * HOUR_MS, NOW + 38 * HOUR_MS, 5 * 60_000, (t) => skyStateAt(t, observer));
const iso = (t: number) => new Date(t).toISOString();

describe('tonightSpan (FR-FIRST-8)', () => {
  it('is 12 h centred on the middle of tonight’s dark band, rounded to the hour', () => {
    const dark = tonightsDark(bands, NOW);
    // Dark from 20:20 to 06:45 local; its middle, 01:32, rounds to 02:00 local (05:00 UTC).
    expect(dark && [iso(dark.from), iso(dark.to)]).toEqual(['2026-09-10T23:20:00.000Z', '2026-09-11T09:45:00.000Z']);
    const span = tonightSpan(bands, observer, NOW);
    expect([iso(span.start), iso(span.end)]).toEqual(['2026-09-10T23:00:00.000Z', '2026-09-11T11:00:00.000Z']);
  });

  it('inside the dark band takes that band, not the next night’s', () => {
    const span = tonightSpan(bands, observer, Date.UTC(2026, 8, 11, 7, 0));
    expect(iso(span.start)).toBe('2026-09-10T23:00:00.000Z');
  });

  it('with no dark band is centred on the next local solar midnight (OQ-33)', () => {
    // A high-summer night at 69° N: day and bright twilight only.
    const north = { lon: 18.96, timeZone: 'UTC' };
    const now = Date.UTC(2026, 5, 20, 12, 0);
    const summer: SkyBand[] = [
      { from: now - 12 * HOUR_MS, to: now + 10 * HOUR_MS, sky: 'day' },
      { from: now + 10 * HOUR_MS, to: now + 14 * HOUR_MS, sky: 'bright-twilight' },
      { from: now + 14 * HOUR_MS, to: now + 36 * HOUR_MS, sky: 'day' },
    ];
    // 18.96° E: solar midnight 75.84 min before UTC midnight, 22:44 UTC, which rounds to 23:00.
    expect(iso(solarMidnight(north.lon, now))).toBe('2026-06-20T22:44:09.600Z');
    const span = tonightSpan(summer, north, now);
    expect([iso(span.start), iso(span.end)]).toEqual(['2026-06-20T17:00:00.000Z', '2026-06-21T05:00:00.000Z']);
  });

  it('takes the solar midnight ahead of now, not the one just gone', () => {
    const lon = -67.99; // 04:32 UTC
    expect(iso(solarMidnight(lon, Date.UTC(2026, 8, 11, 4, 0)))).toBe('2026-09-11T04:31:57.600Z');
    expect(iso(solarMidnight(lon, Date.UTC(2026, 8, 11, 5, 0)))).toBe('2026-09-12T04:31:57.600Z');
  });

  it('rounds to the hour of the observer’s clock, not UTC’s', () => {
    // A 10:00–10:40 UTC dark band, middle 10:20: to 10:00 in UTC, to 10:30 UTC (16:00) in India (UTC+5:30).
    const one: SkyBand[] = [{ from: Date.UTC(2026, 0, 1, 10, 0), to: Date.UTC(2026, 0, 1, 10, 40), sky: 'dark' }];
    const now = Date.UTC(2026, 0, 1, 0, 0);
    expect(iso(tonightSpan(one, { lon: 0, timeZone: null }, now).start)).toBe('2026-01-01T04:00:00.000Z');
    expect(iso(tonightSpan(one, { lon: 0, timeZone: 'Asia/Kolkata' }, now).start)).toBe('2026-01-01T04:30:00.000Z');
  });
});

describe('tonightStripe (FR-FIRST-8)', () => {
  const span = tonightSpan(bands, observer, NOW);
  const stripe = tonightStripe(bands, passes, span, ZONE);

  it('labels every 2 h in the observer’s zone, five characters apart', () => {
    expect(stripe.labels).toBe('20   22   00   02   04   06   08');
    expect(tonightStripe(bands, passes, span, null).labels).toBe('23   01   03   05   07   09   11');
  });

  it('draws 30 characters of 24 min: day, bright twilight and dark from the same bands', () => {
    expect(stripe.cells).toHaveLength(TONIGHT_STRIPE_CELLS);
    expect(stripe.cells.map((cell) => cell.char).join('')).toBe('▒██████████████████████████▒▓▓');
    expect(stripe.cells[0]?.sky).toBe('bright-twilight');
    expect(stripe.cells[1]?.sky).toBe('dark');
    expect(stripe.cells[29]?.sky).toBe('day');
  });

  it('ticks the cell of each listed pass’s peak inside the span, once a cell', () => {
    // The run's first night: seven passes from 04:36 to 06:58 local, two of them peaking in one cell.
    expect(stripe.ticks).toEqual([21, 22, 23, 24, 26, 27]);
    expect(tickLine(stripe.ticks)).toBe('                     ▲▲▲▲ ▲▲  ');
    // Nothing outside the span: the next two nights' passes are not ticked.
    expect(tonightStripe(bands, passes.slice(7), span, ZONE).ticks).toEqual([]);
  });

  it('leaves a cell the bands do not reach blank', () => {
    const empty = tonightStripe([], [], span, ZONE);
    expect(empty.cells.every((cell) => cell.char === ' ' && cell.sky === null)).toBe(true);
  });
});
