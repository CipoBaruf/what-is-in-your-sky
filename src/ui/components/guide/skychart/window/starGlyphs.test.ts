/**
 * R114 (FR-STAR-6 as amended, FR-DS-8 as amended, FR-DS-2; D-753): the ladder
 * as a table over its boundaries, the planets on the same sizes, the collision
 * rule and the hit test; and the module's two px numbers held to the sheet —
 * `SIZE_PX` to the chart text tokens and `HIT_RADIUS_PX` to `--tap` / 4 — so
 * no length is written outside `tokens.css` without a test that reads it.
 * R155: the rungs are the polar chart's until R158 (D-982); the window's marks
 * have their own table at the end. R160: the rungs are gone (nothing drew them
 * after R158); the token sizes and tones stay the sheet's and the ink map's.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAR_SIZES_PX } from '../../../../../data/stars/constants';
import { bloomed, collide, COLLISION_PX, DOT_OPACITY, dotOpacity, dotRadiusPx, GLYPH_SIZES, HIT_RADIUS_PX, hitTest, magnitudeOrder, MARK_GLYPH_SIZES, markFor, planetMarkFor, SIZE_PX, SMALL_SIZE, toneFor, toneToken, type ColourToken, type SizeToken } from './starGlyphs';

const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');

/** A root token's px value at the 16 px base (R79's reader): `Npx`, `Nrem` or `calc(K * var(--name))`. */
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

describe('the token sizes (FR-STAR-6 as amended, V24-14; R160)', () => {
  it('lists every glyph × token size the ink map measures, once (D-752): the old ladder’s pairs and a planet at each size', () => {
    const drawn = new Set(['* chart-text-18', '* chart-text-15', '+ chart-text-12', '. chart-text-12']);
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

describe('the draw order (FR-STAR-6, FR-SKY-4; D-813)', () => {
  it('is brightest first, a tie in the given order, a missing or NaN magnitude last', () => {
    expect(magnitudeOrder([2, -1, 0.5, 2, 1])).toEqual([1, 2, 4, 0, 3]);
    expect(magnitudeOrder([Number.NaN, 3, Number.NaN, -4])).toEqual([3, 1, 0, 2]);
    expect(magnitudeOrder(new Float32Array([1.5, 0.5]))).toEqual([1, 0]);
    expect(magnitudeOrder([])).toEqual([]);
  });
});

describe('the one sheet (FR-STAR-6, FR-DS-2; D-813)', () => {
  const sheet = readFileSync('src/ui/components/guide/skychart/window/starGlyphs.module.css', 'utf8');
  const sizes: SizeToken[] = ['chart-text-18', 'chart-text-15', 'chart-text-12'];
  const tones: ColourToken[] = ['chart-star', 'chart-star-dim', 'chart-star-faint', 'chart-planet'];

  it('styles every token size and tone from the token of the same name, and nothing else', () => {
    expect(new Set(GLYPH_SIZES.map(([, size]) => size))).toEqual(new Set(sizes));
    for (const size of sizes) expect(sheet).toContain(`.glyphs [data-size='${size}'] {\n  font-size: var(--${size});\n}`);
    for (const tone of tones) expect(sheet).toContain(`.glyphs [data-tone='${tone}'] {\n  fill: var(--${tone});\n}`);
    expect(sheet).toMatch(/\.glyphs \[data-glyph\] \{\n {2}text-anchor: middle;\n {2}dominant-baseline: central;\n\}/);
    expect(sheet).not.toMatch(/#[0-9a-f]{3,8}\b|\d+px/i);
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

/**
 * R155 (FR-LOOK-4, FR-LOOK-5, FR-LOOK-6; V210-8, V210-10; D-982): the
 * window's marks — `*` at `STAR_SIZES_PX` to `STAR_DOT_MAG`, dots sized by
 * magnitude below it, the tone from B−V, the deep stars' opacity, a planet
 * never a dot — and the sheet's rules for the three new tones.
 */
describe('the marks (FR-LOOK-4, FR-LOOK-5)', () => {
  it.each([
    [-1.46, 0.0, { kind: 'char', glyph: '*', px: 20, tone: 'chart-star' }], // Sirius: B−V 0.00 is the white row's first value
    [0.5, -0.23, { kind: 'char', glyph: '*', px: 20, tone: 'chart-star-blue' }],
    [0.51, 0.65, { kind: 'char', glyph: '*', px: 16, tone: 'chart-star-yellow' }],
    [1.5, 1.83, { kind: 'char', glyph: '*', px: 16, tone: 'chart-star-orange' }], // Antares' index
    [1.51, 0.2, { kind: 'char', glyph: '*', px: 13, tone: 'chart-star' }],
    [2.5, 0.39, { kind: 'char', glyph: '*', px: 13, tone: 'chart-star' }],
    [2.51, 0.4, { kind: 'dot', r: 2.4, tone: 'chart-star-yellow', opacity: 1 }],
    [3.5, 0.8, { kind: 'dot', r: 1.95, tone: 'chart-star-orange', opacity: 1 }],
    [4.5, undefined, { kind: 'dot', r: 1.5, tone: 'chart-star', opacity: 1 }],
    [4.6, Number.NaN, { kind: 'dot', r: 1.46, tone: 'chart-star', opacity: 0.68 }],
    [5.5, 0.1, { kind: 'dot', r: 1.05, tone: 'chart-star', opacity: 0.5 }],
    [6.5, 2.5, { kind: 'dot', r: 0.6, tone: 'chart-star-orange', opacity: 0.3 }],
    [7, -1, { kind: 'dot', r: 0.6, tone: 'chart-star-blue', opacity: 0.3 }],
  ])('V %s at B−V %s', (mag, bv, expected) => {
    expect(markFor(mag, bv)).toEqual(expected);
  });

  it('is continuous in the dot and never the same dot on two rungs, from 2.4 px at 2.5 to 0.6 px at 6.5, with the opacity from 0.7 at 4.5 to 0.3', () => {
    expect(dotRadiusPx(2.5)).toBe(2.4);
    expect(dotRadiusPx(6.5)).toBe(0.6);
    expect(dotRadiusPx(4.5)).toBe(1.5);
    expect(dotRadiusPx(3)).toBeGreaterThan(dotRadiusPx(4));
    expect(dotOpacity(4.5)).toBe(1);
    expect(dotOpacity(4.5001)).toBeCloseTo(DOT_OPACITY.atLimit, 2);
    expect(dotOpacity(5.5)).toBe(0.5);
    expect(dotOpacity(6.5)).toBe(DOT_OPACITY.atDeep);
    expect(markFor(Number.NaN)).toEqual({ kind: 'dot', r: 0.6, tone: 'chart-star', opacity: 0.3 });
  });

  it('takes the tone from BV_TONES’ rows, white where the index is missing', () => {
    expect(toneFor(-0.01)).toBe('blue');
    expect(toneFor(0)).toBe('white');
    expect(toneFor(0.39)).toBe('white');
    expect(toneFor(0.4)).toBe('yellow');
    expect(toneFor(0.79)).toBe('yellow');
    expect(toneFor(0.8)).toBe('orange');
    expect(toneFor(undefined)).toBe('white');
    expect(toneToken(1.2)).toBe('chart-star-orange');
    expect(toneToken(undefined)).toBe('chart-star');
  });

  it.each([
    [-4.1, 20], // Venus
    [0.5, 20],
    [0.7, 16], // Saturn, often
    [1.5, 16],
    [1.8, 13], // Mars at its faintest
    [5.5, 13], // never a dot
  ])('a planet at V %s is `@` in --chart-planet at %s px', (mag, px) => {
    expect(planetMarkFor(mag)).toEqual({ kind: 'char', glyph: '@', px, tone: 'chart-planet' });
  });

  it('blooms a star or a planet brighter than BLOOM_MAG and lists every * and @ size for the ink offsets', () => {
    expect(bloomed(1.79)).toBe(true);
    expect(bloomed(1.8)).toBe(false);
    expect(MARK_GLYPH_SIZES).toEqual([
      ['*', 20],
      ['@', 20],
      ['*', 16],
      ['@', 16],
      ['*', 13],
      ['@', 13],
    ]);
    expect(STAR_SIZES_PX.map((row) => row.px)).toEqual([20, 16, 13]);
  });

  it('styles the three tones and the five bloom gradients from the token of the same name in the one sheet', () => {
    const sheet = readFileSync('src/ui/components/guide/skychart/window/starGlyphs.module.css', 'utf8');
    for (const tone of ['chart-star-blue', 'chart-star-yellow', 'chart-star-orange']) expect(sheet).toContain(`.glyphs [data-tone='${tone}'] {\n  fill: var(--${tone});\n}`);
    for (const tone of ['chart-star', 'chart-star-blue', 'chart-star-yellow', 'chart-star-orange', 'chart-planet']) expect(sheet).toContain(`.glyphs [data-bloom-tone='${tone}'] stop {\n  stop-color: var(--${tone});\n}`);
  });
});
