/**
 * R23 (FR-DESK-1, D-71): the one place that says where compact ends and wide
 * begins.
 *
 * FR-DESK-1 states the breakpoint in cells — wide at 100 cells of viewport
 * width — but a media query cannot read `var(--cell)`, so the CSS carries the
 * literal and `tests/styles/breakpoint.test.ts` recomputes it from
 * `tokens.css` (`--cell: 1ch`, a 0.6 em advance) and `global.css` (the 16 px
 * base): 100 × 0.6 × 16 = 960. That test asserts every `min-width` in
 * `src/ui` and the constant below are that one number, so the stylesheet and
 * the hook cannot drift apart.
 *
 * The hook itself is `ui/hooks/useLayoutMode.ts`, not this file: PLAN §3
 * forbids React in `src/lib` (D-116).
 */
export const WIDE_CELLS = 100;
export const WIDE_MIN_PX = 960;
export const WIDE_QUERY = `(min-width: ${String(WIDE_MIN_PX)}px)`;

export type LayoutMode = 'compact' | 'wide';

/** Which shell a `matchMedia(WIDE_QUERY)` result means (D-72). */
export function layoutMode(matchesWide: boolean): LayoutMode {
  return matchesWide ? 'wide' : 'compact';
}
