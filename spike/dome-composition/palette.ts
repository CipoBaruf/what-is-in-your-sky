/**
 * R16 (FR-DOME-2): candidate colour maps, one value per meaning per theme.
 *
 * The spike hard-codes hex values on purpose — its output is the list of
 * values R20 puts in `tokens.css` and R21 reads back through the probe
 * element (D-75). Nothing here ships.
 *
 * `mono` is the R15 reading (two greys) and is the control: every candidate
 * has to beat it to be worth the colour work. `night` follows FR-THEME-3 — no
 * element keeps a non-red hue.
 */

/** One colour per FR-DOME-2 meaning, plus the two base-layer surfaces. */
export interface DomePalette {
  /** The highlighted pass's arc. */
  highlighted: string;
  /** The part of the highlighted arc already flown (FR-DOME-5). */
  flown: string;
  /** Every other pass. */
  dim: string;
  peak: string;
  shadow: string;
  now: string;
  horizon: string;
  rings: string;
  compass: string;
  sun: string;
  moon: string;
  /** Base layer: the ground disc below the horizon and the sky bowl above it. */
  ground: string;
  sky: string;
  /** Page ground and default text, so the captures match the product's frame. */
  bg: string;
  fg: string;
}

const DARK_BG = '#0b0f14';
const NIGHT_BG = '#0a0202';

export const PALETTES: Record<string, Record<string, DomePalette>> = {
  cool: {
    dark: {
      highlighted: '#9ad0ff',
      flown: '#5f9fd0',
      dim: '#7d8794',
      peak: '#f0c674',
      shadow: '#ff8a80',
      now: '#ffffff',
      horizon: '#a7b1bf',
      rings: '#606c7a',
      compass: '#d5dbe3',
      sun: '#f0a94a',
      moon: '#e8e2d0',
      ground: '#161c24',
      sky: '#1d2733',
      bg: DARK_BG,
      fg: '#d5dbe3',
    },
    night: {
      highlighted: '#ff6a55',
      flown: '#c04a3a',
      dim: '#a3453a',
      peak: '#ff9c86',
      shadow: '#d95a48',
      now: '#ffd8cd',
      horizon: '#c05545',
      rings: '#8a3a2e',
      compass: '#ff8f7d',
      sun: '#ff7a52',
      moon: '#ffb3a0',
      ground: '#160505',
      sky: '#1e0908',
      bg: NIGHT_BG,
      fg: '#ff8f7d',
    },
  },
  warm: {
    dark: {
      highlighted: '#ffd479',
      flown: '#c79a3f',
      dim: '#8f8a7d',
      peak: '#8fd694',
      shadow: '#ff8a80',
      now: '#fffaf0',
      horizon: '#b5ab96',
      rings: '#6f6857',
      compass: '#e8e2d0',
      sun: '#ffb454',
      moon: '#dfe6f0',
      ground: '#1a1710',
      sky: '#231e14',
      bg: DARK_BG,
      fg: '#e8e2d0',
    },
    night: {
      highlighted: '#ff7a4d',
      flown: '#c25a33',
      dim: '#a04a33',
      peak: '#ffab84',
      shadow: '#d9604a',
      now: '#ffe0cf',
      horizon: '#c46046',
      rings: '#8c4230',
      compass: '#ff9b7a',
      sun: '#ff8a4d',
      moon: '#ffc0a3',
      ground: '#160705',
      sky: '#1e0a07',
      bg: NIGHT_BG,
      fg: '#ff9b7a',
    },
  },
  mono: {
    dark: {
      highlighted: '#d5dbe3',
      flown: '#d5dbe3',
      dim: '#7d8794',
      peak: '#d5dbe3',
      shadow: '#d5dbe3',
      now: '#ffffff',
      horizon: '#d5dbe3',
      rings: '#7d8794',
      compass: '#d5dbe3',
      sun: '#d5dbe3',
      moon: '#d5dbe3',
      ground: '#161c24',
      sky: '#1d2733',
      bg: DARK_BG,
      fg: '#d5dbe3',
    },
    night: {
      highlighted: '#ff8f7d',
      flown: '#ff8f7d',
      dim: '#a3453a',
      peak: '#ff8f7d',
      shadow: '#ff8f7d',
      now: '#ffd8cd',
      horizon: '#ff8f7d',
      rings: '#a3453a',
      compass: '#ff8f7d',
      sun: '#ff8f7d',
      moon: '#ff8f7d',
      ground: '#160505',
      sky: '#1e0908',
      bg: NIGHT_BG,
      fg: '#ff8f7d',
    },
  },
};

/** The meanings a candidate has to name (FR-DOME-2), in the order the findings table prints them. */
export const MEANINGS: readonly (keyof DomePalette)[] = ['highlighted', 'flown', 'dim', 'peak', 'shadow', 'now', 'horizon', 'rings', 'compass', 'sun', 'moon', 'ground', 'sky'];

export function paletteFor(set: string, theme: string): DomePalette {
  const bySet = PALETTES[set] ?? PALETTES['cool'];
  const palette = bySet?.[theme] ?? bySet?.['dark'];
  if (!palette) throw new Error(`no palette for ${set}/${theme}`);
  return palette;
}
