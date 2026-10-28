/**
 * R134 (FR-FLOW-11, D-871): the rules of `.target` and `.target-row` that a
 * jsdom render cannot see — which floors weigh nothing, the prefix's cell in a
 * dense row, and the width floor and the stretch being compact's.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/styles/primitives.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const wideAt = css.indexOf('@media (width >= 964px)');
const compact = wideAt < 0 ? css : css.slice(0, wideAt);
const wide = wideAt < 0 ? '' : css.slice(wideAt);

/** The declarations of the rule whose selector is exactly `selector`, in `text`. */
function rule(text: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? '';
}

describe('primitives.css targets (R134, FR-FLOW-11, D-871)', () => {
  it('writes the floors under :where(), so a button keeps its 48 px --tap and a min-width: 0 still shrinks', () => {
    expect(rule(compact, ':where(.target)')).toMatch(/min-block-size:\s*var\(--target\)/);
    expect(rule(compact, ':where(.target-row > [data-option])')).toMatch(/min-block-size:\s*var\(--target\)/);
    expect(rule(compact, '.target')).not.toMatch(/min-block-size|min-inline-size/);
    expect(rule(compact, '.target-row > [data-option]')).not.toMatch(/min-block-size/);
  });

  it('keeps one cell between a dense row’s prefix and its first point', () => {
    expect(rule(compact, '.target-row > [data-option]')).toMatch(/padding-inline:\s*calc\(var\(--cell\) \/ 2\)/);
    expect(rule(compact, '.target-row > [data-option]:first-child')).toMatch(/padding-inline-start:\s*0/);
    expect(rule(compact, '.target-row > :not([data-option]) + [data-option]')).toMatch(/padding-inline-start:\s*var\(--cell\)/);
  });

  it('holds the width floor and the stretch to compact', () => {
    expect(rule(compact, ':where(.target)')).toMatch(/min-inline-size:\s*var\(--target\)/);
    expect(rule(compact, '.target-row > [data-option]')).toMatch(/flex:\s*1 1 auto/);
    expect(rule(wide, ':where(.target)')).toMatch(/min-inline-size:\s*auto/);
    expect(rule(wide, '.target-row > [data-option]')).toMatch(/flex:\s*0 1 auto/);
  });

  it('is the one place the 44 px floor is written: TextButton’s .toggle reads --target', () => {
    const textButton = readFileSync('src/ui/components/primitives/TextButton.module.css', 'utf8');
    expect(rule(textButton, '.toggle')).toMatch(/min-inline-size:\s*var\(--target\)/);
    expect(textButton).not.toMatch(/calc\(var\(--tap\) - var\(--row\) \/ 6\)/);
  });
});
