/**
 * R62 (FR-FSC-3, FR-THEME-2; D-322): the follow screen's overlay surface, held
 * to the same bar as every other pair in `tokens.css` and by the same
 * arithmetic (R19/R20's `scripts/contrast.ts`, extended to both themes).
 *
 * The overlays are not a token pair, though: they are a *composite*. The
 * readout and the legend strip sit on `color-mix(in srgb, var(--bg-raised)
 * var(--follow-overlay-alpha), transparent)` over the drawing, so what their
 * text really lands on is that much raised surface over whatever the drawing
 * has there. The worst ground is the darkest of the chart's two base surfaces,
 * since a lighter one only lifts the composite away from the text; this test
 * composes the mix by hand from the token values and holds every text token
 * over it to FR-THEME-2's 4.5 : 1, in both themes.
 *
 * That is the half of FR-FSC-3 an alpha can be wrong about in a way a
 * screenshot would not show. The other half — the horizon and the arcs under
 * the strip staying readable — is what caps the alpha from above, and is the
 * owner's eye on R64's captures.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHART_SURFACE_TOKENS, contrastRatio, luminance, readTokens, TEXT_TOKENS, THEMES, TOKENS_PATH, type Theme } from '../../scripts/contrast';

const css = readFileSync(TOKENS_PATH, 'utf8');
const byTheme = new Map<Theme, Map<string, string>>(THEMES.map((theme) => [theme, readTokens(css, theme)] as const));

const token = (theme: Theme, name: string): string => {
  const value = byTheme.get(theme)?.get(name);
  if (!value) throw new Error(`no --${name} in the ${theme} theme`);
  return value;
};

/**
 * FR-FSC-3's 85 %, read off the stylesheet rather than repeated here, so the
 * test cannot pass an alpha the app does not use. It is an alpha and not a
 * colour, which is why it has one value for both themes and why `readTokens`
 * — which reads `#rrggbb` declarations — does not see it.
 */
const FOLLOW_OVERLAY_ALPHA = (() => {
  const match = /--follow-overlay-alpha:\s*(\d+(?:\.\d+)?)%\s*;/.exec(css);
  if (!match?.[1]) throw new Error(`no --follow-overlay-alpha in ${TOKENS_PATH}`);
  return Number(match[1]) / 100;
})();

/** `color-mix(in srgb, over <alpha>, transparent)` composited on `under`: srgb, channel by channel. */
function mix(over: string, under: string, alpha: number): string {
  const channels = (hex: string): [number, number, number] => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const [a, b] = [channels(over), channels(under)];
  const hex = (value: number): string => Math.round(value).toString(16).padStart(2, '0');
  return `#${a.map((value, index) => hex(value * alpha + (b[index] ?? 0) * (1 - alpha))).join('')}`;
}

/** The darkest of the chart's base surfaces — the worst ground the overlay can be composited over. */
function darkestSky(theme: Theme): string {
  const sorted = [...CHART_SURFACE_TOKENS].map((name) => token(theme, name)).sort((a, b) => luminance(a) - luminance(b));
  const darkest = sorted[0];
  if (darkest === undefined) throw new Error('no chart surface tokens to compose the overlay over');
  return darkest;
}

describe.each(THEMES)('the follow overlay (%s)', (theme) => {
  const composite = mix(token(theme, 'bg-raised'), darkestSky(theme), FOLLOW_OVERLAY_ALPHA);

  it('keeps every text token at ≥ 4.5 : 1 over the darkest sky token (FR-THEME-2)', () => {
    for (const text of TEXT_TOKENS) {
      expect(contrastRatio(token(theme, text), composite), `--${text} on the overlay over ${darkestSky(theme)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * The alpha is a compromise, so both ends of it are pinned. Below the floor
   * the drawing shows through the strip enough to take the dim rows under 4.5;
   * at 100 % the strip would be a panel and the horizon under it would be gone,
   * which is the half of FR-FSC-3 that has no number.
   */
  it('leaves the drawing visible through the overlay', () => {
    expect(FOLLOW_OVERLAY_ALPHA).toBeGreaterThan(0.5);
    expect(FOLLOW_OVERLAY_ALPHA).toBeLessThan(1);
  });
});

describe('the follow overlay token', () => {
  it('is one alpha for both themes, mixed with the surface each theme already sets', () => {
    // Not a colour: it has no per-theme value, and the theme tests' pair table does not see it.
    expect(byTheme.get('dark')?.has('follow-overlay-alpha')).toBe(false);
    expect(css).toContain('--follow-overlay-alpha: 85%;');
    const frame = readFileSync('src/ui/components/guide/skychart/ChartFrame.module.css', 'utf8');
    expect(frame).toContain('--follow-overlay: color-mix(in srgb, var(--bg-raised) var(--follow-overlay-alpha), transparent);');
  });
});
