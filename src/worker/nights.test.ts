/**
 * The window split of PLAN D-77. Pure arithmetic, so it is checked on its own
 * before `handlers.test.ts` checks that the handler emits it in the right
 * order; the "union equals one search over the whole window" property is in
 * `handlers.test.ts`, where the physics is.
 */
import { describe, expect, it } from 'vitest';
import { MAX_PASS_SPAN_MS, NIGHT_MS, claimsPass, splitIntoNights } from './nights';

const T0 = Date.UTC(2026, 8, 4, 12, 0, 0);
const window = (hours: number) => ({ startMs: T0, endMs: T0 + hours * 3_600_000 });

describe('splitIntoNights', () => {
  it('cuts a 72 h window into three nights, indexed 0, 1, 2 and covering it exactly', () => {
    const nights = splitIntoNights(window(72));
    expect(nights.map((n) => n.index)).toEqual([0, 1, 2]);
    expect(nights.map((n) => n.startMs)).toEqual([T0, T0 + NIGHT_MS, T0 + 2 * NIGHT_MS]);
    expect(nights.map((n) => n.endMs)).toEqual([T0 + NIGHT_MS, T0 + 2 * NIGHT_MS, T0 + 3 * NIGHT_MS]);
    expect(nights.map((n) => n.isLast)).toEqual([false, false, true]);
  });

  it('leaves an MVP 24 h window as one night whose search is the window itself', () => {
    const nights = splitIntoNights(window(24));
    expect(nights).toHaveLength(1);
    expect(nights[0]).toMatchObject({ index: 0, isLast: true, search: window(24) });
  });

  it('gives a partial last night its own shorter span', () => {
    const nights = splitIntoNights(window(30));
    expect(nights).toHaveLength(2);
    expect(nights[1]).toMatchObject({ startMs: T0 + NIGHT_MS, endMs: T0 + 30 * 3_600_000, isLast: true });
  });

  it('widens each search by the maximum pass span, clamped to the request window', () => {
    const nights = splitIntoNights(window(72));
    expect(nights[0]?.search).toEqual({ startMs: T0, endMs: T0 + NIGHT_MS + MAX_PASS_SPAN_MS });
    expect(nights[1]?.search).toEqual({ startMs: T0 + NIGHT_MS - MAX_PASS_SPAN_MS, endMs: T0 + 2 * NIGHT_MS + MAX_PASS_SPAN_MS });
    expect(nights[2]?.search).toEqual({ startMs: T0 + 2 * NIGHT_MS - MAX_PASS_SPAN_MS, endMs: T0 + 3 * NIGHT_MS });
  });

  it('keeps the widened search on the 30 s coarse grid of a single whole-window search', () => {
    const COARSE_STEP_MS = 30_000;
    for (const night of splitIntoNights(window(72))) {
      expect((night.search.startMs - T0) % COARSE_STEP_MS).toBe(0);
    }
  });

  it('still produces one night for a zero-length window, so a caller sees one message per object', () => {
    const nights = splitIntoNights({ startMs: T0, endMs: T0 });
    expect(nights).toHaveLength(1);
    expect(nights[0]?.search).toEqual({ startMs: T0, endMs: T0 });
  });
});

describe('claimsPass', () => {
  const nights = splitIntoNights(window(72));
  /** Which nights claim a pass starting at `t`; a well-formed split answers with exactly one index. */
  const claimants = (t: number): number[] => nights.filter((n) => claimsPass(n, t)).map((n) => n.index);

  it('gives every instant in the window to exactly one night', () => {
    for (const t of [T0, T0 + 1, T0 + NIGHT_MS - 1, T0 + NIGHT_MS, T0 + 2 * NIGHT_MS, T0 + 3 * NIGHT_MS - 1]) {
      expect(claimants(t)).toHaveLength(1);
    }
  });

  it('claims a pass on the boundary for the night it starts, not the one it ends in', () => {
    expect(claimants(T0 + NIGHT_MS - 1)).toEqual([0]);
    expect(claimants(T0 + NIGHT_MS)).toEqual([1]);
  });

  it('lets the last night keep a pass starting at the very end of the window', () => {
    expect(claimants(T0 + 3 * NIGHT_MS)).toEqual([2]);
  });

  it('drops a pass found in the forward overlap; the next night claims it', () => {
    expect(claimants(T0 + NIGHT_MS + 60_000)).toEqual([1]);
  });
});
