/**
 * R23 (FR-DESK-1, D-71). A media query cannot read `var(--cell)`, so the
 * stylesheets carry a pixel literal and this test is what keeps it equal to
 * 100 cells: it recomputes the number from `--cell` in `tokens.css` and the
 * base font size in `global.css`, and holds every `min-width` in `src/ui`,
 * plus `WIDE_MIN_PX` in `lib/layout.ts`, to it. Change the cell, the base or
 * the query and exactly one of these fails.
 *
 * FR-DESK-1's other half — "column and panel widths are in cells" — is the
 * last test here: no length inside a wide-layout block may be written in px.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WIDE_CELLS, WIDE_MIN_PX } from '../../src/lib/layout';

const UI_DIR = 'src/ui';
const TOKENS_PATH = 'src/ui/styles/tokens.css';
const GLOBAL_PATH = 'src/ui/styles/global.css';

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

/** The `--cell` declaration: `1ch`, with the em advance the app assumes for it documented in the comment beside it. */
function cellAdvanceEm(css: string): number {
  const declaration = /--cell:\s*1ch;\s*\/\*\s*([\d.]+) em advance\s*\*\//.exec(css);
  expect(declaration, `${TOKENS_PATH} should declare --cell as 1ch with its em advance documented beside it`).not.toBeNull();
  return Number(declaration?.[1]);
}

/** `html { … font-size: 16px … }` — the base every `em` and `ch` is measured against. */
function baseFontPx(css: string): number {
  const block = /^html\s*\{([^}]*)\}/m.exec(css);
  expect(block, `${GLOBAL_PATH} should set the base font size on html`).not.toBeNull();
  const size = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(block?.[1] ?? '');
  expect(size, `${GLOBAL_PATH}'s html block should give font-size in px`).not.toBeNull();
  return Number(size?.[1]);
}

const tokens = readFileSync(TOKENS_PATH, 'utf8');
const global = readFileSync(GLOBAL_PATH, 'utf8');
const cellPx = cellAdvanceEm(tokens) * baseFontPx(global);
const files = cssFiles(UI_DIR).map((path) => [path, readFileSync(path, 'utf8')] as const);

/** Every `@media (min-width: …)` block's body, braces matched. */
function wideBlocks(css: string): string[] {
  const blocks: string[] = [];
  for (const match of css.matchAll(/@media[^{]*min-width[^{]*\{/g)) {
    let depth = 1;
    let i = match.index + match[0].length;
    const from = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push(css.slice(from, i - 1));
  }
  return blocks;
}

describe('the wide breakpoint (FR-DESK-1, D-71)', () => {
  it('is 100 cells: the media-query literal is the cell advance times the base font size', () => {
    expect(cellPx).toBe(9.6);
    expect(WIDE_CELLS * cellPx).toBe(WIDE_MIN_PX);
  });

  it('is written once: every min-width in src/ui is that same literal', () => {
    const found = files.flatMap(([path, css]) => [...css.matchAll(/min-width:\s*(\d+(?:\.\d+)?)px/g)].map((m) => [path, Number(m[1])] as const));
    expect(found.length, 'no min-width media query in src/ui — the wide layout is not there').toBeGreaterThan(0);
    for (const [path, px] of found) expect(px, `${path} uses a different breakpoint`).toBe(WIDE_MIN_PX);
  });

  it('starts at the stylesheet frame: wide drops the 80-cell compact frame', () => {
    expect(wideBlocks(global).join('\n')).toMatch(/max-width:\s*none/);
  });

  it('writes every width inside a wide block in cells or rows, never in px (FR-DESK-1)', () => {
    for (const [path, css] of files) {
      for (const block of wideBlocks(css)) {
        const pxLengths = [...block.matchAll(/[\d.]+px/g)].map((m) => m[0]).filter((length) => length !== '1px'); // hairlines: a rule is one device pixel, not a column width
        expect(pxLengths, `${path} sizes something in px inside a wide block`).toEqual([]);
      }
    }
  });
});
