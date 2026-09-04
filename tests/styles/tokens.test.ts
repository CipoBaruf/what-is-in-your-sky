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
import { CHART_MARK_TOKENS, CHART_SURFACE_TOKENS, contrastRatio, GROUND_TOKENS, hue, isRedHue, MAX_RED_HUE, readTokens, TEXT_TOKENS, THEMES, TOKENS_PATH, type Theme } from '../../scripts/contrast';

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
