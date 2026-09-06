/**
 * R54 (FR-TRAJ-5, FR-LIVE-7 as amended v1.1.1, D-268): whether the page has
 * touch. The stepping row under the stripe is for fingers — the spike chose
 * its six buttons for a thumb on a phone (OQ-18) — and a pointer has the
 * arrow keys (FR-LIVE-4), so the row is drawn only where a touch is possible.
 * `maxTouchPoints` is the one signal every engine agrees on; Playwright's
 * `hasTouch` sets it too.
 */
export function pageHasTouch(nav: Pick<Navigator, 'maxTouchPoints'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return nav !== undefined && (nav.maxTouchPoints ?? 0) > 0;
}
