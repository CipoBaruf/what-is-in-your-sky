/**
 * R79 (FR-GUT-1, US-28 AC1, AC6; D-450): the compass gutter's height is one
 * number in two places — `GUTTER_PX` in `window/gutter.ts`, which the chip
 * and the notes are placed from, and `--gutter` in `tokens.css`, which the
 * stylesheets size the gutter from — so they are read here and held equal.
 * The 68 px FR-GUT-1 gives the drawing back is asserted as arithmetic — the
 * strip's two `--tap` rows less the gutter — rather than as a constant, so a
 * change to `--tap` or to the gutter moves it and this test says by how much.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUTTER_PX } from '../../src/ui/components/guide/skychart/window/gutter';

const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
const gutterCss = readFileSync('src/ui/components/guide/skychart/window/CompassGutter.module.css', 'utf8');

/** A root token's px value at the 16 px base: `Npx`, `Nrem`, or `calc(K * var(--row))`. */
function px(name: string): number {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens);
  const value = match?.[1]?.trim();
  if (!value) throw new Error(`no --${name} in tokens.css`);
  const literal = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(value);
  if (literal) return Number(literal[1]) * (literal[2] === 'rem' ? 16 : 1);
  const times = /^calc\((\d+(?:\.\d+)?) \* var\(--([a-z-]+)\)\)$/.exec(value);
  if (times?.[2]) return Number(times[1]) * px(times[2]);
  throw new Error(`--${name}: cannot read ${value}`);
}

describe('the gutter token (FR-GUT-1)', () => {
  it('is GUTTER_PX, 28 px', () => {
    expect(px('gutter')).toBe(GUTTER_PX);
    expect(GUTTER_PX).toBe(28);
  });

  it('is one text row and 4 px of tick', () => {
    expect(px('gutter') - px('row')).toBe(4);
  });

  it('gives the drawing back the strip’s two tap rows less itself: 68 px', () => {
    expect(2 * px('tap') - px('gutter')).toBe(68);
  });

  it('is the height the gutter is drawn at, from the token and not a literal', () => {
    expect(gutterCss).toMatch(/\.gutter \{[^}]*\bheight: var\(--gutter\);/);
    expect(gutterCss).not.toMatch(/\b28px\b/);
  });
});
