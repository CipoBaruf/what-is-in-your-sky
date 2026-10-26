/**
 * R124 (FR-SKY-5, D-818): the braille raster read as dots. A cell in the
 * braille block (U+2800..U+28FF) carries one bit per raised dot, so a raster's
 * dots are the bits of its cells. `SkyDome.raster.test.tsx` counts the dots
 * the stars add and `dome-perf.spec.ts` logs the line layer's count, so both
 * read the raster through this one module.
 */
const BRAILLE_BLANK = 0x2800;
const BRAILLE_LAST = 0x28ff;

/** The cell's dot bits, or 0 for anything outside the braille block. */
export function brailleBits(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  return code >= BRAILLE_BLANK && code <= BRAILLE_LAST ? code - BRAILLE_BLANK : 0;
}

/** How many dots one cell's bits raise. */
export function bitCount(bits: number): number {
  let dots = 0;
  for (let rest = bits; rest; rest >>= 1) dots += rest & 1;
  return dots;
}

/** How many braille dots a raster carries: the bits of every cell in the braille block. */
export function brailleDots(text: string): number {
  let dots = 0;
  for (const ch of text) dots += bitCount(brailleBits(ch));
  return dots;
}
