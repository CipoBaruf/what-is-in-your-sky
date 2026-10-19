/**
 * R12 (FR-X-5, FR-X-1) extended by R20 (FR-THEME-1..3, D-84): the same pair
 * table over **both** themes. Every text token reaches WCAG AA (4.5 : 1) on
 * every ground, the control edge and every chart mark reach 3 : 1, the night
 * theme restates every colour the dark theme defines and keeps every one of
 * them a red hue, and the ratios in the file's header comment are the ones
 * `scripts/contrast.ts` computes, so the documented numbers cannot drift from
 * the colours.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICON_TONES } from '../../scripts/build-mark';
import { CHART_MARK_TOKENS, CHART_SURFACE_TOKENS, contrastRatio, GROUND_TOKENS, hue, isRedHue, MAX_RED_HUE, readSections, readTokens, SECTIONS, TEXT_TOKENS, THEMES, TOKENS_PATH, type Section, type Theme } from '../../scripts/contrast';

const css = readFileSync(TOKENS_PATH, 'utf8');
/** The header comment wraps, so the prose assertions read it as one line. */
const prose = css.replace(/\s+/g, ' ');
const byTheme = new Map<Theme, Map<string, string>>(THEMES.map((theme) => [theme, readTokens(css, theme)] as const));
const token = (theme: Theme, name: string): string => {
  const value = byTheme.get(theme)?.get(name);
  if (!value) throw new Error(`no --${name} in the ${theme} theme`);
  return value;
};
const ratio = (theme: Theme, fg: string, ground: string): string => contrastRatio(token(theme, fg), token(theme, ground)).toFixed(2);
const sections = readSections(css);
const section = (name: Section): Map<string, string> => {
  const found = sections.find((s) => s.name === name);
  if (!found) throw new Error(`no == ${name} == section in ${TOKENS_PATH}`);
  return found.tokens;
};

/**
 * R103 (FR-DS-1, D-700): the sheet is sections the tests parse — six markers
 * in `:root` and the night block — and the night block is a colour set: it
 * restates every token of the colour section and nothing else (FR-THEME-1 as
 * amended v2.3, V23-3, here as a test and not a convention). Every length in
 * `space`, `edges` and `layers` is written from the grid — a `calc()` of
 * `--row`, a `var()`, an integer or a bare `0` — and never as a bare length;
 * `--space-block` is the one named exception (1.2 rem, board 1B's contract,
 * V23-5) and the grid section is where the bare units live by nature.
 */
describe('tokens.css sections (FR-DS-1, D-700)', () => {
  it('is cut under the seven markers, in order, with every declaration under one', () => {
    expect(sections.map((s) => s.name)).toEqual([...SECTIONS]);
    for (const s of sections) expect(s.tokens.size, `the ${s.name} section is empty`).toBeGreaterThan(0);
    const named = sections.filter((s) => s.name !== 'night').reduce((total, s) => total + s.tokens.size, 0);
    expect(named).toBe((css.match(/^\s+--[a-z0-9-]+:/gm) ?? []).length - section('night').size);
  });

  it('restates every colour token in the night block, and nothing else (FR-THEME-1 as amended)', () => {
    expect([...section('night').keys()].sort()).toEqual([...section('colour').keys()].sort());
    for (const value of section('colour').values()) expect(value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('writes every length in space, edges and layers from the grid, never as a bare length', () => {
    const BARE_LENGTH = /\d(px|rem|em|ch)\b/;
    const GRID_WRITTEN = /^(calc\(.*\)|var\(--[a-z0-9-]+\)( solid var\(--[a-z-]+\))?|\d+(\.\d+)?%?|0)$/;
    for (const name of ['space', 'edges', 'layers'] as const) {
      for (const [key, value] of section(name)) {
        if (key === 'space-block') continue; // V23-5: 1.2 rem, kept at its value beside the scale (OQ-37)
        expect(value, `--${key}: ${value}`).not.toMatch(BARE_LENGTH);
        expect(value, `--${key}: ${value}`).toMatch(GRID_WRITTEN);
      }
    }
    expect(section('space').get('space-block')).toBe('1.2rem');
  });

  it('has the scales FR-DS-1 names, at their values', () => {
    expect([...section('space').keys()]).toEqual(['space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-block', 'gutter']);
    expect(section('space').get('space-2')).toBe('calc(var(--row) / 2)');
    expect(section('space').get('space-5')).toBe('calc(2 * var(--row))');
    for (const key of ['border', 'border-control', 'radius-0', 'radius-1', 'radius-2', 'focus-ring', 'focus-offset', 'focus-offset-tight', 'weight-bold', 'window-fill-opacity']) expect(section('edges').has(key), `--${key}`).toBe(true);
    expect(section('edges').get('border')).toBe('var(--hairline) solid var(--rule)');
    expect(section('edges').get('weight-bold')).toBe('700');
    expect(section('edges').get('window-fill-opacity')).toBe('0.88');
    expect(Object.fromEntries(section('layers'))).toEqual({ 'z-raised': '1', 'z-raised-2': '2', 'z-sheet': '10', 'z-overlay': '20', 'z-screen': '30', 'z-banner': '100' });
    for (const [key, value] of section('type')) {
      if (key.startsWith('chart-text-')) expect(value).toBe(`${key.slice('chart-text-'.length)}px`);
      else if (key.endsWith('-row') || key === 'small' || key === 'small-row') expect(value).toMatch(/^(\d+(\.\d+)?rem|var\(--row\)|var\(--small\)|calc\(.*\))$/);
      else expect(section('type').has(`${key}-row`), `--${key} has no --${key}-row`).toBe(true);
    }
    expect([...section('type').keys()].filter((key) => key.startsWith('chart-text-'))).toEqual(['chart-text-9', 'chart-text-11', 'chart-text-12', 'chart-text-14', 'chart-text-15']);
  });
});

describe.each(THEMES)('tokens.css contrast (%s)', (theme) => {
  it('has every text token at ≥ 4.5 : 1 on both grounds, and the ground at ≥ 4.5 : 1 on the accent', () => {
    for (const text of TEXT_TOKENS) for (const ground of GROUND_TOKENS) expect(contrastRatio(token(theme, text), token(theme, ground)), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token(theme, 'bg'), token(theme, 'accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it('has the control edge at ≥ 3 : 1 on the ground (WCAG 1.4.11)', () => {
    for (const ground of GROUND_TOKENS) expect(contrastRatio(token(theme, 'edge'), token(theme, ground)), `edge on ${ground}`).toBeGreaterThanOrEqual(3);
  });

  /** FR-DOME-2 / FR-THEME-3: a mark carries meaning, so it meets the non-text bar; the two base surfaces are not marks. */
  it('has every chart mark at ≥ 3 : 1 on the page ground, and the base surfaces below 1.5 : 1', () => {
    for (const mark of CHART_MARK_TOKENS) expect(contrastRatio(token(theme, mark), token(theme, 'bg')), mark).toBeGreaterThanOrEqual(3);
    for (const surface of CHART_SURFACE_TOKENS) expect(contrastRatio(token(theme, surface), token(theme, 'bg')), surface).toBeLessThan(1.5);
  });

  /**
   * FR-DS-8 (R103): the four marks reserved for the stars, measured now though
   * nothing draws with them — the star in `--fg`'s class, the dim star in
   * `--fg-dim`'s, the figure a line in `--chart-rings`' class, the planet apart
   * from a star in lightness and, in the dark theme, in hue.
   */
  it('has the four reserved star tokens at FR-DS-8’s ratios, the planet apart from the star', () => {
    const on = (mark: string): number => contrastRatio(token(theme, mark), token(theme, 'bg'));
    expect(on('chart-star')).toBeGreaterThanOrEqual(10);
    expect(on('chart-star-dim')).toBeGreaterThanOrEqual(4.5);
    expect(on('chart-figure')).toBeGreaterThanOrEqual(3);
    expect(on('chart-planet')).toBeGreaterThanOrEqual(7);
    expect(Math.abs(on('chart-planet') - on('chart-star')), 'the planet and the star differ in lightness').toBeGreaterThan(1);
    if (theme === 'dark') expect(Math.abs(hue(token(theme, 'chart-planet')) - hue(token(theme, 'chart-star'))), 'the planet and the star differ in hue').toBeGreaterThan(90);
  });
});

describe('tokens.css themes', () => {
  it('gives every colour the dark theme defines a value in the night theme, and no others (FR-THEME-1)', () => {
    const dark = [...(byTheme.get('dark')?.keys() ?? [])].sort();
    const night = [...(byTheme.get('night')?.keys() ?? [])].sort();
    expect(dark.length).toBeGreaterThan(0);
    expect(night).toEqual(dark);
  });

  it('keeps every night value on a red hue (FR-THEME-3)', () => {
    for (const [name, value] of byTheme.get('night') ?? []) expect(isRedHue(value), `--${name} ${value} is ${hue(value).toFixed(0)}°, past the ${MAX_RED_HUE}° red bound`).toBe(true);
  });

  it('leaves no dark colour showing through in night mode', () => {
    for (const name of byTheme.get('dark')?.keys() ?? []) expect(token('night', name), `--${name}`).not.toBe(token('dark', name));
  });
});

describe('tokens.css literals elsewhere', () => {
  /**
   * R74 (FR-MARK-3, FR-MARK-4 e, D-460): an icon has no stylesheet, so the
   * mark's files carry the dark theme's `--bg`, `--chart-horizon` (the bezel,
   * one ramp step above the body), `--fg-dim` and `--accent` as literals in
   * `scripts/build-mark.ts`. This is the check that keeps them the theme's.
   */
  it('keeps the icon tones equal to the dark theme (ICON_TONES)', () => {
    expect(ICON_TONES).toEqual({ bg: token('dark', 'bg'), bezel: token('dark', 'chart-horizon'), dim: token('dark', 'fg-dim'), accent: token('dark', 'accent') });
  });
});

describe('tokens.css documentation', () => {
  /**
   * The three pinned columns: both grounds in dark (R12's table, unchanged)
   * and the page ground in night. The night raised column is deliberately not
   * a fourth set of figures — `--bg-raised` sits 1.06 : 1 above `--bg`, so it
   * carries no information the 4.5 floor above does not already check.
   */
  it('documents the computed ratios in its header comment', () => {
    const columns: readonly (readonly [Theme, string])[] = [
      ['dark', 'bg'],
      ['dark', 'bg-raised'],
      ['night', 'bg'],
    ];
    for (const text of TEXT_TOKENS) {
      const line = new RegExp(`--${text}\\s+([\\d.]+) : 1\\s+([\\d.]+) : 1\\s+([\\d.]+) : 1`).exec(css);
      expect(line, `no table row for --${text}`).not.toBeNull();
      expect(line?.slice(1, 4)).toEqual(columns.map(([theme, ground]) => ratio(theme, text, ground)));
    }
    expect(prose).toContain(`--bg on --accent (pressed sort button) ${ratio('dark', 'bg', 'accent')} : 1 dark, ${ratio('night', 'bg', 'accent')} : 1 night`);
    expect(prose).toContain(`is ${ratio('dark', 'edge', 'bg')} : 1 on \`--bg\` (${ratio('dark', 'edge', 'bg-raised')} : 1 on \`--bg-raised\`) dark and ${ratio('night', 'edge', 'bg')} : 1 on \`--bg\` night`);
    expect(prose).toContain(`\`--rule\` (${ratio('dark', 'rule', 'bg')} : 1 dark) is decorative only`);
  });

  it('documents each chart token’s measured ratio beside it', () => {
    for (const chart of [...CHART_MARK_TOKENS, ...CHART_SURFACE_TOKENS]) {
      for (const theme of THEMES) {
        const expected = ratio(theme, chart, 'bg');
        expect(css, `--${chart} (${theme}) should be documented as ${expected} : 1`).toContain(`--${chart}: ${token(theme, chart)}; /* ${expected} : 1`);
      }
    }
  });
});
