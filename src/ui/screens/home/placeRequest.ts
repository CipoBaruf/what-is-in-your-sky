/**
 * R87 (FR-FIRST-1 as amended v2.1, F-75): the home page's receiving side of
 * `[ set a place ]`. The live page with no observer draws the control (R89)
 * and calls `requestPlace()`, which marks the request and goes home the way
 * `leaveLive` does — in place, with the `hashchange` every hash subscriber
 * reads. The home page reads the mark as it mounts (`Home`), opens the where
 * step, and puts the focus in the input group. The mark is this module's, not
 * the store's and not the URL's: it is one navigation's intent and nothing
 * else reads it. What Back does after it is R92's.
 */
let requested = false;

export function requestPlace(): void {
  requested = true;
  if (window.location.hash !== '') {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Whether the page is being opened to set a place. */
export function placeRequested(): boolean {
  return requested;
}

/** Spent once the home page has read it, so a later visit to home is an ordinary one. */
export function clearPlaceRequest(): void {
  requested = false;
}
