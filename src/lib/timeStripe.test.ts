/**
 * R33 (FR-LIVE-4): the stripe's geometry — tick positions, the night bands, a
 * pass segment, the cursor — and the two ways of moving the instant along it.
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../tests/support/catalogFixtures';
import type { Pass } from '../model';
import {
  CELL_PX,
  CHUNK_MIN_WALL_S,
  CHUNK_MS,
  chunkFor,
  clampToSpan,
  cursorAt,
  daysFromCivil,
  drawnSpan,
  HOUR_MS,
  hourTicks,
  isCurrent,
  keepLabels,
  keyStep,
  labelEveryHours,
  labelEveryMs,
  midnightDate,
  OVERVIEW_KEY_STEP_MS,
  overviewKeyStep,
  STRIPE_CHUNK_H,
  tickLabel,
  nextRise,
  nightBands,
  passSegments,
  previousRise,
  RISE_SLACK_MS,
  shortWeekday,
  skyBands,
  STRIPE_LABEL_MIN_CELLS,
  timeAt,
  xAt,
  zoneOffsetMs,
  type Span,
  type StripeLabel,
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

describe('daysFromCivil', () => {
  it('agrees with the epoch calendar on both sides of a leap day and of 1970', () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(daysFromCivil(2026, 9, 11)).toBe(Date.UTC(2026, 8, 11) / 86_400_000);
    expect(daysFromCivil(2024, 2, 29)).toBe(Date.UTC(2024, 1, 29) / 86_400_000);
    expect(daysFromCivil(2024, 3, 1)).toBe(Date.UTC(2024, 2, 1) / 86_400_000);
    expect(daysFromCivil(1969, 12, 31)).toBe(-1);
    expect(daysFromCivil(2000, 1, 1)).toBe(Date.UTC(2000, 0, 1) / 86_400_000);
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
  /*
   * R48 (FR-TRAJ-4): every 2 h where twelve two-character labels fit and every
   * 3 h where they do not, always from midnight; the midnight tick is flagged
   * for its date. R61 (D-312): the room is the *stripe's*, measured in cells of
   * its own width, and no longer the shell's — the wide live page draws the
   * stripe in a 44- to 68-cell rail, where the shell's answer overlapped the
   * numbers (F-59).
   */
  it('labels every second hour where twelve fit and every third where they do not, from midnight, and flags the midnight crossing', () => {
    expect(labelEveryHours(STRIPE_LABEL_MIN_CELLS)).toBe(2);
    expect(labelEveryHours(STRIPE_LABEL_MIN_CELLS - 1)).toBe(3);
    // 350 px is 36 cells, the phone's stripe.
    const narrow = hourTicks(span, 350, 'UTC');
    expect(narrow.filter((tick) => tick.labelled).map((tick) => tick.hour)).toEqual([12, 15, 18, 21, 0, 3, 6, 9]);
    // 1200 px is 125 of them.
    const roomy = hourTicks(span, WIDTH, 'UTC');
    expect(roomy.filter((tick) => tick.labelled).map((tick) => tick.hour)).toEqual([10, 12, 14, 16, 18, 20, 22, 0, 2, 4, 6, 8]);
    expect(roomy.filter((tick) => tick.midnight).map((tick) => tick.t)).toEqual([Date.UTC(2026, 8, 12)]);
    // The cells can be given instead of measured, for a caller whose cell is not the base one.
    expect(hourTicks(span, WIDTH, 'UTC', 36).filter((tick) => tick.labelled).map((tick) => tick.hour)).toEqual([12, 15, 18, 21, 0, 3, 6, 9]);
  });
});

/**
 * R70 (FR-SPAN-1, D-382): the four hours the stripe draws. The boundaries are
 * multiples of four hours from the observer's local midnight — whole clock
 * hours that do not move as time runs — clipped to the span at both ends.
 */
describe('chunkFor (FR-SPAN-1)', () => {
  const local = (t: number, zone: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t);

  it('cuts on the observer clock at UTC and at a half-hour zone alike', () => {
    // 14:30 UTC: the chunk is 12:00–16:00 UTC, whole clock hours inside the span.
    const utc = chunkFor(START + 5 * HOUR_MS, span, 'UTC');
    expect([local(utc.start, 'UTC'), local(utc.end, 'UTC')]).toEqual(['12:00', '16:00']);
    expect(utc.end - utc.start).toBe(CHUNK_MS);
    // The same instant is 20:00 in Kolkata, half an hour off UTC: the chunk is 20:00–00:00 IST, which is 14:30–18:30 UTC.
    const half = chunkFor(START + 5 * HOUR_MS, span, 'Asia/Kolkata');
    expect([local(half.start, 'Asia/Kolkata'), local(half.end, 'Asia/Kolkata')]).toEqual(['20:00', '00:00']);
    expect(new Date(half.end).toISOString()).toBe('2026-09-11T18:30:00.000Z');
  });

  it('returns the chunk holding the instant on either side of a boundary, and the boundary belongs to the chunk it opens', () => {
    const boundary = Date.UTC(2026, 8, 11, 12, 0, 0);
    expect(chunkFor(boundary - 1, span, 'UTC').end).toBe(boundary);
    expect(chunkFor(boundary, span, 'UTC').start).toBe(boundary);
    expect(chunkFor(boundary + 1, span, 'UTC')).toEqual({ start: boundary, end: boundary + CHUNK_MS });
  });

  it('clips at both ends of the span: the first chunk starts at now and the last ends at now + 24 h', () => {
    expect(chunkFor(START, span, 'UTC')).toEqual({ start: START, end: Date.UTC(2026, 8, 11, 12, 0, 0) });
    expect(chunkFor(span.end, span, 'UTC')).toEqual({ start: Date.UTC(2026, 8, 12, 8, 0, 0), end: span.end });
    expect(chunkFor(span.end - 1, span, 'UTC').end).toBe(span.end);
    // An instant outside the span names the chunk at the edge it is outside.
    expect(chunkFor(span.end + HOUR_MS, span, 'UTC').end).toBe(span.end);
    expect(chunkFor(START - HOUR_MS, span, 'UTC').start).toBe(START);
  });

  it('is four hours long, and an unknown zone cuts on UTC like every other clock on the page', () => {
    expect(STRIPE_CHUNK_H).toBe(4);
    expect(chunkFor(START + 5 * HOUR_MS, span, null)).toEqual(chunkFor(START + 5 * HOUR_MS, span, 'UTC'));
  });
});

/** R70 (FR-SPAN-6, D-385): the speed at which a chunk stops being worth drawing. */
describe('drawnSpan (FR-SPAN-6)', () => {
  const t = START + 5 * HOUR_MS;
  it('gives the chunk at 1× and 60×, and the whole span at 600× and 3600×', () => {
    expect(drawnSpan(t, span, 'UTC', 1)).toEqual(chunkFor(t, span, 'UTC'));
    expect(drawnSpan(t, span, 'UTC', 60)).toEqual(chunkFor(t, span, 'UTC'));
    expect(drawnSpan(t, span, 'UTC', 600)).toBe(span);
    expect(drawnSpan(t, span, 'UTC', 3600)).toBe(span);
  });
  it('is wall time and not a list of speeds: ten seconds to the hour is the line', () => {
    expect(CHUNK_MIN_WALL_S).toBe(10);
    const exactly = 3600 / CHUNK_MIN_WALL_S;
    expect(exactly).toBe(360);
    expect(drawnSpan(t, span, 'UTC', exactly)).toEqual(chunkFor(t, span, 'UTC'));
    expect(drawnSpan(t, span, 'UTC', exactly + 1)).toBe(span);
  });
  it('gives the chunk back while paused, whatever speed is selected', () => {
    expect(drawnSpan(t, span, 'UTC', null)).toEqual(chunkFor(t, span, 'UTC'));
  });
});

/** R70 (FR-LIVE-4 as amended v1.4, FR-SPAN-2): the page keys, and the overview's own quarter hour. */
describe('keyStep and overviewKeyStep (FR-SPAN-2)', () => {
  const t = START + 6 * HOUR_MS;
  it('moves the stripe one chunk on Page Up and Page Down, clamped', () => {
    expect(keyStep(t, 'PageUp', false, span)).toBe(t + CHUNK_MS);
    expect(keyStep(t, 'PageDown', false, span)).toBe(t - CHUNK_MS);
    expect(keyStep(START + HOUR_MS, 'PageDown', false, span)).toBe(START);
    expect(keyStep(span.end - HOUR_MS, 'PageUp', false, span)).toBe(span.end);
  });
  it('moves the overview a quarter hour on the arrows and a chunk on the page keys', () => {
    expect(OVERVIEW_KEY_STEP_MS).toBe(15 * 60_000);
    expect(overviewKeyStep(t, 'ArrowRight', span)).toBe(t + 15 * 60_000);
    expect(overviewKeyStep(t, 'ArrowLeft', span)).toBe(t - 15 * 60_000);
    expect(overviewKeyStep(t, 'PageUp', span)).toBe(t + CHUNK_MS);
    expect(overviewKeyStep(t, 'PageDown', span)).toBe(t - CHUNK_MS);
    expect(overviewKeyStep(START, 'ArrowLeft', span)).toBe(START);
    expect(overviewKeyStep(t, 'Enter', span)).toBeNull();
  });
});

/** R70 (FR-SPAN-7, FR-TRAJ-4 as amended v1.4): the cadence the chunk is labelled at. */
describe('labelEveryMs and the chunk ticks (FR-SPAN-7)', () => {
  it('labels a chunk every 30 min where its own labels fit — four cells each — and every hour under that', () => {
    // Eight half hours in a chunk: 32 cells, inside the 36 FR-TRAJ-4 guarantees the compact stripe (360 px is 37.5).
    expect(labelEveryMs(CHUNK_MS, 32)).toBe(30 * 60_000);
    expect(labelEveryMs(CHUNK_MS, 360 / CELL_PX)).toBe(30 * 60_000);
    expect(labelEveryMs(CHUNK_MS, 31)).toBe(HOUR_MS);
    // A chunk clipped by the span's start is shorter and wants less: three half hours, twelve cells.
    expect(labelEveryMs(90 * 60_000, 12)).toBe(30 * 60_000);
    expect(labelEveryMs(90 * 60_000, 11)).toBe(HOUR_MS);
    // …and the whole span keeps FR-TRAJ-4's own pair.
    expect(labelEveryMs(24 * HOUR_MS, STRIPE_LABEL_MIN_CELLS)).toBe(2 * HOUR_MS);
    expect(labelEveryMs(24 * HOUR_MS, STRIPE_LABEL_MIN_CELLS - 1)).toBe(3 * HOUR_MS);
  });
  it('puts a tick on every half hour of the chunk at the roomy cadence, and every hour at the dense one', () => {
    const chunk = chunkFor(Date.UTC(2026, 8, 11, 13, 0, 0), span, 'UTC');
    const roomy = hourTicks(chunk, 1200, 'UTC');
    expect(roomy.map((tick) => `${String(tick.hour)}:${String(tick.minute).padStart(2, '0')}`)).toEqual(['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']);
    expect(roomy.every((tick) => tick.labelled)).toBe(true);
    expect(roomy.map(tickLabel)).toEqual(['12', '30', '13', '30', '14', '30', '15', '30', '16']);
    // Under 32 cells — a rail narrower than the compact stripe — the chunk is labelled every hour.
    const dense = hourTicks(chunk, 31 * CELL_PX, 'UTC');
    expect(dense.map((tick) => tick.hour)).toEqual([12, 13, 14, 15, 16]);
    expect(dense.map(tickLabel)).toEqual(['12', '13', '14', '15', '16']);
  });
  it('flags the midnight crossing inside a chunk, whose label is the date and not the hour', () => {
    const chunk = chunkFor(Date.UTC(2026, 8, 11, 23, 0, 0), span, 'UTC');
    const ticks = hourTicks(chunk, 350, 'UTC');
    expect(ticks.filter((tick) => tick.midnight).map((tick) => tick.t)).toEqual([Date.UTC(2026, 8, 12)]);
  });
});

/**
 * R61 (FR-TRAJ-4, D-312, F-59): which of the labelled ticks are drawn. A label
 * is centred on its tick and `text.length` cells wide.
 */
describe('keepLabels', () => {
  const label = (x: number, text: string, midnight = false): StripeLabel => ({ tick: { t: START + x, x, hour: midnight ? 0 : 12, minute: 0, labelled: true, midnight }, text });

  it('drops a label that would spill past either edge', () => {
    const kept = keepLabels([label(2, '06'), label(300, '12'), label(595, '18')], 600);
    expect(kept.map(({ text }) => text)).toEqual(['12']);
  });

  it('drops a label that would touch the one beside it, and the date is the one that stays', () => {
    // Two-character labels are 19.2 px, the date 67.2; 50 px apart, the date reaches both of its neighbours.
    const kept = keepLabels([label(250, '22'), label(300, '12 Sept', true), label(350, '02'), label(400, '04')], 600);
    expect(kept.map(({ text }) => text)).toEqual(['12 Sept', '04']);
  });

  it('keeps every label where they clear each other, in the order the stripe draws them', () => {
    const kept = keepLabels([label(100, '20'), label(300, '12 Sept', true), label(500, '04')], 600);
    expect(kept.map(({ text }) => text)).toEqual(['20', '12 Sept', '04']);
  });

  it('drops a label with no text (a zone the date cannot be formatted in)', () => {
    expect(keepLabels([label(300, '')], 600)).toEqual([]);
  });
});

describe('midnightDate (FR-TRAJ-4)', () => {
  it('is the day and the short month in the zone, in either language, without a trailing period', () => {
    const midnight = Date.UTC(2026, 8, 12, 3, 0, 0); // 00:00 in Neuquén
    expect(midnightDate(midnight, 'America/Argentina/Buenos_Aires', 'en')).toBe('12 Sept');
    expect(midnightDate(midnight, 'America/Argentina/Buenos_Aires', 'es')).toBe('12 sept');
    expect(midnightDate(Date.UTC(2026, 11, 1), null, 'en')).toBe('1 Dec');
    expect(midnightDate(Date.UTC(2026, 11, 1), 'Not/AZone', 'en')).toBe('');
  });
  it('names the weekday short in either language', () => {
    const saturday = Date.UTC(2026, 8, 12, 15, 0, 0);
    expect(shortWeekday(saturday, 'America/Argentina/Buenos_Aires', 'en')).toBe('Sat');
    expect(shortWeekday(saturday, 'America/Argentina/Buenos_Aires', 'es')).toBe('sáb');
    expect(shortWeekday(saturday, 'Not/AZone', 'en')).toBe('');
  });
});

describe('nextRise / previousRise (FR-TRAJ-5)', () => {
  const golden = goldenPassFixture();
  const rising = (id: string, atMs: number): Pass => ({ ...golden, id, start: { ...golden.start, t: START + atMs } });
  const passes = [rising('under-way', -20 * 60_000), rising('a', HOUR_MS), rising('b', 6 * HOUR_MS), rising('far', 30 * HOUR_MS)];

  it('jumps to the first rise after and the last rise before the instant, inside the span only', () => {
    expect(nextRise(passes, START, span)).toBe(START + HOUR_MS);
    expect(nextRise(passes, START + HOUR_MS, span)).toBe(START + 6 * HOUR_MS);
    expect(nextRise(passes, START + 6 * HOUR_MS, span)).toBeNull();
    expect(previousRise(passes, START + 6 * HOUR_MS, span)).toBe(START + HOUR_MS);
    expect(previousRise(passes, START + HOUR_MS, span)).toBeNull();
    expect(previousRise(passes, START + 12 * HOUR_MS, span)).toBe(START + 6 * HOUR_MS);
    expect(nextRise([], START, span)).toBeNull();
  });
  it('treats a rise within a second as reached, so a second tap moves on', () => {
    expect(nextRise(passes, START + HOUR_MS - 500, span)).toBe(START + 6 * HOUR_MS);
    expect(previousRise(passes, START + 6 * HOUR_MS + 500, span)).toBe(START + HOUR_MS);
    expect(nextRise(passes, START + HOUR_MS - RISE_SLACK_MS - 1, span)).toBe(START + HOUR_MS);
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

  it('is one segment per pass in its series colour, clipped to the span, carrying the pass its own interval', () => {
    const passes = [at('a', -30 * 60_000, HOUR_MS), at('b', 6 * HOUR_MS, 30 * 60_000), at('c', 30 * HOUR_MS, HOUR_MS)];
    const segments = passSegments(passes, span, WIDTH);
    expect(segments).toEqual([
      { passId: 'a', x: 0, width: 25, series: 1, lane: 0, start: START - 30 * 60_000, end: START + 30 * 60_000 },
      { passId: 'b', x: 300, width: 25, series: 2, lane: 0, start: START + 6 * HOUR_MS, end: START + 6.5 * HOUR_MS },
    ]);
    // R39 (F-38): which pass is under way is asked of the segment, not baked into it — the instant moves every frame and the geometry does not.
    const instant = START + 6 * HOUR_MS + 60_000;
    expect(segments.map((segment) => isCurrent(segment, instant))).toEqual([false, true]);
    expect(segments.map((segment) => isCurrent(segment, START))).toEqual([true, false]);
  });
  it('gives overlapping passes their own rows and lets a short pass keep a visible width', () => {
    const passes = [at('a', HOUR_MS, HOUR_MS), at('b', HOUR_MS + 10 * 60_000, HOUR_MS), at('c', HOUR_MS + 20 * 60_000, 60_000), at('d', 3 * HOUR_MS, 60_000)];
    const segments = passSegments(passes, span, WIDTH);
    expect(segments.map((s) => [s.passId, s.lane])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 0],
    ]);
    expect(segments[2]?.width).toBe(2);
    // The seventh pass cycles back to the first series colour.
    const seven = passSegments(Array.from({ length: 7 }, (_, i) => at(String(i), i * 2 * HOUR_MS, HOUR_MS)), span, WIDTH);
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
