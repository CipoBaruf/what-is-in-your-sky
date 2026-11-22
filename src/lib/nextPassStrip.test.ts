/** R213 (FR-STRIP-1, FR-STRIP-2; D-1232): the strip's one pure function and the instant `▶ watch` lands on. */
import { describe, expect, it } from 'vitest';
import { LIVE_WINDOW_MS } from './livePasses';
import { nextPassStrip, watchInstant } from './nextPassStrip';

const NOW = Date.UTC(2026, 10, 21, 15, 0);
const MIN = 60_000;
const pass = (startMin: number, minutes = 6) => ({ start: { t: NOW + startMin * MIN }, end: { t: NOW + (startMin + minutes) * MIN } });
const at = (passes: ReturnType<typeof pass>[], shownMin = 0) => nextPassStrip({ passes, shownMs: NOW + shownMin * MIN, nowMs: NOW });

describe('nextPassStrip (FR-STRIP-1)', () => {
  it('FR-STRIP-1: next is the first rise after the shown instant, whatever the list order', () => {
    const passes = [pass(300), pass(70), pass(-30)];
    expect(at(passes)).toEqual({ kind: 'next', pass: passes[1] });
    expect(at(passes, 80)).toEqual({ kind: 'next', pass: passes[0] });
  });

  it('FR-STRIP-1: up from the rise to the set, both ends included, the first risen of two', () => {
    const [first, second] = [pass(10), pass(12)];
    expect(at([first], 10)).toEqual({ kind: 'up', pass: first });
    expect(at([first], 16)).toEqual({ kind: 'up', pass: first });
    expect(at([second, first], 13)).toEqual({ kind: 'up', pass: first });
    expect(at([first, second], 17)).toEqual({ kind: 'up', pass: second });
  });

  it('FR-STRIP-1: a pass up comes before one still to rise', () => {
    const passes = [pass(2), pass(-1)];
    expect(at(passes)).toEqual({ kind: 'up', pass: passes[1] });
  });

  it('FR-STRIP-1: none with nothing left, and the span is 24 h from real time, not from the shown instant', () => {
    const day = LIVE_WINDOW_MS / MIN;
    expect(at([])).toEqual({ kind: 'none' });
    expect(at([pass(-30)])).toEqual({ kind: 'none' });
    expect(at([pass(day)])).toMatchObject({ kind: 'next' });
    expect(at([pass(day + 1)])).toEqual({ kind: 'none' });
    expect(at([pass(day + 1)], 60)).toEqual({ kind: 'none' });
  });
});

describe('watchInstant (FR-STRIP-2)', () => {
  it('FR-STRIP-2: is a minute before the rise', () => {
    expect(watchInstant(pass(70))).toBe(NOW + 69 * MIN);
  });
});
