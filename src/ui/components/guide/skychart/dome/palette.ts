import { useEffect, useState, type RefObject } from 'react';

/**
 * FR-DOME-2 / FR-THEME-3 (R21, D-75): one colour per meaning, read from the
 * `--chart-*` tokens through a hidden probe element rather than repeated in
 * TypeScript — the tokens (R20, from the R16 spike) are the single source of
 * both themes, so the night theme is a token swap and nothing here has to
 * change. glyphcss needs a concrete colour string per polygon, so the values
 * are resolved with `getComputedStyle` at mount and again whenever the root's
 * `data-theme` attribute changes.
 *
 * Where no stylesheet is in force — jsdom, or a browser that has not applied
 * the chart chunk's CSS yet — `readPalette` returns `null` and the dome keeps
 * R15's monochrome reading (`useColors={false}`), which FR-X-5 requires to
 * stay legible anyway. No hex value appears in this file.
 */

/** The FR-DOME-2 meanings, each with the token that carries it in both themes. */
export const CHART_TOKENS = {
  highlighted: '--chart-pass',
  flown: '--chart-pass-flown',
  dim: '--chart-pass-dim',
  peak: '--chart-peak',
  shadow: '--chart-shadow',
  now: '--chart-now',
  horizon: '--chart-horizon',
  rings: '--chart-rings',
  compass: '--chart-compass',
  sun: '--chart-sun',
  moon: '--chart-moon',
  ground: '--chart-ground',
  sky: '--chart-sky',
} as const;

export type DomeMeaning = keyof typeof CHART_TOKENS;
export type DomePalette = Record<DomeMeaning, string>;

export const MEANINGS = Object.keys(CHART_TOKENS) as readonly DomeMeaning[];

/**
 * The palette in force on `probe`, or `null` if any meaning has no value —
 * a partial palette would colour half the drawing and leave the rest in the
 * page's foreground, which reads worse than no colour at all.
 */
export function readPalette(probe: Element | null): DomePalette | null {
  const view = probe?.ownerDocument.defaultView;
  if (!probe || !view) return null;
  const style = view.getComputedStyle(probe);
  const palette: Partial<DomePalette> = {};
  for (const meaning of MEANINGS) {
    const value = style.getPropertyValue(CHART_TOKENS[meaning]).trim();
    if (!value) return null;
    palette[meaning] = value;
  }
  return palette as DomePalette;
}

const same = (a: DomePalette | null, b: DomePalette | null): boolean =>
  a === b || (a !== null && b !== null && MEANINGS.every((meaning) => a[meaning] === b[meaning]));

/**
 * The palette of the theme in force, re-read when the root's `data-theme`
 * changes (FR-THEME-1 switches it in place, so no component remounts). The
 * probe is an element the caller renders inside the chart, so a theme scoped
 * to a container would be picked up as well as one on the root.
 */
export function useDomePalette(probeRef: RefObject<Element | null>): DomePalette | null {
  const [palette, setPalette] = useState<DomePalette | null>(null);
  useEffect(() => {
    const read = (): void => {
      const next = readPalette(probeRef.current);
      setPalette((previous) => (same(previous, next) ? previous : next));
    };
    read();
    const root = probeRef.current?.ownerDocument.documentElement;
    if (!root || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      observer.disconnect();
    };
  }, [probeRef]);
  return palette;
}
