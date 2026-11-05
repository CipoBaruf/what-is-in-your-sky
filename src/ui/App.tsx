import { createRef, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { I18nProvider, useLocale, useT } from '../i18n/useT';
import { isFaint } from '../lib/faint';
import { MOON_LORE } from '../lib/flags';
import { routeTitle, type RouteName } from '../lib/routeTitle';
import { observerFromLink, resolvePassLink, STARS_HASH } from '../lib/shareLinks';
import type { ShortcutActions } from '../lib/shortcuts';
import { formatClock, formatDate, formatShortClock } from '../lib/timeFormat';
import { catalogName, isFeatured, useActiveObserver, useAppStore } from '../state';
import styles from './App.module.css';
import { RootBoundary } from './RootBoundary';
import { Footer } from './components/common/Footer';
import { Header } from './components/common/Header';
import { PageNotices } from './components/common/VisitNotice';
import { ShortcutsOverlay } from './components/common/ShortcutsOverlay';
import { useLayoutMode } from './hooks/useLayoutMode';
import { PassList } from './components/passes/PassList';
import { useShortcuts } from './hooks/useShortcuts';
import { moveCursor, passIdAtCursor, PASS_CARD } from './components/passes/passCursor';
import { nextView } from './screens/chartViewDefault';
import { Home, useSteps } from './screens/Home';
import { useLiveRoute } from './screens/LiveRoute';
import { PassDetail } from './screens/PassDetail';
import { findSelectedPass, usePassSelection, useSettingsRoute } from './screens/passSelection';
import { settingsShell } from './screens/SettingsRoute';
import { prefetchSettingsWhenIdle } from './screens/settingsChunk';
import { StarsPage, useStarsRoute } from './screens/StarsRoute';
import { clearRoute, open as openRoute } from './navigation';
import { Shell } from './Shell';

/**
 * R32 (FR-LIVE-1, PLAN §11): the live page is its own lazy chunk, fetched the
 * first time `#live` is opened, so the home page pays nothing for it. The
 * route is read from the hash beside the pass selection (D-13).
 */
const LivePage = lazy(() => import('./screens/Live').then((module) => ({ default: module.LivePage })));

/**
 * FR-FLAG-1 (D-183): the import lives inside the `if`, not just the render,
 * so with `MOON_LORE` statically `false` Rollup never registers the dynamic
 * import as a chunk boundary — `lore.json` and its component ship in no file
 * of the build, not merely one the app declines to fetch.
 */
const MoonLore = MOON_LORE ? lazy(() => import('./components/moon/MoonLore').then((module) => ({ default: module.MoonLore }))) : undefined;

/** R186: the live page's link notes (FR-VISIT-3), under the app's header on wide as the page's top row held them. */
const LIVE_NOTES = ['past', 'far'] as const;

/** R87 (FR-VISIT-4): the one link note home can be showing; the moment's two are the live page's (R89). */
const HOME_NOTES = ['unreadable'] as const;

/** R129 (D-845): the settings header's `[ ← ]`, which the settings chunk focuses when it arrives. One app, one ref. */
const SETTINGS_BACK = createRef<HTMLButtonElement>();

/**
 * R5: the screen only writes the observer to the store; the effects started
 * by `main.tsx` load the elements and drive the worker (PLAN §3: `src/ui`
 * imports `src/state`, never `src/data` or `src/physics`). R7: the Now panel
 * sits between the input and the pass list. R6: the selected pass lives in
 * the URL hash (D-13) and opens the detail sheet over the list; header, main
 * and footer are made inert while the sheet is up. R9/R10: the location
 * section holds the place picker, the coordinates, the device button and the
 * clear action. R11: the elements banners (epoch age, stale, not cached,
 * objects without elements) sit between the location and the Now panel.
 * R12: the frame is header (title and tagline), main, and the footer with
 * the attributions (FR-X-2). R17: the header also carries the language
 * switch (US-13), and `AppRoot` is what `main.tsx` renders — the store's
 * locale wrapped around the screen, so switching re-renders everything
 * without touching the URL or the state (FR-I18N-5). R20 puts the theme
 * switch beside it (US-19) and `AppRoot` writes `data-theme` from the store.
 * R23 (FR-DESK-2/3): the same elements in two columns from 100 cells up —
 * location, banners and the Now panel in the left one, the passes in the
 * right one, the header spanning both. The guide is rendered inside the
 * right column, where the wide shell wants it; the compact sheet portals
 * itself out to the body from there (D-117), which is why the page can still
 * be made inert around it. With a pass open the wide page is one viewport
 * high and every pane scrolls itself (D-119), which is why the left column
 * carries a class of its own — it is the one that has to stretch to the
 * footer and, on a short screen, scroll. R30 fills the last slot FR-DESK-2
 * names for that column: the Moon's tradition line, below the Now panel whose
 * last line is the Moon's observing facts (FR-MOON-3/4, D-122). R27 puts the
 * readiness line directly under the location, above the elements banners, which
 * is where FR-OFF-4 asks for it and where the other statements about what the
 * app is running on already are. R32: the header's controls gain the link to
 * the live page (FR-LIVE-1), and under `#live` the whole screen is that page
 * instead of this one. R28 puts the update offer and the install hint at the
 * head of the left column (FR-OFF-1, FR-OFF-6): they are page-level statements
 * like the elements banners, and being inside the shell is what keeps them out
 * of reach under an open pass and off the live page altogether (D-154). R35
 * (FR-DESK-4, D-73): this is also where the app's one `keydown` listener is
 * mounted, because this is the component that has the selection, the guide,
 * the route and the preferences in scope at once — every handler in the
 * shortcut table is a line of it. R76 (FR-FIRST-1..6, D-443): what the main
 * holds is `screens/Home.tsx`'s — the cold open with no observer, and the three
 * readings, Where, When and What, once there is one; the columns above are the
 * readings' wrappers now, and from `HOME_THREE_PANE_MIN_PX` they are three panes.
 */
export function App() {
  const t = useT();
  const observer = useActiveObserver();
  const passes = useAppStore((s) => s.passes.passes);
  const locale = useLocale();
  const passesStatus = useAppStore((s) => s.passes.status);
  const { selectedId, link, open, close } = usePassSelection();
  // R31 (FR-SHARE-3): a shared pass is resolved against this device's own
  // recompute — the same pass, the nearest pass of that object, or none — and
  // a local selection is still just an id (D-33).
  // R97 (FR-FAINT-3): the link's own pass opens whether or not it is faint; the nearest pass standing in for
  // one that has gone is found among the passes the list shows, so it is faint only while faint passes are.
  const showFaint = useAppStore((s) => s.showFaint);
  const resolution = useMemo(() => {
    if (link === null) return null;
    const found = resolvePassLink(passes, link);
    if (found.kind !== 'nearest' || showFaint) return found;
    return resolvePassLink(passes.filter((pass) => !isFaint(pass, { isIss: isFeatured, nextEventId: null, openId: null })), link);
  }, [passes, link, showFaint]);
  /*
   * R51 (F-18): the substitute pass waits for the recompute to finish. The
   * cards stream in (D-5), so until `passes.status === 'done'` the "nearest
   * pass of that object" is only the nearest one computed *so far* — the
   * guide opened on it silently, and the FR-SHARE-3 sentence that explains
   * why this is not the pass the link named appears next to it a second
   * later, by which time the pass underneath may have changed. The link's own
   * pass (`same`) is an exact match within the D-33 tolerance and needs no
   * explanation, so it opens as soon as it is computed.
   */
  const selected = useMemo(() => {
    if (resolution === null) return findSelectedPass(passes, selectedId);
    if (resolution.kind !== 'same' && passesStatus !== 'done') return null;
    return resolution.pass;
  }, [resolution, passes, selectedId, passesStatus]);
  const timeZone = observer?.timeZone ?? null;
  /*
   * The message the recipient of a stale link reads, in both of FR-SHARE-3's
   * branches: it names the satellite and the instant the link was made for,
   * which is all the link itself said. It waits for the recompute to finish —
   * before that, "no pass" would only mean "not yet".
   */
  const shareNotice = useMemo(() => {
    if (passesStatus !== 'done') return null;
    if (link === null) {
      /*
       * R92 (FR-ROUTE-3): a reload keeps `#pass=<id>`, and a pass that has left the run since — its night over,
       * a recompute that no longer finds it — is FR-SHARE-3's message rather than a home page that says nothing
       * about the address it was given. The id is `<norad>-<start>`, which is all the message needs.
       */
      const m = selectedId === null || selected !== null ? null : /^(\d+)-(\d+)$/.exec(selectedId);
      if (!m) return null;
      const startT = Number(m[2]);
      return t.share.missing({ name: catalogName(Number(m[1])), time: `${formatDate(startT, timeZone, locale)} ${formatClock(startT, timeZone, locale)}` });
    }
    if (resolution === null || resolution.kind === 'same') return null;
    const name = resolution.pass?.name ?? catalogName(link.noradId);
    const time = `${formatDate(link.startT, timeZone, locale)} ${formatClock(link.startT, timeZone, locale)}`;
    return resolution.kind === 'nearest' ? t.share.nearest({ name, time }) : t.share.missing({ name, time });
  }, [link, resolution, selectedId, selected, passesStatus, timeZone, locale, t]);
  /*
   * R51 (F-17): a share link is consumed once. It arrives authoritative — its
   * observer wins over the saved one (D-135) and its pass is what the screen
   * opens on — but it stayed authoritative for as long as it sat in the hash,
   * so a recipient who typed their own coordinates had the guide torn down by
   * the recompute and put straight back up from the link, on a pass belonging
   * to somebody else's sky, with no way out but editing the URL. Once the
   * observer is no longer the one the link named, the link has been consumed:
   * it is cleared from the hash in place, which closes the guide and leaves
   * the reader on their own list. The comparison is the coordinates alone, as
   * R39's `#live` effect makes it — the label and the zone are filled in later
   * from the forecast and are not what identifies a place.
   */
  useEffect(() => {
    if (link === null || observer === null) return;
    const linked = observerFromLink(link);
    if (observer.lat === linked.lat && observer.lon === linked.lon && observer.altM === linked.altM) return;
    close();
  }, [link, observer, close]);
  const mode = useLayoutMode();
  const live = useLiveRoute();
  /*
   * R87 (FR-VISIT-4, F-93): a hash that starts as one of the app's routes and
   * does not parse opens the reader's own home with a note, and one that is no
   * route at all is simply dropped; either way it leaves the URL before the
   * paint, in place, so Back is not spent on it. `#live?lat=999` is the one
   * that would otherwise draw a page: it is the live route with no link, which
   * is what a bare `#live` is, so it is told apart here and not shown.
   */
  const linkResult = useAppStore((s) => s.linkResult);
  useLayoutEffect(() => {
    if (linkResult?.kind === 'unreadable' || linkResult?.kind === 'unknown') clearRoute();
  }, [linkResult]);
  const liveUnreadable = live.active && live.link === null && window.location.hash !== '#live';
  // R52 (FR-COMP-2, D-184): the third route, read from the hash beside the other two.
  const settings = useSettingsRoute();
  // R115 (FR-STAR-3, D-756): the fourth, the stars page.
  const stars = useStarsRoute();
  /*
   * R87 (FR-FIRST-1, FR-FIRST-4 as amended v2.1, D-548): the phone's first-run
   * steps are held here rather than in `Home`, because the footer is this
   * component's and takes its `line` form while they are up (F-74).
   *
   * `Home` was unmounted by the live and settings routes, which put the steps
   * back to what a fresh mount makes of the observer; nothing unmounts here, so
   * the route is passed in and `useSteps` does it. Without that, a place set on
   * the settings page came back to a step rather than to the stacked page.
   */
  const steps = useSteps(observer, (live.active && !liveUnreadable) || settings.active || stars.active);
  const stepping = mode === 'compact' && steps.step !== null;
  /*
   * R186 (FR-WIDE-1, D-1098; amends FR-DESK-3): on wide a selected pass is the desk's shell in the home's place, so
   * the right column's tracks (D-253's split, R76's `pane`) are gone; only the compact sheet stands over the home.
   */
  const guide = selected === null ? 'closed' : 'open';
  const openPass = (passId: string): void => {
    open(passId);
  };
  /*
   * FR-WIDE-1: `Esc`, `[ × ]` and `[ home ]` return to the home with the list at the card. The home mounts again on the
   * close, so its card is a new element: once it is there it is scrolled into view and takes the focus, its folded
   * night unfolded first (`passCursor`: `focus()` on a hidden card does nothing).
   */
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    if (selected !== null) {
      if (mode === 'wide') returnTo.current = selected.id;
      return;
    }
    const id = returnTo.current;
    if (id === null) return;
    returnTo.current = null;
    const card = document.querySelector<HTMLElement>(`${PASS_CARD}[data-pass-id="${CSS.escape(id)}"]`);
    if (!card) return;
    const night = card.closest<HTMLElement>('[data-night-group][hidden]');
    if (night) {
      document.querySelector<HTMLButtonElement>(`[aria-controls="${night.id}"]`)?.click();
      night.hidden = false;
    }
    // As `passCursor`: jsdom has no `scrollIntoView`.
    card.scrollIntoView?.({ block: 'center' });
    card.focus({ preventScroll: true });
  }, [selected, mode]);
  /*
   * R39 (F-34): `startApp` reads a link's observer once, before the first
   * render (D-135), which covers the arrival — a pasted URL, a reload. A
   * same-document navigation to a shared `#live?lat=…` never reaches it: the
   * route changed, the observer did not, and the page drew this device's sky at
   * the link's instant and offered to share that. The route has already parsed
   * the hash; this applies what it parsed, through the same `setObserver` the
   * link takes on arrival. Coordinates that are already the store's are left
   * alone — on arrival they are, and a fresh observer would restart the whole
   * compute chain for the place it is already showing.
   *
   * R58 (D-280, D-295, FR-LIVE-11): "already the store's" is `sameHashPlace`,
   * the test `startApp`'s guard uses, and not equality digit for digit. The
   * hash carries five decimals; an observer the device fixed itself
   * (`observerFromPosition` keeps the whole reading) never matches its own
   * link exactly, and a fresh `source: 'coords'` observer here drops that
   * reader's label, zone and stored run — F-56 again, a render after
   * `startApp` refused it.
   *
   * R83 (F-93, D-539): the running tab reads every changed hash through
   * `state`'s `followHash`, the `openLink` the boot uses, instead of applying a
   * live link here and dropping a pass link: a link over a saved place is a
   * visit and is not stored, a pass link's place is visited and its pass
   * selected, and D-280's guard covers both.
   *
   * R92 (D-533): that listener is `Shell`'s now, the app's one route listener.
   */
  /*
   * R35 (FR-DESK-4, D-73): the shortcut table's handlers, the one place the
   * keys reach the app's state. Each says whether it did something, which is
   * what decides whether the key press was the app's or the browser's.
   *
   * The cursor `j` and `k` move is DOM focus on a pass card, not state here
   * (`components/passes/passCursor.ts`), so the list keeps deciding which
   * cards there are and in what order.
   */
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsArriving, setSettingsArriving] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const chartView = useAppStore((s) => s.chartView);
  const setChartView = useAppStore((s) => s.setChartView);
  const actions: ShortcutActions = {
    next: () => moveCursor(document, 1) !== null,
    previous: () => moveCursor(document, -1) !== null,
    open: () => {
      const passId = passIdAtCursor(document);
      if (passId === null) return false;
      openPass(passId);
      return true;
    },
    // The overlay first: it is what is on top, and it is where the reader just
    // read that Esc closes the guide.
    close: () => {
      if (helpOpen) {
        setHelpOpen(false);
        return true;
      }
      // R52 (US-20 AC4): `Esc` leaves the settings page, through the same one
      // listener and with the same guard as the guide (D-73) — so a press
      // inside the place field or the coordinate field is still that field's.
      if (settings.active) {
        settings.leave();
        return true;
      }
      // R115: and the stars page, the same way.
      if (stars.active) {
        stars.leave();
        return true;
      }
      if (selected === null) return false;
      close();
      return true;
    },
    live: () => {
      setHelpOpen(false);
      openRoute('#live');
      return true;
    },
    // R115 (FR-DESK-4 as amended v2.4): `s` opens the stars page; on the page itself it is the page already, and
    // the press did something only if it closed the overlay.
    stars: () => {
      setHelpOpen(false);
      if (stars.active) return helpOpen;
      openRoute(STARS_HASH);
      return true;
    },
    view: () => {
      // R186 (FR-WIDE-2, FR-DESK-4): on wide the next of `Globe Window Dome` after the view shown, saved for the three pages.
      setChartView(nextView('pass', mode, chartView));
      return true;
    },
    // R127 (FR-DESK-4 as amended v2.5): `f` is the live page's, where its window listens for it; here it does nothing.
    follow: () => false,
    theme: () => {
      setTheme(theme === 'night' ? 'dark' : 'night');
      return true;
    },
    help: () => {
      setHelpOpen(true);
      return true;
    },
  };
  // Not on the live page: it is a screen of its own with its own keys (R32, R33).
  useShortcuts(actions, !live.active);
  // Only the compact sheet covers the page; the wide panel opens beside the
  // list, which stays live (FR-DESK-3). The shortcuts overlay covers it at
  // every width, so nothing behind it is reachable either.
  //
  // R50 (F-45): this covers the header, the main and the footer, and the
  // compact sheet is in none of them — it portals itself to the body (D-117),
  // which is exactly what lets it stay live while they are inert. With the
  // overlay up the sheet is behind it like everything else, so it is told
  // separately (`inert` on `PassDetail` below).
  const inert = helpOpen || (selected !== null && mode === 'compact');
  /*
   * R49 (F-30): the two offers are under a stricter rule than the rest of the
   * page. D-154 says a reload button cannot be reached while a pass is open,
   * because applying an update swaps the shell under a reader who is in the
   * middle of something; on wide the guide is a panel beside a list that stays
   * live (FR-DESK-3), so `inert` above never reaches them there and the button
   * was one Tab away from a reader following a pass. The rule is the pass, not
   * the width — and the help sheet, as for everything else.
   */
  const offersInert = helpOpen || selected !== null;
  /*
   * R92 (FR-A11Y-1, FR-A11Y-3; D-529, D-531): every route is one `Shell`, the same element in every branch
   * below, so the announcer and the focus that follows the route live across the change rather than being
   * remounted with it. Which route is on screen, and what the tab calls it: a pass is a route once it has
   * resolved to a pass of the run.
   */
  const liveShown = live.active && !liveUnreadable;
  // The shortcuts overlay, over home and over the stars page alike.
  const overlay = helpOpen && (
    <ShortcutsOverlay
      onClose={() => {
        setHelpOpen(false);
      }}
    />
  );
  const route: RouteName = liveShown ? 'live' : settings.active ? 'settings' : stars.active ? 'stars' : selected !== null ? 'pass' : 'home';
  const routeKey = route === 'pass' && selected !== null ? `pass:${selected.id}` : route;
  const title = routeTitle(route, t, selected && { name: selected.name, time: `${formatDate(selected.start.t, timeZone, locale)} ${formatShortClock(selected.start.t, timeZone, locale, timeZone === null)}` });
  if (liveShown) {
    // The live page renders its own `banner` and `main` inside its grid (D-529); the fallback is a `main` of its own.
    // D-1023 (FR-X-2 as amended 2026-11-02): on a desk the footer's one row follows the page's one viewport, under the
    // fold (`Live.module.css`); on a phone the row is the controls sheet's last (`ControlsSheet`).
    // R186 (FR-WIDE-1, D-1098): on wide the live page is a page like the stars page — the app's header (`live` current,
    // `[ ← ]` and the place), the page in the shell's `main`, the footer under it; on a phone it is its own screen (D-529).
    if (mode === 'wide') {
      return (
        <Shell
          chrome="stars"
          routeKey={routeKey}
          title={title}
          banner={<Header page="live" context={observer?.label ?? null} onBack={live.leave} inert={helpOpen} />}
          beforeMain={<PageNotices kinds={LIVE_NOTES} />}
          mainProps={{ inert: helpOpen, className: styles.stars }}
          footer={<Footer inert={helpOpen} />}
          after={overlay}
        >
          <Suspense fallback={<p className={styles.starsLoading}>{t.live.loading}</p>}>
            <LivePage link={live.link} onLeave={live.leave} />
          </Suspense>
        </Shell>
      );
    }
    return (
      <Shell chrome="live" routeKey={routeKey} title={title}>
        <Suspense
          fallback={
            <main className={styles.liveLoading}>
              <p>{t.live.loading}</p>
            </main>
          }
        >
          <LivePage link={live.link} onLeave={live.leave} />
        </Suspense>
      </Shell>
    );
  }
  /*
   * R52 (FR-COMP-2): the settings page is a screen, like the live one — the
   * whole of it, at every width, with its own header. Rendered after `#live`
   * so a hash that is somehow both is the live page, which is the one with a
   * share link behind it. D-1023 (FR-SET-1 as amended 2026-11-02): its foot is
   * the app's footer, as on every page (R75's privacy line is gone).
   */
  // R93 (D-545): the page is a chunk; while it is on its way the header's bead runs (FR-MARK-5), through this flag.
  if (settings.active) return <Shell routeKey={routeKey} title={title} {...settingsShell(t, { onLeave: settings.leave, backRef: SETTINGS_BACK }, { arriving: settingsArriving, onArriving: setSettingsArriving, place: observer?.label ?? null })} />;
  /*
   * R115 (FR-STAR-3, D-756): the stars page is a screen like the settings one — the header (its `[ stars ]` the
   * current page's), the page as `main` — and a chunk of its own, fetched here or from the link ahead
   * of the tap. The shortcuts overlay opens over it as over home. D-1023 (FR-X-2 as amended 2026-11-02): on a desk
   * the footer's one row under it, as every page; on a phone the row is the controls sheet's last (`ControlsSheet`).
   */
  if (stars.active) {
    return (
      <Shell
        chrome="stars"
        routeKey={routeKey}
        title={title}
        banner={<Header page="stars" context={observer?.label ?? null} onBack={stars.leave} inert={helpOpen} />}
        mainProps={{ inert: helpOpen, className: styles.stars }}
        {...(mode === 'wide' ? { footer: <Footer inert={helpOpen} /> } : {})}
        after={overlay}
      >
        <Suspense fallback={<p className={styles.starsLoading}>{t.stars.loading}</p>}>
          <StarsPage />
        </Suspense>
      </Shell>
    );
  }
  /*
   * R186 (FR-WIDE-1, D-1098): on wide a selected pass is a page of its own in the home's place — the app's header (its
   * `[ home ]` a link back), the desk's shell with the home's list in its rail, the footer — and the home's doors and
   * panes are not mounted. The hash is still `#pass=<id>` (D-13).
   */
  if (mode === 'wide' && selected !== null && observer !== null) {
    return (
      <Shell
        chrome="home"
        routeKey={routeKey}
        title={title}
        banner={<Header inert={helpOpen} homeLink />}
        beforeMain={<PageNotices kinds={HOME_NOTES} inert={helpOpen} />}
        mainProps={{ inert: helpOpen, className: styles.stars, 'data-sky': 'pass' }}
        footer={<Footer inert={helpOpen} />}
        after={overlay}
      >
        <PassDetail key={selected.id} pass={selected} observer={observer} onClose={close} inert={helpOpen} passList={<PassList onOpenPass={openPass} selectedPassId={selected.id} />} />
      </Shell>
    );
  }
  return (
    <Shell
      chrome="home"
      routeKey={routeKey}
      title={title}
      banner={<Header inert={inert} />}
      beforeMain={<PageNotices kinds={HOME_NOTES} inert={inert} />}
      mainProps={{ inert, className: styles.main, 'data-home': observer === null ? 'cold' : 'readings', 'data-guide': guide, ...(stepping ? { 'data-step': '' } : {}) }}
      footer={<Footer inert={inert} form={stepping ? 'line' : 'full'} />}
      after={overlay}
    >
        <Home
            offersInert={offersInert}
            guide={guide}
            shareNotice={shareNotice}
            selectedPassId={selected ? selected.id : null}
            onOpenPass={openPass}
            MoonLore={MoonLore}
            steps={steps}
            passDetail={
              /* R50 (F-8): keyed by the pass, so opening a second one from the list beside the panel
                 is a new guide — its heading takes focus, and closing it returns to the card that
                 opened it rather than to the first one's. */
              selected &&
              observer && (
                <PassDetail
                  key={selected.id}
                  pass={selected}
                  observer={observer}
                  onClose={close}
                  inert={helpOpen}
                />
              )
            }
          />
    </Shell>
  );
}

/**
 * The app as `main.tsx` mounts it: the active language around the screen, and
 * the active theme on the root element (D-70). `main.tsx` applies both once
 * before the first render; this keeps the language on every later switch, and
 * the shell keeps the theme (R156, `useThemeTick.ts`) — the store is the one
 * source of the choice.
 */
export function AppRoot() {
  const locale = useAppStore((s) => s.locale);
  // R93 (D-545): the settings chunk is fetched once the browser is idle after first paint, so the link's tap does not wait on it.
  useEffect(prefetchSettingsWhenIdle, []);
  // R91 (FR-FAIL-5, D-544): the boundary outside the provider, so a render error anywhere below is a page.
  return (
    <RootBoundary>
      <I18nProvider locale={locale}>
        <App />
      </I18nProvider>
    </RootBoundary>
  );
}
