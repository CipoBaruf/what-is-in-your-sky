/**
 * R103 (FR-DS-2, FR-X-6 as amended, US-37 AC3; D-701): no literal in a module.
 * Every stylesheet under `src/` but `tokens.css`, and every inline `style`
 * object in `src/ui/**\/*.tsx`, is read for what D-701 names — a colour
 * literal, a `px`/`rem`/`em` length other than `0` outside a media condition,
 * a `z-index` number, an `outline` other than the stripes' tight offset, a
 * `font-family` that is not the stack, and the `[ ` / ` ]` brackets outside
 * the primitives — and held to `literals.allow.json`: one entry per file with
 * its count and its reason, seeded at the day's counts by R103. A file's
 * matches must equal its count — more is a new literal, fewer is a count that
 * was not lowered with the change that earned it — and an entry at zero or
 * for a file that is gone is a failure too, so the list only falls.
 */
import { describe, expect, it } from 'vitest';
import { ALLOW_PATH, components, PRIMITIVES_DIR, readAllowList, scanAll, scanComponent, scanStylesheet, stylesheets, TOKENS_FILE, type Literal } from './literals';

const allow = readAllowList();
const scanned = scanAll();

const lines = (found: Literal[]): string => found.map((l) => `  line ${String(l.line)} (${l.kind}): ${l.text}`).join('\n');

describe('the literals test (FR-DS-2, D-701)', () => {
  it('reads every stylesheet under src/ but tokens.css, and every component under src/ui', () => {
    expect(stylesheets().length).toBeGreaterThan(40);
    expect(stylesheets()).not.toContain(TOKENS_FILE);
    expect(stylesheets().every((path) => path.endsWith('.css'))).toBe(true);
    expect(components().length).toBeGreaterThan(40);
  });

  it('holds every file to its allow-list count, in both directions', () => {
    const failures: string[] = [];
    for (const [path, found] of scanned) {
      const expected = allow[path]?.count ?? 0;
      if (found.length === expected) continue;
      const direction = found.length > expected ? `${String(found.length - expected)} more than` : `${String(expected - found.length)} fewer than`;
      failures.push(`${path}: ${String(found.length)} literal(s), ${direction} the ${String(expected)} ${ALLOW_PATH} allows${found.length > 0 ? `:\n${lines(found)}` : ''}`);
    }
    expect(failures, failures.join('\n\n')).toEqual([]);
  });

  it('allows nothing it does not read, nothing at zero, and nothing without a reason', () => {
    for (const [path, entry] of Object.entries(allow)) {
      expect(scanned.has(path), `${ALLOW_PATH} lists ${path}, which the test does not read — remove the entry`).toBe(true);
      expect(entry.count, `${ALLOW_PATH}: ${path} is at zero — remove the entry`).toBeGreaterThan(0);
      expect(Number.isInteger(entry.count), `${ALLOW_PATH}: ${path}'s count is not a whole number`).toBe(true);
      expect(entry.reason.trim().length, `${ALLOW_PATH}: ${path} has no reason`).toBeGreaterThan(0);
      expect(entry.reason, `${ALLOW_PATH}: ${path}'s reason is one line`).not.toContain('\n');
    }
    expect(Object.keys(allow)).toEqual([...Object.keys(allow)].sort());
  });

  describe('what it matches', () => {
    const kinds = (css: string, path = 'src/ui/x.module.css'): string[] => scanStylesheet(path, css).map((l) => `${l.kind} ${l.text}`);

    it('a colour literal: hex, rgb(), hsl(), a named colour, a color-mix() with a literal inside', () => {
      expect(kinds('.a { color: #fff; background: rgb(1 2 3); border-color: hsl(0 0% 0%); fill: white; }')).toEqual(['colour color: #fff', 'colour background: rgb(', 'colour border-color: hsl(', 'colour fill: white']);
      expect(kinds('.a { --x: color-mix(in srgb, var(--bg) 85%, transparent); color: currentColor; background: transparent; fill: inherit; }')).toEqual([]);
      expect(kinds('.a { background: color-mix(in srgb, var(--bg) 85%, black); }')).toEqual(['colour background: color-mix(', 'colour background: black']);
      expect(kinds('.a { grid-area: tan; color: var(--tan); }')).toEqual(['colour grid-area: tan']);
    });

    it('a px, rem or em length other than 0, outside a media or container condition', () => {
      expect(kinds('.a { padding: 0 1px 0.5rem 2em; margin: 0px; width: calc(2 * var(--cell)); height: 100%; stroke-width: 1.5; }')).toEqual(['length padding: 1px', 'length padding: 0.5rem', 'length padding: 2em']);
      expect(kinds('@media (width >= 964px) { .a { gap: var(--row); } } @container (min-width: 62ch) { .a { gap: 0; } }')).toEqual([]);
      expect(kinds('.a { min-height: calc(var(--x, 0px) * 2); }')).toEqual([]);
    });

    it('a z-index number, an outline that is not the tight offset, a font-family that is not the stack', () => {
      expect(kinds('.a { z-index: 10; } .b { z-index: var(--z-sheet); } .c { z-index: auto; }')).toEqual(['z-index z-index: 10']);
      expect(kinds('.a { outline: none; } .b { outline-offset: var(--focus-offset-tight); } .c { outline: var(--focus-ring) solid var(--accent); outline-offset: var(--focus-offset); }')).toEqual(['outline outline: none', 'outline outline: var(--focus-ring) solid var(--accent)', 'outline outline-offset: var(--focus-offset)']);
      expect(kinds('.a { font-family: var(--font-mono); } .b { font-family: inherit; } .c { font-family: monospace; }')).toEqual(['font-family font-family: inherit', 'font-family font-family: monospace']);
    });

    it('the brackets drawn as content, outside the primitives', () => {
      const css = ".a::before { content: '[ '; } .a::after { content: ' ]'; } .b::before { content: '── '; } .c::after { content: \"[ \"; }";
      expect(kinds(css)).toEqual(["bracket content: '[ '", "bracket content: ' ]'", 'bracket content: "[ "']);
      expect(kinds(css, `${PRIMITIVES_DIR}/TextButton.module.css`)).toEqual([]);
    });

    it('leaves comments and custom properties alone, and keeps the line', () => {
      const found = scanStylesheet('src/ui/x.module.css', '/* 12px, #fff */\n.a {\n  --cells: 12px;\n  gap: 12px; /* #fff */\n}\n');
      expect(found).toEqual([{ kind: 'length', line: 4, text: 'gap: 12px' }]);
    });

    it('an inline style whose value is a colour or a length literal, and not one computed at runtime', () => {
      const tsx = (body: string): string[] => scanComponent('src/ui/X.tsx', `<div style={{ ${body} }} />`).map((l) => l.text);
      expect(tsx("color: '#fff', width: '12px', height: 12, top: 0, left: `${String(x)}px`, minWidth: `${n}ch`, ['--x' as string]: '12px', ...at(x, w)")).toEqual(["color: '#fff'", "width: '12px'", 'height: 12']);
      expect(tsx("'--screen-turn': `${String(deg)}deg`, transform: rotate(deg), background: side")).toEqual([]);
      expect(scanComponent('src/ui/X.tsx', '<div style={layerStyle(base)} />')).toEqual([]);
    });
  });
});
