/**
 * R141 (FR-TONIGHT-4, D-897): `tonight`'s and `next`'s targets over a stored
 * run, per PLAN §9.9's first bullet. R213 (FR-STRIP-5): the opening's jump and
 * choice left with the card.
 */
import { describe, expect, it } from 'vitest';
import type { SkyBand, Span } from './timeStripe';
import { nextTarget, tonightTarget } from './tonightJump';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOON = Date.UTC(2026, 9, 29, 12, 0);
const span: Span = { start: NOON, end: NOON + 24 * HOUR };

const pass = (startMin: number, lengthMin = 5) => ({ start: { t: NOON + startMin * MIN }, end: { t: NOON + (startMin + lengthMin) * MIN } });

/** Day until 19:00, twilight to 19:40, dark to 05:20, twilight to 06:00, day after. */
const bands: SkyBand[] = [
  { from: NOON - HOUR, to: NOON + 7 * HOUR, sky: 'day' },
  { from: NOON + 7 * HOUR, to: NOON + 7 * HOUR + 40 * MIN, sky: 'bright-twilight' },
  { from: NOON + 7 * HOUR + 40 * MIN, to: NOON + 17 * HOUR + 20 * MIN, sky: 'dark' },
  { from: NOON + 17 * HOUR + 20 * MIN, to: NOON + 18 * HOUR, sky: 'bright-twilight' },
  { from: NOON + 18 * HOUR, to: NOON + 25 * HOUR, sky: 'day' },
];
const NIGHT_START = NOON + 7 * HOUR;

describe('tonightTarget (FR-TONIGHT-4)', () => {
  it('from the day, lands before the first visible pass tonight and plays', () => {
    const passes = [pass(9 * 60), pass(8 * 60), pass(3 * 60), pass(20 * 60)];
    expect(tonightTarget(bands, passes, NOON, NOON, span)).toEqual({ t: NOON + 8 * HOUR - MIN, play: true });
  });

  it('counts a pass in the twilight at either end as tonight’s', () => {
    expect(tonightTarget(bands, [pass(7 * 60 + 10)], NOON, NOON, span)).toEqual({ t: NOON + 7 * HOUR + 9 * MIN, play: true });
  });

  it('with no visible pass tonight, goes to the night’s start, paused', () => {
    expect(tonightTarget(bands, [pass(3 * 60), pass(19 * 60)], NOON, NOON, span)).toEqual({ t: NIGHT_START, play: false });
    expect(tonightTarget(bands, [], NOON, NOON + 2 * HOUR, span)).toEqual({ t: NIGHT_START, play: false });
  });

  it('with t inside tonight, goes to the first visible pass at or after t', () => {
    const passes = [pass(8 * 60), pass(10 * 60), pass(12 * 60)];
    expect(tonightTarget(bands, passes, NOON, NOON + 9 * HOUR, span)).toEqual({ t: NOON + 10 * HOUR - MIN, play: true });
    // From a landing, the same pass: the tap does not skip the one it landed before.
    expect(tonightTarget(bands, passes, NOON, NOON + 10 * HOUR - MIN, span)).toEqual({ t: NOON + 10 * HOUR - MIN, play: true });
    // Past tonight's last, back to its first.
    expect(tonightTarget(bands, passes, NOON, NOON + 13 * HOUR, span)).toEqual({ t: NOON + 8 * HOUR - MIN, play: true });
  });

  it('with now inside the night, tonight is this night and nothing before now', () => {
    const now = NOON + 9 * HOUR;
    expect(tonightTarget(bands, [pass(8 * 60), pass(11 * 60)], now, now, span)).toEqual({ t: NOON + 11 * HOUR - MIN, play: true });
    expect(tonightTarget(bands, [pass(8 * 60)], now, now, span)).toEqual({ t: now, play: false });
  });

  it('keeps to the span: a pass rising past its end is not tonight’s, and the night’s start is held at its end', () => {
    const short: Span = { start: NOON, end: NOON + 6 * HOUR };
    expect(tonightTarget(bands, [pass(8 * 60)], NOON, NOON, short)).toEqual({ t: NOON + 6 * HOUR, play: false });
    const cut: Span = { start: NOON, end: NOON + 8 * HOUR };
    expect(tonightTarget(bands, [pass(9 * 60), pass(7 * 60 + 30)], NOON, NOON, cut)).toEqual({ t: NOON + 7 * HOUR + 29 * MIN, play: true });
  });

  it('is null while the bands hold no night', () => {
    expect(tonightTarget([], [pass(8 * 60)], NOON, NOON, span)).toBeNull();
    expect(tonightTarget([{ from: NOON, to: NOON + 25 * HOUR, sky: 'day' }], [pass(8 * 60)], NOON, NOON, span)).toBeNull();
  });
});

describe('nextTarget (FR-TONIGHT-4)', () => {
  const passes = [pass(10 * 60), pass(8 * 60), pass(12 * 60)];

  it('lands before the first visible rise after t + the lead, so from a landing it moves on', () => {
    expect(nextTarget(passes, NOON)).toBe(NOON + 8 * HOUR - MIN);
    expect(nextTarget(passes, NOON + 8 * HOUR - MIN)).toBe(NOON + 10 * HOUR - MIN);
    expect(nextTarget(passes, NOON + 8 * HOUR + 2 * MIN)).toBe(NOON + 10 * HOUR - MIN);
  });

  it('is null at the last pass of the span', () => {
    expect(nextTarget(passes, NOON + 12 * HOUR - MIN)).toBeNull();
    expect(nextTarget([], NOON)).toBeNull();
  });
});
