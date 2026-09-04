/**
 * FR-DOME-2 / FR-THEME-3 (R21, D-75, PLAN §9.1 "Palette"): the palette names
 * exactly the chart tokens `tokens.css` defines, hard-codes no colour of its
 * own, resolves every meaning through the probe, and re-reads when the root's
 * `data-theme` changes.
 */
import { act, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CHART_MARK_TOKENS, CHART_SURFACE_TOKENS, readTokens, TOKENS_PATH } from '../../../../../../scripts/contrast';
import { CHART_TOKENS, MEANINGS, readPalette, useDomePalette, type DomeMeaning } from './palette';

const source = readFileSync('src/ui/components/guide/skychart/dome/palette.ts', 'utf8');
const css = readFileSync(TOKENS_PATH, 'utf8');

/** A probe carrying one theme's values inline, the way the stylesheet carries them in a browser. */
function paint(probe: HTMLElement, theme: 'dark' | 'night'): void {
  const tokens = readTokens(css, theme);
  for (const meaning of MEANINGS) probe.style.setProperty(CHART_TOKENS[meaning], tokens.get(CHART_TOKENS[meaning].slice(2)) ?? '');
}

function Harness() {
  const ref = useRef<HTMLSpanElement>(null);
  const palette = useDomePalette(ref);
  return (
    <>
      <span ref={ref} data-testid="probe" />
      <output data-testid="read">{palette === null ? 'none' : MEANINGS.map((meaning) => palette[meaning]).join(' ')}</output>
    </>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('dome palette', () => {
  it('names every FR-DOME-2 token tokens.css defines, and no others', () => {
    const declared = [...CHART_MARK_TOKENS, ...CHART_SURFACE_TOKENS].map((name) => `--${name}`).sort();
    expect([...MEANINGS].map((meaning) => CHART_TOKENS[meaning]).sort()).toEqual(declared);
  });

  it('hard-codes no colour (D-75: the tokens are the only source)', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|hsl|oklch)a?\(/);
  });

  it('resolves every meaning from the probe, and gives no partial palette', () => {
    const probe = document.createElement('span');
    document.body.append(probe);
    expect(readPalette(probe)).toBeNull();
    expect(readPalette(null)).toBeNull();
    paint(probe, 'dark');
    const dark = readPalette(probe);
    expect(dark).not.toBeNull();
    for (const meaning of MEANINGS) expect(dark?.[meaning], meaning).toMatch(/^#[0-9a-f]{6}$/i);
    probe.style.removeProperty(CHART_TOKENS['moon']);
    expect(readPalette(probe)).toBeNull();
    probe.remove();
  });

  it('reads the palette at mount and again on a data-theme change (FR-THEME-1)', async () => {
    const { getByTestId } = render(<Harness />);
    const probe = getByTestId('probe');
    const read = () => getByTestId('read').textContent;
    expect(read()).toBe('none');

    paint(probe, 'dark');
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    const dark = readTokens(css, 'dark');
    expect(read()).toBe(MEANINGS.map((meaning: DomeMeaning) => dark.get(CHART_TOKENS[meaning].slice(2))).join(' '));

    paint(probe, 'night');
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'night');
    });
    const night = readTokens(css, 'night');
    expect(read()).toBe(MEANINGS.map((meaning: DomeMeaning) => night.get(CHART_TOKENS[meaning].slice(2))).join(' '));
    expect(read()).not.toBe(MEANINGS.map((meaning: DomeMeaning) => dark.get(CHART_TOKENS[meaning].slice(2))).join(' '));
  });
});
