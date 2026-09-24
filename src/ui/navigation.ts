import { useSyncExternalStore } from 'react';
import { isLiveRoute, isSettingsRoute, parseHash } from '../lib/shareLinks';

/**
 * R92 (FR-ROUTE-1..3, FR-A11Y-4; D-532, D-533; F-91): the one place the app
 * writes the history. There is still no router (D-13) — the hash is the route —
 * but opening and closing a route used to be two different history operations:
 * opening pushed an entry, closing replaced it with home, so every visit left a
 * second home entry behind and the browser's Back did nothing once per visit.
 *
 * **What the app pushed, it pops.** `open` pushes with `history.state =
 * { wiys: depth }`, one more than the entry it was opened from. `close` calls
 * `history.back()` when the entry carries that marker, and replaces the state
 * only when it does not — the load's own entry, a bookmark or a link, where
 * there is nothing of this session's behind it to go back to.
 *
 * **Focus returns to the opener.** `open` records the element that opened the
 * route (the focused element when none is named). When a route is left — by
 * the page's own control or by the browser's Back — the shell asks
 * `takeFocusTarget` where the focus goes: the opener if it is still in the
 * document, the same control re-rendered (a header that was unmounted with its
 * page, found again by its `data-testid` or `id`), or the page's `h1`.
 *
 * **One listener.** `subscribe` installs one `popstate` and one `hashchange`
 * listener on the window for every subscriber — the three route hooks and the
 * shell — and records which openers a traversal went back past before any of
 * them hears of it.
 */

/** The marker on an entry this session pushed. */
interface WiysState {
  wiys: number;
}

interface Opener {
  element: HTMLElement | null;
  /** How to find the same control once its element is gone: its test id or its id. */
  key: string | null;
}

/** `openers[i]` opened the entry at depth `i + 1`. */
const openers: Opener[] = [];
/** Where the focus goes after the route the reader just left; `undefined` when nothing was left. */
let pending: Opener | 'h1' | undefined;

const listeners = new Set<(event: Event) => void>();

/** The depth of the current entry: 0 for one the app did not push. */
export function depth(): number {
  const state: unknown = window.history.state;
  if (typeof state === 'object' && state !== null && typeof (state as Partial<WiysState>).wiys === 'number') return (state as WiysState).wiys;
  return 0;
}

function keyOf(element: HTMLElement): string | null {
  return element.dataset.testid ?? (element.id === '' ? null : element.id);
}

function focusedElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

function path(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function emit(event: Event): void {
  // A traversal back past entries this session pushed: the reader left those routes, and the focus goes
  // to what opened the shallowest of them.
  //
  // The openers are not truncated here. Forward re-enters a pushed entry without going through `open()`, so
  // trimming on the way back would leave `openers` permanently shorter than `depth()` and every later Back
  // from that entry would restore no focus at all (FR-A11Y-4). `openers[i]` belongs to depth `i + 1` whether
  // the reader arrived by opening or by going forward, and `open()` already drops the stale tail when it
  // pushes a new entry over a forward one.
  const d = depth();
  if (openers.length > d) pending = openers[d];
  for (const listener of listeners) listener(event);
}

/** `replaceState` and `pushState` fire nothing; every hash subscriber is told the way a real change tells it. */
function announce(): void {
  const event = new HashChangeEvent('hashchange');
  window.dispatchEvent(event);
}

export function subscribe(listener: (event: Event) => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('popstate', emit);
    window.addEventListener('hashchange', emit);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('popstate', emit);
      window.removeEventListener('hashchange', emit);
    }
  };
}

const hashNow = (): string => window.location.hash;
const noHash = (): string => '';

/** The current hash, re-rendering on every route change. The first render already knows its route. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, hashNow, noHash);
}

/**
 * Opens a route as a history entry of this session's own, remembering what opened it.
 *
 * A pass opened while another is open — a card in the list beside the wide guide, `j` and `Enter` — takes the
 * open pass's entry rather than stacking on it: closing the guide is leaving the pass route, and it would
 * otherwise go back to the pass before, and the one before that, before it reached the list.
 */
export function open(hash: string, opener: HTMLElement | null = focusedElement()): void {
  if (window.location.hash === hash) return;
  if (isPassHash(window.location.hash) && isPassHash(hash)) {
    // The entry is the new pass's now, and so is what the focus goes back to (F-8).
    const d = depth();
    if (d > 0 && openers.length >= d) openers[d - 1] = { element: opener, key: opener ? keyOf(opener) : null };
    window.history.replaceState(window.history.state, '', hash);
    announce();
    return;
  }
  const next = depth() + 1;
  openers.length = next - 1;
  openers[next - 1] = { element: opener, key: opener ? keyOf(opener) : null };
  window.history.pushState({ wiys: next } satisfies WiysState, '', hash);
  announce();
}

/** Leaves the current route: back to the entry it was opened from, or home in place when it was the load's. */
export function close(): void {
  if (window.location.hash === '') return;
  if (depth() > 0) {
    window.history.back();
    return;
  }
  pending = 'h1';
  clearRoute();
}

/** Home, in place: no history entry, the state kept. For a hash that names no route the app can draw (FR-VISIT-4). */
export function clearRoute(): void {
  if (window.location.hash !== '') window.history.replaceState(window.history.state, '', path());
  announce();
}

/** Where the focus goes now that a route was left, once; `null` when no route was left since the last ask. */
export function takeFocusTarget(): HTMLElement | null {
  const target = pending;
  pending = undefined;
  if (target === undefined) return null;
  if (target !== 'h1') {
    if (target.element?.isConnected) return target.element;
    if (target.key !== null) {
      const again = document.querySelectorAll<HTMLElement>(`[data-testid="${CSS.escape(target.key)}"], [id="${CSS.escape(target.key)}"]`);
      if (again.length === 1 && again[0]) return again[0];
    }
  }
  return document.querySelector<HTMLElement>('h1');
}

/** A same-document link to one of the app's routes, which `open` takes instead of the browser (so its entry is marked). */
export function isRouteHref(href: string): boolean {
  if (!href.startsWith('#') || href === '#') return false;
  return isLiveRoute(href) || isSettingsRoute(href) || isPassHash(href);
}

function isPassHash(hash: string): boolean {
  const parsed = parseHash(hash);
  return parsed !== null && (parsed.kind === 'pass' || parsed.kind === 'passId');
}

/** For tests: forget every opener and any pending focus. */
export function resetNavigation(): void {
  openers.length = 0;
  pending = undefined;
}
