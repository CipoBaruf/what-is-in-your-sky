/**
 * R114 (FR-STAR-6 as amended, FR-DS-8 as amended, FR-DS-2; D-753): the ladder
 * as a table over its boundaries, the planets on the same sizes, the collision
 * rule and the hit test; and the module's two px numbers held to the sheet —
 * `SIZE_PX` to the chart text tokens and `HIT_RADIUS_PX` to `--tap` / 4 — so
 * no length is written outside `tokens.css` without a test that reads it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collide, COLLISION_PX, GLYPH_SIZES, HIT_RADIUS_PX, hitTest, LADDER, planetRungFor, rungFor, SIZE_PX, SMALL_SIZE, type Rung, type SizeToken } from './starGlyphs';

const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');

/** A root token's px value at the 16 px base (`gutter.test.ts`'s reader): `Npx`, `Nrem` or `calc(K * var(--name))`. */
function px(name: string): number {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens);
  const value = match?.[1]?.trim();
  if (!value) throw new Error(`no --${name} in tokens.css`);
  const literal = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(value);
  if (literal) return Number(literal[1]) * (literal[2] === 'rem' ? 16 : 1);
  const times = /^calc\((\d+(?:\.\d+)?) \* var\(--([a-z-]+)\)(?: \/ (\d+))?\)$/.exec(value);
  if (times?.[2]) return (Number(times[1]) * px(times[2])) / Number(times[3] ?? 1);
  throw new Error(`--${name}: cannot read ${value}`);
}

describe('the ladder (FR-STAR-6 as amended, V24-14)', () => {
  const rung = (glyph: Rung['glyph'], sizeToken: SizeToken, colourToken: Rung['colourToken']): Rung => ({ glyph, sizeToken, colourToken });

  it.each([
    [-1.46, rung('*', 'chart-text-18', 'chart-star')], // Sirius
    [0.5, rung('*', 'chart-text-18', 'chart-star')],
    [0.51, rung('*', 'chart-text-15', 'chart-star')],
    [1.5, rung('*', 'chart-text-15', 'chart-star')],
    [1.51, rung('+', 'chart-text-12', 'chart-star')],
    [2.5, rung('+', 'chart-text-12', 'chart-star')],
    [2.51, rung('.', 'chart-text-12', 'chart-star-dim')],
    [3.5, rung('.', 'chart-text-12', 'chart-star-dim')],
    [3.51, rung('.', 'chart-text-12', 'chart-star-faint')],
    [4.5, rung('.', 'chart-text-12', 'chart-star-faint')],
    [6, rung('.', 'chart-text-12', 'chart-star-faint')],
  ])('V %s', (mag, expected) => {
    expect(rungFor(mag)).toEqual(expected);
  });

  it('is five rungs, three sizes and three tones, the glyph carrying the magnitude without colour (FR-X-5)', () => {
    expect(LADDER.map((row) => [row.maxMag, row.glyph, row.sizeToken, row.colourToken])).toEqual([
      [0.5, '*', 'chart-text-18', 'chart-star'],
      [1.5, '*', 'chart-text-15', 'chart-star'],
      [2.5, '+', 'chart-text-12', 'chart-star'],
      [3.5, '.', 'chart-text-12', 'chart-star-dim'],
      [Number.POSITIVE_INFINITY, '.', 'chart-text-12', 'chart-star-faint'],
    ]);
    expect(new Set(LADDER.map((row) => row.sizeToken)).size).toBe(3);
    expect(new Set(LADDER.map((row) => row.colourToken)).size).toBe(3);
  });

  it.each([
    [-4.1, 'chart-text-18'], // Venus
    [-2.3, 'chart-text-18'], // Jupiter
    [0.5, 'chart-text-18'],
    [0.7, 'chart-text-15'], // Saturn, often
    [1.5, 'chart-text-15'],
    [1.8, 'chart-text-12'], // Mars at its faintest
    [5.5, 'chart-text-12'],
  ])('a planet at V %s is `@` in --chart-planet at %s', (mag, sizeToken) => {
    expect(planetRungFor(mag)).toEqual({ glyph: '@', sizeToken, colourToken: 'chart-planet' });
  });

  it('lists every glyph × size the ladder and the planets can draw, once, for the ink offsets (D-752)', () => {
    const drawn = new Set<string>();
    for (const row of LADDER) drawn.add(`${row.glyph} ${row.sizeToken}`);
    for (const size of Object.keys(SIZE_PX)) drawn.add(`@ ${size}`);
    const listed = GLYPH_SIZES.map(([glyph, size]) => `${glyph} ${size}`);
    expect(new Set(listed).size).toBe(listed.length);
    expect(new Set(listed)).toEqual(drawn);
  });
});

describe('the two px numbers are the sheet’s (FR-DS-2)', () => {
  it('SIZE_PX is each chart text token’s value', () => {
    for (const [name, value] of Object.entries(SIZE_PX)) expect(px(name), `--${name}`).toBe(value);
    expect(SMALL_SIZE).toBe('chart-text-12');
  });

  it('the collision distance is half the small size, 6 px', () => {
    expect(COLLISION_PX).toBe(px('chart-text-12') / 2);
    expect(COLLISION_PX).toBe(6);
  });

  it('the hit radius is --tap / 4, 12 px', () => {
    expect(HIT_RADIUS_PX).toBe(px('tap') / 4);
    expect(HIT_RADIUS_PX).toBe(12);
  });
});

describe('the collision rule (FR-STAR-6)', () => {
  it('keeps the brighter alone of two within half the small size, and both at the distance or beyond', () => {
    expect(collide([{ x: 100, y: 100 }, { x: 104, y: 103 }])).toEqual([true, false]); // 5 px apart
    expect(collide([{ x: 100, y: 100 }, { x: 106, y: 100 }])).toEqual([true, true]); // exactly 6
    expect(collide([{ x: 100, y: 100 }, { x: 100, y: 107 }])).toEqual([true, true]);
  });

  it('walks in draw order: a point dropped does not shield a later one', () => {
    // b is within 6 of a and dropped; c is within 6 of b but 10 from a, so c is kept.
    expect(collide([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }])).toEqual([true, false, true]);
  });

  it('skips what is not drawn, and across the grid’s cell edges', () => {
    expect(collide([null, { x: 11.9, y: 11.9 }, { x: 12.1, y: 12.1 }, null])).toEqual([false, true, false, false]);
    expect(collide([{ x: -1, y: -1 }, { x: 1, y: 1 }])).toEqual([true, false]);
  });

  it('takes the distance as a parameter and at zero keeps everything drawn', () => {
    expect(collide([{ x: 0, y: 0 }, { x: 5, y: 0 }], 4)).toEqual([true, true]);
    expect(collide([{ x: 0, y: 0 }, { x: 5, y: 0 }, null], 0)).toEqual([true, true, false]);
  });
});

describe('the hit test (FR-STAR-6, FR-STAR-9)', () => {
  const points = [{ x: 100, y: 100 }, null, { x: 120, y: 100 }, { x: 300, y: 300 }];

  it('is the nearest drawn glyph within 12 px of the point, or none', () => {
    expect(hitTest(points, 103, 104)).toBe(0);
    expect(hitTest(points, 113, 100)).toBe(2);
    expect(hitTest(points, 112, 100)).toBe(2); // 12 from a, 8 from c: c
    expect(hitTest(points, 110, 100)).toBe(0); // 10 from each: the tie goes to the brighter, drawn first
    expect(hitTest(points, 100, 113)).toBeNull(); // 13 px away
    expect(hitTest(points, 100, 112)).toBe(0); // at the radius exactly
    expect(hitTest(points, 0, 0)).toBeNull();
  });

  it('never returns a hidden glyph', () => {
    expect(hitTest([null, null], 0, 0)).toBeNull();
    expect(hitTest([{ x: 0, y: 0 }, null], 0, 0, 1)).toBe(0);
  });
});
