import { useEffect, useRef, useState, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useT } from '../i18n/useT';
import { LIVE_HASH, routeOfHash } from '../lib/shareLinks';
import { followHash } from '../state';
import { UpdateBanner } from './components/common/UpdateBanner';
import { VisuallyHidden } from './components/primitives/VisuallyHidden';
import { isRouteHref, open, replace, subscribe, takeFocusTarget } from './navigation';
import styles from './Shell.module.css';
import { useThemeTick } from './styles/useThemeTick';

/**
 * R92 (FR-A11Y-1, FR-A11Y-3..5, FR-ROUTE-2; D-529, D-531..D-533; F-71): the one
 * shell every route renders in.
 *
 * It holds what is the same on every route: the skip link (FR-A11Y-5), the
 * `banner` slot and the update bar under it (R212, FR-UPD-2, D-1237), the `main` landmark, an optional
 * `contentinfo`, the polite region that names each new route once, and the
 * effect that keeps `document.title` on the route and the language. It also
 * mounts the app's one `popstate` + `hashchange` subscriber, which follows a
 * changed hash into the store (R83, `followHash`), and after
 * each route change puts the focus back on what opened the route just left
 * (FR-A11Y-4, `navigation.takeFocusTarget`).
 *
 * `chrome` says which route's frame this is. All but the compact live page get the skip
 * link and a `main` of the shell's own. The live page's grid is one element
 * whose cells are its top row and its content, and a box of the shell's around
 * either half would re-cut it (FR-SHP-2's rule), so on `live` the page renders
 * the two landmarks itself, as `display: contents` wrappers inside that grid
 * (`Live.tsx`), and the shell renders its children as they are.
 *
 * R166 (FR-CLEAN-12, D-1003): on a desk every route's rows stop at
 * `HOME_MAX_CELLS` and are centred — the rule is `Shell.module.css`'s, on the
 * shell's `main` and on `#root`'s other rows, the live page's grid among them.
 *
 * Links to a route (`#live`, `#settings`, a pass) are taken from the browser
 * here, by one delegated click listener, so every entry the app opens is one
 * `navigation.open` marked — a plain `<a href="#live">` would push an entry
 * with no marker, and closing it would leave it behind (F-91). A click with a
 * modifier is the browser's: it opens a tab.
 */
type Chrome = 'pass' | 'settings' | 'stars' | 'live';

/** The `main` landmark's id: the skip link's target. */
const MAIN_ID = 'main';

export interface ShellProps {
  chrome: Chrome;
  /** Which route is on screen; a change is what the announcer says and the focus follows. A pass's key carries its id. */
  routeKey: string;
  /** `document.title`, from `lib/routeTitle` (D-531). */
  title: string;
  /** The `banner` landmark: the header, which renders its own `<header>` told its page (R129, D-845). The compact live page holds its own in its grid. */
  banner?: ReactNode;
  /** The `contentinfo` landmark, rendering its own `<footer>`. */
  footer?: ReactNode;
  /** Attributes of the shell's `main`: its class, `inert`, the page's data attributes. */
  mainProps?: HTMLAttributes<HTMLElement> & { inert?: boolean; [data: `data-${string}`]: string | undefined };
  /** Page-level strips between the banner and `main` (the visit notices), and layers after the footer. */
  beforeMain?: ReactNode;
  after?: ReactNode;
  /** The update bar is out of reach: a layer stands over the page (the shortcuts, the phone's pass sheet). */
  barInert?: boolean;
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

/**
 * D-532: the `h1` the focus falls back to is not a control, so it is focusable (`tabIndex=-1`) only while it holds
 * the focus — a click on the title would otherwise take the focus too, off whatever the reader had.
 */
function focusOn(target: HTMLElement): void {
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', () => {
      target.removeAttribute('tabindex');
    }, { once: true });
  }
  target.focus();
}

export function Shell({ chrome, routeKey, title, banner, footer, mainProps, beforeMain, after, barInert = false, children }: ShellProps) {
  const t = useT();
  const main = useRef<HTMLElement>(null);

  // R156 (FR-PHONE-15, D-972): the theme on the saved preference, and with Auto on the Sun at the saved place, every tick.
  useThemeTick();

  // The one route listener (D-533): the store follows the hash. R152 (FR-GYRO-6): the sky screen it closed first is gone.
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type !== 'hashchange') return;
        // The hash that arrived, not the one left: a live page mounted on it may have written its own already.
        const { newURL } = event as HashChangeEvent;
        followHash(newURL ? new URL(newURL).hash : window.location.hash);
        // FR-LAND-1: read first, so an unreadable link's note outlives its hash.
        if (routeOfHash(window.location.hash) === null) replace(LIVE_HASH);
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
   * to what opened the route just left. Entering a route places its own focus (the Back control of the
   * settings page, the guide's heading), from inside the page that has it; a tab has no Back (D-1230), so where
   * the control that opened it went with its page, the focus is the new page's `h1`.
   */
  const [announced, setAnnounced] = useState('');
  const shownKey = useRef(routeKey);
  useEffect(() => {
    // The title is read here but is not the trigger: a language switch renames the route, it does not change it.
    if (shownKey.current === routeKey) return;
    shownKey.current = routeKey;
    setAnnounced(title);
    const target = takeFocusTarget() ?? (document.activeElement === document.body ? (document.querySelector<HTMLElement>('h1') ?? main.current) : null);
    if (target) focusOn(target);
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
      {/* FR-UPD-2 (D-1237). The phone's sky pages are fixed over the flow, so there the bar is fixed under their head. */}
      <div className={styles.update} data-update-bar="" data-chrome={chrome}>
        <UpdateBanner inert={barInert} />
      </div>
      {beforeMain}
      {chrome === 'live' ? (
        children
      ) : (
        // R166 (FR-CLEAN-12, D-1003): the shell's class carries the desk's cap, beside the page's own.
        <main id={MAIN_ID} ref={main} tabIndex={-1} {...mainProps} className={[styles.main, mainProps?.className].filter(Boolean).join(' ')}>
          {children}
        </main>
      )}
      {footer}
      {after}
      <VisuallyHidden as="p" role="status" aria-live="polite" data-testid="route-announcer">
        {announced}
      </VisuallyHidden>
    </>
  );
}
