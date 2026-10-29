/**
 * R141 (FR-TONIGHT-1, FR-TONIGHT-4, D-897): the jump's, `tonight`'s and
 * `next`'s targets over a stored run, per PLAN §9.9's first bullet.
 */
import { describe, expect, it } from 'vitest';
import type { SkyBand, Span } from './timeStripe';
import { nextTarget, openingJump, tonightTarget } from './tonightJump';

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

describe('openingJump (FR-TONIGHT-1)', () => {
  it('stays on real time while a visible pass is up at now, edges included', () => {
    expect(openingJump([pass(-2), pass(8 * 60)], NOON, span)).toBeNull();
    expect(openingJump([pass(0)], NOON, span)).toBeNull();
    expect(openingJump([pass(-5)], NOON, span)).toBeNull();
  });

  it('lands one minute before the first visible rise later in the span, whatever the list order', () => {
    expect(openingJump([pass(9 * 60), pass(8 * 60), pass(-30)], NOON, span)).toBe(NOON + 8 * HOUR - MIN);
  });

  it('never lands before now: a rise thirty seconds away lands on now', () => {
    expect(openingJump([{ start: { t: NOON + 30_000 }, end: { t: NOON + 6 * MIN } }], NOON, span)).toBe(NOON);
  });

  it('stays on real time with no visible pass in the span', () => {
    expect(openingJump([], NOON, span)).toBeNull();
    expect(openingJump([pass(-30), pass(25 * 60)], NOON, span)).toBeNull();
  });

  it('does not land on a hidden pass: only the passes it is given count', () => {
    const all = [pass(8 * 60), pass(10 * 60)];
    const visible = all.slice(1); // the caller's list, with the first hidden
    expect(openingJump(visible, NOON, span)).toBe(NOON + 10 * HOUR - MIN);
  });
});

describe('tonightTarget (FR-TONIGHT-4)', () => {
  it('from the day, lands before the first visible pass tonight and plays', () => {
    const passes = [pass(9 * 60), pass(8 * 60), pass(3 * 60), pass(20 * 60)];
    expect(tonightTarget(bands, passes, NOON, NOON)).toEqual({ t: NOON + 8 * HOUR - MIN, play: true });
  });

  it('counts a pass in the twilight at either end as tonight’s', () => {
    expect(tonightTarget(bands, [pass(7 * 60 + 10)], NOON, NOON)).toEqual({ t: NOON + 7 * HOUR + 9 * MIN, play: true });
  });

  it('with no visible pass tonight, goes to the night’s start, paused', () => {
    expect(tonightTarget(bands, [pass(3 * 60), pass(19 * 60)], NOON, NOON)).toEqual({ t: NIGHT_START, play: false });
    expect(tonightTarget(bands, [], NOON, NOON + 2 * HOUR)).toEqual({ t: NIGHT_START, play: false });
  });

  it('with t inside tonight, goes to the first visible pass at or after t', () => {
    const passes = [pass(8 * 60), pass(10 * 60), pass(12 * 60)];
    expect(tonightTarget(bands, passes, NOON, NOON + 9 * HOUR)).toEqual({ t: NOON + 10 * HOUR - MIN, play: true });
    // From a landing, the same pass: the tap does not skip the one it landed before.
    expect(tonightTarget(bands, passes, NOON, NOON + 10 * HOUR - MIN)).toEqual({ t: NOON + 10 * HOUR - MIN, play: true });
    // Past tonight's last, back to its first.
    expect(tonightTarget(bands, passes, NOON, NOON + 13 * HOUR)).toEqual({ t: NOON + 8 * HOUR - MIN, play: true });
  });

  it('with now inside the night, tonight is this night and nothing before now', () => {
    const now = NOON + 9 * HOUR;
    expect(tonightTarget(bands, [pass(8 * 60), pass(11 * 60)], now, now)).toEqual({ t: NOON + 11 * HOUR - MIN, play: true });
    expect(tonightTarget(bands, [pass(8 * 60)], now, now)).toEqual({ t: now, play: false });
  });

  it('is null while the bands hold no night', () => {
    expect(tonightTarget([], [pass(8 * 60)], NOON, NOON)).toBeNull();
    expect(tonightTarget([{ from: NOON, to: NOON + 25 * HOUR, sky: 'day' }], [pass(8 * 60)], NOON, NOON)).toBeNull();
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
