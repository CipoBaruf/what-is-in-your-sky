import type { PageKeyId } from '../../lib/shortcuts';

/**
 * FR-I18N-2, FR-STAR-10 (R115, D-756, D-777): the stars page's words that the
 * main chunk draws. R222 (D-1240): the page is gone with its name and its
 * loading line; the `?` overlay's block for the focused box's keys stays. The
 * words only the page draws are `starsPage.ts`, which the `stars` chunk
 * carries, so the main chunk grows by the route and the link (FR-STAR-9).
 */
export const stars = {
  stars: {
    /** FR-DESK-4 as amended v2.4: the `?` overlay's block for the page's four keys. */
    keysHeading: 'With the sky focused',
    keys: {
      starsTurn: 'Turn the sky, with the drawing focused',
      starsTilt: 'Tilt it up or down',
      /* R189 (FR-WIDE-9): the zoom and the reset of FR-SKY-14 and FR-GLOBE-6. */
      boxZoom: 'Zoom in or out (globe, window)',
      boxReset: 'Back to the opening field (0) or view (Home)',
    } satisfies Record<PageKeyId, string>,
  },
};
