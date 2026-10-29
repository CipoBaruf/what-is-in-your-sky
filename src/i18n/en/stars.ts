import type { PageKeyId } from '../../lib/shortcuts';

/**
 * FR-I18N-2, FR-STAR-10 (R115, D-756, D-777): the stars page's words that the
 * main chunk draws — the header's link, the page's name, the When pane's way
 * in, the line while the chunk is on its way, the `?` overlay's block. The
 * words only the page draws are `starsPage.ts`, which the `stars` chunk
 * carries, so the main chunk grows by the route and the link (FR-STAR-9).
 */
export const stars = {
  stars: {
    /** FR-A11Y-1, FR-A11Y-3: the page's `h1` and the tab's route name, "Stars · …". */
    heading: 'Stars',
    /** While the `stars` chunk is on its way. */
    loading: 'Loading the stars…',
    /** FR-DESK-4 as amended v2.4: the `?` overlay's block for the page's four keys. */
    keysHeading: 'On the stars page',
    keys: {
      starsTurn: 'Turn the sky, with the drawing focused',
      starsTilt: 'Tilt it up or down',
    } satisfies Record<PageKeyId, string>,
  },
};
