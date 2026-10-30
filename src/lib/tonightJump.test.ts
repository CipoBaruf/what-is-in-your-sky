/**
 * R141 (FR-TONIGHT-1, FR-TONIGHT-4, D-897): the jump's, `tonight`'s and
 * `next`'s targets over a stored run, per PLAN §9.9's first bullet. R146
 * (FR-FULL-10, D-925): the opening card's choice, per PLAN §9.10's first.
 */
import { describe, expect, it } from 'vitest';
import type { SkyBand, Span } from './timeStripe';
import { nextTarget, openingChoice, openingJump, tonightTarget } from './tonightJump';

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

describe('openingChoice (FR-FULL-10, D-925)', () => {
  it('is up while a visible pass is up at now, edges included: no card', () => {
    expect(openingChoice([pass(-2), pass(8 * 60)], NOON, span)).toEqual({ kind: 'up' });
    expect(openingChoice([pass(0)], NOON, span)).toEqual({ kind: 'up' });
    expect(openingChoice([pass(-5)], NOON, span)).toEqual({ kind: 'up' });
  });

  it('asks about the first visible rise later in the span, with openingJump’s lead instant, whatever the list order', () => {
    const passes = [pass(9 * 60), pass(8 * 60), pass(-30)];
    expect(openingChoice(passes, NOON, span)).toEqual({ kind: 'ask', pass: passes[1], at: NOON + 8 * HOUR - MIN });
    expect(openingChoice(passes, NOON, span)).toMatchObject({ at: openingJump(passes, NOON, span) });
  });

  it('gives the caller’s own pass back, its other fields with it', () => {
    const named = [{ ...pass(8 * 60), name: 'Tiangong' }];
    const choice = openingChoice(named, NOON, span);
    expect(choice.kind === 'ask' && choice.pass.name).toBe('Tiangong');
  });

  it('never asks to land before now: a rise thirty seconds away is at now', () => {
    const soon = { start: { t: NOON + 30_000 }, end: { t: NOON + 6 * MIN } };
    expect(openingChoice([soon], NOON, span)).toEqual({ kind: 'ask', pass: soon, at: NOON });
  });

  it('advises with no visible pass in the span', () => {
    expect(openingChoice([], NOON, span)).toEqual({ kind: 'advise' });
    expect(openingChoice([pass(-30), pass(25 * 60)], NOON, span)).toEqual({ kind: 'advise' });
  });

  it('does not ask about a hidden pass: only the passes it is given count', () => {
    const all = [pass(8 * 60), pass(10 * 60)];
    const visible = all.slice(1); // the caller's list, with the first hidden
    expect(openingChoice(visible, NOON, span)).toEqual({ kind: 'ask', pass: all[1], at: NOON + 10 * HOUR - MIN });
    // A hidden pass up now is no reason to stay: with it filtered out the card asks about the next.
    expect(openingChoice([pass(10 * 60)], NOON, span)).toMatchObject({ kind: 'ask' });
    // And with only hidden passes in the span, the advice.
    expect(openingChoice(all.slice(2), NOON, span)).toEqual({ kind: 'advise' });
  });
});

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
