/**
 * R33 (FR-LIVE-4): the stripe's geometry — tick positions, the night bands, a
 * pass segment, the cursor — and the two ways of moving the instant along it.
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../tests/support/catalogFixtures';
import type { Pass } from '../model';
import {
  clampToSpan,
  cursorAt,
  HOUR_MS,
  hourTicks,
  keyStep,
  labelEveryHours,
  nightBands,
  passSegments,
  skyBands,
  timeAt,
  xAt,
  zoneOffsetMs,
  type Span,
} from './timeStripe';

const START = Date.UTC(2026, 8, 11, 9, 30, 0);
const span: Span = { start: START, end: START + 24 * HOUR_MS };
const WIDTH = 1200;

describe('xAt / timeAt / clampToSpan', () => {
  it('maps the span onto the width both ways, and clamps a pointer past either edge', () => {
    expect(xAt(START, span, WIDTH)).toBe(0);
    expect(xAt(START + 12 * HOUR_MS, span, WIDTH)).toBe(600);
    expect(xAt(span.end, span, WIDTH)).toBe(WIDTH);
    expect(timeAt(300, span, WIDTH)).toBe(START + 6 * HOUR_MS);
    expect(timeAt(-40, span, WIDTH)).toBe(START);
    expect(timeAt(WIDTH + 40, span, WIDTH)).toBe(span.end);
    expect(timeAt(300, span, 0)).toBe(START);
    expect(clampToSpan(START - 1, span)).toBe(START);
    expect(clampToSpan(span.end + 1, span)).toBe(span.end);
  });
});

describe('keyStep (FR-LIVE-4: 1 min, 10 min with Shift)', () => {
  const t = START + HOUR_MS;
  it('moves one minute on the arrows and ten with Shift, either way', () => {
    expect(keyStep(t, 'ArrowRight', false, span)).toBe(t + 60_000);
    expect(keyStep(t, 'ArrowLeft', false, span)).toBe(t - 60_000);
    expect(keyStep(t, 'ArrowRight', true, span)).toBe(t + 600_000);
    expect(keyStep(t, 'ArrowLeft', true, span)).toBe(t - 600_000);
    expect(keyStep(t, 'ArrowUp', false, span)).toBe(t + 60_000);
    expect(keyStep(t, 'ArrowDown', false, span)).toBe(t - 60_000);
  });
  it('clamps to the span and ignores other keys', () => {
    expect(keyStep(START + 30_000, 'ArrowLeft', false, span)).toBe(START);
    expect(keyStep(span.end - 30_000, 'ArrowRight', true, span)).toBe(span.end);
    expect(keyStep(t, 'Enter', false, span)).toBeNull();
    expect(keyStep(t, 'a', true, span)).toBeNull();
  });
});

describe('zoneOffsetMs', () => {
  it('reads the offset of a zone at an instant, and zero for an unknown zone', () => {
    expect(zoneOffsetMs(START, 'America/Argentina/Buenos_Aires')).toBe(-3 * HOUR_MS);
    expect(zoneOffsetMs(START, 'Asia/Kolkata')).toBe(5.5 * HOUR_MS);
    expect(zoneOffsetMs(START, 'UTC')).toBe(0);
    expect(zoneOffsetMs(START, null)).toBe(0);
    expect(zoneOffsetMs(START, 'Not/AZone')).toBe(0);
  });
});

describe('hourTicks', () => {
  it('puts a tick on every whole hour of the observer clock inside the span, from the first after the start', () => {
    const ticks = hourTicks(span, WIDTH, 'America/Argentina/Buenos_Aires');
    // 09:30 UTC is 06:30 in Neuquén; the first whole hour is 07:00 local = 10:00 UTC, and the last inside the span is 06:00 local next day.
    expect(ticks).toHaveLength(24);
    expect(ticks[0]).toMatchObject({ t: Date.UTC(2026, 8, 11, 10, 0, 0), x: 25, hour: 7 });
    expect(ticks[23]).toMatchObject({ t: Date.UTC(2026, 8, 12, 9, 0, 0), hour: 6 });
    expect(ticks.map((tick) => tick.hour)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]);
  });
  it('lands the ticks on half hours of UTC in a half-hour zone', () => {
    const ticks = hourTicks(span, WIDTH, 'Asia/Kolkata');
    expect(new Date(ticks[0]?.t ?? 0).toISOString()).toBe('2026-09-11T09:30:00.000Z'); // 15:00 IST is a whole hour, at the span's very start
    expect(ticks[0]?.hour).toBe(15);
  });
  it('labels every hour when they fit, every third at a phone width, and always from midnight', () => {
    expect(labelEveryHours(span, WIDTH)).toBe(1); // 50 px per hour
    expect(labelEveryHours(span, 350)).toBe(3); // 14.6 px per hour: 1 and 2 are too close, 3 gives 44 px
    expect(labelEveryHours(span, 100)).toBe(12);
    const narrow = hourTicks(span, 350, 'UTC');
    expect(narrow.filter((tick) => tick.labelled).map((tick) => tick.hour)).toEqual([12, 15, 18, 21, 0, 3, 6, 9]);
    expect(hourTicks(span, WIDTH, 'UTC').every((tick) => tick.labelled)).toBe(true);
  });
});

describe('skyBands / nightBands', () => {
  it('runs consecutive samples of one state into a band, and leaves day unshaded', () => {
    // Day until 3 h in, bright twilight for the next hour, dark to 14 h, twilight to 15 h, day after.
    const sample = (t: number): 'day' | 'bright-twilight' | 'dark' => {
      const h = (t - START) / HOUR_MS;
      if (h < 3 || h >= 15) return 'day';
      if (h < 4 || h >= 14) return 'bright-twilight';
      return 'dark';
    };
    const bands = skyBands(START, span.end, 5 * 60_000, sample);
    expect(bands).toEqual([
      { from: START, to: START + 3 * HOUR_MS, sky: 'day' },
      { from: START + 3 * HOUR_MS, to: START + 4 * HOUR_MS, sky: 'bright-twilight' },
      { from: START + 4 * HOUR_MS, to: START + 14 * HOUR_MS, sky: 'dark' },
      { from: START + 14 * HOUR_MS, to: START + 15 * HOUR_MS, sky: 'bright-twilight' },
      { from: START + 15 * HOUR_MS, to: span.end, sky: 'day' },
    ]);
    expect(nightBands(bands, span, WIDTH)).toEqual([
      { x: 150, width: 50, sky: 'bright-twilight' },
      { x: 200, width: 500, sky: 'dark' },
      { x: 700, width: 50, sky: 'bright-twilight' },
    ]);
  });
  it('clips a band to the span and drops one outside it', () => {
    const bands = nightBands(
      [
        { from: START - HOUR_MS, to: START + HOUR_MS, sky: 'dark' },
        { from: span.end + HOUR_MS, to: span.end + 2 * HOUR_MS, sky: 'dark' },
      ],
      span,
      WIDTH,
    );
    expect(bands).toEqual([{ x: 0, width: 50, sky: 'dark' }]);
  });
});

describe('passSegments', () => {
  const golden = goldenPassFixture();
  const at = (id: string, fromMs: number, durationMs: number): Pass => ({
    ...golden,
    id,
    start: { ...golden.start, t: START + fromMs },
    peak: { ...golden.peak, t: START + fromMs + durationMs / 2 },
    end: { ...golden.end, t: START + fromMs + durationMs },
  });

  it('is one segment per pass in its series colour, clipped to the span, and marks the pass containing the instant', () => {
    const passes = [at('a', -30 * 60_000, HOUR_MS), at('b', 6 * HOUR_MS, 30 * 60_000), at('c', 30 * HOUR_MS, HOUR_MS)];
    const segments = passSegments(passes, span, WIDTH, START + 6 * HOUR_MS + 60_000);
    expect(segments).toEqual([
      { passId: 'a', x: 0, width: 25, series: 1, lane: 0, current: false },
      { passId: 'b', x: 300, width: 25, series: 2, lane: 0, current: true },
    ]);
  });
  it('gives overlapping passes their own rows and lets a short pass keep a visible width', () => {
    const passes = [at('a', HOUR_MS, HOUR_MS), at('b', HOUR_MS + 10 * 60_000, HOUR_MS), at('c', HOUR_MS + 20 * 60_000, 60_000), at('d', 3 * HOUR_MS, 60_000)];
    const segments = passSegments(passes, span, WIDTH, START);
    expect(segments.map((s) => [s.passId, s.lane])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 0],
    ]);
    expect(segments[2]?.width).toBe(2);
    // The seventh pass cycles back to the first series colour.
    const seven = passSegments(Array.from({ length: 7 }, (_, i) => at(String(i), i * 2 * HOUR_MS, HOUR_MS)), span, WIDTH, START);
    expect(seven.map((s) => s.series)).toEqual([1, 2, 3, 4, 5, 6, 1]);
  });
});

describe('cursorAt', () => {
  it('sits at the instant and hangs its label inward near either edge', () => {
    expect(cursorAt(START + 12 * HOUR_MS, span, WIDTH)).toEqual({ x: 600, anchor: 'middle' });
    expect(cursorAt(START, span, WIDTH)).toEqual({ x: 0, anchor: 'start' });
    expect(cursorAt(span.end, span, WIDTH)).toEqual({ x: WIDTH, anchor: 'end' });
    expect(cursorAt(span.end + HOUR_MS, span, WIDTH)).toEqual({ x: WIDTH, anchor: 'end' });
  });
});
