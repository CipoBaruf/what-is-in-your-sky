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
 * last test of the first block: no length inside a wide-layout block may be
 * written in px.
 *
 * R103 (FR-DS-3, D-702) widens the join to every condition in the tree: the
 * second block lists every `@media` and `@container` condition as
 * `(feature, comparator, value)`, holds the listing to the committed
 * `breakpoints.json` (so a rewrite that changes no size changes no line of
 * it), holds every condition to range syntax, and holds every length in one
 * to an export of `lib/layout.ts` — the widths, the three heights, the
 * header's four folds and the frame's cell count.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_FONT_PX, CELL_ADVANCE_EM, CELL_ADVANCE_EM_MAX, COMPACT_MAX_CELLS, FOOTER_ONE_LINE_MIN_PX, FRAME_LEGEND_MIN_CELLS, GUIDE_PANE_MIN_CELLS, GUTTER_CELLS, HEADER_FOLD_PX, HOME_MAX_CELLS, HOME_THREE_PANE_MIN_CELLS, HOME_THREE_PANE_MIN_PX, HOME_THREE_PANE_QUERY, LANDSCAPE_PHONE_QUERY, SHELL_PADDING_CELLS, SHORT_MAX_HEIGHT_PX, SIDEWAYS_MAX_HEIGHT_PX, WIDE_CELLS, WIDE_MIN_PX, WIDE_QUERY, WIDE_SHORT_MAX_HEIGHT_PX, WIDE_SPLIT_MIN_CELLS, WIDE_SPLIT_MIN_PX } from '../../src/lib/layout';
import { BREAKPOINTS_PATH, conditionText, cssFiles, listing, queriesOf, UI_DIR, type Listing } from './mediaConditions';

const TOKENS_PATH = 'src/ui/styles/tokens.css';
const GLOBAL_PATH = 'src/ui/styles/global.css';
const APP_PATH = 'src/ui/App.module.css';
const SHEET_PATH = 'src/ui/screens/PassDetail.module.css';
const FRAME_PATH = 'src/ui/components/guide/skychart/ChartFrame.module.css';
const HEADER_PATH = 'src/ui/components/common/Header.module.css';

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

/** Every `@media` block whose query matches `query`, as its query and its body, braces matched. */
function mediaBlocks(css: string, query: RegExp): { query: string; body: string; from: number; to: number }[] {
  const blocks: { query: string; body: string; from: number; to: number }[] = [];
  for (const match of css.matchAll(/@media([^{]*)\{/g)) {
    if (!query.test(match[1] ?? '')) continue;
    let depth = 1;
    let i = match.index + match[0].length;
    const from = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ query: (match[1] ?? '').trim(), body: css.slice(from, i - 1), from: match.index, to: i });
  }
  return blocks;
}

/** Every `@media (width >= …)` block's body, braces matched. */
function wideBlocks(css: string): string[] {
  return mediaBlocks(css, /width\s*>=/).map((block) => block.body);
}

/** The stylesheet with every `@media` block cut out: the rules that hold at every size. */
function outsideMedia(css: string): string {
  let out = '';
  let at = 0;
  for (const block of mediaBlocks(css, /./)) {
    out += css.slice(at, block.from);
    at = block.to;
  }
  return out + css.slice(at);
}

/** The selectors of the first rule in `css` carrying `declaration`, comments stripped. */
function selectorsOf(css: string, declaration: string): string {
  const rule = new RegExp(`([^{}]+)\\{[^{}]*${declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  return rule?.[1]?.trim() ?? '';
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
    // R76 (D-443): the three panes count the same way — 108 cells of content, two gutters, one padding.
    ['the three-pane breakpoint', HOME_THREE_PANE_MIN_CELLS + 2 * GUTTER_CELLS + SHELL_PADDING_CELLS, HOME_THREE_PANE_MIN_PX],
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

  it('is written once: every `width >=` in src/ui is one of the three thresholds', () => {
    const found = files.flatMap(([path, css]) => [...css.matchAll(/width\s*>=\s*(\d+(?:\.\d+)?)px/g)].map((m) => [path, Number(m[1])] as const));
    expect(found.length, 'no `width >=` media query in src/ui — the wide layout is not there').toBeGreaterThan(0);
    for (const [path, px] of found) expect([WIDE_MIN_PX, HOME_THREE_PANE_MIN_PX, WIDE_SPLIT_MIN_PX], `${path} uses a different breakpoint`).toContain(px);
    const literals = found.map(([, px]) => px);
    expect(literals, 'nothing keys off the wide breakpoint').toContain(WIDE_MIN_PX);
    expect(literals, 'nothing keys off the split breakpoint (F-6)').toContain(WIDE_SPLIT_MIN_PX);
    expect(literals, 'nothing keys off the three-pane breakpoint (FR-FIRST-5)').toContain(HOME_THREE_PANE_MIN_PX);
  });

  /*
   * R76 (FR-FIRST-5, D-443): three literals now, and they are in order — the
   * wide breakpoint, the three panes, the split — each a real rule in the
   * page's own stylesheet (a query with a declaration in it), so a fourth
   * cannot be added by accident and none of the three is left as a comment.
   */
  it('keeps the three literals ascending, each a real rule in App.module.css (D-443)', () => {
    expect(HOME_THREE_PANE_MIN_PX).toBe(1118);
    expect([WIDE_MIN_PX, HOME_THREE_PANE_MIN_PX, WIDE_SPLIT_MIN_PX]).toEqual([964, 1118, 1272]);
    expect(WIDE_MIN_PX).toBeLessThan(HOME_THREE_PANE_MIN_PX);
    expect(HOME_THREE_PANE_MIN_PX).toBeLessThan(WIDE_SPLIT_MIN_PX);
    const app = readFileSync(APP_PATH, 'utf8');
    const queries = [...app.matchAll(/@media\s*\(width >= (\d+)px\)\s*\{/g)].map((m) => Number(m[1]));
    expect(queries, `${APP_PATH} should have exactly the three wide queries, in order`).toEqual([WIDE_MIN_PX, HOME_THREE_PANE_MIN_PX, WIDE_SPLIT_MIN_PX]);
    for (const block of wideBlocks(app)) expect(block, 'an empty wide block is not a rule').toMatch(/[a-z-]+\s*:\s*[^;]+;/);
  });

  it('gives the three panes the compact card width each, and an open pass the first two (FR-FIRST-5, D-444)', () => {
    const PANE_CELLS = 36;
    expect(HOME_THREE_PANE_MIN_CELLS).toBe(3 * PANE_CELLS);
    // At the literal on the widest cell, both paddings off: two panes and the gutter between them are still the guide's 72.
    const cells = HOME_THREE_PANE_MIN_PX / (CELL_ADVANCE_EM_MAX * BASE_FONT_PX) - 2 * SHELL_PADDING_CELLS;
    const pane = (cells - 2 * GUTTER_CELLS) / 3;
    expect(2 * pane + GUTTER_CELLS).toBeGreaterThanOrEqual(GUIDE_PANE_MIN_CELLS);
  });

  /*
   * R93 (FR-HOME-4, D-546): the fourth literal is a cap, not a threshold — 160
   * cells as a `max-width` on the shell's rows, so it has no pixel twin and is
   * written in cells in the stylesheet itself. It stands beside the wide and
   * three-pane breakpoints: wider than the three panes need, so the cap never
   * engages before the panes exist, and pinned here so a change to it is a
   * change to this file too. The live page is not under it (FR-DOME-1): the rule
   * names `#root`'s own rows, and the live page's landmarks are not those.
   */
  it('caps the home page at 160 cells beside 964 and 1118, in cells, and not the live page (FR-HOME-4)', () => {
    expect(HOME_MAX_CELLS).toBe(160);
    expect([WIDE_MIN_PX, HOME_THREE_PANE_MIN_PX]).toEqual([964, 1118]);
    expect(pxFor(HOME_MAX_CELLS, CELL_ADVANCE_EM_MAX)).toBeGreaterThan(HOME_THREE_PANE_MIN_PX);
    const app = readFileSync(APP_PATH, 'utf8');
    const cap = wideBlocks(app).find((block) => block.includes(`max-width: calc(${String(HOME_MAX_CELLS)} * var(--cell))`));
    expect(cap, `${APP_PATH} should cap the shell's rows at HOME_MAX_CELLS inside a wide block`).toBeDefined();
    const rule = /([^{}]+)\{[^{}]*max-width: calc\(160 \* var\(--cell\)\)/.exec((cap ?? '').replace(/\/\*[\s\S]*?\*\//g, ''));
    const selectors = rule?.[1] ?? '';
    for (const row of ['.main', '#root) > :global(header)', '#root) > :global(footer)']) expect(selectors).toContain(row);
    expect(selectors).not.toMatch(/live/i);
    expect(cap).toContain('margin-inline: auto');
  });

  it('starts at the stylesheet frame: wide drops the 60-cell compact frame', () => {
    expect(wideBlocks(global).join('\n')).toMatch(/max-width:\s*none/);
  });

  /*
   * R99 (FR-TAB-1..3, US-35; D-625, D-634): the fifth literal is the compact
   * column's cap — `COMPACT_MAX_CELLS`, 60 cells as a `max-width` on the
   * shell's rows and the guide's sheet, centred, written in cells like
   * `HOME_MAX_CELLS` and with no pixel twin. It stands beside the other four:
   * under the wide breakpoint on every font, so it binds on compact only and
   * the wide block's `max-width: none` is what lifts it; over the 36-cell card
   * (FR-COMP-4), which is a row's budget and not the column's. The compact
   * live page is under it by the shell's own rule (its landmarks are
   * `display: contents`, D-529), and the one exception is the landscape
   * phone's live page, whose two panes already divide the width (FR-TAB-2):
   * D-173's query lifts the cap from that page and from nothing else. The
   * literal is written once per column — the shell's and the sheet's — and the
   * 80-cell frame it replaces is gone from `src/ui`.
   */
  it('caps the compact column at 60 cells beside 964, 1118 and 160: the shell, the notices, the live page and the sheet, lifted from the landscape phone alone (FR-TAB-1, FR-TAB-2, D-625)', () => {
    const CARD_CELLS = 36;
    expect(COMPACT_MAX_CELLS).toBe(60);
    expect([WIDE_MIN_PX, HOME_THREE_PANE_MIN_PX, HOME_MAX_CELLS, COMPACT_MAX_CELLS]).toEqual([964, 1118, 160, 60]);
    expect(pxFor(COMPACT_MAX_CELLS, CELL_ADVANCE_EM_MAX)).toBeLessThan(WIDE_MIN_PX);
    expect(COMPACT_MAX_CELLS).toBeGreaterThan(CARD_CELLS + 2 * SHELL_PADDING_CELLS);
    expect(COMPACT_MAX_CELLS).toBeLessThan(HOME_MAX_CELLS);

    const cap = `max-width: calc(${String(COMPACT_MAX_CELLS)} * var(--cell))`;
    // The shell's rule holds at every size the wide block does not undo it at: outside any media block.
    const shell = outsideMedia(global);
    const selectors = selectorsOf(shell, cap);
    expect(selectors, `${GLOBAL_PATH} should cap the compact column at COMPACT_MAX_CELLS outside any media block`).not.toBe('');
    for (const row of ['header', 'main', 'footer', '[data-page-notices]', "#root > [data-compact='true']"]) expect(selectors.split(',').map((s) => s.trim())).toContain(row);
    expect(shell.slice(shell.indexOf(cap)).split('}')[0]).toContain('margin-inline: auto');

    // The sheet's frame carries the same literal, outside any media block.
    const sheet = readFileSync(SHEET_PATH, 'utf8');
    expect(selectorsOf(outsideMedia(sheet), cap), `${SHEET_PATH} should cap the sheet's frame at COMPACT_MAX_CELLS`).toBe('.frame');

    // The landscape phone lifts it from the live page and from nothing else: D-173's query, the live page's selector alone.
    const lifted = mediaBlocks(global, /orientation: landscape/);
    expect(lifted.map((block) => block.query)).toEqual([LANDSCAPE_PHONE_QUERY]);
    expect(selectorsOf(lifted[0]?.body ?? '', 'max-width: none')).toBe("#root > [data-compact='true']");
    expect(selectorsOf(lifted[0]?.body ?? '', 'max-width: none')).not.toMatch(/header|main|footer|notices/);

    // Nothing in src/ui still draws the 80-cell frame. (The shortcuts overlay's 72-cell panel is a layer over the
    // page, like the sky screen, and not a column of it.)
    for (const [path, css] of files) expect(css, `${path} still carries the 80-cell frame`).not.toContain('80 * var(--cell)');
  });

  /*
   * R102 (FR-HOME-3 as amended v2.2, FR-SHOW-8; D-664, D-681): the sixth
   * literal is a pair, one per language — the width from which the wide
   * one-row footer holds one line with its fourth credit, measured on the
   * built app and not derived, so this test cannot check it against a cell
   * count. What it holds: the two numbers are the measured ones (V22-15: the
   * library alone in the row, 1118/1137, down from 1330/1349 with the
   * author's name); the Spanish row is the longer; both stand inside the wide
   * range, under the split literal and between the two desk capture widths,
   * so the 1024 px captures show the wrap and the 1280 px ones do not; and
   * `App.module.css` carries each under its own `:root[lang]`, as a `width <`
   * fold from the wide breakpoint, the block halving the main's row of air
   * (its share of it, so the block stays in rows) and the short footer's top
   * padding, and touching nothing else.
   */
  it('pins the two-line footer\'s fold per language, and the shell pays for it from its air (FR-HOME-3, D-681)', () => {
    expect(FOOTER_ONE_LINE_MIN_PX).toEqual({ en: 1118, es: 1137 });
    expect(FOOTER_ONE_LINE_MIN_PX.en).toBeLessThan(FOOTER_ONE_LINE_MIN_PX.es);
    const CAPTURE_MID_PX = 1024;
    const CAPTURE_DESK_PX = 1280;
    for (const px of Object.values(FOOTER_ONE_LINE_MIN_PX)) {
      expect(px).toBeGreaterThan(WIDE_MIN_PX);
      expect(px).toBeGreaterThan(CAPTURE_MID_PX);
      expect(px).toBeLessThan(WIDE_SPLIT_MIN_PX);
      expect(px).toBeLessThan(CAPTURE_DESK_PX);
      expect(px).toBeLessThan(pxFor(HOME_MAX_CELLS, CELL_ADVANCE_EM_MAX));
    }
    const app = readFileSync(APP_PATH, 'utf8');
    for (const [lang, px] of Object.entries(FOOTER_ONE_LINE_MIN_PX)) {
      const blocks = mediaBlocks(app, new RegExp(`^\\s*\\(width >= ${String(WIDE_MIN_PX)}px\\)\\s*and\\s*\\(width < ${String(px)}px\\)\\s*$`));
      expect(blocks, `${APP_PATH} should fold the ${lang} footer at ${String(px)} px from the wide breakpoint, once`).toHaveLength(1);
      const body = (blocks[0]?.body ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
      const rules = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]?.trim() ?? '', m[2]?.trim() ?? ''] as const);
      expect(rules.map(([selector]) => selector)).toEqual([`:global(:root[lang='${lang}']) .main`, `:global(:root[lang='${lang}'] #root) > :global(footer[data-form='short'])`]);
      expect(rules[0]?.[1]).toBe('--two-line-footer: 0.5;');
      // R105 (D-720): the footer's top padding is the space under its `Rule`, which Footer.module.css reads from this name.
      expect(rules[1]?.[1]).toBe('--footer-rule-gap: var(--space-2);');
    }
    // The main's air is one calculation, the two shares subtracted, so both rules true leave none (D-608 composes).
    const wide = wideBlocks(app).join('\n');
    expect(wide).toContain('padding-top: calc(var(--row) * (1 - var(--short-window) - var(--two-line-footer)));');
    expect(wide).toContain('padding-bottom: calc(var(--row) * (1 - var(--short-window) - var(--two-line-footer)));');
    const short = mediaBlocks(app, new RegExp(`height <= ${String(WIDE_SHORT_MAX_HEIGHT_PX)}px`));
    expect(short).toHaveLength(1);
    expect(short[0]?.body.replace(/\/\*[\s\S]*?\*\//g, '').trim()).toBe('.main {\n    --short-window: 0.5;\n  }');
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

/*
 * R103 (FR-DS-3, D-702): every condition in the tree. The listing is read
 * syntax-blind — `(min-width: 964px)` and `(width >= 964px)` are both
 * `width >= 964px` — so the committed `breakpoints.json`, written before the
 * range-syntax rewrite, is what proves the rewrite moved no size: the listing
 * is identical before and after, and a task that adds, removes or moves a
 * condition changes a line of it on purpose. Range syntax is the browser
 * floor from here on — Safari 16.4, Chrome 104, Firefox 63 (V23-10).
 */
describe('every media and container condition (FR-DS-3, D-702)', () => {
  const queries = cssFiles(UI_DIR).flatMap((path) => queriesOf(readFileSync(path, 'utf8')).map((query) => ({ path, ...query })));
  const conditions = queries.flatMap((query) => query.conditions.map((condition) => ({ path: query.path, at: query.at, prelude: query.prelude, ...condition })));
  const committed = JSON.parse(readFileSync(BREAKPOINTS_PATH, 'utf8')) as Listing;

  it('is the committed listing, line for line', () => {
    expect(listing()).toEqual(committed);
    expect(Object.values(committed).flat().length, 'the listing is not empty').toBeGreaterThan(0);
  });

  it('is written in range syntax: `width >=`, `width <`, `height <=`, or an orientation; a container query in cells', () => {
    for (const query of queries) {
      for (const match of query.prelude.matchAll(/\([^()]*\)/g)) {
        const where = `${query.path}: @${query.at} ${query.prelude}`;
        if (query.at === 'container') expect(match[0], where).toMatch(/^\(min-width: \d+ch\)$/);
        else expect(match[0], where).toMatch(/^\((width >= \d+px|width < \d+px|height <= \d+px|orientation: (landscape|portrait))\)$/);
      }
    }
  });

  it('holds every length in a condition to an export of lib/layout.ts', () => {
    const widths = new Set([WIDE_MIN_PX, HOME_THREE_PANE_MIN_PX, WIDE_SPLIT_MIN_PX, ...Object.values(FOOTER_ONE_LINE_MIN_PX), ...Object.values(HEADER_FOLD_PX).flatMap((fold) => Object.values(fold))]);
    const heights = new Set([SIDEWAYS_MAX_HEIGHT_PX, SHORT_MAX_HEIGHT_PX, WIDE_SHORT_MAX_HEIGHT_PX]);
    for (const condition of conditions) {
      const where = `${condition.path}: ${conditionText(condition)}`;
      if (condition.feature === 'orientation') continue;
      const value = /^(\d+)(px|ch)$/.exec(condition.value);
      expect(value, `${where} is not a whole number of px or ch`).not.toBeNull();
      const n = Number(value?.[1]);
      if (condition.at === 'container') expect(n, where).toBe(FRAME_LEGEND_MIN_CELLS);
      else if (condition.feature === 'width') expect(widths, where).toContain(n);
      else expect(heights, where).toContain(n);
    }
  });

  it('keys something off each of the three heights, each where lib/layout.ts says it folds', () => {
    const at = (feature: string, px: number): string[] => conditions.filter((c) => c.feature === feature && c.value === `${String(px)}px`).map((c) => c.path);
    expect(SIDEWAYS_MAX_HEIGHT_PX).toBe(500);
    expect(SHORT_MAX_HEIGHT_PX).toBe(700);
    expect(WIDE_SHORT_MAX_HEIGHT_PX).toBe(720);
    expect(SHORT_MAX_HEIGHT_PX).toBeLessThan(WIDE_SHORT_MAX_HEIGHT_PX);
    expect(at('height', SIDEWAYS_MAX_HEIGHT_PX).sort()).toEqual([GLOBAL_PATH, 'src/ui/screens/Live.module.css'].sort());
    expect(at('height', SHORT_MAX_HEIGHT_PX).sort()).toEqual([APP_PATH, 'src/ui/components/location/LocationInput.module.css'].sort());
    expect(at('height', WIDE_SHORT_MAX_HEIGHT_PX)).toEqual([APP_PATH]);
    // The landscape phone's height stands with its orientation and nothing else, in both files, and is the query the page asks in script.
    for (const query of queries.filter((q) => q.conditions.some((c) => c.feature === 'height' && c.value === `${String(SIDEWAYS_MAX_HEIGHT_PX)}px`))) expect(query.prelude).toBe(LANDSCAPE_PHONE_QUERY);
  });

  it('holds the header’s four folds to HEADER_FOLD_PX, as `width <` and nothing else, under the wide breakpoint’s neighbours', () => {
    const folds = conditions.filter((c) => c.path === HEADER_PATH && c.comparator === '<').map((c) => Number.parseInt(c.value, 10));
    expect(folds.sort((a, b) => a - b)).toEqual(Object.values(HEADER_FOLD_PX).flatMap((fold) => Object.values(fold)).sort((a, b) => a - b));
    // Each fold is held to its language and its line, not only to the set: the block under `width < HEADER_FOLD_PX[lang][line]` is the one that hides that language's title or tagline.
    const header = readFileSync(HEADER_PATH, 'utf8');
    for (const [lang, fold] of Object.entries(HEADER_FOLD_PX)) {
      for (const [line, px] of Object.entries(fold)) {
        const block = new RegExp(`@media \\(width < ${String(px)}px\\) \\{([^}]*\\{[^}]*\\})`).exec(header)?.[1] ?? '';
        expect(block, `${lang} ${line} at ${String(px)}px`).toContain(`[lang='${lang}']`);
        expect(block, `${lang} ${line} at ${String(px)}px`).toContain(line === 'title' ? '.fullTitle' : '.tagline');
      }
    }
    for (const [lang, fold] of Object.entries(HEADER_FOLD_PX)) {
      expect(fold.tagline, `${lang}: the tagline folds before the title`).toBeLessThan(fold.title);
      expect(fold.title).toBeLessThan(HOME_THREE_PANE_MIN_PX);
    }
    // The only other `width <` folds are the footer's two-line rule, one per language, each under its language's selector (R93, D-546).
    const app = readFileSync(APP_PATH, 'utf8');
    const footerFolds = conditions.filter((c) => c.comparator === '<' && c.path !== HEADER_PATH);
    expect(footerFolds.map((c) => c.path)).toEqual([APP_PATH, APP_PATH]);
    expect(footerFolds.map((c) => Number.parseInt(c.value, 10)).sort((a, b) => a - b)).toEqual([FOOTER_ONE_LINE_MIN_PX.en, FOOTER_ONE_LINE_MIN_PX.es].sort((a, b) => a - b));
    for (const [lang, px] of Object.entries(FOOTER_ONE_LINE_MIN_PX)) {
      const block = new RegExp(`@media \\(width >= \\d+px\\) and \\(width < ${String(px)}px\\) \\{([^}]*\\{[^}]*\\})`).exec(app)?.[1] ?? '';
      expect(block, `footer ${lang} at ${String(px)}px`).toContain(`[lang='${lang}']`);
    }
  });

  it('holds the chart frame’s container query to FRAME_LEGEND_MIN_CELLS, the one container query in the tree', () => {
    expect(FRAME_LEGEND_MIN_CELLS).toBe(62);
    const containers = queries.filter((q) => q.at === 'container');
    expect(containers.map((q) => q.path)).toEqual([FRAME_PATH]);
    expect(containers[0]?.prelude).toBe(`(min-width: ${String(FRAME_LEGEND_MIN_CELLS)}ch)`);
  });

  it('asks the same queries in script: the wide and three-pane queries are the stylesheets’ conditions', () => {
    expect(WIDE_QUERY).toBe(`(width >= ${String(WIDE_MIN_PX)}px)`);
    expect(HOME_THREE_PANE_QUERY).toBe(`(width >= ${String(HOME_THREE_PANE_MIN_PX)}px)`);
    expect(queries.map((q) => q.prelude)).toContain(WIDE_QUERY);
    expect(queries.map((q) => q.prelude)).toContain(HOME_THREE_PANE_QUERY);
  });
});
