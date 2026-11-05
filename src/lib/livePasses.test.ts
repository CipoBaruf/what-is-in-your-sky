/**
 * v2.14.1 (FR-CLEAN-14 as amended, D-1134): `firstPassFor`, the pass the wide header's `[ satellites ]` opens — the
 * pass up now, else the span's next, else none — over `livePasses`' span (`now` to `now + LIVE_WINDOW_MS`).
 */
import { describe, expect, it } from 'vitest';
import type { Pass } from '../model';
import { firstPassFor, LIVE_WINDOW_MS, livePasses } from './livePasses';

const T0 = Date.UTC(2026, 10, 5, 0, 0);
const MINUTE = 60_000;
const pass = (id: string, startMs: number, durationMs = 5 * MINUTE): Pass => ({ id, start: { t: startMs }, end: { t: startMs + durationMs } }) as unknown as Pass;

describe('firstPassFor (D-1134)', () => {
  const gone = pass('gone', T0 - 60 * MINUTE);
  const up = pass('up', T0 - 2 * MINUTE);
  const next = pass('next', T0 + 30 * MINUTE);
  const later = pass('later', T0 + 90 * MINUTE);
  const tomorrow = pass('tomorrow', T0 + LIVE_WINDOW_MS + MINUTE);

  it('is the pass up now, wherever it stands in the list', () => {
    expect(firstPassFor([gone, next, up, later], T0)?.id).toBe('up');
  });

  it('counts a pass whose rise or set is exactly now as up', () => {
    expect(firstPassFor([pass('rising', T0), later], T0)?.id).toBe('rising');
    expect(firstPassFor([pass('setting', T0 - 5 * MINUTE), later], T0)?.id).toBe('setting');
  });

  it('is otherwise the first rise after now, by its rise and not the list order', () => {
    expect(firstPassFor([gone, later, next, tomorrow], T0)?.id).toBe('next');
  });

  it('is null when the span holds no pass: the ended ones and those past 24 h are not in it', () => {
    expect(firstPassFor([gone, tomorrow], T0)).toBeNull();
    expect(firstPassFor([], T0)).toBeNull();
    expect(livePasses([gone, tomorrow], T0)).toEqual([]);
  });
});
