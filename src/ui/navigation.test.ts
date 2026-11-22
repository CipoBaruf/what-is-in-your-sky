/**
 * R92 (FR-ROUTE-1, FR-A11Y-4; D-532, D-533; F-91): what the app pushes it pops, and the focus goes back to
 * what opened the route. jsdom traverses the history a task later, as a browser does, hence the waits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { close, depth, isRouteHref, landRoute, open, replace, resetNavigation, subscribe, takeFocusTarget } from './navigation';

// Every traversal here lands on the load's entry; waiting for it rather than for a fixed time keeps a loaded run honest.
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
    window.history.replaceState(null, '', '#settings');
    const heard = vi.fn();
    const off = subscribe(heard);
    const entries = window.history.length;
    close();
    off();
    expect(window.location.hash).toBe('#live');
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

  it('replace turns a bare #pass into a pass in its entry, tells the subscribers, and keeps the opener (D-1134, V214-35)', async () => {
    const link = document.body.appendChild(document.createElement('a'));
    open('#pass', link);
    const entries = window.history.length;
    const heard = vi.fn();
    const off = subscribe(heard);
    replace('#pass=25544-1');
    off();
    expect(window.location.hash).toBe('#pass=25544-1');
    expect(window.history.length).toBe(entries);
    expect(depth()).toBe(1);
    expect(heard).toHaveBeenCalledTimes(1);
    replace('#pass=25544-1');
    expect(heard).toHaveBeenCalledTimes(1);
    close();
    await settle();
    expect(takeFocusTarget()).toBe(link);
  });

  it('FR-LAND-1: landRoute writes #live over a hash that names no route, in its entry, keeping its state, and tells nobody', () => {
    for (const hash of ['', '#', '#nope', '#live?lat=999', '#pass?lat=999']) {
      window.history.replaceState({ wiys: 2 }, '', `${window.location.pathname}${hash}`);
      const entries = window.history.length;
      const heard = vi.fn();
      const off = subscribe(heard);
      landRoute();
      off();
      expect(window.location.hash, hash).toBe('#live');
      expect(depth(), hash).toBe(2);
      expect(window.history.length, hash).toBe(entries);
      expect(heard, hash).not.toHaveBeenCalled();
    }
    window.history.replaceState(null, '', '#settings');
    landRoute();
    expect(window.location.hash).toBe('#settings');
  });

  it('FR-LAND-1: the live page as the load entry has nowhere to close to', () => {
    const link = '#live?lat=51.5&lon=-0.12&alt=0';
    window.history.replaceState(null, '', link);
    close();
    expect(window.location.hash).toBe(link);
  });

  it('D-1231: a pass stacked on the list closes to it, and one that was the load entry to the hash it is given', async () => {
    open('#pass');
    open('#pass=25544-1', null, { stack: true });
    expect(depth()).toBe(2);
    close();
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('#pass');
    });
    window.history.replaceState(null, '', '#pass=25544-1');
    close('#pass');
    expect(window.location.hash).toBe('#pass');
  });

  it('takes only the app routes from the browser', () => {
    expect(isRouteHref('#live')).toBe(true);
    expect(isRouteHref('#settings')).toBe(true);
    expect(isRouteHref('#stars')).toBe(true);
    expect(isRouteHref('#pass=25544-1')).toBe(true);
    // v2.14.1 (D-1134): the pass page with no pass, `[ satellites ]` with none in the span.
    expect(isRouteHref('#pass')).toBe(true);
    expect(isRouteHref('#coords-field')).toBe(false);
    expect(isRouteHref('#')).toBe(false);
    expect(isRouteHref('https://celestrak.org/')).toBe(false);
  });
});

it('opens a pass from the pass page with no pass in its entry, not on top of it (D-1134, D-1135)', () => {
  resetNavigation();
  open('#pass');
  const at = depth();
  open('#pass=25544-1');
  expect(depth()).toBe(at);
  expect(window.location.hash).toBe('#pass=25544-1');
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
