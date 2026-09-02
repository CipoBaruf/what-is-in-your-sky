/**
 * R12 (FR-X-5, FR-X-1): every text token on every ground token in
 * `tokens.css` reaches WCAG AA (4.5 : 1), the control edge reaches 3 : 1 on
 * the ground, and the ratio table in the file's header comment is the one
 * `scripts/contrast.ts` computes, so the documented numbers cannot drift from
 * the colours.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, GROUND_TOKENS, readTokens, TEXT_TOKENS, TOKENS_PATH } from '../../scripts/contrast';

const css = readFileSync(TOKENS_PATH, 'utf8');
const tokens = readTokens(css);
const token = (name: string): string => {
  const value = tokens.get(name);
  if (!value) throw new Error(`no --${name}`);
  return value;
};

describe('tokens.css contrast', () => {
  it('has every text token at ≥ 4.5 : 1 on both grounds, and the ground at ≥ 4.5 : 1 on the accent', () => {
    for (const text of TEXT_TOKENS) for (const ground of GROUND_TOKENS) expect(contrastRatio(token(text), token(ground)), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token('bg'), token('accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it('has the control edge at ≥ 3 : 1 on the ground (WCAG 1.4.11)', () => {
    expect(contrastRatio(token('edge'), token('bg'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(token('edge'), token('bg-raised'))).toBeGreaterThanOrEqual(3);
  });

  it('documents the computed ratios in its header comment', () => {
    for (const text of TEXT_TOKENS) {
      const line = new RegExp(`--${text}\\s+([\\d.]+) : 1\\s+([\\d.]+) : 1`).exec(css);
      expect(line, `no table row for --${text}`).not.toBeNull();
      expect(line?.[1]).toBe(contrastRatio(token(text), token('bg')).toFixed(2));
      expect(line?.[2]).toBe(contrastRatio(token(text), token('bg-raised')).toFixed(2));
    }
    expect(css).toContain(`--bg on --accent (pressed sort button)   ${contrastRatio(token('bg'), token('accent')).toFixed(2)} : 1`);
    expect(css).toContain(`${contrastRatio(token('edge'), token('bg')).toFixed(2)} : 1 on \`--bg\` (${contrastRatio(token('edge'), token('bg-raised')).toFixed(2)} : 1 on \`--bg-raised\`)`);
    expect(css).toContain(`\`--rule\` (${contrastRatio(token('rule'), token('bg')).toFixed(2)} : 1)`);
  });
});
