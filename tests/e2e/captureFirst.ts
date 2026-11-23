import type { CaptureScreen } from './captureSet';

/**
 * R203 (FR-OPEN-7, D-1205): the example's pages of the capture set — the pass, live and stars pages for the example,
 * at 390 and 1280. R212 (FR-LAND-1, D-1245): the home's first-visit screens left with the home; these are opened by
 * address now. `captureSet.ts` spreads them first.
 */
export const FIRST_VISIT: readonly CaptureScreen[] = [
  {
    name: 'first-pass',
    widths: [390, 1280],
    themes: ['dark'],
    what: "The example's next pass opened at `#pass` (FR-OPEN-7, FR-LAND-6): at 390 the pass page over the sky with `Example: Buenos Aires, from your time zone · [ set your place ]` under its head; at 1280 the pass page with the line under the header.",
  },
  {
    name: 'first-live',
    widths: [390, 1280],
    themes: ['dark'],
    what: "The live page — on a phone the sky screen — opened for the example at `/` (FR-OPEN-7, FR-LAND-1): the example's sky, the line under the head (390) or the header (1280), and no \"The live sky needs a place.\"",
  },
  {
    name: 'first-stars',
    widths: [390, 1280],
    themes: ['dark'],
    what: "The stars page opened for the example at `#stars` (FR-OPEN-7): Buenos Aires's sky, the line under the head (390) or the header (1280).",
  },
];
