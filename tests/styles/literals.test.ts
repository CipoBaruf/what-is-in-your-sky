/**
 * R103 (FR-DS-2, FR-X-6 as amended, US-37 AC3; D-701): no literal in a module.
 * Every stylesheet under `src/` but `tokens.css`, and every inline `style`
 * object in `src/ui/**\/*.tsx`, is read for what D-701 names — a colour
 * literal, a `px`/`rem`/`em` length other than `0` outside a media condition,
 * a `z-index` number, an `outline` other than the stripes' tight offset, a
 * `font-family` that is not the stack, and the `[ ` / ` ]` brackets outside
 * `Tag` — and held to `literals.allow.json`: one entry per file with
 * its count and its reason, seeded at the day's counts by R103. A file's
 * matches must equal its count — more is a new literal, fewer is a count that
 * was not lowered with the change that earned it — and an entry at zero or
 * for a file that is gone is a failure too, so the list only falls. R209
 * (FR-CTRL-14, FR-CTRL-17; D-1229): a bracketed word outside `Tag` is held to
 * the lanes' lists in `allow/`, which fail on a raised count alone.
 */
import { describe, expect, it } from 'vitest';
import { ALLOW_PATH, bracketFiles, components, PRIMITIVES_DIR, readAllowList, scanAll, scanBrackets, scanComponent, scanStylesheet, stylesheets, TAG_COMPONENT, TAG_STYLESHEET, TOKENS_FILE, type Literal } from './literals';
import { laneLists, listFaults, overCount, type LaneList } from './ratchet';

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

    it('the brackets drawn as content, outside Tag (FR-DS-2 as amended)', () => {
      const css = ".a::before { content: '[ '; } .a::after { content: ' ]'; } .b::before { content: '── '; } .c::after { content: \"[ \"; }";
      expect(kinds(css)).toEqual(["bracket content: '[ '", "bracket content: ' ]'", 'bracket content: "[ "']);
      expect(kinds(css, `${PRIMITIVES_DIR}/TextButton.module.css`)).toHaveLength(3);
      expect(kinds(css, TAG_STYLESHEET)).toEqual([]);
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

describe('brackets mean a label, and Tag writes them (FR-CTRL-14, D-1229)', () => {
  const lists = laneLists('brackets');
  const count = (text: string, path = 'src/ui/X.tsx'): number => scanBrackets(path, text).length;

  it('FR-CTRL-17: no file draws more bracketed words than its lane’s list allows', () => {
    const failures = overCount(new Map(bracketFiles().map((path) => [path, scanBrackets(path)])), lists);
    expect(failures, `A label is a Tag (docs/DESIGN.md).\n${failures.join('\n')}`).toEqual([]);
  });

  it('the lists are one per lane, a file in one of them, each with its count and reason', () => {
    expect(listFaults('brackets', lists)).toEqual([]);
  });

  it('counts a bracketed word in JSX text, the whole or round an expression', () => {
    expect(count('const x = <p>a [twilight] pass</p>;')).toBe(1);
    expect(count('const x = <p>[{word}]</p>;')).toBe(1);
    expect(count("const x = <p>{open ? '[−]' : '[+]'}</p>;")).toBe(2);
    expect(count('const x = <p>twilight</p>;')).toBe(0);
  });

  it('counts one in a catalog’s string or message, and no other module’s strings', () => {
    const text = "export const ui = { tag: '[faint]', level: (n: number) => `[level ${n}] of five` };";
    expect(count(text, 'src/i18n/en/ui.ts')).toBe(2);
    expect(count("const selector = '[data-option]';")).toBe(0);
  });

  it('counts a template that builds [${…}], and no selector or index', () => {
    expect(count('const marker = `[${t.banner}]`;')).toBe(1);
    expect(count('const step = `[0${n}] ${word}`;')).toBe(1);
    expect(count('const a = `[data-pass-id="${id}"]`; const b = `${CARD}[data-selected]`; const c = list[i];')).toBe(0);
  });

  it('counts one handed to a component as a prop, and no selector', () => {
    expect(count('const x = <Line marker="[info]">A sentence</Line>;')).toBe(1);
    expect(count("const x = <Line marker={'[info]'}>A sentence</Line>;")).toBe(1);
    expect(count('const x = <TextButton label="[ retry ]" />;')).toBe(1);
    expect(count("const x = <Line marker={warn ? '[warning]' : '[info]'}>A sentence</Line>;")).toBe(2);
    expect(count("const x = <Line marker={marker ?? '[info]'}>A sentence</Line>;")).toBe(1);
    expect(count("const x = <Line marker={'[info] ' + word}>A sentence</Line>;")).toBe(1);
    expect(count('const x = <Line marker={`[info] ${word}`}>A sentence</Line>;')).toBe(1);
    expect(count('const x = <p>{`[info] ${word}`}</p>;')).toBe(1);
    expect(count("const x = <ToggleGroup options={[{ value: 'a', label: '[a]' }]} />;")).toBe(1);
    expect(count("const x = <Line {...(warn ? { marker: '[warning]' } : {})}>A sentence</Line>;")).toBe(1);
    // A template that builds one is still one, wherever it stands.
    expect(count('const x = <Line marker={`[${word}]`}>A sentence</Line>;')).toBe(1);
    expect(count('const x = <p>{`[${word}]`}</p>;')).toBe(1);
    expect(count('const x = <List within="[data-option]" first=\'[role="option"]\' row={`[data-id="${id}"]`} />;')).toBe(0);
    expect(count("const x = <Line marker={key === '[' ? open : shut}>A sentence</Line>;")).toBe(0);
  });

  it('counts no data- or aria- selector that a template builds in a prop', () => {
    expect(count('const x = <List within={`[data-${kind}]`} />;')).toBe(0);
    expect(count('const x = <List within={`[aria-${state}] li`} />;')).toBe(0);
    expect(count('const x = <List {...{ within: `[data-${kind}]` }} />;')).toBe(0);
    expect(count('const x = <List first={query(`[data-${kind}]`)} />;')).toBe(0);
    // A child is drawn, inside a prop too.
    expect(count('const x = <p>{`[data-${kind}]`}</p>;')).toBe(1);
    expect(count('const x = <Line lead={<b>{`[data-${kind}]`}</b>}>A sentence</Line>;')).toBe(1);
  });

  it('counts one drawn as a stylesheet’s content', () => {
    expect(count(".a::before { content: '['; } .a::after { content: ']'; } .b::before { content: '── '; }", 'src/ui/x.module.css')).toBe(2);
    expect(count(".a::before { content: '[ '; }", `${PRIMITIVES_DIR}/Line.module.css`)).toBe(1);
  });

  it('never counts Tag’s own', () => {
    expect(count('const x = <span>[{children}]</span>;', TAG_COMPONENT)).toBe(0);
    expect(count(".a::before { content: '['; }", TAG_STYLESHEET)).toBe(0);
  });

  it('fails on a raised count and passes on a lowered one', () => {
    const path = 'src/ui/X.tsx';
    const allowed: LaneList[] = [{ path: 'ui.brackets.json', entries: { [path]: { count: 1, reason: 'fixture' } } }];
    const judged = (text: string): string[] => overCount(new Map([[path, scanBrackets(path, text)]]), allowed);
    expect(judged('const x = <><p>[a]</p><p>[b]</p></>;')).toEqual([expect.stringContaining('2, over the 1')]);
    expect(judged('const x = <p>[a]</p>;')).toEqual([]);
    expect(judged('const x = <p>a</p>;')).toEqual([]);
  });
});
