/**
 * R12 (FR-X-5): WCAG 2.1 contrast ratios of the text tokens in
 * `src/ui/styles/tokens.css`, printed as the table the file's header comment
 * carries. `tests/styles/tokens.test.ts` recomputes the same numbers in CI.
 * Run: `npx tsx scripts/contrast.ts`.
 */
import { readFileSync } from 'node:fs';

export const TOKENS_PATH = 'src/ui/styles/tokens.css';
export const TEXT_TOKENS = ['fg', 'fg-dim', 'accent', 'danger', 'ok', 'warn'] as const;
export const GROUND_TOKENS = ['bg', 'bg-raised'] as const;

export function readTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) if (name && value) tokens.set(name, value.toLowerCase());
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

if (process.argv[1]?.endsWith('contrast.ts')) {
  const tokens = readTokens(readFileSync(TOKENS_PATH, 'utf8'));
  const get = (name: string): string => {
    const value = tokens.get(name);
    if (!value) throw new Error(`no --${name} in ${TOKENS_PATH}`);
    return value;
  };
  console.log(`text token   ${GROUND_TOKENS.map((g) => `on --${g} (${get(g)})`.padEnd(26)).join('')}`);
  for (const text of TEXT_TOKENS) {
    console.log(`--${text.padEnd(10)} ${GROUND_TOKENS.map((g) => `${contrastRatio(get(text), get(g)).toFixed(2)} : 1`.padEnd(26)).join('')}`);
  }
  console.log(`--bg on --accent ${contrastRatio(get('bg'), get('accent')).toFixed(2)} : 1`);
  console.log(`--edge on --bg ${contrastRatio(get('edge'), get('bg')).toFixed(2)} : 1 (non-text, needs 3 : 1); on --bg-raised ${contrastRatio(get('edge'), get('bg-raised')).toFixed(2)} : 1`);
  console.log(`--rule on --bg ${contrastRatio(get('rule'), get('bg')).toFixed(2)} : 1 (decorative)`);
}
