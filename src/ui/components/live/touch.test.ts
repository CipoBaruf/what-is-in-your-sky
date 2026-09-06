import { describe, expect, it } from 'vitest';
import { pageHasTouch } from './touch';

describe('pageHasTouch (R54, FR-TRAJ-5)', () => {
  it('is true with any touch point and false with none, no navigator, or an engine that omits the field', () => {
    expect(pageHasTouch({ maxTouchPoints: 1 })).toBe(true);
    expect(pageHasTouch({ maxTouchPoints: 5 })).toBe(true);
    expect(pageHasTouch({ maxTouchPoints: 0 })).toBe(false);
    expect(pageHasTouch(undefined)).toBe(false);
    expect(pageHasTouch({} as Pick<Navigator, 'maxTouchPoints'>)).toBe(false);
  });
});
