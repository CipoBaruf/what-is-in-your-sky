/**
 * R33 (FR-LIVE-5, D-81): the frame arithmetic. A dropped frame loses no
 * simulated time, the instant stops at the end of the span, and the wall-time
 * budgets are one rule.
 */
import { describe, expect, it } from 'vitest';
import { advance, BODIES_EVERY_MS, DEFAULT_SPEED, due, HIDDEN_EVERY_MS, isSpeed, SPEEDS } from './playback';

const T = Date.UTC(2026, 8, 11, 9, 30, 0);
const END = T + 24 * 3_600_000;

describe('advance', () => {
  it('moves the instant by wall delta × speed', () => {
    expect(advance(T, 16, 1, END)).toEqual({ t: T + 16, atEnd: false });
    expect(advance(T, 16, 60, END)).toEqual({ t: T + 960, atEnd: false });
    expect(advance(T, 1000, 3600, END)).toEqual({ t: T + 3_600_000, atEnd: false });
  });
  it('loses no simulated time over a dropped frame: three frames of 16 ms and one of 200 ms add up the same as the wall clock', () => {
    let t = T;
    for (const delta of [16, 16, 200, 16]) t = advance(t, delta, 600, END).t;
    expect(t - T).toBe((16 + 16 + 200 + 16) * 600);
  });
  it('stops at the end of the span and says so', () => {
    expect(advance(END - 1000, 1000, 3600, END)).toEqual({ t: END, atEnd: true });
    expect(advance(END, 16, 1, END)).toEqual({ t: END, atEnd: true });
  });
  it('moves nothing on a first frame or a clock that went backwards', () => {
    expect(advance(T, 0, 3600, END).t).toBe(T);
    expect(advance(T, -50, 3600, END).t).toBe(T);
    expect(advance(T, Number.NaN, 3600, END).t).toBe(T);
  });
});

describe('due', () => {
  it('is due with no previous evaluation, and then once the budget has elapsed', () => {
    expect(due(null, 0, BODIES_EVERY_MS)).toBe(true);
    expect(due(0, 999, BODIES_EVERY_MS)).toBe(false);
    expect(due(0, 1000, BODIES_EVERY_MS)).toBe(true);
    expect(due(100, 349, HIDDEN_EVERY_MS)).toBe(false);
    expect(due(100, 350, HIDDEN_EVERY_MS)).toBe(true);
  });
});

describe('SPEEDS', () => {
  it('are FR-LIVE-5s four, and the default is a minute a second', () => {
    expect(SPEEDS).toEqual([1, 60, 600, 3600]);
    expect(DEFAULT_SPEED).toBe(60);
    expect(isSpeed(600)).toBe(true);
    expect(isSpeed(2)).toBe(false);
  });
});
