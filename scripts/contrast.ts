/**
 * R12 (FR-X-5), extended by R20 (FR-THEME-1..3, D-84): WCAG 2.1 contrast
 * ratios of the tokens in `src/ui/styles/tokens.css`, computed for **both**
 * themes over the same pair table. It prints every column;
 * `tokens.css` documents three of them (D-100) and
 * `tests/styles/tokens.test.ts` recomputes those in CI, so the documented
 * numbers cannot drift. Run: `npx tsx scripts/contrast.ts`.
 */
import { readFileSync } from 'node:fs';

export const TOKENS_PATH = 'src/ui/styles/tokens.css';
export const TEXT_TOKENS = ['fg', 'fg-dim', 'accent', 'danger', 'ok', 'warn'] as const;
export const GROUND_TOKENS = ['bg', 'bg-raised'] as const;

/**
 * FR-DOME-2 / FR-THEME-3 (R20): one token per chart meaning, with a value in
 * every theme. These are marks — non-text, so WCAG 1.4.11's 3 : 1 on the page
 * ground is the bar, and `scripts`/tests hold them to it. `chart-ground` and
 * `chart-sky` are the dome's base surfaces (D-92), not marks: their job is to
 * sit *barely* above the page ground, so they are listed apart.
 */
export const CHART_MARK_TOKENS = [
  'chart-pass',
  'chart-pass-flown',
  'chart-pass-dim',
  'chart-peak',
  'chart-shadow',
  'chart-now',
  'chart-horizon',
  'chart-rings',
  'chart-compass',
  'chart-sun',
  'chart-moon',
  // FR-LIVE-2 (R32): the live page's six per-satellite arc colours.
  'chart-series-1',
  'chart-series-2',
  'chart-series-3',
  'chart-series-4',
  'chart-series-5',
  'chart-series-6',
] as const;
export const CHART_SURFACE_TOKENS = ['chart-ground', 'chart-sky'] as const;

/** The themes `tokens.css` defines, and the selector each is written under (D-84). */
export const THEMES = ['dark', 'night'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_SELECTORS: Record<Theme, string> = { dark: ':root', night: '[data-theme="night"]' };

/**
 * The colour declarations of one theme's block. The file is hand-written and
 * flat — one selector at the start of a line, one `{ … }`, no nesting — so a
 * line-anchored match on the selector and a read to the next `}` is enough.
 * The anchor matters: `:root` is also *named* in the file's header comment,
 * and an unanchored search would find the prose first and then read the
 * wrong block.
 */
export function readTokens(css: string, theme: Theme = 'dark'): Map<string, string> {
  const selector = THEME_SELECTORS[theme];
  const opener = new RegExp(`^${selector.replace(/[[\]]/g, '\\$&')}\\s*\\{`, 'm').exec(css);
  if (!opener) throw new Error(`no ${selector} block in ${TOKENS_PATH}`);
  const close = css.indexOf('}', opener.index);
  if (close < 0) throw new Error(`unterminated ${selector} block in ${TOKENS_PATH}`);
  const block = css.slice(opener.index, close);
  const tokens = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) if (name && value) tokens.set(name, value.toLowerCase());
  return tokens;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG 2.1 contrast ratio, ≥ 1. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL hue in degrees; 0 for a grey, where hue is undefined. */
export function hue(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

/**
 * FR-THEME-3: "no element keeps a non-red hue in night mode". A colour is red
 * when its channels descend (`r ≥ g ≥ b`, so nothing green or blue can lead)
 * and its hue is within `MAX_RED_HUE` of red — the descending order alone
 * allows anything up to yellow at 60°, which a red-adaptation palette must
 * not reach. A neutral grey (`max === min`) has no hue and passes: pure black
 * and pure white are not a colour cast.
 */
export const MAX_RED_HUE = 30;

export function isRedHue(hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255] as [number, number, number];
  if (r < g || g < b) return false;
  return r === b || hue(hex) <= MAX_RED_HUE;
}

if (process.argv[1]?.endsWith('contrast.ts')) {
  const css = readFileSync(TOKENS_PATH, 'utf8');
  const byTheme = new Map<Theme, Map<string, string>>(THEMES.map((theme) => [theme, readTokens(css, theme)] as const));
  const get = (theme: Theme, name: string): string => {
    const value = byTheme.get(theme)?.get(name);
    if (!value) throw new Error(`no --${name} in the ${theme} block of ${TOKENS_PATH}`);
    return value;
  };
  /** One row: the token, then its ratio on each ground in each theme, in the header comment's column order. */
  const row = (name: string, cell: (theme: Theme, ground: string) => string, grounds: readonly string[] = GROUND_TOKENS): string =>
    `--${name.padEnd(16)} ${THEMES.flatMap((theme) => grounds.map((ground) => cell(theme, ground).padEnd(24))).join('')}`;
  const ratio = (fg: string) => (theme: Theme, ground: string) => `${contrastRatio(get(theme, fg), get(theme, ground)).toFixed(2)} : 1`;

  console.log(`token${' '.repeat(14)}${THEMES.flatMap((theme) => GROUND_TOKENS.map((g) => `${theme} on --${g} (${get(theme, g)})`.padEnd(24))).join('')}`);
  for (const text of TEXT_TOKENS) console.log(row(text, ratio(text)));
  console.log(`--bg on --accent   ${THEMES.map((theme) => `${theme} ${contrastRatio(get(theme, 'bg'), get(theme, 'accent')).toFixed(2)} : 1`).join(', ')}`);
  console.log(row('edge (non-text)', ratio('edge')));
  console.log(row('rule (decor.)', ratio('rule')));

  console.log('\nFR-DOME-2 marks, on each theme’s --bg (3 : 1 is the bar); the two base surfaces are meant to sit near 1.');
  for (const chart of [...CHART_MARK_TOKENS, ...CHART_SURFACE_TOKENS]) {
    console.log(row(chart, (theme) => `${get(theme, chart)}  ${contrastRatio(get(theme, chart), get(theme, 'bg')).toFixed(2)} : 1`, ['bg']));
  }

  const offHue = [...(byTheme.get('night') ?? [])].filter(([, value]) => !isRedHue(value));
  console.log(offHue.length === 0 ? '\nEvery night value is a red hue (FR-THEME-3).' : `\nNOT RED: ${offHue.map(([name, value]) => `--${name} ${value} (hue ${hue(value).toFixed(0)}°)`).join(', ')}`);
}
