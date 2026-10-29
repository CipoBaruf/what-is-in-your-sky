/**
 * R33 (FR-LIVE-5, D-81): the frame arithmetic. A dropped frame loses no
 * simulated time, the instant stops at the end of the span, and the wall-time
 * budgets are one rule.
 */
import { describe, expect, it } from 'vitest';
import { advance, advanceAuto, autoRates, autoSpeed, BODIES_EVERY_MS, DEFAULT_SPEED, due, heldOffset, HIDDEN_EVERY_MS, isSpeed, linkInstant, nightEnd, passUp, rateSpan, SPEEDS } from './playback';
import type { SkyBand } from './timeStripe';

const HOUR_MS = 3_600_000;
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

describe('heldOffset (R77, FR-WATCH-2)', () => {
  const MIN = 60_000;
  it('is whole minutes from real time, signed, with the hours split off past sixty', () => {
    expect(heldOffset(T + 33 * MIN, T)).toEqual({ sign: '+', hours: 0, minutes: 33 });
    expect(heldOffset(T - 12 * MIN, T)).toEqual({ sign: '−', hours: 0, minutes: 12 });
    expect(heldOffset(T + 65 * MIN, T)).toEqual({ sign: '+', hours: 1, minutes: 5 });
    expect(heldOffset(T + 23 * 60 * MIN + 59 * MIN, T)).toEqual({ sign: '+', hours: 23, minutes: 59 });
  });

  it('rounds to the minute and never reads −0', () => {
    expect(heldOffset(T, T)).toEqual({ sign: '+', hours: 0, minutes: 0 });
    expect(heldOffset(T - 20_000, T)).toEqual({ sign: '+', hours: 0, minutes: 0 });
    expect(heldOffset(T + 31_000, T)).toEqual({ sign: '+', hours: 0, minutes: 1 });
  });
});

describe('autoSpeed (R141, FR-TONIGHT-5)', () => {
  const MIN = 60_000;
  const rise = T + HOUR_MS;
  const passes = [{ start: { t: rise }, end: { t: rise + 6 * MIN } }];

  it('is 60× while a visible pass is up, edges included', () => {
    expect(autoSpeed(rise, passes)).toBe(60);
    expect(autoSpeed(rise + 3 * MIN, passes)).toBe(60);
    expect(autoSpeed(rise + 6 * MIN, passes)).toBe(60);
  });

  it('is 60× with a rise 5 min ahead and 600× at 5 min and one second', () => {
    expect(autoSpeed(rise - 5 * MIN, passes)).toBe(60);
    expect(autoSpeed(rise - 5 * MIN - 1000, passes)).toBe(600);
  });

  it('is 600× in a gap, after the last pass and with none', () => {
    expect(autoSpeed(T, passes)).toBe(600);
    expect(autoSpeed(rise + 6 * MIN + 1000, passes)).toBe(600);
    expect(autoSpeed(T, [])).toBe(600);
  });
});

describe('advanceAuto (R141, D-899)', () => {
  const MIN = 60_000;
  const rise = T + HOUR_MS;
  const passes = [{ start: { t: rise }, end: { t: rise + 6 * MIN } }];

  it('runs a gap frame at 600× and a near frame at 60×', () => {
    expect(advanceAuto(T, 16, autoRates(passes), END)).toEqual({ t: T + 16 * 600, atEnd: false, speed: 600 });
    expect(advanceAuto(rise, 16, autoRates(passes), END)).toEqual({ t: rise + 16 * 60, atEnd: false, speed: 60 });
  });

  it('splits a frame that crosses the slow-down boundary there, the rest at 60×', () => {
    const boundary = rise - 5 * MIN;
    // 1 s of wall: 0.5 s reaches the boundary at 600×, the other 0.5 s runs at 60×.
    const from = boundary - 300_000;
    expect(advanceAuto(from, 1000, autoRates(passes), END)).toEqual({ t: boundary + 500 * 60, atEnd: false, speed: 60 });
    // However long the frame, the rise is not passed at 600×: ten seconds of wall land 9.5 min of 60× past the boundary.
    expect(advanceAuto(from, 10_000, autoRates(passes), END).t).toBe(boundary + 9500 * 60);
  });

  it('stops at the end, and a boundary past the end splits nothing', () => {
    expect(advanceAuto(T, 10_000, autoRates(passes), T + 1000)).toEqual({ t: T + 1000, atEnd: true, speed: 600 });
  });
});

describe('rateSpan and autoRates (R141’s review)', () => {
  const MIN = 60_000;
  const rise = T + HOUR_MS;
  const pass = { start: { t: rise }, end: { t: rise + 6 * MIN } };
  const passes = [pass];

  it('a pass is up from its rise to its set, both included, for the jump and the rate alike', () => {
    expect([rise - 1, rise, rise + 6 * MIN, rise + 6 * MIN + 1].map((t) => passUp(pass, t))).toEqual([false, true, true, false]);
  });

  it('holds the rate until the next edge: the slow-down boundary from a gap, the set from a pass', () => {
    expect(rateSpan(T, passes)).toEqual({ speed: 600, from: T, until: rise - 5 * MIN });
    expect(rateSpan(rise, passes)).toEqual({ speed: 60, from: rise, until: rise + 6 * MIN });
    expect(rateSpan(rise + 7 * MIN, passes)).toEqual({ speed: 600, from: rise + 7 * MIN, until: Number.POSITIVE_INFINITY });
  });

  it('scans again only once t leaves the span, and agrees with autoSpeed on both sides of every edge', () => {
    let scans = 0;
    const counted = [
      {
        get start() {
          scans += 1;
          return pass.start;
        },
        end: pass.end,
      },
    ];
    const rates = autoRates(counted);
    rates(T);
    const after = scans;
    rates(T + MIN);
    rates(T + 10 * MIN);
    expect(scans).toBe(after);
    for (const t of [rise - 5 * MIN - 1, rise - 5 * MIN, rise, rise + 6 * MIN, rise + 6 * MIN + 1, T]) {
      expect(rates(t).speed).toBe(autoSpeed(t, passes));
    }
  });
});

describe('nightEnd (R141, FR-TONIGHT-5)', () => {
  const H = HOUR_MS;
  const bands: SkyBand[] = [
    { from: T, to: T + 8 * H, sky: 'day' },
    { from: T + 8 * H, to: T + 9 * H, sky: 'bright-twilight' },
    { from: T + 9 * H, to: T + 18 * H, sky: 'dark' },
    { from: T + 18 * H, to: T + 19 * H, sky: 'bright-twilight' },
    { from: T + 19 * H, to: T + 30 * H, sky: 'day' },
  ];

  it('is the end of the night holding t, its twilights included', () => {
    expect(nightEnd(bands, T + 8 * H)).toBe(T + 19 * H);
    expect(nightEnd(bands, T + 12 * H)).toBe(T + 19 * H);
    expect(nightEnd(bands, T + 18 * H + 30 * 60_000)).toBe(T + 19 * H);
  });

  it('from the day, is the end of the next night', () => {
    expect(nightEnd(bands, T)).toBe(T + 19 * H);
  });

  it('at the night’s own end is that end, so play from the stop goes nowhere (D-908)', () => {
    expect(nightEnd(bands, T + 19 * H)).toBe(T + 19 * H);
    expect(nightEnd(bands, T + 19 * H + 1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('is unbounded with no night left in the bands, so the span’s end wins', () => {
    expect(nightEnd(bands, T + 20 * H)).toBe(Number.POSITIVE_INFINITY);
    expect(nightEnd([], T)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('linkInstant (R89, FR-VISIT-3)', () => {
  const NOW = Date.UTC(2026, 8, 20, 21, 0);
  const SPAN = 24 * 3_600_000;

  it('opens a bare route and a passed moment at real time', () => {
    expect(linkInstant(null, NOW, SPAN)).toBeNull();
    expect(linkInstant(NOW - 60_000, NOW, SPAN)).toBeNull();
  });

  it('holds a moment inside the span as the link says, and one beyond it at the end of the span', () => {
    expect(linkInstant(NOW, NOW, SPAN)).toBe(NOW);
    expect(linkInstant(NOW + 3_600_000, NOW, SPAN)).toBe(NOW + 3_600_000);
    expect(linkInstant(NOW + 30 * 3_600_000, NOW, SPAN)).toBe(NOW + SPAN);
  });
});
