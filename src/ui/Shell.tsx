import { useEffect, useRef, useState, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useT } from '../i18n/useT';
import { appStore, followHash } from '../state';
import { isRouteHref, open, subscribe, takeFocusTarget } from './navigation';

/**
 * R92 (FR-A11Y-1, FR-A11Y-3..5, FR-ROUTE-2; D-529, D-531..D-533; F-71): the one
 * shell every route renders in.
 *
 * It holds what is the same on every route: the skip link (home and settings,
 * FR-A11Y-5), the `banner` slot, the `main` landmark, an optional
 * `contentinfo`, the polite region that names each new route once, and the
 * effect that keeps `document.title` on the route and the language. It also
 * mounts the app's one `popstate` + `hashchange` subscriber, which follows a
 * changed hash into the store (R83, `followHash`), closes the sky screen before
 * the route under it changes (FR-ROUTE-2; OQ-22 stays the owner's), and after
 * each route change puts the focus back on what opened the route just left
 * (FR-A11Y-4, `navigation.takeFocusTarget`).
 *
 * `chrome` says which route's frame this is. Home and settings get the skip
 * link and a `main` of the shell's own. The live page's grid is one element
 * whose cells are its top row and its content, and a box of the shell's around
 * either half would re-cut it (FR-SHP-2's rule), so on `live` the page renders
 * the two landmarks itself, as `display: contents` wrappers inside that grid
 * (`Live.tsx`), and the shell renders its children as they are.
 *
 * Links to a route (`#live`, `#settings`, a pass) are taken from the browser
 * here, by one delegated click listener, so every entry the app opens is one
 * `navigation.open` marked — a plain `<a href="#live">` would push an entry
 * with no marker, and closing it would leave it behind (F-91). A click with a
 * modifier is the browser's: it opens a tab.
 */
export type Chrome = 'home' | 'settings' | 'live';

/** The `main` landmark's id: the skip link's target. */
export const MAIN_ID = 'main';

export interface ShellProps {
  chrome: Chrome;
  /** Which route is on screen; a change is what the announcer says and the focus follows. A pass's key carries its id. */
  routeKey: string;
  /** `document.title`, from `lib/routeTitle` (D-531). */
  title: string;
  /** The `banner` landmark: the header, which renders its own `<header>`. Home and settings only. */
  banner?: ReactNode;
  /** The `contentinfo` landmark, rendering its own `<footer>`. */
  footer?: ReactNode;
  /** Attributes of the shell's `main` (home and settings): its class, `inert`, the page's data attributes. */
  mainProps?: HTMLAttributes<HTMLElement> & { inert?: boolean; [data: `data-${string}`]: string | undefined };
  /** Page-level strips between the banner and `main` (the visit notices), and layers after the footer. */
  beforeMain?: ReactNode;
  after?: ReactNode;
  children: ReactNode;
}

function takeRouteLink(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
  const href = anchor?.getAttribute('href');
  if (!anchor || href == null || anchor.target !== '' || !isRouteHref(href)) return;
  event.preventDefault();
  open(href, anchor);
}

export function Shell({ chrome, routeKey, title, banner, footer, mainProps, beforeMain, after, children }: ShellProps) {
  const t = useT();
  const main = useRef<HTMLElement>(null);

  // The one route listener (D-533): the store follows the hash, and a sky screen closes before the route changes.
  useEffect(
    () =>
      subscribe((event) => {
        const state = appStore.getState();
        if (state.skyScreen) state.closeSkyScreen();
        if (event.type === 'hashchange') followHash(window.location.hash);
      }),
    [],
  );

  useEffect(() => {
    document.addEventListener('click', takeRouteLink);
    return () => {
      document.removeEventListener('click', takeRouteLink);
    };
  }, []);

  // FR-A11Y-3 (D-531): the tab names the route, in the active language.
  useEffect(() => {
    document.title = title;
  }, [title]);

  /*
   * FR-A11Y-4 (D-532): once per route change — not on the first render, which is the page loading and which
   * the screen reader reads by itself — the new route is named in the polite region, and the focus goes back
   * to what opened the route just left. Entering a route places its own focus (the Back control of the live and
   * settings pages, the guide's heading), from inside the page that has it.
   */
  const [announced, setAnnounced] = useState('');
  const shownKey = useRef(routeKey);
  useEffect(() => {
    // The title is read here but is not the trigger: a language switch renames the route, it does not change it.
    if (shownKey.current === routeKey) return;
    shownKey.current = routeKey;
    setAnnounced(title);
    takeFocusTarget()?.focus();
  }, [routeKey, title]);

  const skip =
    chrome === 'live' ? null : (
      <a
        href={`#${MAIN_ID}`}
        className="skip-link"
        data-testid="skip-link"
        onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        {t.a11y.skip}
      </a>
    );

  return (
    <>
      {skip}
      {banner}
      {beforeMain}
      {chrome === 'live' ? (
        children
      ) : (
        <main id={MAIN_ID} ref={main} tabIndex={-1} {...mainProps}>
          {children}
        </main>
      )}
      {footer}
      {after}
      <p role="status" aria-live="polite" className="sr-only" data-testid="route-announcer">
        {announced}
      </p>
    </>
  );
}
