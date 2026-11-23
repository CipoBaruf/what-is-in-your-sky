import { createRef, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { I18nProvider, useLocale, useT } from '../i18n/useT';
import { isFaint } from '../lib/faint';
import { routeTitle, type RouteName } from '../lib/routeTitle';
import { isPassPageRoute, LIVE_HASH, observerFromLink, PASS_PAGE_HASH, passIdHash, resolvePassLink, routeOfHash, STARS_HASH } from '../lib/shareLinks';
import type { AppShortcutId } from '../lib/shortcuts';
import { formatClock, formatDate, formatShortClock } from '../lib/timeFormat';
import { catalogName, isFeatured, useAppStore } from '../state';
import { count } from '../state/measure';
import styles from './App.module.css';
import { RootBoundary } from './RootBoundary';
import { Banner } from './components/common/Banner';
import { Footer } from './components/common/Footer';
import { Header } from './components/common/Header';
import { PageNotices } from './components/common/VisitNotice';
import { ShortcutsOverlay } from './components/common/ShortcutsOverlay';
import { useLayoutMode } from './hooks/useLayoutMode';
import { useOwnObserver, usePageObserver } from './hooks/useOwnObserver';
import { PassList } from './components/passes/PassList';
import { useShortcuts } from './hooks/useShortcuts';
import { moveCursor, passIdAtCursor } from './components/passes/passCursor';
import { nextView } from './screens/chartViewDefault';
import { useLiveRoute } from './screens/LiveRoute';
import { PassDetail } from './screens/PassDetail';
import { findSelectedPass, usePassSelection, useSettingsRoute } from './screens/passSelection';
import { settingsShell } from './screens/SettingsRoute';
import { prefetchSettingsWhenIdle } from './screens/settingsChunk';
import { StarsPage, useStarsRoute } from './screens/StarsRoute';
import { close as closeRoute, landRoute, open as openRoute, useHash } from './navigation';
import { PassEmpty, PassTonight } from './screens/sky/pass/Empty';
import { Shell } from './Shell';
import { useVisitHand } from './components/guide/skychart/useChartHand';

/**
 * R32 (FR-LIVE-1, PLAN §11): the live page is its own lazy chunk, fetched the
 * first time it is shown; since R212 (FR-LAND-1) that is the first page. The
 * route is read from the hash beside the pass selection (D-13).
 */
const LivePage = lazy(() => import('./screens/Live').then((module) => ({ default: module.LivePage })));

/** R186: the live page's link notes (FR-VISIT-3), under the app's header on wide as the page's top row held them. */
const LIVE_NOTES = ['past', 'far'] as const;

/** R203 (D-1205): the pages with none of the moment's notes; the stars page's strip holds the example's line alone, on wide. */
const NO_NOTES = [] as const;

/** R129 (D-845): the settings header's `[ ← ]`, which the settings chunk focuses when it arrives. One app, one ref. */
const SETTINGS_BACK = createRef<HTMLButtonElement>();

/**
 * The app's four routes, each one `Shell` (R92): live, the first page (R212, FR-LAND-1, D-1230), the satellites
 * (`#pass`: a desk's pass page, a phone's list of tonight with the pass's sheet over it, D-1231), settings and, until
 * R222, the stars. The screens only write the observer to the store; the effects `main.tsx` starts load the elements
 * and drive the worker (PLAN §3: `src/ui` imports `src/state`, never `src/data` or `src/physics`). The route is the
 * hash (D-13). R35 (FR-DESK-4, D-73): the app's one `keydown` listener is mounted here, where the selection, the
 * route and the preferences are in scope at once.
 */
export function App() {
  // FR-LAND-1 (D-1230): before the first render reads it, the hash that names no route is `#live`.
  useState(landRoute);
  const t = useT();
  // R203 (FR-OPEN-6, D-1205): the example opens the pages while it is drawn, never after the fallback replaced it.
  const observer = usePageObserver();
  const own = useOwnObserver();
  const passes = useAppStore((s) => s.passes.passes);
  const locale = useLocale();
  const passesStatus = useAppStore((s) => s.passes.status);
  const { selectedId, link } = usePassSelection();
  const hash = useHash();
  const mode = useLayoutMode();
  const barePass = isPassPageRoute(hash);
  // D-1231: on a phone a pass is a sheet over the list, so it stacks on it and closes to it.
  const openPass = (passId: string): void => {
    openRoute(passIdHash(passId), undefined, { stack: mode === 'compact' && barePass });
  };
  const closePass = (): void => {
    closeRoute(mode === 'compact' ? PASS_PAGE_HASH : LIVE_HASH);
  };
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
   * the reader on their own satellites page. The comparison is the coordinates alone, as
   * R39's `#live` effect makes it — the label and the zone are filled in later
   * from the forecast and are not what identifies a place.
   */
  useEffect(() => {
    if (link === null || observer === null) return;
    const linked = observerFromLink(link);
    if (observer.lat === linked.lat && observer.lon === linked.lon && observer.altM === linked.altM) return;
    closeRoute(PASS_PAGE_HASH);
  }, [link, observer]);
  const live = useLiveRoute();
  // R52 (FR-COMP-2, D-184): the third route, read from the hash beside the other two.
  const settings = useSettingsRoute();
  // R115 (FR-STAR-3, D-756): the fourth, the stars page.
  const stars = useStarsRoute();
  // FR-LAND-1: a hash that arrives naming no route draws live; the shell's listener writes `#live` over it.
  const route: RouteName = routeOfHash(hash) ?? 'live';
  // FR-LAND-6, FR-CLEAN-14: on wide the satellites are the pass page; with no place there is no sky for it to draw.
  const passDesk = route === 'pass' && mode === 'wide' && observer !== null;
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
  // R189 (D-1102): the app's rows; the desk sky pages' rows are their layout's (`SkyViewLayout`'s `keys`).
  const actions: Record<AppShortcutId, () => boolean> = {
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
      if (selected === null && !passDesk) return false;
      closePass();
      return true;
    },
    live: () => {
      setHelpOpen(false);
      // R189: on the live page itself (a desk runs these keys there now) it is the page already, and a held instant stays.
      if (live.active) return helpOpen;
      openRoute(LIVE_HASH);
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
    theme: () => {
      setTheme(theme === 'night' ? 'dark' : 'night');
      return true;
    },
    help: () => {
      setHelpOpen(true);
      return true;
    },
  };
  // Not on the compact live page: it is a screen of its own with its own keys (R32, R33). R189 (FR-WIDE-9): on wide the
  // live page is a desk page like the other two, and `?`, `v`, `n` and the rest run there as they do on them.
  useShortcuts(actions, !live.active || mode === 'wide');
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
   * R92 (FR-A11Y-1, FR-A11Y-3; D-529, D-531): every route is one `Shell`, the same element in every branch
   * below, so the announcer and the focus that follows the route live across the change rather than being
   * remounted with it. What the tab calls it: a pass is named once it has resolved to a pass of the run.
   */
  const liveShown = route === 'live';
  // R190 (R186's note): the live page is mounted in a different shell either side of the wide breakpoint; its hand camera is the visit's.
  const liveHand = useVisitHand(liveShown);
  // FR-MEAS-2 (D-1147): a page opening is counted from the route hooks, once per load each (the sender drops a repeat).
  const passShown = selected !== null;
  useEffect(() => {
    if (passShown) count('pass_open');
    if (liveShown) count('live_open');
    if (stars.active) count('stars_open');
    if (settings.active) count('settings_open');
  }, [passShown, liveShown, stars.active, settings.active]);
  // The shortcuts overlay, over every page the keys run on.
  const overlay = helpOpen && (
    <ShortcutsOverlay
      onClose={() => {
        setHelpOpen(false);
      }}
    />
  );
  const routeKey = route === 'pass' && selected !== null ? `pass:${selected.id}` : route;
  const title = routeTitle(route, t, selected && { name: selected.name, time: `${formatDate(selected.start.t, timeZone, locale)} ${formatShortClock(selected.start.t, timeZone, locale, timeZone === null)}` });
  if (liveShown) {
    // The live page renders its own `banner` and `main` inside its grid (D-529); the fallback is a `main` of its own.
    // D-1023 (FR-X-2 as amended 2026-11-02): on a desk the footer's one row follows the page's one viewport, under the
    // fold (`Live.module.css`); on a phone the row is the controls sheet's last (`ControlsSheet`).
    // R186 (FR-WIDE-1, D-1098): on wide the live page is a page like the stars page — the app's header (`live` current
    // and the place; R212: no Back, it is the first page), the page in the shell's `main`, the footer under it; on a phone it is its own screen (D-529).
    if (mode === 'wide') {
      return (
        <Shell
          chrome="stars"
          routeKey={routeKey}
          title={title}
          banner={<Header page="live" context={observer?.label ?? null} inert={helpOpen} />}
          barInert={helpOpen}
          beforeMain={<PageNotices kinds={LIVE_NOTES} inert={helpOpen} />}
          mainProps={{ inert: helpOpen, className: styles.stars }}
          footer={<Footer inert={helpOpen} />}
          after={overlay}
        >
          <Suspense fallback={<p className={styles.starsLoading}>{t.live.loading}</p>}>
            <LivePage link={live.link} onLeave={live.leave} chartHand={liveHand} />
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
          <LivePage link={live.link} onLeave={live.leave} chartHand={liveHand} />
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
  if (settings.active) return <Shell routeKey={routeKey} title={title} {...settingsShell(t, { onLeave: settings.leave, backRef: SETTINGS_BACK }, { arriving: settingsArriving, onArriving: setSettingsArriving, place: own?.label ?? null })} />;
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
        barInert={helpOpen}
        beforeMain={<PageNotices kinds={NO_NOTES} visit={false} example={mode === 'wide'} inert={helpOpen} />}
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
  const notice =
    shareNotice === null ? null : (
      <Banner variant="info" testId="share-fallback">
        {shareNotice}
      </Banner>
    );
  /*
   * R186 (FR-WIDE-1, D-1098), v2.14.1 (FR-WIDE-1, FR-CLEAN-14 as amended; D-1134): on wide the satellites are a page
   * of the app's header — `page="pass"`, so `[ satellites ]` is the current link — the desk's shell with the pass list
   * in its rail, the footer. `[ ← ]` is the page's close (`Esc`, `[ × ]`): back, or the live page where the pass was
   * the load's. A bare `#pass` is the same page with no pass (`PassEmpty`). The hash is still `#pass=<id>` (D-13).
   */
  if (passDesk) {
    // D-1135 (FR-WIDE-1 as amended): the rail's list is tonight's passes, the open one `aria-current`; a row opens its pass in place.
    const passList = (
      <>
        {notice}
        <PassList onOpenPass={openPass} selectedPassId={selected?.id ?? null} onlyTonight />
      </>
    );
    return (
      <Shell
        chrome="pass"
        routeKey={routeKey}
        title={title}
        banner={<Header page="pass" context={observer.label} onBack={closePass} inert={helpOpen} />}
        barInert={helpOpen}
        beforeMain={<PageNotices kinds={NO_NOTES} inert={helpOpen} />}
        mainProps={{ inert: helpOpen, className: styles.stars, 'data-sky': 'pass' }}
        footer={<Footer inert={helpOpen} />}
        after={overlay}
      >
        {selected !== null ? <PassDetail key={selected.id} pass={selected} observer={observer} onClose={closePass} inert={helpOpen} passList={passList} /> : <PassEmpty observer={observer} passList={passList} settle={barePass} />}
      </Shell>
    );
  }
  // D-1231: the phone's satellites page, and either width's with no place to look from. Its Back is the tabs'.
  return (
    <Shell
      chrome="pass"
      routeKey={routeKey}
      title={title}
      banner={<Header page="pass" inert={inert} />}
      barInert={inert}
      beforeMain={<PageNotices kinds={NO_NOTES} inert={inert} />}
      mainProps={{ inert, className: styles.main }}
      footer={<Footer inert={inert} />}
      after={overlay}
    >
      <PassTonight observer={observer} notice={notice} selectedPassId={selected?.id ?? null} onOpenPass={openPass} />
      {/* R50 (F-8): keyed by the pass, so opening a second one is a new guide — its heading takes focus. */}
      {selected && observer && <PassDetail key={selected.id} pass={selected} observer={observer} onClose={closePass} inert={helpOpen} />}
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
