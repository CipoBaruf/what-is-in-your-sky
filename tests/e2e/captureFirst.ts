import type { CaptureScreen } from './captureSet';

/**
 * R202 (FR-OPEN-11, D-1203): the first visit's screens of the capture set, beside `location` (the fallback): the
 * example, its wait, the question it opens and the example at noon at 390 × 844, each again at 360 × 640 as a
 * `-short` screen, and the example at 1024 and 1280. `captureSet.ts` spreads them after `location`. R203 (D-1205): the
 * pass, live and stars pages the example's doors open, at 390 and 1280.
 */
export const FIRST_VISIT: readonly CaptureScreen[] = [
  {
    name: 'location-short',
    widths: [360],
    height: 640,
    themes: ['dark'],
    what: 'The `location` screen at 360 × 640 (FR-OPEN-11, FR-FIRST-1): the question under the tagline on the short phone, at most the footer below the fold.',
  },
  {
    name: 'first-example',
    widths: [390, 1024, 1280],
    what: "The first visit in the zone `America/Argentina/Buenos_Aires` at the set's instant, a night (FR-OPEN-3, FR-OPEN-4, FR-OPEN-12, FR-OPEN-13): at 390 the tagline and the example band over the stacked page — the label, the next pass as the first card with its heights and brightness in words and the line saying what a pass looks like, tonight's stripe and `[ Not there? Set your place ]`, all above the fold; at 1024 and 1280 the populated page for Buenos Aires, the Where pane holding the label and the action, the When pane ending in the next event in words. No degree and no magnitude anywhere on the page.",
  },
  {
    name: 'first-example-short',
    widths: [360],
    height: 640,
    what: 'The `first-example` screen at 360 × 640 (FR-OPEN-3, FR-OPEN-11): the action still above the fold on the short phone.',
  },
  {
    name: 'first-wait',
    widths: [390],
    themes: ['dark'],
    what: "The example before its run is ready (FR-OPEN-4): the band's label, \"Finding tonight's passes over Buenos Aires…\" and the action, already live, the card and the stripe holding their height so nothing under the band moves when the run lands.",
  },
  {
    name: 'first-wait-short',
    widths: [360],
    height: 640,
    themes: ['dark'],
    what: 'The `first-wait` screen at 360 × 640 (FR-OPEN-4, FR-OPEN-11).',
  },
  {
    name: 'first-place',
    widths: [390],
    themes: ['dark'],
    what: 'The place question opened from the example by `[ Not there? Set your place ]` (FR-OPEN-5): one screen — `[ back ]` above the heading, the sentence and the boxed group — with the footer in its one-line form and no scroll.',
  },
  {
    name: 'first-place-short',
    widths: [360],
    height: 640,
    themes: ['dark'],
    what: 'The `first-place` screen at 360 × 640 (FR-OPEN-5, FR-OPEN-11): at most the footer below the fold.',
  },
  {
    name: 'first-noon',
    widths: [390],
    themes: ['dark'],
    what: 'The example opened at noon in its zone (FR-OPEN-14): under the card, "Satellites are only visible after dusk.", the card counting down to the evening\'s first pass and the stripe\'s day band under the present hour; the action still above the fold.',
  },
  // R203 (FR-OPEN-7, FR-OPEN-11; D-1205): the pages the example's doors open, each with its line.
  {
    name: 'first-pass',
    widths: [390, 1280],
    themes: ['dark'],
    what: "The example's next pass opened from the Satellites door (FR-OPEN-7): at 390 the pass page over the sky with `Example: Buenos Aires, from your time zone · [ set your place ]` under its head; at 1280 the pass page with the line under the header.",
  },
  {
    name: 'first-live',
    widths: [390, 1280],
    themes: ['dark'],
    what: "The live page — on a phone the sky screen — opened for the example from the Live sky door (FR-OPEN-7): the example's sky, the line under the head (390) or the header (1280), and no \"The live sky needs a place.\"",
  },
  {
    name: 'first-stars',
    widths: [390, 1280],
    themes: ['dark'],
    what: "The stars page opened for the example from the Stars door (FR-OPEN-7): Buenos Aires's sky, the line under the head (390) or the header (1280).",
  },
];
