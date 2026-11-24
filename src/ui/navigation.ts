import { useSyncExternalStore } from 'react';
import { isLiveRoute, isPassPageRoute, isSettingsRoute, LIVE_HASH, parseHash, routeOfHash, starsAsLive } from '../lib/shareLinks';

/**
 * R92 (FR-ROUTE-1..3, FR-A11Y-4; D-532, D-533; F-91): the one place the app
 * writes the history. There is still no router (D-13) — the hash is the route —
 * but opening and closing a route used to be two different history operations:
 * opening pushed an entry, closing replaced it, so every visit left a
 * second entry behind and the browser's Back did nothing once per visit.
 *
 * **Live is the first page** (R212, FR-LAND-1, D-1230). A hash that names no
 * route becomes `#live` in its own entry, and a route that was the load's
 * closes to `#live`: the live page is where there is nothing further back.
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
  const d = depth();
  if (openers.length > d) {
    pending = openers[d];
    openers.length = d;
  }
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
 * `stack` is the phone's list at `#pass` (D-1231): its pass is a sheet over it, which closes to the list.
 */
export function open(hash: string, opener: HTMLElement | null = focusedElement(), { stack = false }: { stack?: boolean } = {}): void {
  if (window.location.hash === hash) return;
  if (!stack && isPassHash(window.location.hash) && isPassHash(hash)) {
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

/**
 * v2.14.1 (D-1134, V214-35): the current entry becomes `hash` in place — no new entry, and what opened the entry stays
 * what the focus goes back to. A bare `#pass` becomes the pass `[ satellites ]` names once the passes are known.
 */
export function replace(hash: string): void {
  if (window.location.hash === hash) return;
  window.history.replaceState(window.history.state, '', hash);
  announce();
}

/**
 * Leaves the current route: back to the entry it was opened from, or `to` in place when it was the load's — the
 * live page, or the phone's list under a pass's sheet (D-1231). The live page as the load's has nowhere to go.
 */
export function close(to: string = LIVE_HASH): void {
  if (depth() > 0) {
    window.history.back();
    return;
  }
  const hash = window.location.hash;
  if (hash === to || hash === '' || routeOfHash(hash) === 'live') return;
  pending = 'h1';
  replace(to);
}

/**
 * R212 (FR-LAND-1, D-1230): an empty, unknown or unreadable hash becomes `#live` in its entry. It tells nobody: it
 * runs before the first render, which then reads the hash it left.
 */
export function landRoute(): void {
  landStars();
  if (routeOfHash(window.location.hash) === null) window.history.replaceState(window.history.state, '', `${path()}${LIVE_HASH}`);
}

/**
 * R222 (FR-LAND-3, D-1240): a load of `#stars` or `#stars?…` is `#live` with the same parameters, written over the entry.
 * `main.tsx` runs it before `startApp`, so a link's place is read from the live hash it becomes.
 */
export function landStars(): void {
  const folded = starsAsLive(window.location.hash);
  if (folded !== null) window.history.replaceState(window.history.state, '', `${path()}${folded}`);
}

const atStart = (): boolean => depth() === 0 && routeOfHash(window.location.hash) === 'live';
const notAtStart = (): boolean => false;

/** The live page as the visit's first entry: there is nothing to go back to, so it offers no Back (D-1230). */
export function useAtStart(): boolean {
  return useSyncExternalStore(subscribe, atStart, notAtStart);
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

/** A pass's hash, or v2.14.1's bare `#pass` (D-1134): the pass page, so a pass opened from it takes its entry in place. */
function isPassHash(hash: string): boolean {
  if (isPassPageRoute(hash)) return true;
  const parsed = parseHash(hash);
  return parsed !== null && (parsed.kind === 'pass' || parsed.kind === 'passId');
}

/** For tests: forget every opener and any pending focus. */
export function resetNavigation(): void {
  openers.length = 0;
  pending = undefined;
}
