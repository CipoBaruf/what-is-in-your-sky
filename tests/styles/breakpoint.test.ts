/**
 * R23 (FR-DESK-1, D-71), R50 (F-6, F-10, D-252/D-253). A media query cannot
 * read `var(--cell)`, so the stylesheets carry pixel literals and this test is
 * what keeps them equal to the cell counts the requirements state: it holds
 * every `min-width` in `src/ui` to one of the two thresholds in
 * `lib/layout.ts`, and holds those two to the rule they are derived by.
 *
 * R50 (F-10) is why the derivation is no longer `cells × 0.6 em × 16 px`.
 * `1ch` is one advance of whichever family of `--font-mono` the device has,
 * and they differ — 0.6 em for SF Mono, 0.602 for Menlo, 0.55 for Consolas —
 * so a single literal is a different number of cells on each. What the tests
 * below pin is the property that matters: on every font in the stack the
 * literal is at least the cells it stands for, so a layout never engages
 * before the cells it needs exist, and on the widest of them it is not more
 * than one cell over, so the threshold is not quietly somewhere else. The
 * table itself is held to the stack in `tokens.css`, since a family added
 * there without its advance would make all of this a guess again.
 *
 * FR-DESK-1's other half — "column and panel widths are in cells" — is the
 * last test here: no length inside a wide-layout block may be written in px.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE_FONT_PX, CELL_ADVANCE_EM, CELL_ADVANCE_EM_MAX, GUTTER_CELLS, SHELL_PADDING_CELLS, WIDE_CELLS, WIDE_MIN_PX, WIDE_SPLIT_MIN_CELLS, WIDE_SPLIT_MIN_PX } from '../../src/lib/layout';

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

/** `html { … font-size: 16px … }` — the base every `em` and `ch` is measured against. */
function baseFontPx(css: string): number {
  const block = /^html\s*\{([^}]*)\}/m.exec(css);
  expect(block, `${GLOBAL_PATH} should set the base font size on html`).not.toBeNull();
  const size = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(block?.[1] ?? '');
  expect(size, `${GLOBAL_PATH}'s html block should give font-size in px`).not.toBeNull();
  return Number(size?.[1]);
}

/** The families named in `--font-mono`, without the two generics. */
function fontStack(css: string): string[] {
  const declaration = /--font-mono:\s*([^;]+);/.exec(css);
  expect(declaration, `${TOKENS_PATH} should declare --font-mono`).not.toBeNull();
  return (declaration?.[1] ?? '')
    .split(',')
    .map((family) => family.trim().replace(/^'|'$/g, ''))
    .filter((family) => family !== 'ui-monospace' && family !== 'monospace');
}

const tokens = readFileSync(TOKENS_PATH, 'utf8');
const global = readFileSync(GLOBAL_PATH, 'utf8');
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

/** What `cells` of that font are in px at the app's base size. */
function pxFor(cells: number, advanceEm: number): number {
  return cells * advanceEm * BASE_FONT_PX;
}

describe('the wide breakpoints (FR-DESK-1, FR-DESK-3, D-71, D-252)', () => {
  it('measures the cell from the font stack rather than assuming it (F-10)', () => {
    expect(baseFontPx(global)).toBe(BASE_FONT_PX);
    expect(tokens).toMatch(/--cell:\s*1ch;/);
    // A family in the stack with no advance recorded is what made the old
    // derivation wrong: 960 px was 100 cells on a Mac and 109 on Consolas.
    expect(fontStack(tokens).sort()).toEqual(Object.keys(CELL_ADVANCE_EM).sort());
  });

  it.each([
    ['the wide breakpoint', WIDE_CELLS, WIDE_MIN_PX],
    // The two gutters, and one of the shell's two paddings, are width the
    // screen has to find as well as the three columns (D-253).
    ['the split breakpoint', WIDE_SPLIT_MIN_CELLS + 2 * GUTTER_CELLS + SHELL_PADDING_CELLS, WIDE_SPLIT_MIN_PX],
  ])('%s is at least its cells on every font in the stack, and no more than one cell over on the widest', (_name, cells, px) => {
    for (const [family, advanceEm] of Object.entries(CELL_ADVANCE_EM)) {
      expect(px, `${family} reaches ${String(cells)} cells before the literal does`).toBeGreaterThanOrEqual(pxFor(cells, advanceEm));
    }
    expect(px).toBeLessThan(pxFor(cells + 1, CELL_ADVANCE_EM_MAX));
  });

  it('takes the shell padding of the split literal from the stylesheet, not from memory (D-253)', () => {
    const padding = /padding:\s*0\s*calc\((\d+)\s*\*\s*var\(--cell\)\)/.exec(global);
    expect(padding, `${GLOBAL_PATH} should give the shell's side padding in cells`).not.toBeNull();
    expect(Number(padding?.[1])).toBe(SHELL_PADDING_CELLS);
  });

  it('leaves the guide the 40 cells FR-DESK-3 says it may never be under', () => {
    const LIST_MIN_CELLS = 44;
    const GUIDE_MIN_CELLS = 40;
    const LEFT_COLUMN_CELLS = 40;
    expect(WIDE_SPLIT_MIN_CELLS).toBe(LEFT_COLUMN_CELLS + LIST_MIN_CELLS + GUIDE_MIN_CELLS);
    // At the literal itself, on the font the literal is tightest for, with the
    // gutters and the one padding of D-253 taken off the top first: what is
    // left after the left column and the list's floor is still the guide's 40.
    const cells = WIDE_SPLIT_MIN_PX / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX);
    expect(cells - SHELL_PADDING_CELLS - LEFT_COLUMN_CELLS - 2 * GUTTER_CELLS - LIST_MIN_CELLS).toBeGreaterThanOrEqual(GUIDE_MIN_CELLS);
  });

  it('is written once: every min-width in src/ui is one of the two thresholds', () => {
    const found = files.flatMap(([path, css]) => [...css.matchAll(/min-width:\s*(\d+(?:\.\d+)?)px/g)].map((m) => [path, Number(m[1])] as const));
    expect(found.length, 'no min-width media query in src/ui — the wide layout is not there').toBeGreaterThan(0);
    for (const [path, px] of found) expect([WIDE_MIN_PX, WIDE_SPLIT_MIN_PX], `${path} uses a different breakpoint`).toContain(px);
    const literals = found.map(([, px]) => px);
    expect(literals, 'nothing keys off the wide breakpoint').toContain(WIDE_MIN_PX);
    expect(literals, 'nothing keys off the split breakpoint (F-6)').toContain(WIDE_SPLIT_MIN_PX);
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
