/**
 * R83 (D-538): `endVisit` clears the link from the URL. In place — no history
 * entry — and with the `hashchange` that `replaceState` does not dispatch, so
 * every hash subscriber (the pass selection, the live and settings routes) sees
 * the home page at once, the way `leaveLive` and `leaveSettings` do it.
 */
export function clearLocationHash(): void {
  if (typeof window === 'undefined') return;
  if (window.location.hash !== '') {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
