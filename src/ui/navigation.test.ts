/**
 * R92 (FR-ROUTE-1, FR-A11Y-4; D-532, D-533; F-91): what the app pushes it pops, and the focus goes back to
 * what opened the route. jsdom traverses the history a task later, as a browser does, hence the waits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRoute, close, depth, isRouteHref, open, resetNavigation, subscribe, takeFocusTarget } from './navigation';

// Every traversal here lands on home; waiting for it rather than for a fixed time keeps a loaded run honest.
const settle = (): Promise<void> =>
  vi.waitFor(() => {
    expect(window.location.hash).toBe('');
  });

let unsubscribe: () => void = () => undefined;

beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname);
  resetNavigation();
  unsubscribe = subscribe(() => undefined);
});

afterEach(() => {
  unsubscribe();
  document.body.innerHTML = '';
});

describe('navigation (D-533)', () => {
  it('marks what it opens and goes back past it on close, so open-and-close leaves the history as it was', async () => {
    const start = window.history.length;
    open('#settings');
    expect(window.location.hash).toBe('#settings');
    expect(depth()).toBe(1);
    const afterFirstOpen = window.history.length;
    close();
    await settle();
    expect(window.location.hash).toBe('');
    expect(depth()).toBe(0);
    for (const hash of ['#pass=25544-1', '#pass=25544-2', '#live', '#settings']) {
      open(hash);
      close();
      await settle();
    }
    // The one forward entry the first Back left is re-used by every later open: no net growth.
    expect(window.history.length).toBe(afterFirstOpen);
    expect(afterFirstOpen).toBe(start + 1);
    expect(window.location.hash).toBe('');
  });

  it('replaces in place when the route was the load entry (a bookmark, a link), and tells the subscribers', () => {
    window.history.replaceState(null, '', '#live');
    const heard = vi.fn();
    const off = subscribe(heard);
    const entries = window.history.length;
    close();
    off();
    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(entries);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('opens a pass over an open pass in its entry, so closing it is one step back', async () => {
    open('#pass=25544-1');
    open('#pass=25544-2');
    expect(depth()).toBe(1);
    close();
    await settle();
    expect(window.location.hash).toBe('');
  });

  it('clearRoute leaves the state as it is and changes no entry', () => {
    const heard = vi.fn();
    const off = subscribe(heard);
    clearRoute();
    off();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('');
  });

  it('takes only the app routes from the browser', () => {
    expect(isRouteHref('#live')).toBe(true);
    expect(isRouteHref('#settings')).toBe(true);
    expect(isRouteHref('#pass=25544-1')).toBe(true);
    expect(isRouteHref('#coords-field')).toBe(false);
    expect(isRouteHref('#')).toBe(false);
    expect(isRouteHref('https://celestrak.org/')).toBe(false);
  });
});

describe('the focus after a route is left (D-532)', () => {
  it('is the opener while it is in the document', async () => {
    const button = document.body.appendChild(document.createElement('button'));
    open('#settings', button);
    expect(takeFocusTarget()).toBeNull();
    close();
    await settle();
    expect(takeFocusTarget()).toBe(button);
    // Once: a second ask without a route change has nothing to say.
    expect(takeFocusTarget()).toBeNull();
  });

  it('is the same control re-rendered when the opener left with its page, found by its test id', async () => {
    const link = document.body.appendChild(document.createElement('a'));
    link.dataset.testid = 'live-link';
    open('#live', link);
    link.remove();
    const again = document.body.appendChild(document.createElement('a'));
    again.dataset.testid = 'live-link';
    close();
    await settle();
    expect(takeFocusTarget()).toBe(again);
  });

  it('is the h1 when the opener is gone, and when the route was the load entry', async () => {
    const h1 = document.body.appendChild(document.createElement('h1'));
    open('#live', document.body.appendChild(document.createElement('button')));
    document.body.querySelector('button')?.remove();
    close();
    await settle();
    expect(takeFocusTarget()).toBe(h1);
    window.history.replaceState(null, '', '#settings');
    close();
    expect(takeFocusTarget()).toBe(h1);
  });

  it('follows the browser Back as well as the page control', async () => {
    const button = document.body.appendChild(document.createElement('button'));
    open('#settings', button);
    window.history.back();
    await settle();
    expect(takeFocusTarget()).toBe(button);
  });
});
