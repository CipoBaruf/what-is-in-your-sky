/**
 * R73 (FR-FSC-10; PLAN D-424, D-430): the pose table. `quarterTurnFor` is pure
 * — the whole of "which way is up to the reader" is the rotation the window
 * already smooths — so the four quarters, the diagonals either side of the
 * hysteresis, the flat poses and the missing reading are a unit test and not a
 * phone in a hand.
 */
import { describe, expect, it } from 'vitest';
import { rotationMatrix, type Mat3 } from './projection';
import { quarterTurnFor, SCREEN_TURN_FLAT_DEG, SCREEN_TURN_HYSTERESIS_DEG } from './screenTurn';

/** Upright, top up, back to the north: the pose the browser calls angle 0. */
const upright = rotationMatrix(0, 90, 0);

/**
 * The device rolled in its own plane by `deg`, counter-clockwise seen from the
 * viewer (`projection.test.ts`'s `rollDevice`): the room's up, which is up the
 * screen for the upright phone, ends up `deg` clockwise from the screen's top,
 * so the argument *is* the angle the function has to read. 90 is the phone
 * turned counter-clockwise with its top to the reader's left, which is what
 * `screen.orientation.angle` calls 90.
 */
function roll(m: Mat3, deg: number): Mat3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [m[0][0] * c + m[0][1] * s, -m[0][0] * s + m[0][1] * c, m[0][2]],
    [m[1][0] * c + m[1][1] * s, -m[1][0] * s + m[1][1] * c, m[1][2]],
    [m[2][0] * c + m[2][1] * s, -m[2][0] * s + m[2][1] * c, m[2][2]],
  ];
}

describe('the constants (FR-FSC-10)', () => {
  it('are 20° past the diagonal and 25° of flat', () => {
    expect(SCREEN_TURN_HYSTERESIS_DEG).toBe(20);
    expect(SCREEN_TURN_FLAT_DEG).toBe(25);
  });
});

describe('quarterTurnFor: the four quarters', () => {
  it('reads each pose as the quarter the browser would report for an unlocked phone', () => {
    expect(quarterTurnFor(roll(upright, 0), 0)).toBe(0);
    expect(quarterTurnFor(roll(upright, 90), 0)).toBe(90);
    expect(quarterTurnFor(roll(upright, 180), 0)).toBe(180);
    expect(quarterTurnFor(roll(upright, 270), 0)).toBe(270);
  });

  it('does not care where the phone is aimed, only how it is rolled', () => {
    // The same roll with the back pointing east and 40° up: the room's vertical still lies along +X.
    for (const aimed of [rotationMatrix(270, 130, 0), rotationMatrix(45, 60, 0)]) {
      expect(quarterTurnFor(roll(aimed, 90), 0)).toBe(90);
    }
  });

  it('gets there from any held quarter, since a whole quarter away is well past the diagonal', () => {
    expect(quarterTurnFor(roll(upright, 90), 180)).toBe(90);
    expect(quarterTurnFor(roll(upright, 0), 180)).toBe(0);
    expect(quarterTurnFor(roll(upright, 270), 90)).toBe(270);
  });
});

describe('quarterTurnFor: the hysteresis (it does not flutter)', () => {
  it('holds the quarter it is on until the pose is 65° past it', () => {
    // The diagonal between 0 and 90 is 45°; nothing moves until 65°.
    expect(quarterTurnFor(roll(upright, 44), 0)).toBe(0);
    expect(quarterTurnFor(roll(upright, 46), 0)).toBe(0);
    expect(quarterTurnFor(roll(upright, 64), 0)).toBe(0);
    expect(quarterTurnFor(roll(upright, 66), 0)).toBe(90);
  });

  it('is symmetric: the same diagonal seen from the other side holds 90 instead', () => {
    expect(quarterTurnFor(roll(upright, 46), 90)).toBe(90);
    expect(quarterTurnFor(roll(upright, 26), 90)).toBe(90);
    expect(quarterTurnFor(roll(upright, 24), 90)).toBe(0);
  });

  it('holds across the wrap at 0, where a naive difference would be 340° instead of 20°', () => {
    expect(quarterTurnFor(roll(upright, 340), 0)).toBe(0);
    // 300° is 60° short of 0 the shorter way round, which is inside the hysteresis; 290° is 70° and past it.
    expect(quarterTurnFor(roll(upright, 300), 0)).toBe(0);
    expect(quarterTurnFor(roll(upright, 290), 0)).toBe(270);
    expect(quarterTurnFor(roll(upright, 296), 270)).toBe(270);
  });

  it('walks the four diagonals, inside and outside, from the quarter each one leaves', () => {
    const table: readonly { held: 0 | 90 | 180 | 270; inside: number; outside: number; next: 0 | 90 | 180 | 270 }[] = [
      { held: 0, inside: 60, outside: 70, next: 90 },
      { held: 90, inside: 150, outside: 160, next: 180 },
      { held: 180, inside: 240, outside: 250, next: 270 },
      { held: 270, inside: 330, outside: 340, next: 0 },
    ];
    for (const { held, inside, outside, next } of table) {
      expect(quarterTurnFor(roll(upright, inside), held)).toBe(held);
      expect(quarterTurnFor(roll(upright, outside), held)).toBe(next);
    }
  });
});

describe('quarterTurnFor: flat (it does not spin at the zenith)', () => {
  it('holds whatever it was given while the phone is within 25° of flat, face up or face down', () => {
    for (const held of [0, 90, 180, 270] as const) {
      // Face up on a table, face down over one, and 20° off each: no direction worth reading in the screen's plane.
      expect(quarterTurnFor(rotationMatrix(0, 0, 0), held)).toBe(held);
      expect(quarterTurnFor(rotationMatrix(0, 180, 0), held)).toBe(held);
      expect(quarterTurnFor(rotationMatrix(0, 20, 0), held)).toBe(held);
      expect(quarterTurnFor(rotationMatrix(0, 160, 0), held)).toBe(held);
      // A roll while flat is not a turn either: the phone spinning on the table leaves the picture alone.
      expect(quarterTurnFor(roll(rotationMatrix(0, 0, 0), 90), held)).toBe(held);
    }
  });

  it('reads the quarter again once the phone is past 25° of flat', () => {
    expect(quarterTurnFor(rotationMatrix(0, 30, 0), 90)).toBe(0);
    expect(quarterTurnFor(roll(rotationMatrix(0, 30, 0), 90), 0)).toBe(90);
  });
});

describe('quarterTurnFor: no reading', () => {
  it('is 0 before the first reading, whatever was held: the screen is laid out as the viewport is', () => {
    expect(quarterTurnFor(null, 0)).toBe(0);
    expect(quarterTurnFor(null, 90)).toBe(0);
    expect(quarterTurnFor(null, 270)).toBe(0);
  });
});
